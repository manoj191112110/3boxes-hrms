'use client';

import { useAuthStore } from '@/store/authStore';
import { FiShield } from 'react-icons/fi';

interface RoleAccessGuardProps {
  allowedRoles: string[];
  moduleKey?: string;
  action?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function RoleAccessGuard({ allowedRoles, moduleKey, action, children, fallback }: RoleAccessGuardProps) {
  const { user, hasPermission, canAccessModule } = useAuthStore();

  // Super admin always has access
  if (user?.role === 'super_admin') return <>{children}</>;

  // Check role-based access
  if (!allowedRoles.includes(user?.role || '')) {
    return fallback ? <>{fallback}</> : (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <FiShield className="w-16 h-16 text-thb-text-muted" />
        <h2 className="text-xl font-semibold text-thb-text-primary">Access Restricted</h2>
        <p className="text-thb-text-secondary text-center max-w-md">You don&apos;t have permission to access this section. Contact your administrator for access.</p>
      </div>
    );
  }

  // Check module-level permission if moduleKey provided
  if (moduleKey && !canAccessModule(moduleKey)) {
    // Fallback to role-based if RBAC permissions not loaded yet
    if (!allowedRoles.includes(user?.role || '')) {
      return fallback ? <>{fallback}</> : (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <FiShield className="w-16 h-16 text-thb-text-muted" />
          <h2 className="text-xl font-semibold text-thb-text-primary">Access Restricted</h2>
          <p className="text-thb-text-secondary text-center max-w-md">You don&apos;t have permission to access this module.</p>
        </div>
      );
    }
  }

  // Check specific action permission if provided
  if (moduleKey && action && !hasPermission(moduleKey, action)) {
    return fallback ? <>{fallback}</> : (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <FiShield className="w-16 h-16 text-thb-text-muted" />
        <h2 className="text-xl font-semibold text-thb-text-primary">Access Restricted</h2>
        <p className="text-thb-text-secondary text-center max-w-md">You don&apos;t have permission for this action.</p>
      </div>
    );
  }

  return <>{children}</>;
}
