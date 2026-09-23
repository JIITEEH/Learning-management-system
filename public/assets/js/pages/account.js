// Your own account: what it holds, and changing its password.

import { api } from "../api.js";
import { clearNotice, showNotice, toast, whileLoading } from "../main.js";
import { mountShell } from "../shell.js";
import { roleLabel, statusLabel } from "../session.js";

const current = await mountShell();
// Null means the visitor was signed out and the browser is already on its way
// to the sign-in page. Nothing below would have anything to draw.
if (current) {
  fillDetails(current);
  wirePasswordForm();
}

function fillDetails({ user, permissions }) {
  const show = (field, value) => {
    const cell = document.querySelector(`[data-field="${field}"]`);
    cell.textContent = value;
    // The dash and its faint grey are for a value the system does not have.
    // A real value must not keep wearing them.
    cell.classList.remove("placeholder");
  };

  show("fullName", user.fullName);
  show("email", user.email);
  show("role", roleLabel(user.role));
  show("status", statusLabel(user.status));

  const codes = [...permissions].sort();
  document.querySelector("[data-permission-count]").textContent =
    `${codes.length} permission${codes.length === 1 ? "" : "s"}`;

  const list = document.querySelector("[data-permissions]");
  for (const code of codes) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = code;
    list.appendChild(tag);
  }
}

function wirePasswordForm() {
  const form = document.querySelector("[data-form]");
  const notice = document.querySelector("[data-notice]");
  const button = form.querySelector("button[type=submit]");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearNotice(notice);

    const currentPassword = form.currentPassword.value;
    const newPassword = form.newPassword.value;

    if (newPassword.length < 8) {
      showNotice(notice, "The new password must be at least 8 characters.");
      return;
    }
    if (newPassword !== form.confirm.value) {
      showNotice(notice, "The two new passwords do not match.");
      form.confirm.select();
      return;
    }
    if (newPassword === currentPassword) {
      showNotice(notice, "The new password is the same as the current one.");
      return;
    }

    try {
      await whileLoading(button, () =>
        api.patch("/auth/password", { currentPassword, newPassword }),
      );
      form.reset();
      toast("Password changed.");
    } catch (error) {
      showNotice(notice, error.message);
    }
  });
}
