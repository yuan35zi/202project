/* ==========================================================================
   数据库层：连接、迁移、种子、备份、重置
   使用 Node 内置 node:sqlite（Node >= 22.5），无需任何第三方依赖。
   ========================================================================== */
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const { seed, hashPassword } = require('./seed');

const DEFAULT_PATH = path.join(__dirname, '..', 'data', 'app.db');
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

let db = null;

/* ---------- 基础 ---------- */
function dbFile() {
  return process.env.DB_PATH || DEFAULT_PATH;
}

function connect() {
  const file = dbFile();
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const conn = new DatabaseSync(file);
  conn.exec('PRAGMA journal_mode = WAL');
  conn.exec('PRAGMA foreign_keys = ON');
  conn.exec('PRAGMA busy_timeout = 5000');
  conn.exec('PRAGMA synchronous = NORMAL');
  return conn;
}

function tableExists(d, name) {
  return !!d.prepare("SELECT 1 x FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

function removeFiles(file) {
  ['', '-wal', '-shm'].forEach((suffix) => {
    try { fs.rmSync(file + suffix, { force: true }); } catch (e) { /* ignore */ }
  });
}

/* ---------- 迁移 ---------- */
function applyMigrations(d) {
  d.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    applied_at INTEGER NOT NULL
  )`);
  const applied = new Set(d.prepare('SELECT version FROM schema_migrations').all().map((r) => r.version));
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  let count = 0;
  files.forEach((file) => {
    const version = parseInt(file.split('_')[0], 10);
    if (!Number.isFinite(version) || applied.has(version)) return;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    d.exec('BEGIN IMMEDIATE');
    try {
      d.exec(sql);
      d.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?,?,?)').run(version, file, Date.now());
      d.exec('COMMIT');
      count++;
    } catch (err) {
      try { d.exec('ROLLBACK'); } catch (e) { /* ignore */ }
      throw new Error('迁移 ' + file + ' 执行失败：' + err.message);
    }
  });
  return count;
}

function schemaVersion(d) {
  try {
    const row = d.prepare('SELECT MAX(version) v, COUNT(*) c FROM schema_migrations').get();
    return { version: row.v || 0, applied: row.c || 0 };
  } catch (e) {
    return { version: 0, applied: 0 };
  }
}

/* ---------- 打开（含旧库识别与重建） ---------- */
function open() {
  if (db) return db;
  const file = dbFile();
  db = connect();

  if (!tableExists(db, 'schema_migrations') && tableExists(db, 'users')) {
    // 旧版本直接建表的数据库：先做一致性备份，再按迁移重建（演示数据可重新生成）
    let backupPath = '';
    try {
      backupPath = path.join(path.dirname(file), 'legacy-' + stamp() + '.db');
      db.prepare('VACUUM INTO ?').run(backupPath);
    } catch (e) {
      backupPath = '（备份失败：' + e.message + '）';
    }
    db.close();
    db = null;
    if (file !== ':memory:') removeFiles(file);
    db = connect();
    console.log('[db] 检测到旧版结构，已重建并备份到：' + backupPath);
  }

  const migrated = applyMigrations(db);
  if (migrated) console.log('[db] 已应用 ' + migrated + ' 个迁移');

  const row = db.prepare('SELECT COUNT(*) c FROM users').get();
  if (!row.c) {
    const stat = seed(db);
    console.log('[db] 已写入演示数据：学生 ' + stat.students + ' 人 / 实训室 ' + stat.labs +
      ' 个 / 面试 ' + stat.interviews + ' 场 / 名单 ' + stat.nominations + ' 条');
  }
  return db;
}

/* ---------- 事务 ---------- */
function tx(fn) {
  const d = open();
  d.exec('BEGIN IMMEDIATE');
  try {
    const r = fn(d);
    d.exec('COMMIT');
    return r;
  } catch (err) {
    try { d.exec('ROLLBACK'); } catch (e) { /* ignore */ }
    throw err;
  }
}

/* ---------- 清空与重置 ---------- */
function truncate(d) {
  [
    'sessions', 'confirmations', 'allocations', 'objections', 'nominations', 'interviews',
    'application_versions', 'application_labs', 'applications', 'labs', 'stages', 'cycle',
    'users', 'audit', 'publicity', 'meta'
  ].forEach((t) => d.exec('DELETE FROM ' + t));
  d.exec("DELETE FROM sqlite_sequence WHERE name IN ('nominations','allocations','objections','audit','application_versions')");
}

/** 保留结构，清空并重灌演示数据 */
function resetDemo() {
  const d = open();
  tx((conn) => { truncate(conn); seed(conn); });
  checkpoint();
  return true;
}

/** 删库重建：按迁移重新建表并灌入演示数据 */
function resetHard() {
  const file = dbFile();
  if (db) { try { db.close(); } catch (e) { /* ignore */ } db = null; }
  if (file !== ':memory:') removeFiles(file);
  open();
  return true;
}

/* ---------- 备份与体检 ---------- */
function backup(dir) {
  const d = open();
  const target = path.join(dir || path.join(path.dirname(dbFile()), 'backups'), 'app-' + stamp() + '.db');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  d.prepare('VACUUM INTO ?').run(target);
  return target;
}

function checkpoint() {
  if (!db) return;
  try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch (e) { /* ignore */ }
}

function close() {
  if (!db) return;
  checkpoint();
  try { db.close(); } catch (e) { /* ignore */ }
  db = null;
}

function info() {
  const d = open();
  const file = dbFile();
  const size = file === ':memory:' ? 0 : (fs.existsSync(file) ? fs.statSync(file).size : 0);
  const tables = {};
  ['users', 'labs', 'applications', 'application_labs', 'interviews', 'nominations',
    'confirmations', 'allocations', 'objections', 'audit', 'sessions'].forEach((t) => {
    try { tables[t] = d.prepare('SELECT COUNT(*) c FROM ' + t).get().c; } catch (e) { tables[t] = null; }
  });
  return {
    file,
    size,
    schema: schemaVersion(d),
    tables,
    integrity: d.prepare('PRAGMA integrity_check').get().integrity_check,
    foreignKeys: d.prepare('PRAGMA foreign_key_check').all().length
  };
}

module.exports = {
  open, tx, resetDemo, resetHard, backup, checkpoint, close, info,
  hashPassword, dbFile
};
