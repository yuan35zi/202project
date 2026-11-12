/* 备份数据库（VACUUM INTO，生成一致性快照）
   用法：node scripts/db-backup.js [目标目录]
*/
const fs = require('fs');
const path = require('path');
const db = require('../server/db');

const dir = process.argv[2] || path.join(__dirname, '..', 'data', 'backups');
try {
  const file = db.backup(dir);
  console.log('备份完成：' + file);
  console.log('大小：' + (fs.statSync(file).size / 1024).toFixed(1) + ' KB');
  db.close();
} catch (err) {
  console.error('备份失败：' + err.message);
  process.exitCode = 1;
}
