// The roles screen: every role with how many accounts hold it, and an editor
// for a role's name, description and permissions. The whole screen needs
// role.manage, which the server checks again on every change.

import { api } from "../api.js";
import { clearNotice, esc, showNotice, toast, whileLoading } from "../main.js";
import { mountShell } from "../shell.js";

const rows = document.querySelector("[data-rows]");
const editor = document.querySelector("[data-editor]");
const form = document.querySelector("[data-form]");
const notice = document.querySelector("[data-notice]");
const saveButton = document.querySelector("[data-save]");
const deleteButton = document.querySelector("[data-delete]");
const deleteHint = document.querySelector("[data-delete-hint]");

let me = null; // the signed-in account and its permissions
let catalogue = []; // every permission code, grouped by category
let roles = []; // the table's contents
let picked = null; // the role open in the editor, or null for a new one

const current = await mountShell();
if (current) start(current);

async function start(session) {
  me = session;
  if (!me.permissions.has("role.manage")) {
    document.querySelector("[data-no-access]").hidden = false;
    return;
  }
  document.querySelector("[data-list]").hidden = false;

  try {
    ({ categories: catalogue } = await api.get("/permissions"));
  } catch (error) {
    toast(error.message, "error");
    return;
  }

  rows.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open]");
    if (button) openRole(Number(button.dataset.open));
  });
  document.querySelector("[data-new]").addEventListener("click", () => openRole(null));
  form.addEventListener("submit", saveRole);
  deleteButton.addEventListener("click", deleteRole);

  await loadRoles();
}

/* ------------------------------------------------------------------- The table */

async function loadRoles() {
  try {
    ({ roles } = await api.get("/roles"));
  } catch (error) {
    toast(error.message, "error");
    return;
  }

  rows.innerHTML = roles
    .map(
      (role) => `
      <tr${picked?.id === role.id ? ' aria-current="true"' : ""}>
        <td>
          <span class="cell-strong">${esc(role.label)}</span><br>
          <span class="perm-code">${esc(role.name)}</span>
          ${role.isSystem ? '<span class="tag">Built in</span>' : ""}
        </td>
        <td>${esc(role.description ?? "")}</td>
        <td>${role.userCount}</td>
        <td>${role.permissionCount}</td>
        <td class="cell-action">
          <button class="btn btn-sm" type="button" data-open="${role.id}">
            Edit<span class="visually-hidden"> ${esc(role.label)}</span>
          </button>
        </td>
      </tr>`,
    )
    .join("");
}

/* ------------------------------------------------------------------ The editor */

/** Open a role for editing, or a blank editor when `id` is null. */
async function openRole(id) {
  clearNotice(notice);
  let codes = [];

  if (id === null) {
    picked = null;
  } else {
    try {
      ({ role: picked, codes } = await api.get(`/roles/${id}`));
    } catch (error) {
      toast(error.message, "error");
      return;
    }
  }

  const isNew = picked === null;
  const inUse = roles.find((role) => role.id === picked?.id)?.userCount ?? 0;

  document.querySelector("[data-heading]").textContent = isNew ? "New role" : picked.label;
  form.label.value = picked?.label ?? "";
  form.name.value = picked?.name ?? "";
  form.description.value = picked?.description ?? "";

  // The built-in roles are looked up by their short name inside the server,
  // so renaming one would break those lookups. The server refuses it too.
  form.name.disabled = Boolean(picked?.isSystem);

  drawPermissions(new Set(codes));

  // A role can only be deleted once nobody holds it, and never a built-in one.
  deleteButton.hidden = isNew;
  deleteButton.disabled = Boolean(picked?.isSystem) || inUse > 0;
  deleteHint.hidden = isNew || !deleteButton.disabled;
  deleteHint.textContent = picked?.isSystem
    ? "Built-in roles cannot be deleted."
    : `${inUse === 1 ? "1 account still holds" : `${inUse} accounts still hold`} this role. ` +
      "Move them to another role first.";

  editor.hidden = false;
  document.querySelector("[data-heading]").focus();
  editor.scrollIntoView({ block: "start" });

  for (const row of rows.querySelectorAll("tr")) {
    if (!isNew && row.querySelector(`[data-open="${picked.id}"]`)) {
      row.setAttribute("aria-current", "true");
    } else {
      row.removeAttribute("aria-current");
    }
  }
}

function drawPermissions(granted) {
  document.querySelector("[data-perm-groups]").innerHTML = catalogue
    .map(
      ({ category, permissions }) => `
      <div class="perm-group">
        <h3>${esc(category)}</h3>
        <div class="perm-list">
          ${permissions
            .map(
              ({ code, description }) => `
            <label class="perm-row perm-row-check">
              <input class="check" type="checkbox" name="codes" value="${esc(code)}"${granted.has(code) ? " checked" : ""}>
              <span>
                <span class="perm-code">${esc(code)}</span>
                <span class="perm-desc">${esc(description)}</span>
              </span>
            </label>`,
            )
            .join("")}
        </div>
      </div>`,
    )
    .join("");
}

/* ---------------------------------------------------------------------- Saving */

async function saveRole(event) {
  event.preventDefault();
  clearNotice(notice);

  const label = form.label.value.trim();
  const name = form.name.value.trim().toLowerCase();
  const description = form.description.value.trim();
  const codes = [...form.querySelectorAll('input[name="codes"]:checked')].map((box) => box.value);

  if (!label || !name) {
    showNotice(notice, "Both the name shown on screen and the short name are needed.");
    return;
  }

  // Taking role.manage away from your own role takes it away from you, and
  // then nobody on this account can put it back. The server allows it, since
  // another administrator might hold it through a different role, so the
  // page asks before letting it happen.
  const ownRole = picked && picked.name === me.user.role;
  if (ownRole && !codes.includes("role.manage")) {
    const sure = confirm(
      "This is your own role. Without role.manage you will lose access to this screen " +
        "and cannot undo the change yourself. Save anyway?",
    );
    if (!sure) return;
  }

  try {
    await whileLoading(saveButton, async () => {
      if (picked === null) {
        ({ role: picked } = await api.post("/roles", { name, label, description, codes }));
      } else {
        // The details and the permission list are separate on the server,
        // so a role is saved in two requests.
        await api.patch(`/roles/${picked.id}`, { name, label, description });
        await api.put(`/roles/${picked.id}/permissions`, { codes });
      }
    });
  } catch (error) {
    showNotice(notice, error.message);
    return;
  }

  toast(`${label} saved.`);
  await loadRoles();
  await openRole(picked.id);
}

async function deleteRole() {
  if (!confirm(`Delete the role "${picked.label}"? This cannot be undone.`)) return;

  try {
    await whileLoading(deleteButton, () => api.delete(`/roles/${picked.id}`));
  } catch (error) {
    showNotice(notice, error.message);
    return;
  }

  toast(`${picked.label} deleted.`);
  picked = null;
  editor.hidden = true;
  await loadRoles();
}
