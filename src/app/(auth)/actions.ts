'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import type { UserRole } from '@/types/database';
import { toTitleCase, toNormalizedEmail } from '@/utils/formatters/text-sanitizer';

// ============================================================================
// ESQUEMAS DE VALIDACIÓN CON ZOD
// ============================================================================

const LoginSchema = z.object({
  email: z
    .string()
    .email('Ingresa un correo electrónico válido.')
    .transform(toNormalizedEmail),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
});

const RegistroEstudianteInvitacionSchema = z.object({
  token: z.string().uuid('El código de invitación no tiene un formato válido.'),
  nombre_completo: z
    .string()
    .min(3, 'Ingresa tu nombre completo (mínimo 3 caracteres).')
    .max(120, 'El nombre es demasiado largo.')
    .transform(toTitleCase),
  email: z
    .string()
    .email('Correo electrónico inválido.')
    .transform(toNormalizedEmail)
    .refine((val) => val.endsWith('@centla.tecnm.mx'), {
      message:
        'Exclusivo para estudiantes con correo institucional (@centla.tecnm.mx).',
    }),
  password: z
    .string()
    .min(8, 'La contraseña debe tener mínimo 8 caracteres.'),
});

const CrearDocentePorAdminSchema = z.object({
  nombre_completo: z
    .string()
    .min(3, 'El nombre completo es obligatorio.')
    .transform(toTitleCase),
  email: z
    .string()
    .email('Correo electrónico inválido.')
    .transform(toNormalizedEmail),
  password_temporal: z
    .string()
    .min(8, 'La contraseña temporal debe tener al menos 8 caracteres.'),
});

const InvitarEstudianteSchema = z.object({
  grupo_id: z.string().uuid('ID de grupo inválido.'),
  email_estudiante: z
    .string()
    .email('Correo inválido.')
    .transform(toNormalizedEmail)
    .refine((val) => val.endsWith('@centla.tecnm.mx'), {
      message: 'Solo se puede invitar a correos con dominio @centla.tecnm.mx.',
    }),
});

export type ActionState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
  data?: Record<string, unknown>;
};

// ============================================================================
// 1. INICIO DE SESIÓN (TODOS LOS ROLES)
// ============================================================================
export async function loginAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Revisa los campos del formulario.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

  if (authError || !authData.user) {
    return {
      success: false,
      message: 'Credenciales incorrectas o cuenta no registrada.',
    };
  }

  // Consultar el rol para redirigir al panel correspondiente
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('rol, activo')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile || !profile.activo) {
    await supabase.auth.signOut();
    return {
      success: false,
      message: 'Tu cuenta se encuentra desactivada o sin perfil asignado.',
    };
  }

  const roleRoutes: Record<UserRole, string> = {
    admin: '/admin',
    docente: '/docente',
    estudiante: '/estudiante',
  };

  revalidatePath('/', 'layout');
  redirect(roleRoutes[profile.rol as UserRole]);
}

// ============================================================================
// 2. REGISTRO DE ESTUDIANTE POR INVITACIÓN DEL DOCENTE (@centla.tecnm.mx)
// ============================================================================
export async function registrarEstudiantePorInvitacionAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const parsed = RegistroEstudianteInvitacionSchema.safeParse({
    token: formData.get('token'),
    nombre_completo: formData.get('nombre_completo'),
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Error de validación en los datos ingresados.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { token, nombre_completo, email, password } = parsed.data;
  const adminSupabase = createAdminClient();

  // 1. Verificar que la invitación exista, esté pendiente, no haya expirado y coincida con el correo
  const { data: invitacion, error: invError } = await adminSupabase
    .from('invitaciones')
    .select('id, grupo_id, email_estudiante, estado, expires_at')
    .eq('token', token)
    .single();

  if (invError || !invitacion) {
    return {
      success: false,
      message: 'El enlace de invitación no existe o es inválido.',
    };
  }

  if (invitacion.estado !== 'pendiente') {
    return {
      success: false,
      message: 'Esta invitación ya fue utilizada o revocada anteriormente.',
    };
  }

  if (new Date(invitacion.expires_at) < new Date()) {
    await adminSupabase
      .from('invitaciones')
      .update({ estado: 'expirada' })
      .eq('id', invitacion.id);

    return {
      success: false,
      message: 'La invitación ha expirado. Solicita una nueva a tu docente.',
    };
  }

  if (invitacion.email_estudiante.toLowerCase() !== email) {
    return {
      success: false,
      message:
        'El correo ingresado no coincide con el correo institucional al que fue enviada la invitación.',
    };
  }

  // 2. Crear la cuenta del estudiante en Supabase Auth (confirmando email ya que viene por invitación)
  const { data: newAuthUser, error: createUserError } =
    await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre_completo, rol: 'estudiante' },
    });

  if (createUserError || !newAuthUser.user) {
    return {
      success: false,
      message:
        createUserError?.message ||
        'No fue posible crear el usuario. Verifica si ya tienes una cuenta.',
    };
  }

  const estudianteId = newAuthUser.user.id;

  // 3. Crear registro en public.profiles (cumpliendo chk_dominio_estudiante)
  const { error: profileInsertError } = await adminSupabase
    .from('profiles')
    .insert({
      id: estudianteId,
      nombre_completo,
      email,
      rol: 'estudiante',
      activo: true,
    });

  if (profileInsertError) {
    // Rollback en caso de fallo
    await adminSupabase.auth.admin.deleteUser(estudianteId);
    return {
      success: false,
      message: 'Error al generar el perfil académico del estudiante.',
    };
  }

  // 4. Matricular automáticamente al estudiante en el grupo y marcar invitación como aceptada
  await adminSupabase.from('matriculas').insert({
    grupo_id: invitacion.grupo_id,
    estudiante_id: estudianteId,
  });

  await adminSupabase
    .from('invitaciones')
    .update({ estado: 'aceptada' })
    .eq('id', invitacion.id);

  // 5. Iniciar sesión automáticamente para el estudiante recién registrado
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password });

  revalidatePath('/', 'layout');
  redirect('/estudiante');
}

