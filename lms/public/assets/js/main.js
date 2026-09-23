// Shared entry point for every page. Wires the parts of the shell that need
// behaviour: the navigation sheet on narrow viewports, and the toast region.
//
// Pages talk to the server through api.js, never through fetch directly.

/* ------------------------------------------------------------------ Navigation
   Below 900px the pill nav becomes a sheet under the bar. `data-open` drives
   the CSS, and aria-expanded on the toggle is kept in step with it so the
   state is announced rather than only drawn. */

function mountNav() {
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

/* ----------------------------------------------------------------------- Toasts
   One live region per page, already in the markup. Messages are appended and
   removed on their own; the region is polite so it never interrupts. */

const TOAST_ICONS = {
  ok: '<path d="m5 12.5 4 4 10-10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  error:
    '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.9"/>' +
    '<path d="M12 7.5v5.5m0 3.2v.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
};

export function toast(message, tone = "ok") {
  const region = document.querySelector("[data-toasts]");
  if (!region) return;

  const item = document.createElement("div");
  item.className = `toast toast-${tone === "error" ? "error" : "ok"}`;
  item.innerHTML =
    `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${TOAST_ICONS[tone] ?? TOAST_ICONS.ok}</svg>` +
    `<span class="toast-text"></span>`;
  item.querySelector(".toast-text").textContent = message;

  region.appendChild(item);
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

mountNav();
