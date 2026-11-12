/* 重置演示数据
   默认：保留表结构，清空并重灌（软重置）
   --hard：删库重建，按 migrations 重新建表（结构升级后用）
*/
const db = require('../server/db');

const hard = process.argv.includes('--hard');
try {
  if (hard) db.resetHard();
  else db.resetDemo();
  const info = db.info();
  console.log((hard ? '已删库重建' : '已重置演示数据') + '：' + info.file);
  console.log('结构版本 v' + info.schema.version + '，学生 ' + info.tables.users + ' 个账号，面试 ' + info.tables.interviews + ' 场');
  db.close();
} catch (err) {
  console.error('重置失败：' + err.message);
  process.exitCode = 1;
}
