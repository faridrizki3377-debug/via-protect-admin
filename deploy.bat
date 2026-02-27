@echo off
set /p repo_url="Masukkan URL Repository GitHub Anda: "

echo Menyiapkan Git...
git init
git add .
git commit -m "Update Backend & Admin Panel Anti-Error"
git branch -M main
git remote add origin %repo_url%
git push -u origin main --force

echo.
echo ==========================================
echo BERHASIL! File sudah terupload ke GitHub.
echo Sekarang buka Vercel dan hubungkan repo ini.
echo ==========================================
pause
