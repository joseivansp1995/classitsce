export type UserRole = 'admin' | 'docente' | 'estudiante';

export interface UserProfile {
  id: string;
  nombre_completo: string;
  email: string;
  rol: UserRole;
  activo: boolean;
  created_at: string;
}