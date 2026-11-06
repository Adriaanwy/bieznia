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
- **Eksport do CSV**: Pobieranie aktualnie przefiltrowanych rekordów do pliku `.csv` ze znacznikiem UTF-8 BOM (pełna zgodność z polskimi znakami w Excelu i Google Sheets).
- **Interaktywny wykres CSS Grid / Flexbox**: Możliwość przełączania konkurencji (100 m, 400 m, Skok w dal) z automatycznym przeliczaniem skali, średnich i rozstępu.
- **Zaawansowana Personalizacja Wyglądu i Dostępność**:
  - 🌗 **Tryb Ciemny / Jasny (Dark Mode)**: Szybki przełącznik 1-klik w nagłówku oraz pełny wybór (Jasny / Ciemny / Automatyczny wg preferencji systemu operacyjnego).
  - 🔠 **Pogrubienie czcionki (Wysoka czytelność)**: Możliwość zwiększenia wagi fontu dla wyrazistego, kontrastowego tekstu.
  - 🔍 **Skalowanie rozmiaru tekstu**: Trzystopniowa regulacja wielkości czcionki (Domyślny 100%, Średni 110%, Duży 120%) bez rozbijania układu.
  - 🎨 **Akcenty kolorystyczne**: 4 sportowe palety przewodnie (Błękit lekkoatletyczny, Szmaragd murawy, Sprint tartanowy, Królewski fiolet).
  - 💾 **Trwałość ustawień (`localStorage`)**: Pamięć wyborów użytkownika z natychmiastowym wczytaniem (ochrona przed efektem FOUC).
  - 🔔 **Powiadomienia Toast**: Elegancki dymek informujący o zastosowaniu wprowadzonych zmian.
- **100% Czysty CSS3**: Brak frameworków typu Bootstrap czy Tailwind – układ oparty na CSS Grid i Flexbox z pełną responsywnością (desktop, tablet, mobile).

---

## 🛡️ Moduł Bezpieczeństwa i Ochrony Danych

Aplikacja została wyposażona w kompleksowy, produkcyjnej klasy system bezpieczeństwa spełniający wytyczne **OWASP**, **NIST SP 800-63B** oraz **RFC 8018**, oparty wyłącznie o wbudowaną bibliotekę standardową Pythona:

### 1. Bezpieczne przechowywanie danych uwierzytelniających (Cryptography)
- **Algorytm:** `PBKDF2-HMAC-SHA256` z **210 000 iteracji** (oficjalna rekomendacja OWASP / NIST SP 800-63B chroniąca przed atakami słownikowymi i akceleracją GPU/ASIC).
- **Kryptograficznie bezpieczna sól:** Unikalna dla każdego użytkownika sól o długości 256 bitów (32 bajty) generowana przez CSPRNG (`secrets.token_bytes(32)`), neutralizująca tablice tęczowe (rainbow tables).
- **Porównywanie w stałym czasie:** Weryfikacja hasła za pomocą `secrets.compare_digest` eliminująca podatność na ataki czasowe (timing attacks).
- **Brak zapisu plain-text:** Hasła nigdy nie są logowane ani zapisywane w postaci jawnej.

### 2. Bezpieczny proces logowania i weryfikacji tożsamości
- **Odporność na enumerację użytkowników:**
  - Jednakowy, generyczny komunikat błędu (*„Nieprawidłowy login lub hasło.”*) niezależnie od tego, czy konto istnieje, czy podano błędne hasło.
  - Wykonywanie obliczenia atrapowego (`dummy_verify_password()` o identycznym koszcie 210 000 iteracji PBKDF2), gdy użytkownik nie istnieje, co uniemożliwia enumerację poprzez analizę czasu odpowiedzi serwera (side-channel timing attacks).
- **Ochrona przed atakami Brute-Force & Credential Stuffing:**
  - Mechanizm blokady konta (*Account Lockout*): po **5 nieudanych próbach logowania** konto zostaje zablokowane na **15 minut** (`lockout_until`).
  - Licznik błędnych prób jest zerowany po poprawnym zalogowaniu.
