// One course, at course.html?id=12.
//
// Everyone who can see the course gets its Overview. The instructor who
// teaches it, and an administrator, also get the join code, the status and
// details forms, and the People tab. Which of those appear follows the
// `relation` the server reports and the viewer's own permissions; the server
// checks both again on every change.

import { api } from "../api.js";
import { courseStatus, formatJoinCode, relationLabel } from "../courses.js";
import { clearNotice, esc, showNotice, toast, whileLoading } from "../main.js";
import { mountShell } from "../shell.js";

const courseId = new URLSearchParams(location.search).get("id");

const ENROLLMENT_STATUSES = { active: "Active", completed: "Completed", dropped: "Dropped" };

let permissions = new Set();
let course = null;

const current = await mountShell();
if (current) start(current.permissions);

async function start(held) {
  permissions = held;
  const missing = document.querySelector("[data-missing]");

  // Without a number there is nothing to ask for. Asking anyway would reach
  // /api/courses/, which is the list of courses rather than one of them.
  if (!/^\d+$/.test(courseId ?? "")) {
    missing.hidden = false;
    return;
  }

  try {
    ({ course } = await api.get(`/courses/${courseId}`));
  } catch (error) {
    if (error.status === 404) {
      missing.hidden = false;
    } else {
      toast(error.message, "error");
    }
    return;
  }

  const manages = course.relation === "teaching" || course.relation === "overseeing";
  for (const element of document.querySelectorAll("[data-managers-only]")) {
    element.hidden = !manages;
  }

  document.querySelector("[data-course]").hidden = false;
  drawCourse();
  wireTabs();

  if (manages) {
    wireManagerTools();
    if (permissions.has("enrollment.read")) await loadRoster();
  }
}

function drawCourse() {
  document.title = `${course.title} — Learning Management System`;
  const status = courseStatus(course.status);

  document.querySelector("[data-tags]").innerHTML = `
    <span class="tag">${esc(course.code)}</span>
    <span class="tag ${status.tone}">${esc(status.label)}</span>
    <span class="tag">${esc(relationLabel(course.relation))}</span>`;
  document.querySelector("[data-title]").textContent = course.title;
  document.querySelector("[data-byline]").textContent =
    `Taught by ${course.instructorName ?? "nobody yet"} · ` +
    `${course.studentCount} student${course.studentCount === 1 ? "" : "s"}`;

  const description = document.querySelector("[data-description]");
  description.textContent = course.description || "No description yet.";
  description.classList.toggle("placeholder", !course.description);

  document.querySelector("[data-join-code]").textContent = formatJoinCode(course.joinCode);
}

/* --------------------------------------------------------------------- Tabs
   The pattern screen readers expect: the tabs sit in one row, the arrow keys
   move between them, and only the selected tab is reachable with Tab so the
   next press goes into its panel rather than through every other tab. */

function wireTabs() {
  const tabs = [...document.querySelectorAll('[role="tab"]')].filter((tab) => !tab.hidden);

  const select = (tab) => {
    for (const other of tabs) {
      const chosen = other === tab;
      other.setAttribute("aria-selected", String(chosen));
      other.tabIndex = chosen ? 0 : -1;
      document.getElementById(other.getAttribute("aria-controls")).hidden = !chosen;
    }
  };

  for (const tab of tabs) {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!step) return;
      const next = tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length];
      select(next);
      next.focus();
    });
  }

  select(tabs[0]);
}

/* ------------------------------------------------------------ Manager tools */

function wireManagerTools() {
  const statusForm = document.querySelector("[data-status-form]");
  const detailsForm = document.querySelector("[data-details-form]");
  const deleteButton = document.querySelector("[data-delete]");

  statusForm.hidden = !permissions.has("course.publish");
  detailsForm.hidden = !permissions.has("course.update");
  document.querySelector("[data-new-code]").hidden = !permissions.has("course.update");
  document.querySelector("[data-add-form]").hidden = !permissions.has("enrollment.manage");

  fillForms();

  statusForm.addEventListener("submit", (event) => {
    event.preventDefault();
    save(statusForm, "[data-status-notice]", () =>
      api.patch(`/courses/${course.id}/status`, { status: statusForm.status.value }),
    );
  });

  detailsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    save(detailsForm, "[data-details-notice]", () =>
      api.patch(`/courses/${course.id}`, {
        code: detailsForm.code.value,
        title: detailsForm.title.value,
        description: detailsForm.description.value,
      }),
    );
  });

  const newCodeButton = document.querySelector("[data-new-code]");
  newCodeButton.addEventListener("click", async () => {
    const sure = confirm(
      "Make a new join code? The current one stops working straight away. " +
        "Students already enrolled are not affected.",
    );
    if (!sure) return;
    try {
      ({ course } = await whileLoading(newCodeButton, () =>
        api.post(`/courses/${course.id}/join-code`),
      ));
      drawCourse();
      toast("New join code made.");
    } catch (error) {
      toast(error.message, "error");
    }
  });

  deleteButton.addEventListener("click", async () => {
    const sure = confirm(
      `Delete ${course.title}? Its enrollments go with it, and this cannot be undone.`,
    );
    if (!sure) return;
    try {
      await whileLoading(deleteButton, () => api.delete(`/courses/${course.id}`));
      location.assign("courses.html");
    } catch (error) {
      showNotice(document.querySelector("[data-details-notice]"), error.message);
    }
  });

  wireRoster();
}

