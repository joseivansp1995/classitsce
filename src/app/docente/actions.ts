'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import type { ActionState } from '@/app/(auth)/actions';
import nodemailer from 'nodemailer';
import { toCapitalizedSentence, toNormalizedCode, toNormalizedEmail } from '@/utils/formatters/text-sanitizer';
import {
  checkRateLimit,
  logSecurityEvent,
} from '@/utils/security/rate-limiter';

// ============================================================================
// ESQUEMAS DE VALIDACIÓN CON ZOD
// ============================================================================

const CrearGrupoSchema = z.object({
  nombre: z
    .string()
    .min(3, 'El nombre de la materia debe tener al menos 3 caracteres.')
    .max(120, 'El nombre es demasiado largo.')
    .transform(toCapitalizedSentence),
  clave_materia: z
    .string()
    .min(2, 'Ingresa la clave oficial (ej. AED-1026).')
    .max(30, 'Clave demasiado larga.')
    .transform(toNormalizedCode),
  periodo: z
    .string()
    .min(4, 'Especifica el periodo escolar (ej. Ago - Dic 2026).')
    .transform((v) => v.trim()),
  calificacion_minima_aprobatoria: z.coerce
    .number()
    .min(0, 'Mínimo 0')
    .max(100, 'Máximo 100')
    .default(70),
  asistencia_minima_porcentaje: z.coerce
    .number()
    .min(0, 'Mínimo 0%')
    .max(100, 'Máximo 100%')
    .default(80),
});

const InvitarEstudianteGrupoSchema = z.object({
  grupo_id: z.string().uuid('ID de grupo inválido.'),
  email_estudiante: z
    .string()
    .email('Ingresa un correo electrónico válido.')
    .transform(toNormalizedEmail)
    .refine((val) => val.endsWith('@centla.tecnm.mx'), {
      message:
        'Restricción institucional: Solo se permiten correos con dominio @centla.tecnm.mx.',
    }),
});

/// ============================================================================
// FUNCIÓN AUXILIAR: ENVÍO DE CORREO INSTITUCIONAL VÍA GMAIL SMTP
// ============================================================================
async function enviarCorreoInvitacionInstitucional({
  emailDestino,
  nombreGrupo,
  claveMateria,
  nombreDocente,
  linkInvitacion,
  token,
}: {
  emailDestino: string;
  nombreGrupo: string;
  claveMateria: string;
  nombreDocente: string;
  linkInvitacion: string;
  token: string;
}): Promise<boolean> {
  const user = process.env.EMAIL_SERVER_USER;
  const pass = process.env.EMAIL_SERVER_PASSWORD;

  if (!user || !pass) {
    // Si no están configuradas las credenciales SMTP, opera en modo manual (copiar link)
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST || 'smtp.gmail.com',
      port: Number(process.env.EMAIL_SERVER_PORT) || 465,
      secure: true, // true para puerto 465, false para otros puertos
      auth: {
        user,
        pass,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"ClassITSCe" <${user}>`,
      to: emailDestino,
      subject: `[ClassITSCe] Invitación al curso: ${nombreGrupo} (${claveMateria})`,
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 540px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: #1B396A; color: #ffffff; padding: 24px;">
            <span style="display: inline-block; background: rgba(255,255,255,0.12); padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; margin-bottom: 8px;">
              TecNM Campus Centla • ClassITSCe
            </span>
            <h2 style="margin: 0; font-size: 20px; font-weight: 700;">
              Invitación a Grupo Académico
            </h2>
          </div>

          <div style="padding: 24px; color: #1e293b; font-size: 14px; line-height: 1.6;">
            <p style="margin-top: 0;">Hola <strong>${emailDestino}</strong>,</p>
            <p>
              El docente <strong>${nombreDocente}</strong> te ha invitado a matricularte en la asignatura:
            </p>

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin: 16px 0;">
              <div style="font-weight: 700; color: #1B396A; font-size: 15px;">${nombreGrupo}</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Clave: ${claveMateria}</div>
            </div>

            <p style="margin: 24px 0; text-align: center;">
              <a href="${linkInvitacion}" style="background-color: #1B396A; color: #ffffff; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px; display: inline-block;">
                Completar Registro e Ingresar al Aula
              </a>
            </p>

            <p style="font-size: 12px; color: #64748b; margin-bottom: 4px;">
              O utiliza este Token UUID en la pantalla de registro:
            </p>
            <div style="font-family: monospace; font-size: 12px; background: #f1f5f9; padding: 8px 12px; border-radius: 8px; color: #334155; word-break: break-all;">
              ${token}
            </div>
          </div>

          <div style="background-color: #f8fafc; padding: 14px 24px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
            Plataforma Académica Institucional ClassITSCe • Exclusivo para cuentas @centla.tecnm.mx
          </div>
        </div>
      `,
    });

    return true;
  } catch (error) {
    console.error('Error al enviar correo por SMTP de Gmail:', error);
    return false;
  }
}

