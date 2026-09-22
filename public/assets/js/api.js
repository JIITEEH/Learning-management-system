// Thin wrapper over fetch for the JSON API. Every screen talks to the server
// through here so credentials and error handling stay consistent.

const BASE = "/api";

async function request(method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = response.status === 204 ? null : await response.json();

  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed (${response.status})`);
  }
  return payload;
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  patch: (path, body) => request("PATCH", path, body),
  delete: (path) => request("DELETE", path),
};
