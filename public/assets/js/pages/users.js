// The accounts screen: every account in a table, and a panel for managing
// the one picked from it.
//
// What each viewer can change depends on their own permissions, so the page
// asks for them up front and switches controls off to match:
//   user.read    see the table and each account's permissions
//   user.update  change an account's status
//   role.manage  change an account's role and its exceptions
// Switching a control off is a courtesy. The server checks every one of
// these again on each request.

import { api } from "../api.js";
import { clearNotice, esc, showNotice, toast, whileLoading } from "../main.js";
import { mountShell } from "../shell.js";
import { statusLabel } from "../session.js";

const STATUS_TAGS = { active: "tag-ok", pending: "tag-warn", suspended: "" };

const list = document.querySelector("[data-list]");
const rows = document.querySelector("[data-rows]");
const editor = document.querySelector("[data-editor]");
const notice = document.querySelector("[data-notice]");
const accountForm = document.querySelector("[data-account-form]");
const saveOverridesButton = document.querySelector("[data-save-overrides]");

let me = null; // the signed-in account and its permissions
let roles = []; // every role, for the drop-downs
let catalogue = []; // every permission code, grouped by category
let picked = null; // the account open in the panel

const current = await mountShell();
if (current) start(current);

async function start(session) {
  me = session;
  if (!me.permissions.has("user.read")) {
    document.querySelector("[data-no-access]").hidden = false;
    return;
  }
  list.hidden = false;

  try {
    const [roleReply, permissionReply] = await Promise.all([
      api.get("/roles"),
      api.get("/permissions"),
    ]);
    roles = roleReply.roles;
    catalogue = permissionReply.categories;
  } catch (error) {
    toast(error.message, "error");
    return;
  }

  fillRoleOptions(document.querySelector('[data-filter="role"]'));
  fillRoleOptions(accountForm.role);

  for (const select of document.querySelectorAll("[data-filter]")) {
    select.addEventListener("change", loadAccounts);
  }
  rows.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open]");
    if (button) openAccount(Number(button.dataset.open));
  });
  accountForm.addEventListener("submit", saveAccount);
  saveOverridesButton.addEventListener("click", saveOverrides);

  // Arriving from a link such as users.html?status=pending starts filtered.
  const wanted = new URLSearchParams(location.search).get("status");
  if (wanted) document.querySelector('[data-filter="status"]').value = wanted;

  await loadAccounts();
}

function fillRoleOptions(select) {
  for (const role of roles) {
    const option = document.createElement("option");
    option.value = role.name;
    option.textContent = role.label;
    select.appendChild(option);
  }
}

/* ------------------------------------------------------------------- The table */

async function loadAccounts() {
  const query = new URLSearchParams();
  for (const select of document.querySelectorAll("[data-filter]")) {
    if (select.value) query.set(select.dataset.filter, select.value);
  }

  let users;
  try {
    ({ users } = await api.get(`/users?${query}`));
  } catch (error) {
    toast(error.message, "error");
    return;
  }

  document.querySelector("[data-total]").textContent =
    `${users.length} account${users.length === 1 ? "" : "s"}`;
  document.querySelector("[data-empty]").hidden = users.length > 0;

  rows.innerHTML = users.map(rowMarkup).join("");
}

function rowMarkup(user) {
  const isPicked = picked?.id === user.id;
  const lastSeen = user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never";
  return `
    <tr${isPicked ? ' aria-current="true"' : ""}>
      <td class="cell-strong">${esc(user.fullName)}</td>
      <td data-label="Email address">${esc(user.email)}</td>
      <td data-label="Role">${esc(user.roleLabel)}</td>
      <td data-label="Status"><span class="tag ${STATUS_TAGS[user.status] ?? ""}">${esc(statusLabel(user.status))}</span></td>
      <td data-label="Last signed in">${esc(lastSeen)}</td>
      <td class="cell-action">
        <button class="btn btn-sm" type="button" data-open="${user.id}">
          Manage<span class="visually-hidden"> ${esc(user.fullName)}</span>
        </button>
      </td>
    </tr>`;
}

/* ---------------------------------------------------------------- One account */

