import { http } from './httpClient';

export interface AdminUser {
  id: string | number;
  name: string;
  email?: string | null;
  loginId?: string | null;
  role: string;
  roleName?: string;
  status: 'active' | 'inactive' | 'locked' | string;
  branch?: string | null;
  process?: string | null;
  createdAt?: string | null;
  lastLoginAt?: string | null;
}

export interface AdminUsersData {
  users: AdminUser[];
  total: number;
  source: string;
  hiddenFields: string[];
}

export interface AdminRole {
  role: string;
  name: string;
  permissions: string[];
}

export interface AdminRolesData {
  roles: AdminRole[];
  source: string;
}

export interface AdminPermissionsData {
  permissions: Array<{ permission: string; description: string }>;
  source: string;
}

export interface AdminRoleMatrixData {
  roles: Array<{ role: string; permissions: string[]; permissionCount: number; accessLevel: string }>;
  source: string;
}

export const getAdminUsers = (query: { search?: string; role?: string; status?: string; limit?: number }) =>
  http.get<AdminUsersData>('/api/admin/users', query);

export const getAdminRoles = () =>
  http.get<AdminRolesData>('/api/admin/roles');

export const getAdminPermissions = () =>
  http.get<AdminPermissionsData>('/api/admin/permissions');

export const getAdminRoleMatrix = () =>
  http.get<AdminRoleMatrixData>('/api/admin/role-matrix');