// ============================================================================
// 3. ALTA DE DOCENTES (EXCLUSIVO PARA ROL ADMINISTRADOR)
// ============================================================================
export async function registrarDocentePorAdminAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();

  // Verificar sesión y confirmar que quien llama sea estrictamente 'admin'
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Sesión no válida.' };
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (!callerProfile || callerProfile.rol !== 'admin') {
    return {
      success: false,
      message: 'Acceso denegado: Solo el Administrador puede registrar docentes.',
    };
  }

  const parsed = CrearDocentePorAdminSchema.safeParse({
    nombre_completo: formData.get('nombre_completo'),
    email: formData.get('email'),
    password_temporal: formData.get('password_temporal'),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Datos de docente inválidos.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { nombre_completo, email, password_temporal } = parsed.data;
  const adminSupabase = createAdminClient();

  // Crear usuario en Auth
  const { data: docenteAuth, error: authError } =
    await adminSupabase.auth.admin.createUser({
      email,
      password: password_temporal,
      email_confirm: true,
      user_metadata: { nombre_completo, rol: 'docente' },
    });

  if (authError || !docenteAuth.user) {
    console.error('Error al registrar cuenta del docente:', authError);
    return {
      success: false,
      message: 'No fue posible registrar la cuenta del docente. Verifica que el correo institucional no se encuentre registrado previamente.',
    };
  }

  // Insertar el perfil con rol 'docente'
  const { error: profileError } = await adminSupabase.from('profiles').insert({
    id: docenteAuth.user.id,
    nombre_completo,
    email,
    rol: 'docente',
    activo: true,
  });

  if (profileError) {
    await adminSupabase.auth.admin.deleteUser(docenteAuth.user.id);
    return {
      success: false,
      message: 'Error al guardar el perfil del docente en la base de datos.',
    };
  }

  revalidatePath('/admin');
  return {
    success: true,
    message: `Docente ${nombre_completo} registrado exitosamente.`,
  };
}

// ============================================================================
// 4. GENERAR INVITACIÓN PARA ESTUDIANTE (EXCLUSIVO PARA DOCENTE TITULAR)
// ============================================================================
export async function generarInvitacionEstudianteAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const parsed = InvitarEstudianteSchema.safeParse({
    grupo_id: formData.get('grupo_id'),
    email_estudiante: formData.get('email_estudiante'),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Revisa el correo institucional del estudiante.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'No autenticado.' };
  }

  const { grupo_id, email_estudiante } = parsed.data;

  // Insertar invitación usando la sesión del Docente (protegida por la política RLS de invitaciones)
  const { data: nuevaInvitacion, error } = await supabase
    .from('invitaciones')
    .insert({
      grupo_id,
      docente_id: user.id,
      email_estudiante,
    })
    .select('token')
    .single();

  if (error || !nuevaInvitacion) {
    return {
      success: false,
      message:
        'No se pudo crear la invitación. Verifica que el estudiante no haya sido invitado ya a este grupo.',
    };
  }

  const linkInvitacion = `${process.env.NEXT_PUBLIC_SITE_URL}/registro?token=${nuevaInvitacion.token}&email=${encodeURIComponent(email_estudiante)}`;

  revalidatePath(`/docente/grupos/${grupo_id}`);
  return {
    success: true,
    message: 'Invitación generada correctamente.',
    data: { linkInvitacion, token: nuevaInvitacion.token },
  };
}

// ============================================================================
// 5. CIERRE DE SESIÓN
// ============================================================================
export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}