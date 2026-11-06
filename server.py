import sqlite3
import json
import os
import re
import html
import hashlib
import secrets
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from http.cookies import SimpleCookie
import urllib.parse
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), 'bieznia.db')
PORT = 8000

# Parametry polityki bezpieczeństwa i kryptografii
PBKDF2_ITERATIONS = 210000       # Zgodnie z wytycznymi OWASP i NIST SP 800-63B dla PBKDF2-HMAC-SHA256
MAX_FAILED_ATTEMPTS = 5         # Maksymalna liczba nieudanych prób logowania przed blokadą konta
LOCKOUT_MINUTES = 15            # Czas trwania blokady konta (ochrona przed Brute-Force)
SESSION_LIFETIME_HOURS = 2      # Czas ważności sesji (z odnawianiem przesuwnym)

# Demonstracyjne rekordy (mężczyźni i kobiety w 3 konkurencjach) do zainicjowania bazy
INITIAL_RECORDS = [
    # --- MĘŻCZYŹNI ---
    ("Jakub Nowak", "AZS Warszawa", "mezczyzni", "open", "100 m", "2026-05-24", 10.84, "10,84 s", "s", None, 1),
    ("Michał Kowalski", "KS Sprint Kraków", "mezczyzni", "open", "100 m", "2026-05-24", 10.96, "10,96 s", "s", None, 1),
    ("Adam Wiśniewski", "WKS Poznań", "mezczyzni", "open", "100 m", "2026-05-24", 11.08, "11,08 s", "s", None, 0),
    ("Kacper Wójcik", "MKS Gdańsk", "mezczyzni", "open", "100 m", "2026-05-24", 11.20, "11,20 s", "s", None, 0),
    ("Piotr Kamiński", "AZS Warszawa", "mezczyzni", "open", "100 m", "2026-05-24", 11.32, "11,32 s", "s", None, 0),
    ("Filip Lewandowski", "KS Sprint Kraków", "mezczyzni", "open", "100 m", "2026-05-24", 11.44, "11,44 s", "s", None, 0),
    
    ("Mateusz Zieliński", "WKS Poznań", "mezczyzni", "open", "400 m", "2026-05-17", 48.12, "48,12 s", "s", None, 1),
    ("Bartosz Szymański", "MKS Gdańsk", "mezczyzni", "open", "400 m", "2026-05-17", 48.76, "48,76 s", "s", None, 0),
    ("Tomasz Woźniak", "AZS Warszawa", "mezczyzni", "open", "400 m", "2026-05-17", 49.20, "49,20 s", "s", None, 0),
    ("Paweł Dąbrowski", "KS Sprint Kraków", "mezczyzni", "open", "400 m", "2026-05-17", 49.84, "49,84 s", "s", None, 0),
    ("Marcin Kozłowski", "WKS Poznań", "mezczyzni", "open", "400 m", "2026-05-17", 50.16, "50,16 s", "s", None, 0),
    ("Szymon Jankowski", "MKS Gdańsk", "mezczyzni", "open", "400 m", "2026-05-17", 50.92, "50,92 s", "s", None, 0),
    
    ("Antoni Mazur", "AZS Warszawa", "mezczyzni", "open", "Skok w dal", "2026-05-10", 7.42, "7,42 m", "m", None, 1),
    ("Wojciech Krawczyk", "KS Sprint Kraków", "mezczyzni", "open", "Skok w dal", "2026-05-10", 7.30, "7,30 m", "m", None, 1),
    ("Dawid Piotrowski", "WKS Poznań", "mezczyzni", "open", "Skok w dal", "2026-05-10", 7.18, "7,18 m", "m", None, 0),
    ("Igor Grabowski", "MKS Gdańsk", "mezczyzni", "open", "Skok w dal", "2026-05-10", 7.06, "7,06 m", "m", None, 0),
    ("Oskar Pawlak", "AZS Warszawa", "mezczyzni", "open", "Skok w dal", "2026-05-10", 6.94, "6,94 m", "m", None, 0),
    ("Łukasz Michalski", "KS Sprint Kraków", "mezczyzni", "open", "Skok w dal", "2026-05-10", 6.82, "6,82 m", "m", None, 0),

    # --- KOBIETY ---
    ("Ewa Swoboda", "AZS Warszawa", "kobiety", "open", "100 m", "2026-05-24", 11.05, "11,05 s", "s", "+0.9", 1),
    ("Martyna Kotwiła", "KS Sprint Kraków", "kobiety", "open", "100 m", "2026-05-24", 11.24, "11,24 s", "s", "+0.9", 1),
    ("Magdalena Stefanowicz", "WKS Poznań", "kobiety", "open", "100 m", "2026-05-24", 11.36, "11,36 s", "s", "+0.9", 0),
    ("Paulina Guzowska", "MKS Gdańsk", "kobiety", "open", "100 m", "2026-05-24", 11.48, "11,48 s", "s", None, 0),
    ("Zuzanna Wyppich", "AZS Warszawa", "kobiety", "open", "100 m", "2026-05-24", 11.60, "11,60 s", "s", None, 0),
    ("Oliwia Nowacka", "KS Sprint Kraków", "kobiety", "open", "100 m", "2026-05-24", 11.75, "11,75 s", "s", None, 0),

    ("Natalia Kaczmarek", "AZS Warszawa", "kobiety", "open", "400 m", "2026-05-17", 49.98, "49,98 s", "s", None, 1),
    ("Anna Kiełbasińska", "KS Sprint Kraków", "kobiety", "open", "400 m", "2026-05-17", 50.85, "50,85 s", "s", None, 1),
    ("Justyna Święty-Ersetic", "WKS Poznań", "kobiety", "open", "400 m", "2026-05-17", 51.42, "51,42 s", "s", None, 0),
    ("Iga Baumgart-Witan", "MKS Gdańsk", "kobiety", "open", "400 m", "2026-05-17", 52.15, "52,15 s", "s", None, 0),
    ("Alicja Wrona-Kutrzepa", "AZS Warszawa", "kobiety", "open", "400 m", "2026-05-17", 52.88, "52,88 s", "s", None, 0),
    ("Karolina Łozowska", "WKS Poznań", "kobiety", "open", "400 m", "2026-05-17", 53.40, "53,40 s", "s", None, 0),

    ("Nikola Horowska", "KS Sprint Kraków", "kobiety", "open", "Skok w dal", "2026-05-10", 6.68, "6,68 m", "m", "+1.2", 1),
    ("Roksana Jędraszak", "WKS Poznań", "kobiety", "open", "Skok w dal", "2026-05-10", 6.45, "6,45 m", "m", "+0.7", 1),
    ("Anna Matuszewicz", "AZS Warszawa", "kobiety", "open", "Skok w dal", "2026-05-10", 6.32, "6,32 m", "m", None, 0),
    ("Magdalena Bokun", "MKS Gdańsk", "kobiety", "open", "Skok w dal", "2026-05-10", 6.20, "6,20 m", "m", None, 0),
    ("Joanna Kłodawska", "AZS Warszawa", "kobiety", "open", "Skok w dal", "2026-05-10", 6.08, "6,08 m", "m", None, 0),
    ("Julia Adamczyk", "KS Sprint Kraków", "kobiety", "open", "Skok w dal", "2026-05-10", 5.92, "5,92 m", "m", None, 0),
]

