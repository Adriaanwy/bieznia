@echo off
chcp 65001 > nul
title Bieżnia - Aplikacja Lekkoatletyczna (Sezon 2026)
cls
echo ======================================================================
echo    BIEZNIA - APLIKACJA LEKKOATLETYCZNA (SEZON 2026)
echo ======================================================================
echo.
echo [1/2] Sprawdzanie i inicjalizacja bazy danych SQLite...
echo [2/2] Uruchamianie serwera oraz otwieranie strony w przegladarce...
echo.
echo Adres lokalny: http://127.0.0.1:8000
echo.
echo Pozostaw to okno otwarte podczas korzystania z aplikacji.
echo Aby zakonczyc dzialanie serwera, zamknij to okno lub wcisnij Ctrl+C.
echo ======================================================================
echo.

cd /d "%~dp0"
python server.py
pause