async function openAccount(id) {
  clearNotice(notice);
  let user;
  let permissions;
  try {
    [{ user }, permissions] = await Promise.all([
      api.get(`/users/${id}`),
      api.get(`/users/${id}/permissions`),
    ]);
  } catch (error) {
    toast(error.message, "error");
    return;
  }
  picked = user;

  editor.querySelector("[data-name]").textContent = user.fullName;
  editor.querySelector("[data-email]").textContent = `${user.email} · ${user.roleLabel}`;

  accountForm.status.value = user.status;
  accountForm.role.value = user.role;

  // The server refuses both of these for your own account, because either
  // one is a quick way to lock yourself out. Saying so beforehand is kinder
  // than letting the save fail.
  const isSelf = user.id === me.user.id;
  accountForm.status.disabled = isSelf || !me.permissions.has("user.update");
  accountForm.role.disabled = isSelf || !me.permissions.has("role.manage");
  accountForm.querySelector("button").hidden =
    accountForm.status.disabled && accountForm.role.disabled;
  if (isSelf) {
    document.querySelector("#status-hint").textContent =
      "This is your own account. Another administrator must change its status or role.";
  } else {
    document.querySelector("#status-hint").textContent = "Only an active account can sign in.";
  }

  drawOverrides(permissions);

  editor.hidden = false;
  // Move focus to the panel so keyboard and screen-reader users land on what
  // just opened, instead of staying on a button far above it.
  editor.querySelector("[data-name]").focus();
  editor.scrollIntoView({ block: "start" });

  for (const row of rows.querySelectorAll("tr")) {
    if (row.querySelector(`[data-open="${user.id}"]`)) row.setAttribute("aria-current", "true");
    else row.removeAttribute("aria-current");
  }
}

function drawOverrides({ fromRole, overrides }) {
  const granted = new Set(fromRole);
  const effectByCode = new Map(overrides.map((entry) => [entry.code, entry.effect]));
  const canEdit = me.permissions.has("role.manage");

  const groups = catalogue.map(
    ({ category, permissions }) => `
      <div class="perm-group">
        <h3>${esc(category)}</h3>
        <div class="perm-list">
          ${permissions.map((permission) => overrideRow(permission, granted, effectByCode, canEdit)).join("")}
        </div>
      </div>`,
  );
  editor.querySelector("[data-perm-groups]").innerHTML = groups.join("");
  saveOverridesButton.hidden = !canEdit;
}

function overrideRow({ code, description }, granted, effectByCode, canEdit) {
  const id = `override-${code.replace(".", "-")}`;
  const effect = effectByCode.get(code) ?? "";
  const roleSays = granted.has(code) ? "allowed" : "not allowed";
  const option = (value, label) =>
    `<option value="${value}"${value === effect ? " selected" : ""}>${label}</option>`;

  return `
    <div class="perm-row">
      <div>
        <label class="perm-code" for="${id}">${esc(code)}</label>
        <div class="perm-desc">${esc(description)} The role says: ${roleSays}.</div>
      </div>
      <select class="select" id="${id}" data-code="${esc(code)}"${canEdit ? "" : " disabled"}>
        ${option("", "Follow the role")}
        ${option("allow", "Always allow")}
        ${option("deny", "Always deny")}
      </select>
    </div>`;
}

/* ---------------------------------------------------------------------- Saving */

async function saveAccount(event) {
  event.preventDefault();
  clearNotice(notice);

  const status = accountForm.status.value;
  const role = accountForm.role.value;
  const button = accountForm.querySelector("button");

  try {
    await whileLoading(button, async () => {
      // Status and role are separate addresses on the server, because they
      // need different permissions. Only the one that changed is sent.
      if (status !== picked.status) {
        await api.patch(`/users/${picked.id}/status`, { status });
      }
      if (role !== picked.role) {
        await api.patch(`/users/${picked.id}`, { role });
      }
    });
  } catch (error) {
    showNotice(notice, error.message);
    return;
  }

  toast(`${picked.fullName} saved.`);
  await loadAccounts();
  await openAccount(picked.id);
}

async function saveOverrides() {
  // Only the rows set to allow or deny are sent. The server replaces the
  // whole set, so a row left on "Follow the role" is an exception removed.
  const overrides = [...editor.querySelectorAll("[data-code]")]
    .filter((select) => select.value)
    .map((select) => ({ code: select.dataset.code, effect: select.value }));

  try {
    await whileLoading(saveOverridesButton, () =>
      api.put(`/users/${picked.id}/permissions`, { overrides }),
    );
  } catch (error) {
    // A toast rather than the notice: the notice sits at the top of the
    // panel, a long scroll away from the button that was just pressed.
    toast(error.message, "error");
    return;
  }

  toast(`Exceptions for ${picked.fullName} saved.`);
}
