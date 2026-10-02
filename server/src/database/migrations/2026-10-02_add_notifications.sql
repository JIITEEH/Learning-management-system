-- Adds in-app notifications (roadmap step 11) to a database built before them.
-- A fresh database gets the same table from schema/07_communication.sql, and
-- records this migration as already applied.
--
-- Safe to run on a database that already has the table: IF NOT EXISTS skips it.
-- No permission codes: every signed-in account reads only its own notifications.

CREATE TABLE IF NOT EXISTS notifications (
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
