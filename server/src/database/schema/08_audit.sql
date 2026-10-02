-- 08 · Audit
--
-- A permanent record of administrative changes: accounts approved, suspended,
-- given another role or deleted; roles and their permissions changed; courses
-- published, archived or deleted; students added to, dropped from or removed
-- from a course. It answers "who did this, and when?" when an account or a
-- course changes unexpectedly. The same design as the thesis management
-- system's audit log.
--
-- Names are copied in at the time of the change on purpose. Deleting an
-- account must not erase the record of who they were, or of what was done to
-- them, so actor_name and target_label outlive the rows they describe. There
-- is no foreign key on target_id for the same reason. The app never updates or
-- deletes entries.
--
-- Tables: audit_log
-- Depends on: 01_identity (audit_log.actor_id -> users.id)

CREATE TABLE audit_log (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id      INT UNSIGNED NULL,
  actor_name    VARCHAR(160) NOT NULL,
  action        VARCHAR(60) NOT NULL,
  target_type   ENUM('user', 'role', 'course') NOT NULL,
  target_id     INT UNSIGNED NULL,
  target_label  VARCHAR(255) NOT NULL DEFAULT '',
  details       VARCHAR(1000) NOT NULL DEFAULT '',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_log_target (target_type, target_id),
  -- The entry outlives the account of whoever made the change; actor_name keeps who it was
  CONSTRAINT fk_audit_log_actor
    FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
