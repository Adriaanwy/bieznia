import sqlite3
import json
import os
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import urllib.parse
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'bieznia.db')
PORT = 8000

# 18 oryginalnych rekordów z Figmy do zainicjowania bazy
INITIAL_RECORDS = [
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
]

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
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
    
    # Sprawdź czy tabela jest pusta, jeśli tak – zainicjalizuj 18 rekordami z Figmy
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
        print(f"Zainicjalizowano bazę danych SQLite z {len(INITIAL_RECORDS)} rekordami.")
    conn.close()

class BiezniaHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(__file__), **kwargs)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        
        # Endpoint API: Pobranie wyników z filtrowaniem i sortowaniem
        if parsed.path == '/api/wyniki':
            self.handle_get_wyniki(parsed.query)
            return
            
        # Endpoint API: Statystyki
        if parsed.path == '/api/statystyki':
            self.handle_get_statystyki()
            return
            
        # Standardowa obsługa plików statycznych (HTML, CSS, JS, obrazy)
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        
        # Endpoint API: Zapis nowego wyniku z formularza do bazy
        if parsed.path == '/api/wyniki':
            self.handle_post_wyniki()
            return

        self.send_response(404)
        self.end_headers()

    def handle_get_wyniki(self, query_string):
        params = urllib.parse.parse_qs(query_string)
        szukaj = params.get('szukaj', [''])[0].strip().lower()
        konkurencja = params.get('konkurencja', ['all'])[0].strip()
        klub = params.get('klub', ['all'])[0].strip()
        sortuj = params.get('sortuj', ['data_desc'])[0].strip()

        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        sql = "SELECT * FROM wyniki WHERE 1=1"
        args = []

        # Filtrowanie po nazwisku / imieniu
        if szukaj:
            sql += " AND (LOWER(athlete_name) LIKE ? OR LOWER(athlete_club) LIKE ?)"
            args.extend([f"%{szukaj}%", f"%{szukaj}%"])

        # Filtrowanie po konkurencji
        if konkurencja and konkurencja != 'all':
            # Mapowanie slugów na pełne nazwy w bazie
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

        # Filtrowanie po klubie
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

        # Logika sortowania
        if sortuj == 'data_asc':
            sql += " ORDER BY event_date ASC, id ASC"
        elif sortuj == 'data_desc':
            sql += " ORDER BY event_date DESC, id DESC"
        elif sortuj == 'wynik_asc':
            # Liczbowo rosnąco (najmniejszy wynik pierwszy)
            sql += " ORDER BY score ASC"
        elif sortuj == 'wynik_desc':
            # Liczbowo malejąco (największy wynik pierwszy)
            sql += " ORDER BY score DESC"
        else:
            sql += " ORDER BY event_date DESC, id DESC"

        cursor.execute(sql, args)
        rows = [dict(row) for row in cursor.fetchall()]
        conn.close()

        # Formatowanie daty do wyświetlania w widoku (YYYY-MM-DD -> DD.MM.YYYY)
        for r in rows:
            try:
                dt = datetime.strptime(r['event_date'], '%Y-%m-%d')
                r['event_date_formatted'] = dt.strftime('%d.%m.%Y')
            except Exception:
                r['event_date_formatted'] = r['event_date']

        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(rows, ensure_ascii=False).encode('utf-8'))

    def handle_get_statystyki(self):
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) AS total_count FROM wyniki")
        total_count = cursor.fetchone()['total_count']

        cursor.execute("SELECT COUNT(DISTINCT discipline) AS total_disc FROM wyniki")
        total_disc = cursor.fetchone()['total_disc']

        cursor.execute("SELECT COUNT(DISTINCT athlete_club) AS total_clubs FROM wyniki")
        total_clubs = cursor.fetchone()['total_clubs']

        # Średnia 100m
        cursor.execute("SELECT AVG(score) AS avg_100m, COUNT(*) AS count_100m FROM wyniki WHERE discipline = '100 m'")
        row_100m = cursor.fetchone()
        avg_100m = round(row_100m['avg_100m'], 2) if row_100m['avg_100m'] else 0

        # Lider 100m
        cursor.execute("SELECT athlete_name, athlete_club, score, score_formatted, is_rz FROM wyniki WHERE discipline = '100 m' ORDER BY score ASC LIMIT 1")
        leader_100m = dict(cursor.fetchone() or {})

        # Lider 400m
        cursor.execute("SELECT athlete_name, athlete_club, score, score_formatted, is_rz FROM wyniki WHERE discipline = '400 m' ORDER BY score ASC LIMIT 1")
        leader_400m = dict(cursor.fetchone() or {})

        # Lider skok w dal
        cursor.execute("SELECT athlete_name, athlete_club, score, score_formatted, is_rz FROM wyniki WHERE discipline = 'Skok w dal' ORDER BY score DESC LIMIT 1")
        leader_skok = dict(cursor.fetchone() or {})

        conn.close()

        stats = {
            "total_count": total_count,
            "total_disciplines": total_disc,
            "total_clubs": total_clubs,
            "avg_100m": avg_100m,
            "leader_100m": leader_100m,
            "leader_400m": leader_400m,
            "leader_skok": leader_skok,
        }

        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(stats, ensure_ascii=False).encode('utf-8'))

    def handle_post_wyniki(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')
        try:
            data = json.loads(body)
        except Exception as e:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Niepoprawny JSON"}).encode('utf-8'))
            return

        name = data.get('athlete_name', '').strip()
        club = data.get('athlete_club', '').strip()
        gender = data.get('gender', 'mezczyzni').strip()
        age_cat = data.get('age_category', 'open').strip()
        disp = data.get('discipline', '100 m').strip()
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
        date = data.get('event_date', '').strip()
        score_raw = str(data.get('score', '')).strip().replace(',', '.')
        wind = data.get('wind', '').strip() or None
        is_rz = 1 if data.get('is_rz') else 0

        # Walidacja podstawowa
        if not name or not club or not score_raw:
            self.send_response(422)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Wymagane pola to: Imię i nazwisko, Klub, Wynik"}).encode('utf-8'))
            return

        try:
            score = float(score_raw)
        except ValueError:
            self.send_response(422)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Wynik musi być wartością liczbową"}).encode('utf-8'))
            return

        # Określenie jednostki na podstawie konkurencji
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

        self.send_response(201)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        self.end_headers()
        response_data = {
            "success": True,
            "message": "Wynik został pomyślnie zapisany w bazie danych!",
            "id": new_id,
            "record": {
                "id": new_id,
                "athlete_name": name,
                "athlete_club": club,
                "discipline": disp,
                "score_formatted": score_formatted,
                "event_date": date,
                "is_rz": is_rz
            }
        }
        self.wfile.write(json.dumps(response_data, ensure_ascii=False).encode('utf-8'))

if __name__ == '__main__':
    import webbrowser
    init_db()
    
    try:
        server = ThreadingHTTPServer(('127.0.0.1', PORT), BiezniaHandler)
        server.daemon_threads = True
        print("=" * 65)
        print(f" SERWER BIEŻNIA (SQLite) DZIAŁA POPRAWNIE!")
        print(f" Adres w przeglądarce: http://127.0.0.1:{PORT}")
        print("=" * 65)
        print("Otwieranie strony w domyślnej przeglądarce...")
        webbrowser.open(f'http://127.0.0.1:{PORT}')
        server.serve_forever()
    except OSError as e:
        # Kod błędu 10048 w Windows oznacza, że port 8000 jest już używany (np. serwer już działa w tle)
        if getattr(e, 'winerror', None) == 10048 or "Address already in use" in str(e):
            print("=" * 65)
            print(f" Serwer aplikacji 'bieżnia' już działa w tle pod adresem:")
            print(f" -> http://127.0.0.1:{PORT}")
            print("=" * 65)
            print("Otwieram stronę w przeglądarce...")
            webbrowser.open(f'http://127.0.0.1:{PORT}')
        else:
            raise
    except KeyboardInterrupt:
        print("\nZatrzymywanie serwera...")
        server.server_close()
