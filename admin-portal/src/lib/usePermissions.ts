import { useAdminAuthStore } from '@/store/auth.store';
import { allows, type AccessLevel, type ModuleKey } from '@/config/permissions';

/** What the signed-in staff member may do. Super admins can do everything. */
export function usePermissions() {
  const admin = useAdminAuthStore((s) => s.admin);
  const isSuperAdmin = !!admin?.isSuperAdmin;
  const can = (module: ModuleKey, level: AccessLevel = 'view') =>
    isSuperAdmin || allows(admin?.permissions?.[module], level);
  return { can, isSuperAdmin };
}
