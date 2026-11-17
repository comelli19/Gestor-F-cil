const TOKEN_STORAGE_KEY = 'gestor_facil_token';
let memoryToken: string | null = null;

export function getStoredToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    const ls = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (ls) {
      memoryToken = ls;
      return ls;
    }
  } catch {
    // ignore storage failures
  }
  try {
    const ss = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (ss) {
      memoryToken = ss;
      return ss;
    }
  } catch {
    // ignore storage failures
  }
  return null;
}

export function setStoredToken(token: string | null): void {
  memoryToken = token;
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage failures
  }
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage failures
  }
}

const ADMIN_PREVIEW_KEY = 'gestor_facil_admin_company_id';
let memoryAdminCompanyId: string | null = null;

export function getAdminPreviewCompanyId(): string | null {
  if (memoryAdminCompanyId) return memoryAdminCompanyId;
  try {
    const ss = sessionStorage.getItem(ADMIN_PREVIEW_KEY);
    if (ss) {
      memoryAdminCompanyId = ss;
      return ss;
    }
  } catch {
    // ignore storage failures
  }
  return null;
}

export function setAdminPreviewCompanyId(companyId: string | null): void {
  memoryAdminCompanyId = companyId;
  try {
    if (companyId) {
      sessionStorage.setItem(ADMIN_PREVIEW_KEY, companyId);
    } else {
      sessionStorage.removeItem(ADMIN_PREVIEW_KEY);
    }
  } catch {
    // ignore storage failures
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string | null;
    adminCompanyId?: string | null;
  } = {}
): Promise<T> {
  const token = options.token !== undefined ? options.token : getStoredToken();
  const adminCompanyId =
    options.adminCompanyId !== undefined ? options.adminCompanyId : getAdminPreviewCompanyId();
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (adminCompanyId) {
    headers['X-Admin-Company-Id'] = adminCompanyId;
  }

  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.error || `Erro HTTP ${res.status}`);
  }
  return data as T;
}