- **Polityka złożoności haseł (OWASP Password Policy):**
  - Minimum 8 znaków, maksimum 128 (ochrona przed DoS / ReDoS).
  - Wymóg: co najmniej jedna mała litera, jedna wielka litera, jedna cyfra oraz jeden znak specjalny.
  - Interaktywny wskaźnik siły hasła na frontendzie z dynamicznym sprawdzaniem punktów kontrolnych.

### 3. Ochrona warstwy danych i autoryzacja (RBAC & SQL Injection Defense)
- **100% zapytań sparametryzowanych:** Wszystkie zapytania do bazy SQLite korzystają z bindowania parametrów (`?`), całkowicie eliminując podatność na SQL Injection.
- **Biała lista sortowania:** Parametry sortowania i filtrowania są rygorystycznie walidowane na podstawie dozwolonych wartości.
- **Kontrola dostępu oparta na rolach (Role-Based Access Control - RBAC):**
  - `kibic` / `uzytkownik` (rola publiczna): bezpieczny dostęp tylko do odczytu, wyszukiwania, analizy statystycznej i eksportu CSV.
  - `sedzia` (rola sędziowska): autoryzacja do zatwierdzania i dopisywania oficjalnych wyników zawodów (`POST /api/wyniki`). Niezalogowani użytkownicy widzą elegancki baner strefy autoryzowanej z blokadą formularza.
  - `admin` (rola administratora): pełne uprawnienia, w tym autoryzowane usuwanie rekordów z bazy (`DELETE /api/wyniki`) oraz wgląd w dziennik audytu.
- **Dziennik audytu bezpieczeństwa (*Security Audit Trail*):**
  - Trwała tabela `audit_logs` w SQLite rejestrująca zdarzenia: `LOGIN_SUCCESS`, `LOGIN_FAILED`, `ACCOUNT_LOCKED`, `LOGOUT`, `REGISTER_SUCCESS`, `RESULT_ADDED`, `RESULT_DELETED`, `ACCESS_DENIED`.
  - Rejestracja znaczników czasu UTC, adresu IP, nazwy konta i szczegółów operacji.
  - Dedykowany podgląd audytu w czasie rzeczywistym dla Administratora w interfejsie aplikacji.

### 4. Walidacja danych i zarządzanie sesją (Session Management & Defense-in-Depth)
- **Kryptograficzne tokeny sesyjne:** Identyfikator sesji o 256-bitowej entropii generowany przez CSPRNG (`secrets.token_hex(32)`).
- **Zarządzanie stanem sesji:** Tabela `sessions` w bazie danych z przesuwnym czasem wygaśnięcia (*sliding expiration*, 2 godziny).
- **Bezpieczne ciasteczka HTTP:**
  - `HttpOnly`: flaga uniemożliwiająca dostęp do ciasteczka skryptom JavaScript, neutralizująca ryzyko kradzieży sesji przez ataki XSS.
  - `SameSite=Lax`: ochrona przed atakami Cross-Site Request Forgery (CSRF).
- **Nagłówki bezpieczeństwa HTTP wstrzykiwane do każdego zapytania:**
  - `X-Content-Type-Options: nosniff` (ochrona przed MIME sniffing).
  - `X-Frame-Options: DENY` (ochrona przed Clickjackingiem).
  - `X-XSS-Protection: 1; mode=block`.
  - `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Content-Security-Policy: default-src 'self' ...`.
- **Sanityzacja danych wejściowych:** Ucieczka encji HTML (`html.escape`) oraz ścisła walidacja typów i zakresów liczbowych (zapobieganie Stored XSS).

---

## 🔑 Predefiniowane konta demonstracyjne do testowania

Dla ułatwienia oceny przez prowadzącego, w modalu logowania dostępne są **przyciski szybkiego logowania 1-klik**, jak również dane dostępowe:

| Rola w systemie | Login | Hasło | Uprawnienia |
| :--- | :--- | :--- | :--- |
| **Sędzia PZLA** | `sedzia` | `Sedzia2026!#` | Wprowadzanie oficjalnych wyników do bazy |
| **Administrator** | `admin` | `Admin2026!#` | Zarządzanie, usuwanie rekordów, dziennik audytu |
| **Kibic / Gość** | `kibic` | `Kibic2026!#` | Dostęp do odczytu, brak uprawnień do edycji |

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
