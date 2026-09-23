// Shared browser behaviour, used by every screen.
//
// This file holds only the pieces that have no page of their own: the
// navigation sheet on narrow viewports, the message region, and a wrapper
// that keeps a button from being pressed twice. The bar itself is drawn by
// shell.js, and pages talk to the server through api.js, never fetch.

/* ------------------------------------------------------------------ Navigation
   Below 900px the pill nav becomes a sheet under the bar. `data-open` drives
   the CSS, and aria-expanded on the toggle is kept in step with it so the
   state is announced rather than only drawn.

   Called by shell.js once the bar exists, because the markup it wires is
   drawn rather than authored. */

export function mountNav() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("primary-nav");
  if (!toggle || !nav) return;

  const setOpen = (open) => {
    nav.toggleAttribute("data-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };

  setOpen(false);

  toggle.addEventListener("click", () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });

  // Escape closes the sheet and returns focus to the control that opened it.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      setOpen(false);
      toggle.focus();
    }
  });

  // A tap outside the sheet closes it, the way a menu is expected to behave.
  document.addEventListener("pointerdown", (event) => {
    if (toggle.getAttribute("aria-expanded") !== "true") return;
    if (nav.contains(event.target) || toggle.contains(event.target)) return;
    setOpen(false);
  });
}

/* ----------------------------------------------------------------------- Escaping
   Names, emails and role descriptions are text people typed. Before any of it
   is placed inside markup it is escaped, so a name like <b>Ana</b> shows as
   those characters rather than turning bold, or worse, running as a script. */

export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );

/* ----------------------------------------------------------------------- Toasts
   One live region per page. It is created on first use rather than authored
   into every file, so a page that never reports anything carries no markup
   for it. The region is polite, so a screen reader finishes its sentence
   before reading the message instead of cutting itself off. */

const TOAST_ICONS = {
  ok: '<path d="m5 12.5 4 4 10-10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  error:
    '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.9"/>' +
    '<path d="M12 7.5v5.5m0 3.2v.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
};

function toastRegion() {
  let region = document.querySelector("[data-toasts]");
  if (!region) {
    region = document.createElement("div");
    region.className = "toasts";
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    region.dataset.toasts = "";
    document.body.appendChild(region);
  }
  return region;
}

export function toast(message, tone = "ok") {
  const item = document.createElement("div");
  item.className = `toast toast-${tone === "error" ? "error" : "ok"}`;
  item.innerHTML =
    `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${TOAST_ICONS[tone] ?? TOAST_ICONS.ok}</svg>` +
    `<span class="toast-text"></span>`;
  item.querySelector(".toast-text").textContent = message;

  toastRegion().appendChild(item);
  setTimeout(() => item.remove(), 6000);
}

/* -------------------------------------------------------------------- Requests
   Wraps a button for the length of a request so the page cannot be
   double-submitted, and the control says it is working. */

export async function whileLoading(button, work) {
  button.dataset.loading = "true";
  button.disabled = true;
  try {
    return await work();
  } finally {
    delete button.dataset.loading;
    button.disabled = false;
  }
}

/* ---------------------------------------------------------------------- Notices
   The inline message above a form. Unlike a toast it stays put, which is what
   a failed sign-in needs: the reason must still be on screen while the person
   corrects the field it refers to. */

export function showNotice(element, message, tone = "error") {
  element.className = `notice notice-${tone === "error" ? "error" : "ok"}`;
  element.textContent = message;
  element.hidden = false;
}

export function clearNotice(element) {
  element.textContent = "";
  element.hidden = true;
}
