-- Adds the audit log to a database built before it. A fresh database gets the
-- same from schema/08_audit.sql and the seed files, and records this migration
-- as already applied.
--
-- Safe to run on a database that already has any part of it: IF NOT EXISTS and
-- INSERT IGNORE skip what is already there.

CREATE TABLE IF NOT EXISTS audit_log (
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

INSERT IGNORE INTO permissions (code, category, description) VALUES
  ('audit.read', 'accounts', 'Read the audit log of administrative changes.');

-- The same grant as seed/03_role_permissions.sql: administrators hold every code
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
WHERE r.name = 'admin' AND p.code = 'audit.read';
