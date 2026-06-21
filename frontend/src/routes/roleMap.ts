import type { LoginUser } from '../api/authApi';

export const ROLES = [
  'SUPER_ADMIN',
  'CEO',
  'HO_QA',
  'HO_OPERATIONS',
  'QUALITY_MANAGER',
  'OPERATIONS_MANAGER',
  'PROCESS_MANAGER',
  'BRANCH_MANAGER',
  'TEAM_LEADER',
  'QUALITY_ANALYST',
  'TRAINER',
  'HR_ADMIN',
  'PAYROLL_ADMIN',
  'ANALYST',
  'VIEWER',
] as const;

export type AppRole = typeof ROLES[number];

const ROLE_ALIASES: Record<string, AppRole> = {
  admin: 'SUPER_ADMIN',
  super_admin: 'SUPER_ADMIN',
  superadmin: 'SUPER_ADMIN',
  administrator: 'SUPER_ADMIN',
  qa_admin: 'HO_QA',
  tq_head: 'HO_QA',
  ho_qa: 'HO_QA',
  qa_head: 'HO_QA',
  ops_head: 'HO_OPERATIONS',
  ho_operations: 'HO_OPERATIONS',
  manager: 'OPERATIONS_MANAGER',
  ops_manager: 'OPERATIONS_MANAGER',
  operations_manager: 'OPERATIONS_MANAGER',
  quality_manager: 'QUALITY_MANAGER',
  process_manager: 'PROCESS_MANAGER',
  branch_manager: 'BRANCH_MANAGER',
  branch_head: 'BRANCH_MANAGER',
  tl: 'TEAM_LEADER',
  team_leader: 'TEAM_LEADER',
  quality_analyst: 'QUALITY_ANALYST',
  qa: 'QUALITY_ANALYST',
  trainer: 'TRAINER',
  hr_admin: 'HR_ADMIN',
  payroll_admin: 'PAYROLL_ADMIN',
  agent: 'ANALYST',
  analyst: 'ANALYST',
  viewer: 'VIEWER',
  ceo: 'CEO',
};

export function normalizeRole(roleCode?: unknown): AppRole {
  const raw = String(roleCode || '').trim();
  if (!raw) return 'VIEWER';
  const upper = raw.toUpperCase();
  if ((ROLES as readonly string[]).includes(upper)) return upper as AppRole;
  return ROLE_ALIASES[raw.toLowerCase()] || 'VIEWER';
}

export function getUserRole(user: LoginUser | null | undefined): AppRole {
  return normalizeRole(user?.role_code ?? user?.role ?? user?.role_name);
}

export function getDefaultRouteForRole(role: AppRole): string {
  switch (role) {
    case 'HO_QA':
    case 'QUALITY_MANAGER':
      return '/quality';
    case 'OPERATIONS_MANAGER':
      return '/sales-funnel';
    case 'TEAM_LEADER':
      return '/analysts';
    case 'QUALITY_ANALYST':
      return '/risk';
    case 'TRAINER':
      return '/tni';
    case 'HR_ADMIN':
      return '/admin';
    case 'PAYROLL_ADMIN':
      return '/settings';
    case 'ANALYST':
      return '/profile';
    case 'SUPER_ADMIN':
    case 'CEO':
    case 'HO_OPERATIONS':
    case 'PROCESS_MANAGER':
    case 'BRANCH_MANAGER':
    case 'VIEWER':
    default:
      return '/command-center';
  }
}

export function getDisplayName(user: LoginUser | null | undefined): string {
  return String(user?.full_name || user?.name || user?.login_id || 'Operator');
}