// ============================================================================
// 1. CREAR NUEVO GRUPO ACADÉMICO
// ============================================================================
export async function crearGrupoAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const parsed = CrearGrupoSchema.safeParse({
    nombre: formData.get('nombre'),
    clave_materia: formData.get('clave_materia'),
    periodo: formData.get('periodo'),
    calificacion_minima_aprobatoria: formData.get(
      'calificacion_minima_aprobatoria'
    ),
    asistencia_minima_porcentaje: formData.get('asistencia_minima_porcentaje'),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Por favor verifica los datos del grupo.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Sesión no válida.' };
  }

  const {
    nombre,
    clave_materia,
    periodo,
    calificacion_minima_aprobatoria,
    asistencia_minima_porcentaje,
  } = parsed.data;

  const { error } = await supabase.from('grupos').insert({
    nombre,
    clave_materia,
    periodo,
    docente_id: user.id,
    calificacion_minima_aprobatoria,
    asistencia_minima_porcentaje,
    activo: true,
  });

  if (error) {
    return {
      success: false,
      message: 'No fue posible crear el grupo. Verifica tus permisos.',
    };
  }

  revalidatePath('/docente');
  return {
    success: true,
    message: `Grupo "${nombre}" (${clave_materia}) creado exitosamente.`,
  };
}

// ============================================================================
// HELPER INTERNO DE SEGURIDAD (PREVENCIÓN IDOR)
// ============================================================================

/**
 * Consulta la base de datos y confirma que el usuario autenticado sea el docente titular del grupo.
 */
async function verificarDocenteTitular(
  supabase: any,
  grupoId: string,
  userId: string
): Promise<{ valido: boolean; message?: string; grupo?: any }> {
  const { data: grupo, error } = await supabase
    .from('grupos')
    .select('id, docente_id, nombre, clave_materia')
    .eq('id', grupoId)
    .single();

  if (error || !grupo || grupo.docente_id !== userId) {
    return {
      valido: false,
      message: 'Acceso denegado: no eres el docente titular de este grupo.',
    };
  }

  return { valido: true, grupo };
}

