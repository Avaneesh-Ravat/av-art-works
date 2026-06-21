// Lightweight API client for the gateway. Attaches the access token,
// transparently refreshes it once on 401, and surfaces the backend error
// envelope as thrown ApiError instances.

const API_URL = import.meta.env.VITE_API_URL || "/api";

const ACCESS_KEY = "av_access";
const REFRESH_KEY = "av_refresh";

export const tokenStore = {
  access: () => localStorage.getItem(ACCESS_KEY),
  refresh: () => localStorage.getItem(REFRESH_KEY),
  set(access, refresh) {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function parseError(res) {
  try {
    const body = await res.json();
    const e = body?.error;
    if (e) return new ApiError(res.status, e.code ?? "error", e.message ?? "request failed");
  } catch {
    /* ignore */
  }
  return new ApiError(res.status, "error", res.statusText || "request failed");
}

async function tryRefresh() {
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

async function request(method, path, body, retry = true) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const access = tokenStore.access();
  if (access) headers["Authorization"] = `Bearer ${access}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry && tokenStore.refresh()) {
    if (await tryRefresh()) return request(method, path, body, false);
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined;
  const text = await res.text();
  return text ? JSON.parse(text) : undefined;
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  put: (path, body) => request("PUT", path, body),
  patch: (path, body) => request("PATCH", path, body),
  del: (path) => request("DELETE", path),
};

// uploadImage performs the production upload flow: ask the catalog service for a
// presigned PUT URL, then upload the file bytes directly to object storage (S3 /
// MinIO). Returns the stored object key to attach to a product. The PUT goes
// straight to storage and must NOT carry our Authorization header.
export async function uploadImage(file) {
  const contentType = file.type || "application/octet-stream";
  const presign = await api.post("/v1/uploads/presign", {
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

function fileForUpload(file, index) {
  if (file.name) return file;
  const ext = file.type?.split("/")[1] || "jpg";
  return new File([file], `image-${Date.now()}-${index}.${ext}`, { type: file.type || "image/jpeg" });
}

// uploadImages uploads every file and returns all stored object keys.
export async function uploadImages(files) {
  return Promise.all(files.map((file, i) => uploadImage(fileForUpload(file, i))));
}
