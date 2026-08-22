/**
 * Thin fetch wrapper for the GlobeTrotter API.
 * Vite proxies /api to the server in dev (see vite.config.ts).
 */

const TOKEN_KEY = 'globetrotter.token';

export const auth = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = auth.get();

  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, body.error ?? res.statusText, body.details);
  }
  return body as T;
}

/**
 * Multipart upload for the avatar and trip-cover endpoints.
 * Content-Type is deliberately omitted so the browser sets the multipart
 * boundary itself — setting it by hand produces a request multer cannot parse.
 */
async function upload<T>(path: string, file: File | Blob): Promise<T> {
  const token = auth.get();
  const body = new FormData();
  body.append('image', file);

  const res = await fetch(`/api${path}`, {
    method: 'POST',
    body,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, payload.error ?? res.statusText, payload.details);
  return payload as T;
}

export const api = {
  get: <T>(path: string, init?: RequestInit) => request<T>(path, init),
  upload,
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
