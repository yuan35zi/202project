@echo off
chcp 65001 >nul
title 实训室进组选拔系统
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [错误] 未检测到 Node.js。
  echo 请先安装 Node.js 22.5 或更高版本：https://nodejs.org
  echo.
  pause
  exit /b 1
)

echo.
echo   实训室进组选拔系统
echo   服务地址：http://127.0.0.1:8123
echo   数据文件：data\app.db
echo   演示账号：2023040101 / T102 / admin，密码 123456
echo.
echo   正在启动，浏览器将在 2 秒后打开...
echo   关闭本窗口即停止服务。
echo.

start "" /min cmd /c "timeout /t 2 >nul && start http://127.0.0.1:8123"
node server.js
echo.
echo 服务已停止。
pause
