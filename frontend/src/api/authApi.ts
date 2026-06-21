/**
 * Auth API — login + token management.
 *
 * Backend contract (qaAuthController.ts):
 *   POST /api/qa-auth/login
 *   Request:  { login_id: string, password: string }
 *   Response: { success: true, token: string, user: { ... } }
 *
 * NOTE: Never log password or token. Token stored in localStorage; cleared on logout.
 */

import { configureHttp } from './httpClient';

const TOKEN_STORAGE_KEY = 'cmiq.token';
const USER_STORAGE_KEY = 'cmiq.user';

export interface LoginRequest {
  login_id: string;
  password: string;
}

export interface LoginUser {
  id?: number | string;
  user_id?: number | string;
  login_id?: string;
  email?: string;
  name?: string;
  full_name?: string;
  role_code?: string;
  role?: string;
  role_name?: string;
  branch_short_name?: string | null;
  process_name?: string | null;
  team_id?: string | number | null;
  employee_code?: string | null;
  [k: string]: unknown;
}

export interface LoginResponse {
  token: string;
  user?: LoginUser;
}

export function loadStoredToken(): { token: string | null; user: LoginUser | null } {
  try {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const userRaw = localStorage.getItem(USER_STORAGE_KEY);
    const user = userRaw ? (JSON.parse(userRaw) as LoginUser) : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

export function storeSession(token: string, user?: LoginUser): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  if (user) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  configureHttp({ token });
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
  configureHttp({ token: null });
}

export async function login(req: LoginRequest): Promise<
  | { ok: true; token: string; user?: LoginUser }
  | { ok: false; status: number; code?: string; message: string }
> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5050';
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/qa-auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(req),
    });
  } catch (err: any) {
    return { ok: false, status: 0, code: 'NETWORK_ERROR', message: err?.message || 'Network error' };
  }

  let body: any = null;
  try {
    body = await response.json();
  } catch {
    return { ok: false, status: response.status, message: 'Non-JSON response from server' };
  }

  if (!response.ok || body?.success === false) {
    return {
      ok: false,
      status: response.status,
      code: body?.code,
      message: body?.message || `Login failed (HTTP ${response.status})`,
    };
  }

  const token = body?.token;
  if (!token) {
    return { ok: false, status: response.status, message: 'Login succeeded but no token returned' };
  }

  return { ok: true, token, user: body?.user };
}

export function logout(): void {
  clearSession();
}
