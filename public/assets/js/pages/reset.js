// Choose a new password, from the link in a reset email.
//
// The link carries its secret after a # (reset.html#token=...). A browser
// never sends that part of an address to any server, so the secret stays out
// of server logs and out of what other sites learn when a link is followed.
// It is read once here and then wiped from the address bar and the history.

import { api } from "../api.js";
import { clearNotice, showNotice, whileLoading } from "../main.js";

const form = document.querySelector("[data-form]");
const notice = document.querySelector("[data-notice]");
const button = form.querySelector("button[type=submit]");

const token = new URLSearchParams(location.hash.slice(1)).get("token");
history.replaceState(null, "", location.pathname);

// A link pasted into a tab already on this page changes only the part after
// the #, which does not reload the page, so the new secret would never be
// read. Reload, so it is.
addEventListener("hashchange", () => location.reload());

if (!token) {
  form.hidden = true;
  showNotice(
    notice,
    "This page needs the link from a reset email. Ask for a new one from the sign-in page.",
  );
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearNotice(notice);

  const newPassword = form.newPassword.value;
  if (newPassword.length < 8) {
    showNotice(notice, "The new password must be at least 8 characters.");
    return;
  }
  if (newPassword !== form.confirm.value) {
    showNotice(notice, "The two passwords do not match.");
    form.confirm.select();
    return;
  }

  try {
    await whileLoading(button, () => api.post("/auth/reset", { token, newPassword }));
  } catch (error) {
    showNotice(notice, error.message);
    return;
  }

  form.hidden = true;
  showNotice(notice, "Your password is changed, and every device has been signed out.", "ok");
  const signIn = document.createElement("a");
  signIn.className = "btn btn-primary btn-lg btn-block";
  signIn.href = "login.html";
  signIn.textContent = "Sign in";
  notice.after(signIn);
});
