// Lightweight typed API client for the gateway. Attaches the access token,
// transparently refreshes it once on 401, and surfaces the backend error
// envelope as thrown ApiError instances.

const API_URL = import.meta.env.VITE_API_URL || "/api";

const ACCESS_KEY = "av_access";
const REFRESH_KEY = "av_refresh";

export const tokenStore = {
  access: () => localStorage.getItem(ACCESS_KEY),
  refresh: () => localStorage.getItem(REFRESH_KEY),
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json();
    const e = body?.error;
    if (e) return new ApiError(res.status, e.code ?? "error", e.message ?? "request failed");
  } catch {
    /* ignore */
  }
  return new ApiError(res.status, "error", res.statusText || "request failed");
}

async function tryRefresh(): Promise<boolean> {
  const refresh = tokenStore.refresh();
  if (!refresh) return false;
  const res = await fetch(`${API_URL}/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) {
    tokenStore.clear();
    return false;
  }
  const data = await res.json();
  tokenStore.set(data.access_token, data.refresh_token);
  return true;
}

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const access = tokenStore.access();
  if (access) headers["Authorization"] = `Bearer ${access}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry && tokenStore.refresh()) {
    if (await tryRefresh()) return request<T>(method, path, body, false);
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};

interface PresignResponse {
  key: string;
  upload_url: string;
  public_url: string;
}

// uploadImage performs the production upload flow: ask the catalog service for a
// presigned PUT URL, then upload the file bytes directly to object storage (S3 /
// MinIO). Returns the stored object key to attach to a product. The PUT goes
// straight to storage and must NOT carry our Authorization header.
export async function uploadImage(file: File): Promise<string> {
  const contentType = file.type || "application/octet-stream";
  const presign = await api.post<PresignResponse>("/v1/uploads/presign", {
    filename: file.name,
    content_type: contentType,
  });
  const res = await fetch(presign.upload_url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!res.ok) throw new ApiError(res.status, "upload_failed", "image upload failed");
  return presign.key;
}

function fileForUpload(file: File, index: number): File {
  if (file.name) return file;
  const ext = file.type?.split("/")[1] || "jpg";
  return new File([file], `image-${Date.now()}-${index}.${ext}`, { type: file.type || "image/jpeg" });
}

// uploadImages uploads every file and returns all stored object keys.
export async function uploadImages(files: File[]): Promise<string[]> {
  return Promise.all(files.map((file, i) => uploadImage(fileForUpload(file, i))));
}
