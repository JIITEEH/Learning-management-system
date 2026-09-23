// The bar across the top of every signed-in page.
//
// It is drawn here rather than typed into each HTML file for two reasons.
// One: there will be a dozen pages, and a link added by hand to eleven of
// them is a link missing from the twelfth. Two: the bar is not the same for
// everyone — a student has no business seeing an Administration link — and
// what each account may reach is only known once the server has answered.
//
// A page asks for the bar like this:
//
//   <header class="topbar" data-shell></header>
//   ...
//   import { mountShell } from "../shell.js";
//   const current = await mountShell();
//   if (!current) return;          // already sent to the sign-in page

import { esc, mountNav, toast } from "./main.js";
import { requireSession, roleLabel, signOut } from "./session.js";

/**
 * The navigation, in the order it is shown. `needs` is a permission code:
 * the link is drawn only for an account that holds it. Leaving `needs` off
 * means every signed-in account sees the link.
 *
 * This is presentation, not protection. Hiding a link stops nobody typing
 * the address, which is why every route checks the same permission on the
 * server. The two lists are deliberately kept in step.
 */
const NAV = [
  { href: "/pages/dashboard.html", label: "Dashboard" },
  { href: "/pages/courses.html", label: "Courses", needs: "course.read" },
  { href: "/pages/schedule.html", label: "Schedule", needs: "schedule.read" },
  { href: "/pages/assignments.html", label: "Assignments", needs: "assignment.read" },
  { href: "/pages/files.html", label: "Files", needs: "file.read" },
  { href: "/pages/admin.html", label: "Administration", needs: "role.manage" },
];

const ICONS = {
  brand:
    '<path d="M4 5.5 12 12l8-6.5M4 18.5 12 12l8 6.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  chevron:
    '<path d="m6 9.5 6 5 6-5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
  signOut:
    '<path d="M15 8V6.5A2.5 2.5 0 0 0 12.5 4h-5A2.5 2.5 0 0 0 5 6.5v11A2.5 2.5 0 0 0 7.5 20h5a2.5 2.5 0 0 0 2.5-2.5V16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
    '<path d="M10 12h10m0 0-3-3m3 3-3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
};

/** "Maria Dela Cruz" becomes MC — the first letter of the first and last word. */
function initials(fullName) {
  const words = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function navMarkup(permissions) {
  // Compare whole paths rather than filenames, so /pages/courses.html and a
  // future /pages/admin/courses.html cannot both claim to be the current page.
  const here = location.pathname;

  return NAV.filter((item) => !item.needs || permissions.has(item.needs))
    .map((item) => {
      const current = here === item.href ? ' aria-current="page"' : "";
      return `<a class="navpill-item" href="${item.href}"${current}>${esc(item.label)}</a>`;
    })
    .join("");
}

function shellMarkup({ user, permissions }) {
  return `
    <a class="brand" href="/">
      <span class="brand-mark">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${ICONS.brand}</svg>
      </span>
      LearnHub
    </a>

    <button class="icon-btn nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav">
      <span class="visually-hidden">Menu</span>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${ICONS.menu}</svg>
    </button>

    <nav class="navpill" id="primary-nav" aria-label="Primary">${navMarkup(permissions)}</nav>

    <div class="topbar-actions">
      <a class="account-btn" href="/pages/account.html">
        <span class="avatar" aria-hidden="true">${esc(initials(user.fullName))}</span>
        <span class="account-name">${esc(user.fullName)}</span>
        <span class="visually-hidden">Your account — ${esc(roleLabel(user.role))}</span>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${ICONS.chevron}</svg>
      </a>
      <button class="icon-btn" type="button" data-signout>
        <span class="visually-hidden">Sign out</span>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${ICONS.signOut}</svg>
      </button>
    </div>`;
}

/**
 * Draws the bar and returns the signed-in account, or null when the visitor
 * was signed out and has already been sent to the sign-in page. A page that
 * gets null should stop rather than carry on drawing itself.
 */
export async function mountShell() {
  const current = await requireSession();
  if (!current) return null;

  const host = document.querySelector("[data-shell]");
  if (!host) return current;

  host.innerHTML = shellMarkup(current);
  mountNav();

  const signOutButton = host.querySelector("[data-signout]");
  signOutButton.addEventListener("click", async () => {
    // Held in a variable, not read back from the event: by the time the
    // request finishes the event has been delivered and its currentTarget is
    // null again.
    signOutButton.disabled = true;
    try {
      await signOut();
    } catch {
      toast("Could not sign out. Try again.", "error");
      signOutButton.disabled = false;
    }
  });

  return current;
}
