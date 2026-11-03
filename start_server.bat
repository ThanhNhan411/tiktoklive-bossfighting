@echo off
chcp 65001 > nul
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
title TikTok Live Boss Fight Server
color 0A
echo ========================================================
echo    TIKTOK LIVE INTERACTIVE GAME - BOSS FIGHT SERVER
echo ========================================================
echo.
echo [INFO] Dang khoi chay may chu Flask...
echo.
echo -> Mua Game Overlay: http://localhost:5000/game
echo -> Bang Dieu Khien:  http://localhost:5000/admin
echo.
python app.py
pause
