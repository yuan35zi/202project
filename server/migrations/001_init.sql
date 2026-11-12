-- ===========================================================================
-- 001_init.sql — 实训室进组选拔系统初始结构
-- 约定：时间均为毫秒时间戳（INTEGER）；布尔用 0/1 表示。
-- 所有外键均显式声明，写操作由 PRAGMA foreign_keys=ON 保障。
-- ===========================================================================

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  role          TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  name          TEXT NOT NULL CHECK (length(trim(name)) > 0),
  cls           TEXT,
  phone         TEXT,
  email         TEXT,
  title         TEXT,
  salt          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cycle (
  id   INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100)
);

CREATE TABLE IF NOT EXISTS stages (
  idx      INTEGER PRIMARY KEY CHECK (idx BETWEEN 0 AND 7),
  key      TEXT NOT NULL,
  label    TEXT NOT NULL,
  short    TEXT NOT NULL,
  start_at INTEGER NOT NULL,
  end_at   INTEGER NOT NULL,
  CHECK (end_at > start_at)
);

CREATE TABLE IF NOT EXISTS labs (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL CHECK (length(trim(name)) > 0),
  direction     TEXT NOT NULL,
  quota         INTEGER NOT NULL CHECK (quota >= 0),
  room          TEXT,
  teacher_id    TEXT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  teacher_name  TEXT NOT NULL,
  teacher_title TEXT,
  intro         TEXT,
  tags          TEXT CHECK (tags IS NULL OR json_valid(tags)),
  requirements  TEXT CHECK (requirements IS NULL OR json_valid(requirements))
);