// ============================================================================
// 2. INVITAR O MATRICULAR ESTUDIANTE (@centla.tecnm.mx) + ENVÍO DE CORREO
// ============================================================================
export async function invitarEstudianteGrupoAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const parsed = InvitarEstudianteGrupoSchema.safeParse({
    grupo_id: formData.get('grupo_id'),
    email_estudiante: formData.get('email_estudiante'),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Correo institucional inválido.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Sesión expirada.' };
  }

  // Control 12: Rate limit de 15 invitaciones por minuto por docente
  const rateLimitKey = `invitar:${user.id}`;
  const rateCheck = checkRateLimit(rateLimitKey, 15, 60 * 1000);

  if (!rateCheck.allowed) {
    logSecurityEvent('RATE_LIMIT_EXCEEDED', {
      action: 'invitar_estudiante',
      docenteId: user.id,
      grupoId: parsed.data.grupo_id,
      retryAfterSeconds: rateCheck.retryAfterSeconds,
    });

    return {
      success: false,
      message:
        'Has alcanzado el límite de invitaciones por minuto. Espera un momento antes de enviar más.',
    };
  }

  const { grupo_id, email_estudiante } = parsed.data;

  // Blindaje estricto de titularidad docente (prevención IDOR)
  const authDocente = await verificarDocenteTitular(supabase, grupo_id, user.id);
  if (!authDocente.valido) {
    return {
      success: false,
      message: authDocente.message || 'Acceso denegado: no eres el docente titular de este grupo.',
    };
  }
  const grupoInfo = authDocente.grupo;

  // Consultar en paralelo perfil del docente y si el alumno ya existe
  const [
    { data: docenteInfo },
    { data: existingStudent },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('nombre_completo')
      .eq('id', user.id)
      .single(),
    supabase
      .from('profiles')
      .select('id, nombre_completo, rol')
      .eq('email', email_estudiante)
      .maybeSingle(),
  ]);

  // 1. Si el estudiante ya tiene una cuenta creada en ClassITSCe, matricularlo directo
  if (existingStudent) {
    if (existingStudent.rol !== 'estudiante') {
      return {
        success: false,
        message:
          'Este correo pertenece a un Docente o Administrador, no a un Estudiante.',
      };
    }

    const { error: matriculaError } = await supabase.from('matriculas').insert({
      grupo_id,
      estudiante_id: existingStudent.id,
    });

    if (matriculaError) {
      return {
        success: false,
        message: 'El estudiante ya se encuentra matriculado en este grupo.',
      };
    }

    await supabase.from('invitaciones').upsert(
      {
        grupo_id,
        docente_id: user.id,
        email_estudiante,
        estado: 'aceptada',
      },
      { onConflict: 'grupo_id,email_estudiante' }
    );

    revalidatePath(`/docente/grupos/${grupo_id}`);
    return {
      success: true,
      message: `El alumno ${existingStudent.nombre_completo} ya tenía cuenta en ClassITSCe y fue matriculado automáticamente en el grupo.`,
      data: { matriculadoDirecto: true },
    };
  }

  // 2. Si el estudiante aún no tiene cuenta, generar token de invitación en Supabase
  const { data: invitacion, error: invError } = await supabase
    .from('invitaciones')
    .insert({
      grupo_id,
      docente_id: user.id,
      email_estudiante,
      estado: 'pendiente',
    })
    .select('token')
    .single();

  if (invError || !invitacion) {
    return {
      success: false,
      message:
        'Ya existe una invitación pendiente para este correo en este grupo.',
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const linkInvitacion = `${baseUrl}/registro?token=${invitacion.token}&email=${encodeURIComponent(
    email_estudiante
  )}`;

  // 3. Intentar envío automático por correo (Resend API)
  const correoEnviado = await enviarCorreoInvitacionInstitucional({
    emailDestino: email_estudiante,
    nombreGrupo: grupoInfo?.nombre || 'Asignatura Institucional',
    claveMateria: grupoInfo?.clave_materia || 'TecNM',
    nombreDocente: docenteInfo?.nombre_completo || 'Docente Titular',
    linkInvitacion,
    token: invitacion.token,
  });

  revalidatePath(`/docente/grupos/${grupo_id}`);
  return {
    success: true,
    message: correoEnviado
      ? `¡Invitación enviada automáticamente al correo ${email_estudiante}! También puedes copiar el enlace abajo.`
      : 'Invitación generada. Comparte el enlace o token con el estudiante para que complete su registro.',
    data: {
      matriculadoDirecto: false,
      correoEnviado,
      linkInvitacion,
      token: invitacion.token,
    },
  };
}

// ============================================================================
// 4. EDITAR Y ELIMINAR GRUPO ACADÉMICO (DOCENTE TITULAR)
// ============================================================================

const EditarGrupoSchema = z.object({
  grupo_id: z.string().uuid('ID de grupo inválido.'),
  nombre: z
    .string()
    .min(3, 'El nombre de la materia debe tener al menos 3 caracteres.')
    .max(120, 'El nombre es demasiado largo.')
    .transform(toCapitalizedSentence),
  clave_materia: z
    .string()
    .min(2, 'Ingresa la clave oficial.')
    .max(30, 'Clave demasiado larga.')
    .transform(toNormalizedCode),
  periodo: z
    .string()
    .min(4, 'Especifica el periodo escolar.')
    .transform((v) => v.trim()),
  calificacion_minima_aprobatoria: z.coerce
    .number()
    .min(0, 'Mínimo 0')
    .max(100, 'Máximo 100')
    .default(70),
  asistencia_minima_porcentaje: z.coerce
    .number()
    .min(0, 'Mínimo 0%')
    .max(100, 'Máximo 100%')
    .default(80),
});

export async function editarGrupoAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const parsed = EditarGrupoSchema.safeParse({
    grupo_id: formData.get('grupo_id'),
    nombre: formData.get('nombre'),
    clave_materia: formData.get('clave_materia'),
    periodo: formData.get('periodo'),
    calificacion_minima_aprobatoria: formData.get(
      'calificacion_minima_aprobatoria'
    ),
    asistencia_minima_porcentaje: formData.get('asistencia_minima_porcentaje'),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Revisa los campos del formulario.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Sesión no válida o expirada.' };
  }

  const {
    grupo_id,
    nombre,
    clave_materia,
    periodo,
    calificacion_minima_aprobatoria,
    asistencia_minima_porcentaje,
  } = parsed.data;

  // Verificar que el docente autenticado sea el titular del grupo (prevención IDOR)
  const authDocente = await verificarDocenteTitular(supabase, grupo_id, user.id);
  if (!authDocente.valido) {
    return {
      success: false,
      message: authDocente.message || 'No tienes permisos de docente titular para editar este grupo.',
    };
  }

  const { error: updateError } = await supabase
    .from('grupos')
    .update({
      nombre,
      clave_materia,
      periodo,
      calificacion_minima_aprobatoria,
      asistencia_minima_porcentaje,
    })
    .eq('id', grupo_id)
    .eq('docente_id', user.id);

  if (updateError) {
    return {
      success: false,
      message: 'Error al actualizar los datos del grupo.',
    };
  }

  revalidatePath('/docente');
  revalidatePath(`/docente/grupos/${grupo_id}`);
  revalidatePath(`/estudiante/grupos/${grupo_id}`);

  return {
    success: true,
    message: 'Grupo actualizado correctamente.',
  };
}

export async function eliminarGrupoAction(
  grupoId: string
): Promise<{ success: boolean; message: string }> {
  if (!grupoId) {
    return { success: false, message: 'ID de grupo inválido.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Sesión no válida o expirada.' };
  }

  // Verificar titularidad docente (prevención IDOR)
  const authDocente = await verificarDocenteTitular(supabase, grupoId, user.id);
  if (!authDocente.valido) {
    return {
      success: false,
      message: authDocente.message || 'No tienes permisos de docente titular para eliminar este grupo.',
    };
  }
  const grupoRow = authDocente.grupo;

  const { error: deleteError } = await supabase
    .from('grupos')
    .delete()
    .eq('id', grupoId)
    .eq('docente_id', user.id);

  if (deleteError) {
    return {
      success: false,
      message:
        'No se pudo eliminar el grupo. Verifica si existen registros dependientes.',
    };
  }

  revalidatePath('/docente');

  return {
    success: true,
    message: `El grupo "${grupoRow.nombre}" fue eliminado exitosamente.`,
  };
}

