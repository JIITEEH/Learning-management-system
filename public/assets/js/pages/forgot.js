// Ask for a password reset link.
//
// The server gives the same answer whether or not the address has an
// account, so this page cannot be used to find out who is registered. It
// says so in its reply rather than claiming an email was definitely sent.

import { api } from "../api.js";
import { clearNotice, showNotice, whileLoading } from "../main.js";

const form = document.querySelector("[data-form]");
const notice = document.querySelector("[data-notice]");
const button = form.querySelector("button[type=submit]");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearNotice(notice);

  const email = form.email.value.trim();
  if (!email.includes("@")) {
    showNotice(notice, "Type the email address your account uses.");
    return;
  }

  try {
    await whileLoading(button, () => api.post("/auth/forgot", { email }));
  } catch (error) {
    showNotice(notice, error.message);
    return;
  }

  form.hidden = true;
  showNotice(
    notice,
    `If ${email} has an account, a link to choose a new password is on its way. ` +
      "Check the inbox, and the spam folder, in the next few minutes.",
    "ok",
  );
});
