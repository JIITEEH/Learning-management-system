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

  // A 204 carries no body, and a failure that never reached our routes (a
  // proxy timing out, say) answers with HTML. Neither can be parsed as JSON,
  // so parsing is allowed to come back empty rather than throwing over it.
  const payload =
    response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(payload?.error ?? `Request failed (${response.status})`);
    // Callers need the code, not only the sentence: 401 means "sign in
    // again", where 500 means "the server is broken". They are not the same
    // thing to the person reading the screen.
    error.status = response.status;
    throw error;
  }
  return payload;
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  patch: (path, body) => request("PATCH", path, body),
  put: (path, body) => request("PUT", path, body),
  delete: (path) => request("DELETE", path),
};
