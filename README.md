# 🏃 Bieżnia – Aplikacja Lekkoatletyczna (Sezon 2026)

Nowoczesna aplikacja webowa do przeglądania i analizy wyników lekkoatletycznych, zintegrowana z lokalną bazą danych **SQLite**.

Stworzona zgodnie z projektem w Figmie, z zachowaniem czystej semantyki HTML5, responsywnego układu CSS3 (Flexbox & CSS Grid) oraz dynamicznej komunikacji z bazą.

---

## 🚀 Jak uruchomić projekt

Wymagania: Zainstalowany **Python 3** (wersja 3.8+). Projekt nie wymaga instalowania żadnych dodatkowych bibliotek (`pip`) – korzysta wyłącznie z wbudowanej biblioteki standardowej Pythona (`sqlite3`, `http.server`, `urllib`).

### Metoda 1: Najprostsza (Windows)
1. Kliknij dwukrotnie plik **`uruchom.bat`**.
2. Serwer automatycznie wystartuje, a strona otworzy się w Twojej domyślnej przeglądarce pod adresem:
   👉 **http://127.0.0.1:8000**

### Metoda 2: Z wiersza poleceń / terminala
1. Otwórz terminal (PowerShell, CMD, bash) w folderze projektu.
2. Wpisz polecenie:
   ```bash
   python server.py
   ```
3. Otwórz w przeglądarce: **http://127.0.0.1:8000**

---

## 🛠️ Funkcjonalności

- **Prawdziwa baza danych SQLite (`bieznia.db`)**: 18 startów lekkoatletycznych w 3 konkurencjach (100 m, 400 m, Skok w dal) i 4 klubach.
- **Dynamiczne wyszukiwanie z przyciskiem „Szukaj”**: Filtrowanie tabeli po nazwisku zawodnika lub nazwie klubu.
- **Filtrowanie konkurencji i klubów**: Natychmiastowe zawężanie wyników (np. tylko 100 m).
- **Sortowanie numeryczne i chronologiczne**:
  - Data malejąco / Data rosnąco
  - Wynik rosnąco (najszybszy bieg na górze) / Wynik malejąco (najdłuższy skok na górze)
- **Dodawanie wyników z walidacją**: Formularz zgłoszenia nowego wyniku z podglądem karty na żywo (`Live Preview`) i bezpośrednim zapisem do bazy SQLite.
- **100% Czysty CSS3**: Brak frameworków typu Bootstrap czy Tailwind – układ oparty na CSS Grid i Flexbox z pełną responsywnością (desktop, tablet, mobile).

---

## 📁 Struktura plików

```
bieznia-app/
├── index.html       # Główny plik strony (HTML5)
├── style.css        # Kompletne style aplikacji (CSS3)
├── app.js           # Logika frontendu (fetch API, filtry, walidacja)
├── server.py        # Serwer HTTP w Pythonie z obsługą bazy SQLite
├── bieznia.db       # Baza danych SQLite z wynikami
├── uruchom.bat      # Skrót 1-klik do uruchamiania na Windowsie
└── README.md        # Niniejsza dokumentacja
```
