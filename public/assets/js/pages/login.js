// Sign in.
//
// The form is submitted with JavaScript rather than by the browser's own
// form post, because the answer is JSON: either a session cookie and an
// account, or a sentence saying why not. A plain form post would replace the
// whole page with that JSON.

import { api } from "../api.js";
import { clearNotice, showNotice, whileLoading } from "../main.js";
import { destinationAfterSignIn, session } from "../session.js";

const form = document.querySelector("[data-form]");
const notice = document.querySelector("[data-notice]");
const button = form.querySelector("button[type=submit]");

// Somebody already signed in has no use for this page.
session()
  .then((current) => {
    if (current) location.replace(destinationAfterSignIn());
  })
  .catch(() => {
    // The server is unreachable. Leave the form up: it will report the same
    // problem in the notice, in words, the moment it is used.
  });

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearNotice(notice);

  const email = form.email.value.trim();
  const password = form.password.value;

  if (!email || !password) {
    showNotice(notice, "Enter your email address and password.");
    return;
  }

  try {
    await whileLoading(button, () => api.post("/auth/login", { email, password }));
    location.assign(destinationAfterSignIn());
  } catch (error) {
    showNotice(notice, error.message);
    form.password.select();
  }
});
