-- 07 · Communication
--
-- Announcements an instructor (or an administrator) posts to one course, for
-- everyone taking it. There is no site-wide announcement: each belongs to a
-- course, and is seen by whoever can see that course.
--
-- Notifications tell one person that something concerning them happened: a new
-- announcement or assignment in their course, a grade returned to them, or
-- being added to a course. One row per recipient, so each person reads and
-- dismisses their own copy (the same design as the thesis management system).
-- `link` is the address in the app to open; `read_at` stays empty until read.
--
-- Deadline reminders record each reminder `npm run reminders` has sent: one
-- student, one assignment or quiz, one due date, one kind ('due_soon' or
-- 'overdue'). The daily job checks it so nobody is reminded twice. item_id
-- points at an assignment or a quiz, depending on item_type, so it has no
-- foreign key; deleting an assignment, quiz or course removes its rows by hand.
--
-- Tables: announcements, notifications, deadline_reminders
-- Depends on: 01_identity (announcements.author_id, notifications.user_id and
--             notifications.actor_id -> users.id),
--             02_catalog (announcements.course_id -> courses.id)

CREATE TABLE announcements (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id    INT UNSIGNED NOT NULL,
  author_id    INT UNSIGNED NULL,
  title        VARCHAR(200) NOT NULL,
  body         TEXT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_announcements_course_created (course_id, created_at),
  CONSTRAINT fk_announcements_course
    FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
  -- An announcement outlives its author's account; it then shows no author
  CONSTRAINT fk_announcements_author
    FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE notifications (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  actor_id     INT UNSIGNED NULL,
  type         VARCHAR(40) NOT NULL,
  title        VARCHAR(255) NOT NULL,
  body         VARCHAR(500) NOT NULL DEFAULT '',
  link         VARCHAR(255) NOT NULL DEFAULT '',
  read_at      TIMESTAMP NULL DEFAULT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- The bell asks "what is mine, newest first" and "how many are unread" on every page
  KEY idx_notifications_user_newest (user_id, id),
  KEY idx_notifications_user_unread (user_id, read_at),
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  -- A notification outlives the account of whoever caused it
  CONSTRAINT fk_notifications_actor
    FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE deadline_reminders (
  user_id    INT UNSIGNED NOT NULL,
  item_type  ENUM('assignment', 'quiz') NOT NULL,
  item_id    INT UNSIGNED NOT NULL,
  due_at     DATETIME NOT NULL,
  kind       ENUM('due_soon', 'overdue') NOT NULL,
  sent_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- The due date is part of the key: when a deadline moves, the new date is reminded about too
  PRIMARY KEY (user_id, item_type, item_id, due_at, kind),
  KEY idx_deadline_reminders_item (item_type, item_id),
  CONSTRAINT fk_deadline_reminders_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