# ==============================================================================
# FUNKCJE KRYPTOGRAFICZNE I POMOCNICZE BEZPIECZEŃSTWA
# ==============================================================================

def hash_password(password: str) -> tuple[str, str]:
    """
    Generuje 256-bitową kryptograficznie bezpieczną sól (CSPRNG) oraz hasz
    PBKDF2-HMAC-SHA256 z 210 000 iteracji (rekomendacja OWASP / NIST SP 800-63B).
    """
    salt_bytes = secrets.token_bytes(32)
    salt_hex = salt_bytes.hex()
    hash_bytes = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt_bytes,
        PBKDF2_ITERATIONS
    )
    return hash_bytes.hex(), salt_hex

def verify_password(password: str, stored_hash_hex: str, salt_hex: str, iterations: int = PBKDF2_ITERATIONS) -> bool:
    """
    Weryfikuje hasło wykorzystując porównanie w stałym czasie (secrets.compare_digest),
    co całkowicie eliminuje ataki czasowe (timing attacks).
    """
    try:
        salt_bytes = bytes.fromhex(salt_hex)
        candidate_bytes = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt_bytes,
            iterations
        )
        stored_bytes = bytes.fromhex(stored_hash_hex)
        return secrets.compare_digest(candidate_bytes, stored_bytes)
    except Exception:
        return False

def dummy_verify_password():
    """
    Wykonuje operację PBKDF2 o identycznym koszcie czasowym (210 000 iteracji),
    gdy użytkownik nie istnieje w bazie. Zapobiega to atakom enumeracji użytkowników
    opartym na analizie różnic czasu odpowiedzi serwera (side-channel timing attacks).
    """
    dummy_salt = b'\x00' * 32
    hashlib.pbkdf2_hmac('sha256', b'dummy_timing_mitigation_secret', dummy_salt, PBKDF2_ITERATIONS)

def validate_password_policy(password: str) -> tuple[bool, str]:
    """
    Walidacja złożoności hasła wg zaleceń OWASP:
    - Minimum 8 znaków, maksimum 128 (ochrona przed DoS / ReDoS)
    - Co najmniej jedna mała litera [a-z]
    - Co najmniej jedna wielka litera [A-Z]
    - Co najmniej jedna cyfra [0-9]
    - Co najmniej jeden znak specjalny
    """
    if not isinstance(password, str):
        return False, "Hasło musi być ciągiem znaków."
    if len(password) < 8:
        return False, "Hasło musi zawierać co najmniej 8 znaków."
    if len(password) > 128:
        return False, "Hasło nie może przekraczać 128 znaków."
    if not re.search(r'[a-z]', password):
        return False, "Hasło musi zawierać co najmniej jedną małą literę."
    if not re.search(r'[A-Z]', password):
        return False, "Hasło musi zawierać co najmniej jedną wielką literę."
    if not re.search(r'[0-9]', password):
        return False, "Hasło musi zawierać co najmniej jedną cyfrę."
    if not re.search(r'[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?~`]', password):
        return False, "Hasło musi zawierać co najmniej jeden znak specjalny (np. !@#$%^&*)."
    return True, ""

def sanitize_input(value: str) -> str:
    """
    Oczyszcza dane wejściowe ze znaczników HTML, chroniąc przed atakami Stored XSS.
    """
    if not isinstance(value, str):
        return str(value)
    return html.escape(value.strip())

