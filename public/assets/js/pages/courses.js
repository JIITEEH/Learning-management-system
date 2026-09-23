// The courses list: every course the account teaches or is taking (every
// course, for an administrator), a box to join one with a code, and a form
// to create one. Each part appears only for an account that may use it.

import { api } from "../api.js";
import { courseStatus, relationLabel } from "../courses.js";
import { clearNotice, esc, showNotice, toast, whileLoading } from "../main.js";
import { mountShell } from "../shell.js";

const current = await mountShell();
if (current) start(current.permissions);

async function start(permissions) {
  if (permissions.has("course.manage_any")) {
    document.querySelector("[data-intro]").textContent =
      "Every course in the system. You can open and manage any of them.";
  }
  if (permissions.has("course.create")) wireNewCourse();
  if (permissions.has("enrollment.self")) wireJoin();

  document.querySelector("[data-empty-text]").textContent = permissions.has("course.create")
    ? "No courses yet. Create one with the New course button."
    : "You are not in any course yet. Join one with the code your instructor gave you.";

  await loadCourses();
}

async function loadCourses() {
  let courses;
  try {
    ({ courses } = await api.get("/courses"));
  } catch (error) {
    toast(error.message, "error");
    return;
  }

  document.querySelector("[data-empty]").hidden = courses.length > 0;
  document.querySelector("[data-grid]").innerHTML = courses.map(cardMarkup).join("");
}

function cardMarkup(course) {
  const status = courseStatus(course.status);
  const students = `${course.studentCount} student${course.studentCount === 1 ? "" : "s"}`;
  return `
    <a class="card link-card course-card" href="course.html?id=${course.id}">
      <span class="tag-row">
        <span class="tag">${esc(course.code)}</span>
        <span class="tag ${status.tone}">${esc(status.label)}</span>
      </span>
      <h3>${esc(course.title)}</h3>
      <p>${esc(course.instructorName ?? "No instructor")} · ${students}</p>
      <span class="field-hint">${esc(relationLabel(course.relation))}</span>
    </a>`;
}

/* ------------------------------------------------------------ Creating a course */

function wireNewCourse() {
  const toggle = document.querySelector("[data-new-toggle]");
  const panel = document.querySelector("[data-new]");
  const form = document.querySelector("[data-new-form]");
  const notice = document.querySelector("[data-new-notice]");

  toggle.hidden = false;
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    panel.hidden = !open;
    if (open) form.code.focus();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearNotice(notice);

    const body = {
      code: form.code.value.trim(),
      title: form.title.value.trim(),
      description: form.description.value.trim(),
    };
    if (!body.code || !body.title) {
      showNotice(notice, "A course needs both a code and a title.");
      return;
    }

    try {
      const { course } = await whileLoading(form.querySelector("button"), () =>
        api.post("/courses", body),
      );
      location.assign(`course.html?id=${course.id}`);
    } catch (error) {
      showNotice(notice, error.message);
    }
  });
}

/* ------------------------------------------------------------- Joining a course */

function wireJoin() {
  const card = document.querySelector("[data-join]");
  const form = document.querySelector("[data-join-form]");
  const notice = document.querySelector("[data-join-notice]");
  card.hidden = false;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearNotice(notice);

    const joinCode = form.joinCode.value.trim();
    if (!joinCode) {
      showNotice(notice, "Type the join code first.");
      return;
    }

    try {
      const { course } = await whileLoading(form.querySelector("button"), () =>
        api.post("/enrollments/me", { joinCode }),
      );
      form.reset();
      toast(`You joined ${course.title}.`);
      await loadCourses();
    } catch (error) {
      showNotice(notice, error.message);
    }
  });
}
