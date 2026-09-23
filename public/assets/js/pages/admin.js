// The administration landing page: a card for each administrator screen the
// account may open, with a count on each so waiting work is visible at once.

import { api } from "../api.js";
import { toast } from "../main.js";
import { mountShell } from "../shell.js";

const current = await mountShell();
if (current) showCards(current.permissions);

async function showCards(permissions) {
  const cards = [...document.querySelectorAll("[data-needs]")];
  const allowed = cards.filter((card) => permissions.has(card.dataset.needs));

  for (const card of allowed) card.hidden = false;
  if (allowed.length === 0) {
    document.querySelector("[data-no-access]").hidden = false;
    return;
  }

  try {
    if (permissions.has("user.read")) {
      const { users } = await api.get("/users");
      setCount("users", users.length);

      const pending = users.filter((user) => user.status === "pending").length;
      if (pending > 0) {
        const tag = document.querySelector('[data-count="pending"]');
        tag.textContent = `${pending} waiting for approval`;
        tag.hidden = false;
      }
    }

    if (permissions.has("role.manage")) {
      const { roles } = await api.get("/roles");
      setCount("roles", roles.length);
    }
  } catch (error) {
    toast(error.message, "error");
  }
}

function setCount(name, value) {
  const cell = document.querySelector(`[data-count="${name}"]`);
  cell.textContent = value;
  cell.classList.remove("placeholder");
}
