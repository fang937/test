// 重置 Java 后端（H2）演示数据：删除数据目录后提示重启
// 注意：应用运行中时数据文件被锁定，需先停止
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'backend-java', 'data');
try {
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('已删除 H2 数据目录：', dir);
  console.log('（重新启动后端即自动重建演示数据；MySQL 模式请改用 SQL 清空或重建库）');
} catch (e) {
  console.error('重置失败：', e.message);
  console.error('若提示文件被占用，请先停止正在运行的 Java 后端再执行。');
  process.exit(1);
}
