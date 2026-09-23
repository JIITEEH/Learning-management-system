// Who is signed in, as the server sees it.
//
// Nothing about the visitor is trusted from the browser. Every page that
// shows account-specific content asks the server, and the server answers from
// the signed session cookie. The answer is fetched once per page load and
// then handed to everyone else who asks, so a page with three parts does not
// make three identical requests.

import { api } from "./api.js";
import { toast } from "./main.js";

const SIGN_IN_PAGE = "/pages/login.html";

let asked = null;

/**
 * The signed-in account and the permission codes it holds right now, or null
 * when nobody is signed in. Rejects only when the server could not be
 * reached, which is a different problem and must not be mistaken for being
 * signed out.
 */
export function session() {
  asked ??= api.get("/auth/me").then(
    (payload) => ({ user: payload.user, permissions: new Set(payload.permissions) }),
    (error) => {
      if (error.status === 401 || error.status === 403) return null;
      throw error;
    },
  );
  return asked;
}

/**
 * For pages that make no sense signed out. Returns the session, or null after
 * having already sent the browser to the sign-in page — so a caller writes:
 *
 *   const current = await requireSession();
 *   if (!current) return;
 */
export async function requireSession() {
  let current;
  try {
    current = await session();
  } catch {
    toast("Could not reach the server. Try reloading the page.", "error");
    return null;
  }

  if (!current) {
    // Remember where they were headed, so signing in continues the journey
    // instead of always landing on the dashboard.
    const next = encodeURIComponent(location.pathname + location.search);
    location.replace(`${SIGN_IN_PAGE}?next=${next}`);
    return null;
  }
  return current;
}

/**
 * Where to go after signing in. The address comes from the query string, so
 * it is only obeyed when it points inside this site — a value beginning
 * `//` is another site's address wearing a local disguise, and following it
 * would let a crafted link bounce someone straight off our sign-in page.
 */
export function destinationAfterSignIn() {
  const next = new URLSearchParams(location.search).get("next");
  const safe = next && next.startsWith("/") && !next.startsWith("//");
  return safe ? next : "/pages/dashboard.html";
}

export async function signOut() {
  try {
    await api.post("/auth/logout");
  } catch {
    // The session may already have expired on the server. Either way the
    // right next screen is the sign-in page.
  }
  location.assign(SIGN_IN_PAGE);
}

/** Wording for the stored values, which are codes rather than sentences. */
const ROLE_LABELS = { admin: "Administrator", instructor: "Instructor", student: "Student" };
const STATUS_LABELS = {
  active: "Active",
  pending: "Awaiting approval",
  suspended: "Suspended",
};

export const roleLabel = (role) => ROLE_LABELS[role] ?? role;
export const statusLabel = (status) => STATUS_LABELS[status] ?? status;
