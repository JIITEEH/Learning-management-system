-- 01 · Identity
--
-- Who may sign in, and what each account is allowed to do.
--
-- Access is permission-based, not role-based. A role is a row rather than an
-- ENUM so a new one can be added without a schema change, and it carries a
-- set of permission codes such as 'course.create'. `user_permissions` layers
-- a per-account grant or revoke on top, so one person can be denied something
-- their role would otherwise allow.
--
-- Tables: roles, permissions, role_permissions, users, user_permissions,
--         password_resets
-- Depends on: nothing. This file is always applied first.

CREATE TABLE roles (
  id           SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(40) NOT NULL,
  label        VARCHAR(80) NOT NULL,
  description  VARCHAR(255) NULL,
  is_system    TINYINT(1) NOT NULL DEFAULT 0,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name (name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE permissions (
  id           SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code         VARCHAR(64) NOT NULL,
  category     VARCHAR(40) NOT NULL,
  description  VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_code (code),
  KEY idx_permissions_category (category)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE role_permissions (
  role_id        SMALLINT UNSIGNED NOT NULL,
  permission_id  SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  KEY idx_role_permissions_permission (permission_id),
  CONSTRAINT fk_role_permissions_role
    FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission
    FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE users (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email          VARCHAR(255) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  full_name      VARCHAR(160) NOT NULL,
  role_id        SMALLINT UNSIGNED NOT NULL,
  status         ENUM('pending', 'active', 'suspended') NOT NULL DEFAULT 'pending',
  -- Copied into the session at sign-in and compared on every request. A
  -- password change or reset adds one, so every other device still signed in
  -- with the old password is signed out on its next click.
  session_version INT UNSIGNED NOT NULL DEFAULT 0,
  last_login_at  TIMESTAMP NULL DEFAULT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role_id),
  KEY idx_users_status (status),
  CONSTRAINT fk_users_role
    FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Per-account grant or revoke layered on top of the role. `effect` lets an
-- individual be denied something their role would otherwise allow.
CREATE TABLE user_permissions (
  user_id        INT UNSIGNED NOT NULL,
  permission_id  SMALLINT UNSIGNED NOT NULL,
  effect         ENUM('allow', 'deny') NOT NULL DEFAULT 'allow',
  granted_by     INT UNSIGNED NULL,
  granted_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, permission_id),
  KEY idx_user_permissions_permission (permission_id),
  CONSTRAINT fk_user_permissions_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_user_permissions_permission
    FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE,
  CONSTRAINT fk_user_permissions_granter
    FOREIGN KEY (granted_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- A "forgot password" link. Only a SHA-256 hash of the link's secret is kept,
-- so a copy of this table cannot be used to reset anyone's password. An
-- account holds at most one live link: asking again replaces it, and using it
-- deletes it.
CREATE TABLE password_resets (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  token_hash   CHAR(64) NOT NULL,
  expires_at   TIMESTAMP NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_password_resets_token (token_hash),
  KEY idx_password_resets_user (user_id),
  CONSTRAINT fk_password_resets_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
