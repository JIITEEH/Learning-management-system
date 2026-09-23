-- 05 · Files
--
-- One table for every upload in the system. `owner_type` / `owner_id` say
-- what a file is attached to, so submissions, lessons and courses can all
-- carry attachments without a join table each.
--
-- Only metadata lives here. The bytes are written to storage/uploads under a
-- generated `stored_name`; a client-supplied filename is kept in
-- `original_name` for display and is never used as a path.
--
-- Tables: files
-- Depends on: 01_identity (files.uploaded_by -> users.id)

CREATE TABLE files (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uploaded_by    INT UNSIGNED NULL,
  owner_type     ENUM('submission', 'assignment', 'lesson', 'course', 'user') NOT NULL,
  owner_id       INT UNSIGNED NULL,
  original_name  VARCHAR(255) NOT NULL,
  stored_name    VARCHAR(255) NOT NULL,
  mime_type      VARCHAR(127) NOT NULL,
  size_bytes     INT UNSIGNED NOT NULL,
  checksum       CHAR(64) NULL,
  uploaded_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_files_stored_name (stored_name),
  KEY idx_files_owner (owner_type, owner_id),
  KEY idx_files_uploader (uploaded_by),
  CONSTRAINT fk_files_uploader
    FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
