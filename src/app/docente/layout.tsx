import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import DashboardShell from '@/components/layout/DashboardShell';
import type { UserProfile } from '@/types/database';

export default async function DocenteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, nombre_completo, email, rol, activo')
    .eq('id', user.id)
    .single();

  if (!profile || profile.rol !== 'docente') {
    redirect('/login');
  }

  return (
    <DashboardShell profile={profile as UserProfile}>{children}</DashboardShell>
  );
}