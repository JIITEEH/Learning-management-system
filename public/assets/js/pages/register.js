// Create an account.
//
// The role is not asked for and not sent. The server decides it: the very
// first account on an empty system becomes an active administrator, because
// otherwise there would be nobody able to approve anyone; every account after
// it is a student waiting for approval. Letting the browser name its own role
// would let anyone sign up as an administrator.

import { api } from "../api.js";
import { clearNotice, showNotice, whileLoading } from "../main.js";
import { session } from "../session.js";

const form = document.querySelector("[data-form]");
const notice = document.querySelector("[data-notice]");
const button = form.querySelector("button[type=submit]");

session()
  .then((current) => {
    if (current) location.replace("/pages/dashboard.html");
  })
  .catch(() => {});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearNotice(notice);

  const fullName = form.fullName.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;

  if (!fullName || !email) {
    showNotice(notice, "Your name and email address are both needed.");
    return;
  }
  if (password.length < 8) {
    showNotice(notice, "The password must be at least 8 characters.");
    return;
  }
  // Checked here as a courtesy, not as a rule: only one of the two is sent,
  // so the server has nothing to compare.
  if (password !== form.confirm.value) {
    showNotice(notice, "The two passwords do not match.");
    form.confirm.select();
    return;
  }

  try {
    const { user } = await whileLoading(button, () =>
      api.post("/auth/register", { fullName, email, password }),
    );

    // An active account can sign in straight away; a pending one cannot, and
    // saying so here saves the person a sign-in that was always going to be
    // refused.
    form.hidden = true;
    showNotice(
      notice,
      user.status === "active"
        ? "Account created. You can sign in now."
        : "Account created. An administrator has to approve it before you can sign in.",
      "ok",
    );
    notice.insertAdjacentHTML(
      "afterend",
      '<p class="centred-foot"><a href="login.html">Go to sign in</a></p>',
    );
  } catch (error) {
    showNotice(notice, error.message);
  }
});