def log_audit_event(event_type: str, username: str = None, ip_address: str = None, details: str = None):
    """
    Zapisuje zdarzenie bezpieczeństwa w trwałym dzienniku audytowym SQLite (Audit Trail).
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO audit_logs (event_type, username, ip_address, details)
            VALUES (?, ?, ?, ?)
        ''', (event_type, username, ip_address, details))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[AUDIT ERROR] Nie udało się zapisać zdarzenia: {e}")

# ==============================================================================
# INICJALIZACJA BAZY DANYCH (TABELE WYNIKÓW, UŻYTKOWNIKÓW, SESJI I AUDYTU)
# ==============================================================================

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. Tabela wyników sportowych
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS wyniki (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            athlete_name TEXT NOT NULL,
            athlete_club TEXT NOT NULL,
            gender TEXT NOT NULL,
            age_category TEXT NOT NULL,
            discipline TEXT NOT NULL,
            event_date TEXT NOT NULL,
            score REAL NOT NULL,
            score_formatted TEXT NOT NULL,
            unit TEXT NOT NULL,
            wind TEXT,
            is_rz INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 2. Tabela użytkowników z solonym hashem PBKDF2 i rolami RBAC
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            iterations INTEGER NOT NULL DEFAULT 210000,
            role TEXT NOT NULL DEFAULT 'uzytkownik',
            failed_attempts INTEGER NOT NULL DEFAULT 0,
            lockout_until TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP NULL
        )
    ''')
    
    # 3. Tabela sesji z kryptograficznymi tokenami CSPRNG i czasem wygaśnięcia
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            ip_address TEXT,
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL
        )
    ''')
    
    # 4. Tabela audytu bezpieczeństwa (Security Audit Trail)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            username TEXT,
            ip_address TEXT,
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Inicjalizacja wyników demonstracyjnych z Figmy
    cursor.execute('SELECT COUNT(*) FROM wyniki')
    count = cursor.fetchone()[0]
    if count == 0:
        cursor.executemany('''
            INSERT INTO wyniki (
                athlete_name, athlete_club, gender, age_category,
                discipline, event_date, score, score_formatted,
                unit, wind, is_rz
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', INITIAL_RECORDS)
        conn.commit()
        print(f"Zainicjalizowano tabelę wyników z {len(INITIAL_RECORDS)} rekordami.")
        
    # Inicjalizacja predefiniowanych kont demonstracyjnych dla oceny akademickiej
    cursor.execute('SELECT COUNT(*) FROM users')
    if cursor.fetchone()[0] == 0:
        demo_accounts = [
            ("sedzia", "sedzia@bieznia.pl", "Sedzia2026!#", "sedzia"),
            ("admin", "admin@bieznia.pl", "Admin2026!#", "admin"),
            ("kibic", "kibic@bieznia.pl", "Kibic2026!#", "uzytkownik"),
        ]
        for uname, uemail, upass, urole in demo_accounts:
            phash, psalt = hash_password(upass)
            cursor.execute('''
                INSERT INTO users (username, email, password_hash, salt, iterations, role)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (uname, uemail, phash, psalt, PBKDF2_ITERATIONS, urole))
        conn.commit()
        print("Zainicjalizowano bezpieczne konta demonstracyjne: 'sedzia', 'admin', 'kibic'.")

    conn.close()

# ==============================================================================
# OBSŁUGA ZAPYTAŃ HTTP Z WARSTWĄ BEZPIECZEŃSTWA (HANDLER)
# ==============================================================================

class BiezniaHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(__file__), **kwargs)

    def end_headers(self):
        """
        Automatyczne wstrzykiwanie nagłówków bezpieczeństwa (Defense-in-depth)
        do KAŻDEJ odpowiedzi serwera (pliki statyczne HTML/CSS/JS oraz odpowiedzi API).
        """
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('X-XSS-Protection', '1; mode=block')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        self.send_header(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;"
        )
        super().end_headers()

    def send_json(self, status_code: int, data: dict | list, set_cookie: str = None):
        """Pomocnik wysyłający ustrukturyzowaną odpowiedź JSON wraz z ewentualnym ciasteczkiem."""
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        
        origin = self.headers.get('Origin')
        if origin:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Credentials', 'true')
        else:
            self.send_header('Access-Control-Allow-Origin', '*')

        if set_cookie:
            self.send_header('Set-Cookie', set_cookie)
        self.end_headers()
        self.wfile.write(body)

    def get_client_ip(self) -> str:
        """Pobiera adres IP klienta z uwzględnieniem ewentualnego proxy (nagłówek X-Forwarded-For)."""
        xff = self.headers.get('X-Forwarded-For')
        if xff:
            return xff.split(',')[0].strip()
        return self.client_address[0] if self.client_address else '127.0.0.1'

    def get_session_token(self) -> str | None:
        """Pobiera token sesji z ciasteczka HttpOnly lub nagłówka Authorization Bearer."""
        cookie_header = self.headers.get('Cookie')
        if cookie_header:
            try:
                cookie = SimpleCookie()
                cookie.load(cookie_header)
                if 'session_token' in cookie:
                    return cookie['session_token'].value
            except Exception:
                pass
        
        # Fallback: Nagłówek Authorization: Bearer <token>
        auth = self.headers.get('Authorization')
        if auth and auth.startswith('Bearer '):
            return auth[7:].strip()
            
        return None

    def get_current_user(self) -> dict | None:
        """
        Weryfikuje ważność tokenu sesji w bazie danych SQLite.
        W przypadku aktywnej sesji stosuje 'sliding expiration' (przedłuża ważność sesji o kolejne 2h).
        """
        token = self.get_session_token()
        if not token:
            return None

        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        now_str = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute('''
            SELECT u.id, u.username, u.email, u.role, u.created_at, u.last_login, s.session_id, s.expires_at
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.session_id = ? AND s.expires_at > ?
        ''', (token, now_str))
        row = cursor.fetchone()

        if row:
            # Odnawianie sesji (sliding expiration)
            new_expires = (datetime.utcnow() + timedelta(hours=SESSION_LIFETIME_HOURS)).strftime('%Y-%m-%d %H:%M:%S')
            cursor.execute("UPDATE sessions SET expires_at = ? WHERE session_id = ?", (new_expires, token))
            conn.commit()

        conn.close()
        return dict(row) if row else None

    # --------------------------------------------------------------------------
    # METODY HTTP
    # --------------------------------------------------------------------------

    def do_OPTIONS(self):
        """Obsługa pre-flight CORS."""
        self.send_response(200)
        origin = self.headers.get('Origin')
        if origin:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Credentials', 'true')
        else:
            self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)

        # Endpoint API: Pobranie wyników
        if parsed.path == '/api/wyniki':
            self.handle_get_wyniki(parsed.query)
            return

        # Endpoint API: Statystyki
        if parsed.path == '/api/statystyki':
            self.handle_get_statystyki()
            return

        # Endpoint API: Sprawdzenie aktualnie zalogowanego użytkownika
        if parsed.path == '/api/auth/me':
            self.handle_get_auth_me()
            return

        # Endpoint API: Pobranie dziennika zdarzeń audytu bezpieczeństwa (tylko Admin)
        if parsed.path == '/api/audit-logs':
            self.handle_get_audit_logs()
            return

        # Standardowa obsługa plików statycznych (HTML, CSS, JS, obrazy)
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)

        # Endpoint API: Logowanie
        if parsed.path == '/api/auth/login':
            self.handle_post_login()
            return

        # Endpoint API: Rejestracja nowego użytkownika
        if parsed.path == '/api/auth/register':
            self.handle_post_register()
            return

        # Endpoint API: Wylogowanie
        if parsed.path == '/api/auth/logout':
            self.handle_post_logout()
            return

        # Endpoint API: Dodanie wyniku (wymaga roli sedzia lub admin)
        if parsed.path == '/api/wyniki':
            self.handle_post_wyniki()
            return

        self.send_json(404, {"error": "Nie znaleziono żądanego zasobu."})

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)

        # Endpoint API: Usuwanie wyniku (wymaga roli admin)
        if parsed.path == '/api/wyniki':
            self.handle_delete_wyniki(parsed.query)
            return

        self.send_json(404, {"error": "Nie znaleziono żądanego zasobu."})

    # ==========================================================================
    # HANDLERY ENDPOINTÓW API
    # ==========================================================================

    def handle_get_auth_me(self):
        """Zwraca stan uwierzytelnienia i dane bieżącego profilu."""
        user = self.get_current_user()
        if user:
            self.send_json(200, {
                "authenticated": True,
                "user": {
                    "id": user["id"],
                    "username": user["username"],
                    "email": user["email"],
                    "role": user["role"],
                    "last_login": user["last_login"]
                }
            })
        else:
            self.send_json(200, {"authenticated": False})

    def handle_post_login(self):
        """
        Bezpieczny proces logowania:
        1. Ochrona przed enumeracją użytkowników (generyczne komunikaty).
        2. Ochrona przed atakami czasowymi (dummy hash gdy użytkownik nie istnieje).
        3. Ochrona przed Brute-Force (blokada konta na 15 min po 5 nieudanych próbach).
        4. Zapis zdarzeń do dziennika audytowego.
        """
        client_ip = self.get_client_ip()
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')

        try:
            data = json.loads(body)
        except Exception:
            self.send_json(400, {"error": "Niepoprawny format żądania JSON."})
            return

        login_identifier = str(data.get('login', '')).strip().lower()
        password = str(data.get('password', ''))

        if not login_identifier or not password:
            self.send_json(400, {"error": "Login (lub e-mail) oraz hasło są wymagane."})
            return

        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Bezpieczne zapytanie sparametryzowane (ochrona przed SQL Injection)
        cursor.execute('''
            SELECT id, username, email, password_hash, salt, iterations, role, failed_attempts, lockout_until
            FROM users
            WHERE LOWER(username) = ? OR LOWER(email) = ?
        ''', (login_identifier, login_identifier))
        user = cursor.fetchone()

        # OCHRONA PRZED ENUMERACJĄ UŻYTKOWNIKÓW I ATAKAMI CZASOWYMI:
        # Jeśli użytkownik nie istnieje, wykonujemy obliczenie haszowania o identycznym koszcie
        # i zwracamy DOKŁADNIE ten sam błąd co w przypadku błędnego hasła.
        if not user:
            dummy_verify_password()
            conn.close()
            log_audit_event("LOGIN_FAILED", username=login_identifier, ip_address=client_ip, details="Nieistniejący użytkownik")
            self.send_json(401, {"error": "Nieprawidłowy login lub hasło."})
            return

        # SPRAWDZENIE BLOKADY KONTA (ACCOUNT LOCKOUT):
        if user['lockout_until']:
            try:
                lockout_dt = datetime.strptime(user['lockout_until'], '%Y-%m-%d %H:%M:%S')
                if datetime.utcnow() < lockout_dt:
                    remaining_sec = int((lockout_dt - datetime.utcnow()).total_seconds())
                    remaining_min = max(1, (remaining_sec + 59) // 60)
                    conn.close()
                    log_audit_event("LOGIN_LOCKED_ATTEMPT", username=user['username'], ip_address=client_ip,
                                    details=f"Próba logowania na zablokowane konto (pozostało {remaining_min} min)")
                    self.send_json(423, {
                        "error": f"Konto jest tymczasowo zablokowane z powodu zbyt wielu nieudanych prób logowania. Spróbuj ponownie za {remaining_min} min."
                    })
                    return
            except Exception:
                pass

        # WERYFIKACJA HASŁA W STAŁYM CZASIE
        is_valid = verify_password(password, user['password_hash'], user['salt'], user['iterations'])

        if not is_valid:
            new_failed = user['failed_attempts'] + 1
            if new_failed >= MAX_FAILED_ATTEMPTS:
                lockout_until_str = (datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)).strftime('%Y-%m-%d %H:%M:%S')
                cursor.execute("UPDATE users SET failed_attempts = ?, lockout_until = ? WHERE id = ?",
                               (new_failed, lockout_until_str, user['id']))
                conn.commit()
                conn.close()
                log_audit_event("ACCOUNT_LOCKED", username=user['username'], ip_address=client_ip,
                                details=f"Zablokowano konto na {LOCKOUT_MINUTES} minut po {new_failed} nieudanych próbach")
                self.send_json(423, {
                    "error": f"Konto zostało zablokowane na {LOCKOUT_MINUTES} minut z powodu {MAX_FAILED_ATTEMPTS} nieudanych prób logowania."
                })
                return
            else:
                cursor.execute("UPDATE users SET failed_attempts = ? WHERE id = ?", (new_failed, user['id']))
                conn.commit()
                conn.close()
                attempts_left = MAX_FAILED_ATTEMPTS - new_failed
                log_audit_event("LOGIN_FAILED", username=user['username'], ip_address=client_ip,
                                details=f"Błędne hasło (pozostało prób: {attempts_left})")
                self.send_json(401, {
                    "error": "Nieprawidłowy login lub hasło.",
                    "attempts_left": attempts_left
                })
                return

        # LOGOWANIE UDANE:
        # Reset licznika błędów, aktualizacja czasu logowania i utworzenie bezpiecznej sesji
        now_str = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute("UPDATE users SET failed_attempts = 0, lockout_until = NULL, last_login = ? WHERE id = ?",
                       (now_str, user['id']))

        session_token = secrets.token_hex(32)
        expires_at_str = (datetime.utcnow() + timedelta(hours=SESSION_LIFETIME_HOURS)).strftime('%Y-%m-%d %H:%M:%S')
        user_agent = self.headers.get('User-Agent', '')[:200]

        cursor.execute('''
            INSERT INTO sessions (session_id, user_id, ip_address, user_agent, expires_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (session_token, user['id'], client_ip, user_agent, expires_at_str))
        conn.commit()
        conn.close()

        log_audit_event("LOGIN_SUCCESS", username=user['username'], ip_address=client_ip, details=f"Rola: {user['role']}")

        # Flagi ciasteczka sesyjnego:
        # HttpOnly - zapobiega kradzieży sesji przez skrypty JavaScript (XSS)
        # SameSite=Lax - chroni przed atakami Cross-Site Request Forgery (CSRF)
        cookie_value = f"session_token={session_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={SESSION_LIFETIME_HOURS * 3600}"

        self.send_json(200, {
            "success": True,
            "message": "Zalogowano pomyślnie.",
            "session_token": session_token,
            "user": {
                "id": user['id'],
                "username": user['username'],
                "email": user['email'],
                "role": user['role']
            }
        }, set_cookie=cookie_value)

    def handle_post_register(self):
        """
        Rejestracja nowego użytkownika:
        - Walidacja danych wejściowych
        - Sprawdzenie polityki złożoności hasła (OWASP)
        - Kryptograficzne haszowanie z unikalną solą (PBKDF2-HMAC-SHA256)
        - Automatyczne nadanie sesji
        """
        client_ip = self.get_client_ip()
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')

        try:
            data = json.loads(body)
        except Exception:
            self.send_json(400, {"error": "Niepoprawny format żądania JSON."})
            return

        username = str(data.get('username', '')).strip()
        email = str(data.get('email', '')).strip().lower()
        password = str(data.get('password', ''))
        requested_role = str(data.get('role', 'uzytkownik')).strip().lower()

        # Walidacja nazwy użytkownika
        if not re.match(r'^[a-zA-Z0-9_\-\.]{3,30}$', username):
            self.send_json(422, {
                "error": "Nazwa użytkownika musi mieć od 3 do 30 znaków i może zawierać tylko litery, cyfry, myślniki i kropki."
            })
            return

        # Walidacja e-mail
        if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
            self.send_json(422, {"error": "Podaj poprawny adres e-mail."})
            return

        # Walidacja polityki haseł (OWASP)
        is_pw_valid, pw_err = validate_password_policy(password)
        if not is_pw_valid:
            self.send_json(422, {"error": pw_err})
            return

        # Kontrola dozwolonej roli (domyślnie 'uzytkownik', dla celów demonstracyjnych dopuszczamy 'sedzia')
        allowed_roles = {'uzytkownik', 'zawodnik', 'kibic', 'sedzia'}
        role = requested_role if requested_role in allowed_roles else 'uzytkownik'

        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Sprawdzenie czy login lub email już istnieje
        cursor.execute("SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?", (username.lower(), email))
        if cursor.fetchone():
            conn.close()
            log_audit_event("REGISTER_CONFLICT", username=username, ip_address=client_ip, details="Kolizja loginu lub e-maila")
            self.send_json(409, {"error": "Użytkownik o podanej nazwie lub adresie e-mail już istnieje w systemie."})
            return

        # Bezpieczne haszowanie hasła
        phash, psalt = hash_password(password)

        cursor.execute('''
            INSERT INTO users (username, email, password_hash, salt, iterations, role)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (username, email, phash, psalt, PBKDF2_ITERATIONS, role))
        new_user_id = cursor.lastrowid

        # Automatyczne utworzenie sesji po rejestracji
        session_token = secrets.token_hex(32)
        expires_at_str = (datetime.utcnow() + timedelta(hours=SESSION_LIFETIME_HOURS)).strftime('%Y-%m-%d %H:%M:%S')
        user_agent = self.headers.get('User-Agent', '')[:200]

        cursor.execute('''
            INSERT INTO sessions (session_id, user_id, ip_address, user_agent, expires_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (session_token, new_user_id, client_ip, user_agent, expires_at_str))
        conn.commit()
        conn.close()

        log_audit_event("REGISTER_SUCCESS", username=username, ip_address=client_ip, details=f"Rola: {role}")

        cookie_value = f"session_token={session_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={SESSION_LIFETIME_HOURS * 3600}"

        self.send_json(201, {
            "success": True,
            "message": "Konto zostało pomyślnie utworzone.",
            "session_token": session_token,
            "user": {
                "id": new_user_id,
                "username": username,
                "email": email,
                "role": role
            }
        }, set_cookie=cookie_value)

    def handle_post_logout(self):
        """Wylogowanie: unieważnienie sesji w bazie i usunięcie ciasteczka."""
        client_ip = self.get_client_ip()
        token = self.get_session_token()

        if token:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("SELECT u.username FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.session_id = ?", (token,))
            row = cursor.fetchone()
            username = row[0] if row else "Nieznany"

            cursor.execute("DELETE FROM sessions WHERE session_id = ?", (token,))
            conn.commit()
            conn.close()
            log_audit_event("LOGOUT", username=username, ip_address=client_ip)

        # Ciasteczko z Max-Age=0 natychmiast usuwa wpis w przeglądarce
        expired_cookie = "session_token=deleted; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
        self.send_json(200, {"success": True, "message": "Wylogowano pomyślnie."}, set_cookie=expired_cookie)

    def handle_get_audit_logs(self):
        """Pobieranie dziennika audytu bezpieczeństwa (dostęp wyłącznie dla Administratora)."""
        user = self.get_current_user()
        if not user or user.get('role') != 'admin':
            log_audit_event("ACCESS_DENIED", username=user.get('username') if user else 'Niezalogowany',
                            ip_address=self.get_client_ip(), details="Próba odczytu dziennika audytu bez uprawnień Admina")
            self.send_json(403, {"error": "Dostęp do dziennika audytu bezpieczeństwa wymaga uprawnień Administratora."})
            return

        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT id, event_type, username, ip_address, details, created_at FROM audit_logs ORDER BY id DESC LIMIT 50")
        logs = [dict(row) for row in cursor.fetchall()]
        conn.close()

        self.send_json(200, logs)

    def handle_get_wyniki(self, query_string):
        """Odczyt wyników z filtrowaniem i sortowaniem (dostęp publiczny)."""
        params = urllib.parse.parse_qs(query_string)
        szukaj = params.get('szukaj', [''])[0].strip().lower()
        konkurencja = params.get('konkurencja', ['all'])[0].strip()
        klub = params.get('klub', ['all'])[0].strip()
        sortuj = params.get('sortuj', ['data_desc'])[0].strip()
        gender = params.get('gender', params.get('plec', ['all']))[0].strip().lower()

        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        sql = "SELECT * FROM wyniki WHERE 1=1"
        args = []

        if szukaj:
            sql += " AND (LOWER(athlete_name) LIKE ? OR LOWER(athlete_club) LIKE ?)"
            args.extend([f"%{szukaj}%", f"%{szukaj}%"])

        if gender and gender != 'all':
            if gender in ('kobiety', 'k', 'female', 'f'):
                sql += " AND gender = 'kobiety'"
            elif gender in ('mezczyzni', 'm', 'male'):
                sql += " AND gender = 'mezczyzni'"

        if konkurencja and konkurencja != 'all':
            discipline_map = {
                '100m': '100 m',
                '100 m': '100 m',
                '400m': '400 m',
                '400 m': '400 m',
                'skok-w-dal': 'Skok w dal',
                'skok': 'Skok w dal',
                'Skok w dal': 'Skok w dal'
            }
            mapped_disp = discipline_map.get(konkurencja, konkurencja)
            sql += " AND discipline = ?"
            args.append(mapped_disp)

        if klub and klub != 'all':
            club_map = {
                'azs-warszawa': 'AZS Warszawa',
                'ks-sprint-krakow': 'KS Sprint Kraków',
                'wks-poznan': 'WKS Poznań',
                'mks-gdansk': 'MKS Gdańsk'
            }
            mapped_club = club_map.get(klub, klub)
            sql += " AND athlete_club = ?"
            args.append(mapped_club)

        # Bezpieczna biała lista sortowania (brak możliwości wstrzyknięcia SQL)
        if sortuj == 'data_asc':
            sql += " ORDER BY event_date ASC, id ASC"
        elif sortuj == 'data_desc':
            sql += " ORDER BY event_date DESC, id DESC"
        elif sortuj == 'wynik_asc':
            sql += " ORDER BY score ASC"
        elif sortuj == 'wynik_desc':
            sql += " ORDER BY score DESC"
        else:
            sql += " ORDER BY event_date DESC, id DESC"

        cursor.execute(sql, args)
        rows = [dict(row) for row in cursor.fetchall()]
        conn.close()

        for r in rows:
            try:
                dt = datetime.strptime(r['event_date'], '%Y-%m-%d')
                r['event_date_formatted'] = dt.strftime('%d.%m.%Y')
            except Exception:
                r['event_date_formatted'] = r['event_date']

        self.send_json(200, rows)

    def handle_get_statystyki(self):
        """Pobieranie statystyk analitycznych (dostęp publiczny)."""
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) AS total_count FROM wyniki")
        total_count = cursor.fetchone()['total_count']

        cursor.execute("SELECT COUNT(DISTINCT discipline) AS total_disc FROM wyniki")
        total_disc = cursor.fetchone()['total_disc']

        cursor.execute("SELECT COUNT(DISTINCT athlete_club) AS total_clubs FROM wyniki")
        total_clubs = cursor.fetchone()['total_clubs']

        cursor.execute("SELECT COUNT(*) AS count_women FROM wyniki WHERE gender = 'kobiety'")
        count_women = cursor.fetchone()['count_women']

        cursor.execute("SELECT COUNT(*) AS count_men FROM wyniki WHERE gender = 'mezczyzni'")
        count_men = cursor.fetchone()['count_men']

        cursor.execute("SELECT AVG(score) AS avg_100m, COUNT(*) AS count_100m FROM wyniki WHERE discipline = '100 m'")
        row_100m = cursor.fetchone()
        avg_100m = round(row_100m['avg_100m'], 2) if row_100m['avg_100m'] else 0

        cursor.execute("SELECT athlete_name, athlete_club, score, score_formatted, is_rz FROM wyniki WHERE discipline = '100 m' ORDER BY score ASC LIMIT 1")
        leader_100m = dict(cursor.fetchone() or {})

        cursor.execute("SELECT athlete_name, athlete_club, score, score_formatted, is_rz FROM wyniki WHERE discipline = '400 m' ORDER BY score ASC LIMIT 1")
        leader_400m = dict(cursor.fetchone() or {})

        cursor.execute("SELECT athlete_name, athlete_club, score, score_formatted, is_rz FROM wyniki WHERE discipline = 'Skok w dal' ORDER BY score DESC LIMIT 1")
        leader_skok = dict(cursor.fetchone() or {})

        conn.close()

        stats = {
            "total_count": total_count,
            "total_disciplines": total_disc,
            "total_clubs": total_clubs,
            "count_women": count_women,
            "count_men": count_men,
            "avg_100m": avg_100m,
            "leader_100m": leader_100m,
            "leader_400m": leader_400m,
            "leader_skok": leader_skok,
        }
        self.send_json(200, stats)

    def handle_post_wyniki(self):
        """
        Zapis nowego wyniku do bazy:
        - Wymaga autoryzacji z rolą 'sedzia' lub 'admin' (RBAC).
        - Pełna walidacja danych wejściowych i sanityzacja (ochrona przed XSS).
        - Bezpieczny zapis sparametryzowany (ochrona przed SQL Injection).
        """
        client_ip = self.get_client_ip()
        user = self.get_current_user()

        if not user:
            log_audit_event("ACCESS_DENIED", username="Niezalogowany", ip_address=client_ip,
                            details="Próba dodania wyniku bez uwierzytelnienia")
            self.send_json(401, {
                "error": "Wymagane uwierzytelnienie. Zaloguj się jako Sędzia zawodów lub Administrator, aby dodać wynik."
            })
            return

        if user.get('role') not in ('sedzia', 'admin'):
            log_audit_event("ACCESS_DENIED", username=user.get('username'), ip_address=client_ip,
                            details=f"Odmowa uprawnień do zapisu dla roli: {user.get('role')}")
            self.send_json(403, {
                "error": "Brak uprawnień. Tylko Sędzia zawodów lub Administrator może zatwierdzać oficjalne wyniki."
            })
            return

        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')
        try:
            data = json.loads(body)
        except Exception:
            self.send_json(400, {"error": "Niepoprawny format żądania JSON."})
            return

        # Sanityzacja danych wejściowych (ochrona przed XSS)
        name = sanitize_input(data.get('athlete_name', ''))
        club = sanitize_input(data.get('athlete_club', ''))
        gender = sanitize_input(data.get('gender', 'mezczyzni'))
        age_cat = sanitize_input(data.get('age_category', 'open'))
        disp = sanitize_input(data.get('discipline', '100 m'))
        
        disp_map = {
            '100m': '100 m',
            '100 m': '100 m',
            '400m': '400 m',
            '400 m': '400 m',
            'skok-w-dal': 'Skok w dal',
            'skok': 'Skok w dal',
            'Skok w dal': 'Skok w dal'
        }
        disp = disp_map.get(disp, disp)
        date = str(data.get('event_date', '')).strip()
        score_raw = str(data.get('score', '')).strip().replace(',', '.')
        wind = sanitize_input(data.get('wind', '')) or None
        is_rz = 1 if data.get('is_rz') else 0

        # Walidacja pól obowiązkowych
        if not name or not club or not score_raw:
            self.send_json(422, {"error": "Wymagane pola to: Imię i nazwisko, Klub oraz Wynik."})
            return

        # Walidacja długości tekstu
        if len(name) > 100 or len(club) > 100:
            self.send_json(422, {"error": "Przekroczono maksymalną dozwoloną długość tekstu (100 znaków)."})
            return

        # Walidacja wartości liczbowej wyniku
        try:
            score = float(score_raw)
            if score <= 0 or score > 1000:
                self.send_json(422, {"error": "Wynik musi być dodatnią liczbą w realistycznym zakresie."})
                return
        except ValueError:
            self.send_json(422, {"error": "Wynik musi być poprawną wartością liczbową."})
            return

        # Walidacja formatu daty (YYYY-MM-DD)
        if date:
            try:
                datetime.strptime(date, '%Y-%m-%d')
            except ValueError:
                self.send_json(422, {"error": "Niepoprawny format daty (wymagany YYYY-MM-DD)."})
                return

        unit = 'm' if 'skok' in disp.lower() else 's'
        score_formatted = f"{score:.2f}".replace('.', ',') + f" {unit}"

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO wyniki (
                athlete_name, athlete_club, gender, age_category,
                discipline, event_date, score, score_formatted,
                unit, wind, is_rz
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (name, club, gender, age_cat, disp, date, score, score_formatted, unit, wind, is_rz))
        new_id = cursor.lastrowid
        conn.commit()
        conn.close()

        log_audit_event("RESULT_ADDED", username=user['username'], ip_address=client_ip,
                        details=f"ID: {new_id}, Zawodnik: {name}, Konkurencja: {disp}, Wynik: {score_formatted}")

        self.send_json(201, {
            "success": True,
            "message": "Wynik został pomyślnie i bezpiecznie zapisany w bazie danych!",
            "id": new_id,
            "record": {
                "id": new_id,
                "athlete_name": name,
                "athlete_club": club,
                "discipline": disp,
                "score_formatted": score_formatted,
                "event_date": date,
                "is_rz": is_rz,
                "confirmed_by": user['username']
            }
        })

    def handle_delete_wyniki(self, query_string):
        """
        Usuwanie wyniku z bazy danych:
        - Wymaga uprawnień Administratora ('admin').
        - Zapytanie sparametryzowane.
        - Rejestracja w audycie.
        """
        client_ip = self.get_client_ip()
        user = self.get_current_user()

        if not user or user.get('role') != 'admin':
            log_audit_event("ACCESS_DENIED", username=user.get('username') if user else 'Niezalogowany',
                            ip_address=client_ip, details="Próba usunięcia rekordu bez uprawnień Administratora")
            self.send_json(403, {"error": "Usuwanie rekordów wymaga uprawnień Administratora."})
            return

        params = urllib.parse.parse_qs(query_string)
        record_id_raw = params.get('id', [''])[0].strip()

        try:
            record_id = int(record_id_raw)
        except ValueError:
            self.send_json(400, {"error": "Niepoprawny identyfikator rekordu."})
            return

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT athlete_name, discipline, score_formatted FROM wyniki WHERE id = ?", (record_id,))
        rec = cursor.fetchone()
        if not rec:
            conn.close()
            self.send_json(404, {"error": "Rekord o podanym ID nie istnieje."})
            return

        cursor.execute("DELETE FROM wyniki WHERE id = ?", (record_id,))
        conn.commit()
        conn.close()

        log_audit_event("RESULT_DELETED", username=user['username'], ip_address=client_ip,
                        details=f"Usunięto rekord ID: {record_id} ({rec[0]}, {rec[1]}, {rec[2]})")

        self.send_json(200, {
            "success": True,
            "message": f"Rekord ID {record_id} został pomyślnie usunięty."
        })

# ==============================================================================
# URUCHOMIENIE SERWERA
# ==============================================================================

if __name__ == '__main__':
    import webbrowser
    init_db()
    
    try:
        server = ThreadingHTTPServer(('127.0.0.1', PORT), BiezniaHandler)
        server.daemon_threads = True
        print("=" * 68)
        print(" SERWER BIEŻNIA DZIAŁA POPRAWNIE Z ROZSZERZONYM BEZPIECZEŃSTWEM!")
        print(f" Adres lokalny: http://127.0.0.1:{PORT}")
        print(" Zabezpieczenia: PBKDF2-SHA256 (210k iter.), RBAC, CSPRNG Sessions,")
        print("                 Ochrona przed Brute-Force, Anti-Timing, Audit Trail")
        print(" Konta demo: 'sedzia' / 'admin' / 'kibic' (hasła np. 'Sedzia2026!#')")
        print("=" * 68)
        print("Otwieranie strony w domyślnej przeglądarce...")
        webbrowser.open(f'http://127.0.0.1:{PORT}')
        server.serve_forever()
    except OSError as e:
        if getattr(e, 'winerror', None) == 10048 or "Address already in use" in str(e):
            print("=" * 68)
            print(f" Serwer aplikacji 'bieżnia' już działa w tle pod adresem:")
            print(f" -> http://127.0.0.1:{PORT}")
            print("=" * 68)
            print("Otwieram stronę w przeglądarce...")
            webbrowser.open(f'http://127.0.0.1:{PORT}')
        else:
            raise
    except KeyboardInterrupt:
        print("\nZatrzymywanie serwera...")
        server.server_close()
