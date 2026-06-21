import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasPermission, type Permission } from './permissions';
import { getUserRole } from './roleMap';

export default function RoleGuard({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const role = getUserRole(user);

  if (!hasPermission(role, permission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