CREATE TABLE IF NOT EXISTS applications (
  student_id   TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  round        INTEGER NOT NULL DEFAULT 1 CHECK (round >= 1),
  internal     INTEGER NOT NULL DEFAULT 0 CHECK (internal IN (0, 1)),
  cross        INTEGER NOT NULL DEFAULT 0 CHECK (cross IN (0, 1)),
  intro        TEXT,
  submitted_at INTEGER NOT NULL,
  version      INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE IF NOT EXISTS application_labs (
  student_id TEXT NOT NULL REFERENCES applications (student_id) ON DELETE CASCADE,
  lab_id     TEXT NOT NULL REFERENCES labs (id) ON DELETE CASCADE,
  position   INTEGER NOT NULL CHECK (position BETWEEN 0 AND 2),
  PRIMARY KEY (student_id, lab_id),
  UNIQUE (student_id, position)
);

CREATE TABLE IF NOT EXISTS application_versions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  labs       TEXT NOT NULL CHECK (json_valid(labs)),
  internal   INTEGER NOT NULL CHECK (internal IN (0, 1)),
  cross      INTEGER NOT NULL CHECK (cross IN (0, 1)),
  at         INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS interviews (
  id         TEXT PRIMARY KEY,
  lab_id     TEXT NOT NULL REFERENCES labs (id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  at         INTEGER NOT NULL,
  room       TEXT,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  total      INTEGER CHECK (total IS NULL OR (total BETWEEN 0 AND 100)),
  attitude   INTEGER CHECK (attitude IS NULL OR (attitude BETWEEN 0 AND 100)),
  logic      INTEGER CHECK (logic IS NULL OR (logic BETWEEN 0 AND 100)),
  coding     INTEGER CHECK (coding IS NULL OR (coding BETWEEN 0 AND 100)),
  comm       INTEGER CHECK (comm IS NULL OR (comm BETWEEN 0 AND 100)),
  scored_by  TEXT,
  comment    TEXT,
  locked     INTEGER NOT NULL DEFAULT 0 CHECK (locked IN (0, 1)),
  UNIQUE (lab_id, student_id)
);

CREATE TABLE IF NOT EXISTS nominations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  lab_id     TEXT NOT NULL REFERENCES labs (id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('accept', 'wait', 'internal')),
  rank       INTEGER NOT NULL CHECK (rank >= 1),
  round      INTEGER NOT NULL DEFAULT 1 CHECK (round >= 1),
  status     TEXT CHECK (status IS NULL OR status IN ('released', 'expired', 'promoted')),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS confirmations (
  student_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  lab_id     TEXT NOT NULL REFERENCES labs (id) ON DELETE CASCADE,
  source     TEXT NOT NULL CHECK (source IN ('auto', 'choice', 'alloc')),
  at         INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS allocations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  lab_id     TEXT NOT NULL REFERENCES labs (id) ON DELETE CASCADE,
  priority   TEXT NOT NULL CHECK (priority IN ('P1', 'P2', 'P3')),
  reason     TEXT NOT NULL CHECK (length(trim(reason)) >= 4),
  at         INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS publicity (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  published_at INTEGER,
  until        INTEGER,
  CHECK (until IS NULL OR published_at IS NULL OR until > published_at)
);

CREATE TABLE IF NOT EXISTS objections (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  text       TEXT NOT NULL CHECK (length(trim(text)) >= 5),
  at         INTEGER NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved'))
);

CREATE TABLE IF NOT EXISTS audit (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  at     INTEGER NOT NULL,
  actor  TEXT NOT NULL,
  role   TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin', 'system')),
  action TEXT NOT NULL,
  detail TEXT
);

-- ---------------------------------------------------------------------------
-- 索引：覆盖按实训室、按学生、按时间的常用查询
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_role       ON users (role);
CREATE INDEX IF NOT EXISTS idx_labs_teacher     ON labs (teacher_id);
CREATE INDEX IF NOT EXISTS idx_app_labs_lab     ON application_labs (lab_id);
CREATE INDEX IF NOT EXISTS idx_iv_lab           ON interviews (lab_id, status);
CREATE INDEX IF NOT EXISTS idx_iv_student       ON interviews (student_id);
CREATE INDEX IF NOT EXISTS idx_nom_lab_type     ON nominations (lab_id, type, status, rank);
CREATE INDEX IF NOT EXISTS idx_nom_student      ON nominations (student_id);
CREATE INDEX IF NOT EXISTS idx_conf_lab         ON confirmations (lab_id);
CREATE INDEX IF NOT EXISTS idx_alloc_lab        ON allocations (lab_id);
CREATE INDEX IF NOT EXISTS idx_audit_at         ON audit (at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry  ON sessions (expires_at);

-- 同一实训室下，一名学生只能有一条“有效”名单记录
CREATE UNIQUE INDEX IF NOT EXISTS uq_nomination_active
  ON nominations (lab_id, student_id) WHERE status IS NULL;

-- ---------------------------------------------------------------------------
-- 视图：汇总每个实训室的实际占用（拟录取 ∪ 已确认 ∪ 已调剂，去重）
-- ---------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_lab_capacity AS
SELECT
  l.id    AS lab_id,
  l.name  AS lab_name,
  l.quota AS quota,
  (
    SELECT COUNT(*) FROM (
      SELECT student_id FROM nominations WHERE lab_id = l.id AND type = 'accept' AND status IS NULL
      UNION
      SELECT student_id FROM confirmations WHERE lab_id = l.id
      UNION
      SELECT student_id FROM allocations WHERE lab_id = l.id
    )
  ) AS taken
FROM labs l;

-- ---------------------------------------------------------------------------
-- 触发器：数据库层兜底，绝不允许超录
-- ---------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_nomination_capacity_insert
BEFORE INSERT ON nominations
WHEN NEW.type = 'accept' AND NEW.status IS NULL
BEGIN
  SELECT CASE
    WHEN (SELECT quota FROM labs WHERE id = NEW.lab_id) <= (
      SELECT taken FROM v_lab_capacity WHERE lab_id = NEW.lab_id
    )
    THEN RAISE(ABORT, '名额已满')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_nomination_capacity_update
BEFORE UPDATE OF type, status ON nominations
WHEN NEW.type = 'accept' AND NEW.status IS NULL
     AND NOT (OLD.type = 'accept' AND OLD.status IS NULL)
BEGIN
  SELECT CASE
    WHEN (SELECT quota FROM labs WHERE id = NEW.lab_id) <= (
      SELECT taken FROM v_lab_capacity WHERE lab_id = NEW.lab_id
    )
    THEN RAISE(ABORT, '名额已满')
  END;
END;
