-- 06 · Scheduling
--
-- A recurring weekly meeting for a course, bounded by an effective date range
-- so a timetable can change mid-term without losing what it used to be.
--
-- Tables: schedules
-- Depends on: 02_catalog (schedules.course_id -> courses.id)

CREATE TABLE schedules (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id       INT UNSIGNED NOT NULL,
  title           VARCHAR(200) NULL,
  day_of_week     TINYINT UNSIGNED NOT NULL COMMENT '0 = Sunday … 6 = Saturday',
  starts_at       TIME NOT NULL,
  ends_at         TIME NOT NULL,
  location        VARCHAR(160) NULL,
  effective_from  DATE NOT NULL,
  effective_to    DATE NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_schedules_course_day (course_id, day_of_week),
  KEY idx_schedules_effective (effective_from, effective_to),
  CONSTRAINT fk_schedules_course
    FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
  CONSTRAINT chk_schedules_day CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT chk_schedules_time CHECK (ends_at > starts_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
