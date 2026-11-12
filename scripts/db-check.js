/* 数据库体检：完整性、外键、结构版本、各表行数 */
const db = require('../server/db');

try {
  const info = db.info();
  console.log('数据库文件：' + info.file);
  console.log('文件大小：' + (info.size / 1024).toFixed(1) + ' KB');
  console.log('结构版本：v' + info.schema.version + '（已应用 ' + info.schema.applied + ' 个迁移）');
  console.log('完整性检查：' + info.integrity);
  console.log('外键异常：' + info.foreignKeys + ' 条');
  console.log('表行数：');
  Object.keys(info.tables).forEach((t) => {
    console.log('  ' + t.padEnd(20) + info.tables[t]);
  });

  db.close();
  if (info.integrity !== 'ok') process.exitCode = 1;
  else if (info.foreignKeys > 0) process.exitCode = 2;
} catch (err) {
  console.error('体检失败：' + err.message);
  process.exitCode = 3;
}
