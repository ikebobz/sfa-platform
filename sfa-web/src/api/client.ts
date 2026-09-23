const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1";

export class ApiClientError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

function getAccessToken(): string | null {
  return localStorage.getItem("sfa_access_token");
}

export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {}
): Promise<T> {
  const url = new URL(API_BASE + path);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const token = getAccessToken();
  const res = await fetch(url.toString(), {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiClientError(res.status, payload.message || "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * Downloads a file from an authenticated endpoint (e.g. a CSV export) and saves it
 * client-side. A plain <a href="..."> can't carry the Authorization header, so this
 * fetches as a blob and triggers the save via a temporary object URL instead.
 */
export async function apiDownload(
  path: string,
  query: Record<string, string | number | undefined> = {},
  filename?: string
): Promise<void> {
  const url = new URL(API_BASE + path);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const token = getAccessToken();
  const res = await fetch(url.toString(), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiClientError(res.status, payload.message || "Download failed");
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename || path.split("/").pop() || "download";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