/** Put the course's current values into the forms, and the delete button's state. */
function fillForms() {
  const statusForm = document.querySelector("[data-status-form]");
  const detailsForm = document.querySelector("[data-details-form]");
  statusForm.status.value = course.status;
  detailsForm.code.value = course.code;
  detailsForm.title.value = course.title;
  detailsForm.description.value = course.description ?? "";

  const deleteButton = document.querySelector("[data-delete]");
  const canDelete = permissions.has("course.delete");
  deleteButton.hidden = !canDelete;
  deleteButton.disabled = course.status === "published";
  document.querySelector("[data-delete-hint]").hidden = !canDelete || !deleteButton.disabled;
}

/** Send one form's change, then redraw the course from the server's answer. */
async function save(form, noticeSelector, request) {
  const notice = document.querySelector(noticeSelector);
  clearNotice(notice);
  try {
    ({ course } = await whileLoading(form.querySelector("button[type=submit]"), request));
  } catch (error) {
    showNotice(notice, error.message);
    return;
  }
  drawCourse();
  fillForms();
  toast("Saved.");
}

/* ------------------------------------------------------------------- People */

function wireRoster() {
  const form = document.querySelector("[data-add-form]");
  const notice = document.querySelector("[data-people-notice]");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearNotice(notice);
    const email = form.email.value.trim();
    if (!email) {
      showNotice(notice, "Type the student's email address first.");
      return;
    }
    try {
      const { enrollment } = await whileLoading(form.querySelector("button"), () =>
        api.post("/enrollments", { courseId: course.id, email }),
      );
      form.reset();
      toast(`${enrollment.fullName} added.`);
      await loadRoster();
    } catch (error) {
      showNotice(notice, error.message);
    }
  });

  const roster = document.querySelector("[data-roster]");

  // A change of status saves straight away; there is one field per row, so a
  // separate Save button would only be one more thing to forget.
  roster.addEventListener("change", async (event) => {
    const select = event.target.closest("[data-enrollment-status]");
    if (!select) return;
    try {
      await api.patch(`/enrollments/${select.dataset.enrollmentStatus}`, { status: select.value });
      toast("Enrollment updated.");
      await loadRoster();
    } catch (error) {
      toast(error.message, "error");
    }
  });

  roster.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-remove]");
    if (!button) return;
    if (!confirm(`Remove ${button.dataset.name} from this course? They could rejoin with the join code. To keep them out, and keep a record that they took part, set them to Dropped instead.`)) {
      return;
    }
    try {
      await api.delete(`/enrollments/${button.dataset.remove}`);
      toast(`${button.dataset.name} removed.`);
      await loadRoster();
    } catch (error) {
      toast(error.message, "error");
    }
  });
}

async function loadRoster() {
  let enrollments;
  try {
    ({ enrollments } = await api.get(`/courses/${course.id}/roster`));
  } catch (error) {
    toast(error.message, "error");
    return;
  }

  const active = enrollments.filter((row) => row.status === "active").length;
  document.querySelector("[data-roster-count]").textContent =
    `${active} active of ${enrollments.length}`;
  document.querySelector("[data-roster-empty]").hidden = enrollments.length > 0;

  const canManage = permissions.has("enrollment.manage");
  document.querySelector("[data-roster]").innerHTML = enrollments
    .map((row) => rosterRow(row, canManage))
    .join("");
}

function rosterRow(row, canManage) {
  const id = `enrollment-${row.id}`;
  const options = Object.entries(ENROLLMENT_STATUSES)
    .map(([value, label]) => `<option value="${value}"${value === row.status ? " selected" : ""}>${label}</option>`)
    .join("");
  const status = canManage
    ? `<label class="visually-hidden" for="${id}">Status of ${esc(row.fullName)}</label>
       <select class="select select-sm" id="${id}" data-enrollment-status="${row.id}">${options}</select>`
    : esc(ENROLLMENT_STATUSES[row.status] ?? row.status);
  const action = canManage
    ? `<button class="btn btn-sm btn-danger" type="button" data-remove="${row.id}" data-name="${esc(row.fullName)}">
         Remove<span class="visually-hidden"> ${esc(row.fullName)}</span>
       </button>`
    : "";

  return `
    <tr>
      <td class="cell-strong">${esc(row.fullName)}</td>
      <td data-label="Email address">${esc(row.email)}</td>
      <td data-label="Enrolled">${esc(new Date(row.enrolledAt).toLocaleDateString())}</td>
      <td data-label="Status">${status}</td>
      <td class="cell-action">${action}</td>
    </tr>`;
}
