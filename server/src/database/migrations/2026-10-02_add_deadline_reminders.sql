-- Adds the record of deadline reminders sent (npm run reminders) to a database
-- built before it. A fresh database gets the same from
-- schema/07_communication.sql, and records this migration as already applied.
--
-- Safe to run on a database that already has the table: IF NOT EXISTS skips it.

CREATE TABLE IF NOT EXISTS deadline_reminders (
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
