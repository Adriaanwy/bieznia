/**
 * BIEŻNIA - Oficjalna aplikacja lekkoatletyczna (Sezon 2026)
 * Obsługa frontendu: integracja z bazą SQLite, dynamiczne filtry,
 * wyszukiwarka, sortowanie oraz dodawanie wyników z walidacją.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Stan aplikacji
  const state = {
    search: '',
    discipline: 'all',
    club: 'all',
    gender: 'all',
    sort: 'data_desc',
    results: []
  };

  // Elementy DOM - Baza wyników
  const searchInput = document.getElementById('search-athlete');
  const btnSearch = document.getElementById('btn-search-trigger');
  const filterDiscipline = document.getElementById('filter-discipline');
  const filterClub = document.getElementById('filter-club');
  const btnClearFilters = document.getElementById('btn-clear-filters');
  const sortButtons = document.querySelectorAll('.sort-btn');
  const genderButtons = document.querySelectorAll('.gender-btn');
  const tableSubtitle = document.getElementById('table-subtitle');
  const countGenderAll = document.getElementById('count-gender-all');
  const countGenderMen = document.getElementById('count-gender-men');
  const countGenderWomen = document.getElementById('count-gender-women');
  const heroStatTotal = document.getElementById('hero-stat-total');
  const resultsTbody = document.getElementById('results-tbody');
  const resultsCountBadge = document.getElementById('results-count-badge');
  const resultsCountFooter = document.getElementById('results-count-footer');
  const colHeaderDate = document.getElementById('col-header-date');

  // Elementy DOM - Formularz dodawania wyniku
  const addResultForm = document.getElementById('add-result-form');
  const athleteNameInput = document.getElementById('athlete-name');
  const athleteClubInput = document.getElementById('athlete-club');
  const groupAthleteClub = document.getElementById('group-athlete-club');
  const athleteClubError = document.getElementById('athlete-club-error');
  const disciplineSelect = document.getElementById('discipline');
  const eventDateInput = document.getElementById('event-date');
  const scoreInput = document.getElementById('score-result');
  const scoreUnitBadge = document.getElementById('score-unit-badge');
  const windInput = document.getElementById('wind-val');
  const isRzCheckbox = document.getElementById('is-rz-checkbox');
  const formErrorBanner = document.getElementById('form-error-banner');
  const formErrorText = document.getElementById('form-error-text');
  const formSuccessBanner = document.getElementById('form-success-banner');
  const formSuccessText = document.getElementById('form-success-text');

  // Elementy DOM - Karta Podglądu na żywo
  const previewAthleteName = document.getElementById('preview-athlete-name');
  const previewCategory = document.getElementById('preview-category');
  const previewScoreVal = document.getElementById('preview-score-val');
  const previewUnit = document.getElementById('preview-unit');
  const previewBadgeRz = document.getElementById('preview-badge-rz');
  const previewDateVal = document.getElementById('preview-date-val');
  const previewClubVal = document.getElementById('preview-club-val');
  const previewWindVal = document.getElementById('preview-wind-val');

  // Elementy DOM - Moduł Bezpieczeństwa i Uwierzytelniania
  const btnOpenLogin = document.getElementById('btn-open-login');
  const userBadge = document.getElementById('user-badge');
  const userNameDisplay = document.getElementById('user-name-display');
  const userRoleDisplay = document.getElementById('user-role-display');
  const userAvatarInitials = document.getElementById('user-avatar-initials');
  const btnLogout = document.getElementById('btn-logout');
  const btnOpenAudit = document.getElementById('btn-open-audit');
  const colAdminHeader = document.getElementById('col-admin-header');

  const authModal = document.getElementById('auth-modal');
  const authModalBackdrop = document.getElementById('auth-modal-backdrop');
  const authModalClose = document.getElementById('auth-modal-close');
  const authModalAlert = document.getElementById('auth-modal-alert');
  const tabBtnLogin = document.getElementById('tab-btn-login');
  const tabBtnRegister = document.getElementById('tab-btn-register');
  const authPanelLogin = document.getElementById('auth-panel-login');
  const authPanelRegister = document.getElementById('auth-panel-register');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const demoButtons = document.querySelectorAll('.btn-demo-pill');

  const addResultAuthBarrier = document.getElementById('add-result-auth-barrier');
  const addResultAuthSuccess = document.getElementById('add-result-auth-success');
  const btnBarrierLogin = document.getElementById('btn-barrier-login');
  const judgeNameLabel = document.getElementById('judge-name-label');
  const judgeRoleLabel = document.getElementById('judge-role-label');
  const formLayoutGrid = document.querySelector('.form-layout-grid');

  const auditModal = document.getElementById('audit-modal');
  const auditModalBackdrop = document.getElementById('audit-modal-backdrop');
  const auditModalClose = document.getElementById('audit-modal-close');
  const btnRefreshAudit = document.getElementById('btn-refresh-audit');
  const auditTbody = document.getElementById('audit-tbody');

  // Dane kont demonstracyjnych dla natychmiastowej ewaluacji akademickiej
  const DEMO_CREDENTIALS = {
    sedzia: { login: 'sedzia', password: 'Sedzia2026!#' },
    admin: { login: 'admin', password: 'Admin2026!#' },
    kibic: { login: 'kibic', password: 'Kibic2026!#' }
  };

  // Stan uwierzytelnienia
  let currentUser = {
    authenticated: false,
    user: null
  };

  // ==========================================================================
  // 1. POBIERANIE I RENDEROWANIE WYNIKÓW Z BAZY DANYCH
  // ==========================================================================

  // Jeśli strona została otwarta jako plik lokalny (file:///...),
  // automatycznie kierujemy zapytania do lokalnego serwera bazy danych pod port 8000
  const API_BASE = window.location.protocol.startsWith('http') 
    ? '' 
    : 'http://127.0.0.1:8000';

  /**
   * Pobiera wyniki z backendu SQLite (/api/wyniki) zgodnie z aktualnymi filtrami i sortowaniem.
   * Posiada wbudowaną podwójną warstwę filtrującą (klient + serwer), dzięki czemu
   * zmiana filtrów działa natychmiastowo, płynnie i bezbłędnie nawet jeśli serwer
   * w pamięci nie został jeszcze zrestartowany.
   */
  async function fetchResults() {
    try {
      const params = new URLSearchParams({
        szukaj: state.search,
        konkurencja: state.discipline,
        klub: state.club,
        gender: state.gender,
        sortuj: state.sort
      });

      const response = await fetch(`${API_BASE}/api/wyniki?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Błąd serwera: ${response.status}`);
      }

      let data = await response.json();

      // Odporne, bezwzględne filtrowanie po płci na poziomie frontendu
      if (state.gender && state.gender !== 'all') {
        const targetGender = state.gender.toLowerCase().trim();
        data = data.filter(row => {
          const g = (row.gender || '').toLowerCase().trim();
          if (targetGender === 'kobiety') {
            return g === 'kobiety' || g === 'k' || g === 'female' || g === 'kobieta';
          }
          if (targetGender === 'mezczyzni') {
            return g === 'mezczyzni' || g === 'm' || g === 'male' || g === 'mezczyzna';
          }
          return true;
        });
      }

      // Filtrowanie po konkurencji (zabezpieczenie)
      if (state.discipline && state.discipline !== 'all') {
        data = data.filter(row => row.discipline === state.discipline);
      }

      // Filtrowanie po klubie (zabezpieczenie)
      if (state.club && state.club !== 'all') {
        data = data.filter(row => row.athlete_club === state.club);
      }

      // Filtrowanie po zawodniku / wyszukiwaniu (zabezpieczenie)
      if (state.search) {
        const q = state.search.toLowerCase().trim();
        data = data.filter(row =>
          (row.athlete_name && row.athlete_name.toLowerCase().includes(q)) ||
          (row.athlete_club && row.athlete_club.toLowerCase().includes(q))
        );
      }

      state.results = data;
      renderTable(data);
      updateCounts(data.length);
      refreshGenderCounts();
    } catch (error) {
      console.error('Błąd pobierania wyników:', error);
      renderErrorState();
    }
  }

  /**
   * Odświeża liczniki płci na przyciskach filtrowania oraz w sekcji Hero
   */
  async function refreshGenderCounts() {
    try {
      const res = await fetch(`${API_BASE}/api/statystyki`);
      if (res.ok) {
        const stats = await res.json();
        if (stats.total_count !== undefined && countGenderAll) {
          countGenderAll.textContent = stats.total_count;
        }
        if (stats.count_men !== undefined && countGenderMen) {
          countGenderMen.textContent = stats.count_men;
        }
        if (stats.count_women !== undefined && countGenderWomen) {
          countGenderWomen.textContent = stats.count_women;
        }
        if (stats.total_count !== undefined && heroStatTotal) {
          heroStatTotal.textContent = stats.total_count;
        }
      }
    } catch (e) {
      // Przy braku łączności pozostają wartości początkowe
    }
  }

  /**
   * Renderuje wiersze tabeli wyników
   */
  function renderTable(results) {
    if (!resultsTbody) return;

    if (results.length === 0) {
      resultsTbody.innerHTML = `
        <tr>
          <td colspan="5" class="table-empty-cell">
            <div class="table-empty-state">
              <svg class="table-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <div class="table-empty-title">Brak wyników spełniających kryteria</div>
              <div class="table-empty-desc">Nie znaleziono żadnych rekordów dla wybranych filtrów. Spróbuj zmienić parametry wyszukiwania.</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const isAdmin = currentUser && currentUser.authenticated && currentUser.user && currentUser.user.role === 'admin';

    resultsTbody.innerHTML = results.map((row, index) => {
      const rzBadgeHtml = row.is_rz 
        ? '<span class="badge-rz">RŻ</span>' 
        : '';
      const isFemale = row.gender === 'kobiety';
      const genderBadgeHtml = `<span class="badge-gender ${isFemale ? 'badge-gender-k' : 'badge-gender-m'}" title="${isFemale ? 'Kobieta' : 'Mężczyzna'}">${isFemale ? 'K' : 'M'}</span>`;
      const isFirst = index === 0;
      const firstPlaceBadge = isFirst ? '<span class="badge-first-gold" title="1. miejsce w aktualnym widoku">🥇</span> ' : '';
      const adminColHtml = isAdmin
        ? `<td style="text-align: right;"><button type="button" class="btn-delete-row" data-id="${row.id}" data-athlete="${escapeHtml(row.athlete_name)}" title="Usuń rekord z bazy (Admin)">Usuń</button></td>`
        : '';

      return `
        <tr class="${isFirst ? 'row-first-leader' : ''}">
          <td>
            ${firstPlaceBadge}<span class="athlete-name-text">${escapeHtml(row.athlete_name)}</span>
            ${genderBadgeHtml}
            ${rzBadgeHtml}
          </td>
          <td>${escapeHtml(row.discipline)}</td>
          <td class="cell-result">${escapeHtml(row.score_formatted)}</td>
          <td>${escapeHtml(row.athlete_club)}</td>
          <td class="cell-date">${escapeHtml(row.event_date_formatted || row.event_date)}</td>
          ${adminColHtml}
        </tr>
      `;
    }).join('');
  }

  /**
   * Aktualizuje liczniki rekordów w nagłówku i stopce tabeli
   */
  function updateCounts(count) {
    const polishPluralRecords = (n) => {
      if (n === 1) return '1 rekord';
      const mod10 = n % 10;
      const mod100 = n % 100;
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
        return `${n} rekordy`;
      }
      return `${n} rekordów`;
    };

    if (resultsCountBadge) {
      resultsCountBadge.textContent = polishPluralRecords(count);
    }
    if (resultsCountFooter) {
      if (count === 0) {
        resultsCountFooter.textContent = 'Brak wyników do wyświetlenia';
      } else {
        resultsCountFooter.textContent = `Wyświetlono 1–${count} z ${count} wyników`;
      }
    }
  }

  /**
   * Wyświetla błąd komunikacji w tabeli
   */
  function renderErrorState(message) {
    if (!resultsTbody) return;
    resultsTbody.innerHTML = `
      <tr>
        <td colspan="5" class="table-empty-cell">
          <div class="table-empty-state">
            <svg class="table-empty-icon" style="color: #ef4444;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div class="table-empty-title">Serwer bazy danych nie jest uruchomiony</div>
            <div class="table-empty-desc" style="max-width: 480px; margin: 0 auto; line-height: 1.6;">
              ${message ? escapeHtml(message) + '<br>' : ''}
              Uruchom plik <strong>uruchom.bat</strong> w folderze projektu lub wpisz w terminalu:
              <code style="display: block; background: var(--color-bg-body); color: var(--color-text-main); border: 1px solid var(--color-border); padding: 0.35rem 0.65rem; border-radius: 4px; margin: 0.5rem 0; font-family: monospace;">python server.py</code>
              a następnie otwórz aplikację pod adresem:
              <br>
              <a href="http://127.0.0.1:8000" style="color: var(--color-primary); font-weight: 600; text-decoration: underline; margin-top: 0.35rem; display: inline-block;">
                http://127.0.0.1:8000 ↗
              </a>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  // ==========================================================================
  // 2. OBSŁUGA FILTRÓW, WYSZUKIWARKI I PRZYCISKU "SZUKAJ"
  // ==========================================================================

  // Wyszukiwarka - obsługa kliknięcia przycisku "Szukaj"
  if (btnSearch) {
    btnSearch.addEventListener('click', () => {
      state.search = searchInput ? searchInput.value.trim() : '';
      fetchResults();
    });
  }

  // Wyszukiwarka - obsługa klawisza Enter oraz debounce przy wpisywaniu
  let searchTimeout = null;
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(searchTimeout);
        state.search = searchInput.value.trim();
        fetchResults();
      }
    });

    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        state.search = searchInput.value.trim();
        fetchResults();
      }, 250);
    });
  }

  // Filtr konkurencji (np. 100 m, 400 m, Skok w dal)
  if (filterDiscipline) {
    filterDiscipline.addEventListener('change', (e) => {
      state.discipline = e.target.value;
      fetchResults();
    });
  }

  // Filtr klubów
  if (filterClub) {
    filterClub.addEventListener('change', (e) => {
      state.club = e.target.value;
      fetchResults();
    });
  }

  // Przełącznik kategorii płci (Wszyscy / Mężczyźni / Kobiety)
  genderButtons.forEach(button => {
    button.addEventListener('click', () => {
      const selectedGender = button.dataset.gender || 'all';
      if (state.gender === selectedGender) return;

      genderButtons.forEach(btn => {
        const isActive = btn === button;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
      });

      state.gender = selectedGender;

      // Dynamiczna zmiana podtytułu tabeli
      if (tableSubtitle) {
        if (selectedGender === 'kobiety') {
          tableSubtitle.textContent = 'Kobiety open • Sezon 2026 • najnowsze daty najpierw';
        } else if (selectedGender === 'mezczyzni') {
          tableSubtitle.textContent = 'Mężczyźni open • Sezon 2026 • najnowsze daty najpierw';
        } else {
          tableSubtitle.textContent = 'Wszyscy (Kobiety i Mężczyźni) • Sezon 2026 • najnowsze daty najpierw';
        }
      }

      // 1. Natychmiastowe odświeżenie i przefiltrowanie tabeli
      fetchResults();

      // 2. Natychmiastowa synchronizacja sekcji analitycznej (wykres, rankingi, wskaźniki KPI)
      updateAnalysisSection(selectedGender);
    });
  });

  // Przycisk "Wyczyść filtry"
  if (btnClearFilters) {
    btnClearFilters.addEventListener('click', () => {
      state.search = '';
      state.discipline = 'all';
      state.club = 'all';
      state.gender = 'all';
      state.sort = 'data_desc';

      if (searchInput) searchInput.value = '';
      if (filterDiscipline) filterDiscipline.value = 'all';
      if (filterClub) filterClub.value = 'all';

      // Reset przycisków wyboru płci do "Wszyscy"
      genderButtons.forEach(btn => {
        const isAll = btn.dataset.gender === 'all';
        btn.classList.toggle('active', isAll);
        btn.setAttribute('aria-checked', isAll ? 'true' : 'false');
      });
      if (tableSubtitle) {
        tableSubtitle.textContent = 'Wszyscy (Kobiety i Mężczyźni) • Sezon 2026 • najnowsze daty najpierw';
      }

      // Reset przycisków sortowania do domyślnego "Data malejąco ↓"
      sortButtons.forEach(btn => {
        const isDefault = btn.dataset.sort === 'data_desc';
        btn.classList.toggle('active', isDefault);
        btn.setAttribute('aria-pressed', isDefault ? 'true' : 'false');
      });

      if (colHeaderDate) colHeaderDate.textContent = 'DATA ↓';

      fetchResults();
      updateAnalysisSection('all');
    });
  }

  // ==========================================================================
  // 3. OBSŁUGA PRZYCISKÓW SORTOWANIA
  // ==========================================================================

  sortButtons.forEach(button => {
    button.addEventListener('click', () => {
      const sortMode = button.dataset.sort;
      if (!sortMode) return;

      // Aktualizacja stanu aktywnego przycisku
      sortButtons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      button.classList.add('active');
      button.setAttribute('aria-pressed', 'true');

      state.sort = sortMode;

      // Wizualne oznaczenie w nagłówku kolumny daty
      if (colHeaderDate) {
        if (sortMode === 'data_asc') {
          colHeaderDate.textContent = 'DATA ↑';
        } else if (sortMode === 'data_desc') {
          colHeaderDate.textContent = 'DATA ↓';
        } else {
          colHeaderDate.textContent = 'DATA';
        }
      }

      fetchResults();
    });
  });

  // ==========================================================================
  // 4. PODGLĄD NA ŻYWO (LIVE PREVIEW W SIDEBARZE)
  // ==========================================================================

  function updateLivePreview() {
    const name = (athleteNameInput && athleteNameInput.value.trim()) || 'Imię i nazwisko';
    const club = (athleteClubInput && athleteClubInput.value.trim()) || '';
    const discipline = (disciplineSelect && disciplineSelect.value) || '100 m';
    const dateVal = (eventDateInput && eventDateInput.value) || '';
    const scoreVal = (scoreInput && scoreInput.value.trim()) || '--,--';
    const windVal = (windInput && windInput.value.trim()) || '';
    const isRz = isRzCheckbox ? isRzCheckbox.checked : false;

    // Wybrana płeć
    const selectedGender = document.querySelector('input[name="gender"]:checked');
    const genderLabel = selectedGender && selectedGender.value === 'kobiety' ? 'kobiety' : 'mężczyźni';
    
    // Kategoria wiekowa
    const ageSelect = document.getElementById('age-category');
    const ageLabel = ageSelect ? ageSelect.options[ageSelect.selectedIndex].text.toLowerCase() : 'open';

    const unit = discipline.toLowerCase().includes('skok') ? 'm' : 's';

    // Aktualizacja jednostki w formularzu
    if (scoreUnitBadge) {
      scoreUnitBadge.textContent = unit;
    }

    // Aktualizacja podglądu karty
    if (previewAthleteName) previewAthleteName.textContent = name;
    if (previewCategory) previewCategory.textContent = `${discipline} • ${genderLabel} ${ageLabel}`;
    if (previewScoreVal) previewScoreVal.textContent = scoreVal;
    if (previewUnit) previewUnit.textContent = unit;
    if (previewBadgeRz) previewBadgeRz.style.display = isRz ? 'inline-flex' : 'none';

    // Formatowanie daty do DD.MM.YYYY
    if (previewDateVal) {
      if (dateVal) {
        const parts = dateVal.split('-');
        if (parts.length === 3) {
          previewDateVal.textContent = `${parts[2]}.${parts[1]}.${parts[0]}`;
        } else {
          previewDateVal.textContent = dateVal;
        }
      } else {
        previewDateVal.textContent = '--.--.----';
      }
    }

    // Klub w podglądzie
    if (previewClubVal) {
      if (club) {
        previewClubVal.textContent = club;
        previewClubVal.classList.remove('text-placeholder');
      } else {
        previewClubVal.textContent = 'Do uzupełnienia';
        previewClubVal.classList.add('text-placeholder');
      }
    }

    // Wiatr w podglądzie
    if (previewWindVal) {
      previewWindVal.textContent = windVal || 'Brak pomiaru';
    }
  }

  // Nasłuchiwanie zmian w formularzu dla podglądu na żywo
  const previewTriggers = [
    athleteNameInput,
    athleteClubInput,
    disciplineSelect,
    eventDateInput,
    scoreInput,
    windInput,
    isRzCheckbox,
    document.getElementById('age-category')
  ];

  previewTriggers.forEach(el => {
    if (!el) return;
    el.addEventListener('input', updateLivePreview);
    el.addEventListener('change', updateLivePreview);
  });

  const genderRadios = document.querySelectorAll('input[name="gender"]');
  genderRadios.forEach(radio => radio.addEventListener('change', updateLivePreview));

  // Inicjalizacja podglądu
  updateLivePreview();

  // ==========================================================================
  // 5. DODAWANIE NOWEGO WYNIKU DO BAZY DANYCH (POST /api/wyniki)
  // ==========================================================================

  if (addResultForm) {
    addResultForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Reset poprzednich banerów
      hideBanners();

      const name = athleteNameInput ? athleteNameInput.value.trim() : '';
      const club = athleteClubInput ? athleteClubInput.value.trim() : '';
      const discipline = disciplineSelect ? disciplineSelect.value : '100 m';
      const eventDate = eventDateInput ? eventDateInput.value : '';
      const scoreRaw = scoreInput ? scoreInput.value.trim() : '';
      const wind = windInput ? windInput.value.trim() : '';
      const isRz = isRzCheckbox ? isRzCheckbox.checked : false;

      const selectedGenderEl = document.querySelector('input[name="gender"]:checked');
      const gender = selectedGenderEl ? selectedGenderEl.value : 'mezczyzni';
      const ageCatEl = document.getElementById('age-category');
      const ageCategory = ageCatEl ? ageCatEl.value : 'open';

      // Walidacja front-endowa
      let hasError = false;

      // Walidacja klubu (zgodnie z Figmą - podświetlenie na czerwono)
      if (!club) {
        showClubError('Podaj nazwę klubu lub wpisz „Niezrzeszony”.');
        showErrorBanner('Uzupełnij pole „Klub”, aby wysłać zgłoszenie.');
        hasError = true;
      } else {
        clearClubError();
      }

      // Walidacja imienia i nazwiska
      if (!name) {
        if (!hasError) showErrorBanner('Podaj imię i nazwisko zawodnika.');
        hasError = true;
      }

      // Walidacja wyniku
      const parsedScore = parseFloat(scoreRaw.replace(',', '.'));
      if (!scoreRaw || isNaN(parsedScore) || parsedScore <= 0) {
        if (!hasError) showErrorBanner('Wpisz poprawny wynik liczbowy (np. 10.84 lub 7.42).');
        hasError = true;
      }

      if (hasError) return;

      // Przygotowanie payloadu JSON do zapisu w bazie
      const payload = {
        athlete_name: name,
        athlete_club: club,
        gender: gender,
        age_category: ageCategory,
        discipline: discipline,
        event_date: eventDate,
        score: parsedScore,
        wind: wind,
        is_rz: isRz ? 1 : 0
      };

      try {
        const submitBtn = document.getElementById('btn-submit-result');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span>Zapisywanie...</span>';
        }

        const response = await fetch(`${API_BASE}/api/wyniki`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload)
        });

        const resultData = await response.json();

        if (response.ok && resultData.success) {
          // Sukces! Pokaż baner sukcesu
          showSuccessBanner(`Wynik zawodnika ${name} (${resultData.record.score_formatted}) został pomyślnie zapisany w bazie danych!`);
          
          // Zaktualizuj listę klubów w filtrze, jeśli pojawił się nowy klub
          ensureClubInFilter(club);

          // Odśwież tabelę wyników bezpośrednio z bazy
          await fetchResults();

          // Płynne przewinięcie do bazy wyników, aby użytkownik widział dodany rekord
          setTimeout(() => {
            const bazaSection = document.getElementById('baza-wynikow');
            if (bazaSection) {
              bazaSection.scrollIntoView({ behavior: 'smooth' });
            }
          }, 900);
        } else {
          showErrorBanner(resultData.error || 'Wystąpił błąd podczas zapisywania wyniku w bazie.');
        }
      } catch (err) {
        console.error('Błąd wysyłania:', err);
        showErrorBanner('Błąd połączenia z serwerem. Wynik nie został zapisany.');
      } finally {
        const submitBtn = document.getElementById('btn-submit-result');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Wyślij zgłoszenie</span><span class="btn-arrow" aria-hidden="true">→</span>';
        }
      }
    });
  }

  // Kasowanie błędu klubu przy wpisywaniu
  if (athleteClubInput) {
    athleteClubInput.addEventListener('input', () => {
      if (athleteClubInput.value.trim()) {
        clearClubError();
        if (formErrorBanner && formErrorBanner.style.display !== 'none') {
          hideBanners();
        }
      }
    });
  }

  function showClubError(msg) {
    if (groupAthleteClub) groupAthleteClub.classList.add('has-error');
    if (athleteClubInput) {
      athleteClubInput.classList.add('form-control-error');
      athleteClubInput.setAttribute('aria-invalid', 'true');
    }
    if (athleteClubError) {
      athleteClubError.textContent = msg;
      athleteClubError.style.display = 'block';
    }
  }

  function clearClubError() {
    if (groupAthleteClub) groupAthleteClub.classList.remove('has-error');
    if (athleteClubInput) {
      athleteClubInput.classList.remove('form-control-error');
      athleteClubInput.removeAttribute('aria-invalid');
    }
    if (athleteClubError) {
      athleteClubError.style.display = 'none';
    }
  }

  function showErrorBanner(message) {
    if (formErrorBanner && formErrorText) {
      formErrorText.textContent = message;
      formErrorBanner.style.display = 'flex';
    }
    if (formSuccessBanner) formSuccessBanner.style.display = 'none';
  }

  function showSuccessBanner(message) {
    if (formSuccessBanner && formSuccessText) {
      formSuccessText.textContent = message;
      formSuccessBanner.style.display = 'flex';
    }
    if (formErrorBanner) formErrorBanner.style.display = 'none';
  }

  function hideBanners() {
    if (formErrorBanner) formErrorBanner.style.display = 'none';
    if (formSuccessBanner) formSuccessBanner.style.display = 'none';
  }

  function ensureClubInFilter(clubName) {
    if (!filterClub || !clubName) return;
    const exists = Array.from(filterClub.options).some(opt => opt.value === clubName);
    if (!exists) {
      const newOption = document.createElement('option');
      newOption.value = clubName;
      newOption.textContent = clubName;
      filterClub.appendChild(newOption);
    }
  }

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  // ==========================================================================
  // 6. EKSPORT WYNIKÓW DO PLIKU CSV
  // ==========================================================================
  const btnExportCsv = document.getElementById('btn-export-csv');

  function exportResultsToCsv() {
    if (!state.results || state.results.length === 0) {
      showToast('Brak wyników do wyeksportowania', '⚠️');
      return;
    }

    const headers = ['Zawodnik', 'Klub', 'Konkurencja', 'Wynik', 'Data startu', 'Rekord życiowy'];
    const rows = state.results.map(r => [
      `"${String(r.athlete_name || '').replaceAll('"', '""')}"`,
      `"${String(r.athlete_club || '').replaceAll('"', '""')}"`,
      `"${String(r.discipline || '').replaceAll('"', '""')}"`,
      `"${String(r.score_formatted || r.score || '').replaceAll('"', '""')}"`,
      `"${String(r.event_date_formatted || r.event_date || '').replaceAll('"', '""')}"`,
      r.is_rz ? 'TAK' : 'NIE'
    ]);

    // Używamy znacznika UTF-8 BOM (\uFEFF), aby polskie znaki diakrytyczne
    // otwierały się bez problemu w Excelu i Arkuszach Google.
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(row => row.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const todayStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `bieznia_wyniki_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Wyeksportowano ${state.results.length} rekordów do CSV!`, '📊');
  }

  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', exportResultsToCsv);
  }

  // ==========================================================================
  // 7. INTERAKTYWNOŚĆ WYKRESU ANALITYCZNEGO ORAZ RANKINGÓW Z PODZIAŁEM NA PŁEĆ
  // ==========================================================================
  const chartDisciplineSelect = document.getElementById('chart-discipline-select');
  const chartTitleEl = document.querySelector('.chart-title');
  const chartSubtitleEl = document.querySelector('.chart-subtitle');
  const barChartContainer = document.querySelector('.bar-chart-container');
  const chartSummaryStats = document.querySelector('.chart-summary-stats');

  const chartDataSetsByGender = {
    mezczyzni: {
      '100m': {
        title: '100 m mężczyzn. Jeden dystans, sześć wyników.',
        subtitle: '24.05.2026 • mężczyźni open • czas w sekundach',
        rule: 'Krótszy czas = lepszy wynik',
        xAxis: ['0', '3', '6', '9', '12 s'],
        unit: 's',
        lowerIsBetter: true,
        maxScale: 12.0,
        rows: [
          { athlete: 'Jakub Nowak', score: 10.84, display: '10,84 s', isLeader: true },
          { athlete: 'Michał Kowalski', score: 10.96, display: '10,96 s' },
          { athlete: 'Adam Wiśniewski', score: 11.08, display: '11,08 s' },
          { athlete: 'Kacper Wójcik', score: 11.20, display: '11,20 s' },
          { athlete: 'Piotr Kamiński', score: 11.32, display: '11,32 s' },
          { athlete: 'Filip Lewandowski', score: 11.44, display: '11,44 s' }
        ],
        metrics: [
          { val: '10,84 s', label: 'najlepszy czas' },
          { val: '11,14 s', label: 'średnia' },
          { val: '0,60 s', label: 'rozstęp wyników' }
        ]
      },
      '400m': {
        title: '400 m mężczyzn. Jeden dystans, sześć wyników.',
        subtitle: '17.05.2026 • mężczyźni open • czas w sekundach',
        rule: 'Krótszy czas = lepszy wynik',
        xAxis: ['0', '15', '30', '45', '60 s'],
        unit: 's',
        lowerIsBetter: true,
        maxScale: 55.0,
        rows: [
          { athlete: 'Mateusz Zieliński', score: 48.12, display: '48,12 s', isLeader: true },
          { athlete: 'Bartosz Szymański', score: 48.76, display: '48,76 s' },
          { athlete: 'Tomasz Woźniak', score: 49.20, display: '49,20 s' },
          { athlete: 'Paweł Dąbrowski', score: 49.84, display: '49,84 s' },
          { athlete: 'Marcin Kozłowski', score: 50.16, display: '50,16 s' },
          { athlete: 'Szymon Jankowski', score: 50.92, display: '50,92 s' }
        ],
        metrics: [
          { val: '48,12 s', label: 'najlepszy czas' },
          { val: '49,50 s', label: 'średnia' },
          { val: '2,80 s', label: 'rozstęp wyników' }
        ]
      },
      'skok': {
        title: 'Skok w dal mężczyzn. Próby finałowe.',
        subtitle: '10.05.2026 • mężczyźni open • odległość w metrach',
        rule: 'Dłuższy skok = lepszy wynik',
        xAxis: ['0', '2', '4', '6', '8 m'],
        unit: 'm',
        lowerIsBetter: false,
        maxScale: 8.0,
        rows: [
          { athlete: 'Antoni Mazur', score: 7.42, display: '7,42 m', isLeader: true },
          { athlete: 'Wojciech Krawczyk', score: 7.30, display: '7,30 m' },
          { athlete: 'Dawid Piotrowski', score: 7.18, display: '7,18 m' },
          { athlete: 'Igor Grabowski', score: 7.06, display: '7,06 m' },
          { athlete: 'Oskar Pawlak', score: 6.94, display: '6,94 m' },
          { athlete: 'Łukasz Michalski', score: 6.82, display: '6,82 m' }
        ],
        metrics: [
          { val: '7,42 m', label: 'najlepszy skok' },
          { val: '7,12 m', label: 'średnia' },
          { val: '0,60 m', label: 'rozstęp wyników' }
        ]
      }
    },
    kobiety: {
      '100m': {
        title: '100 m kobiet. Jeden dystans, sześć wyników.',
        subtitle: '24.05.2026 • kobiety open • czas w sekundach',
        rule: 'Krótszy czas = lepszy wynik',
        xAxis: ['0', '3', '6', '9', '12 s'],
        unit: 's',
        lowerIsBetter: true,
        maxScale: 12.0,
        rows: [
          { athlete: 'Ewa Swoboda', score: 11.05, display: '11,05 s', isLeader: true },
          { athlete: 'Martyna Kotwiła', score: 11.24, display: '11,24 s' },
          { athlete: 'Magdalena Stefanowicz', score: 11.36, display: '11,36 s' },
          { athlete: 'Paulina Guzowska', score: 11.48, display: '11,48 s' },
          { athlete: 'Zuzanna Wyppich', score: 11.60, display: '11,60 s' },
          { athlete: 'Oliwia Nowacka', score: 11.75, display: '11,75 s' }
        ],
        metrics: [
          { val: '11,05 s', label: 'najlepszy czas' },
          { val: '11,41 s', label: 'średnia' },
          { val: '0,70 s', label: 'rozstęp wyników' }
        ]
      },
      '400m': {
        title: '400 m kobiet. Jeden dystans, sześć wyników.',
        subtitle: '17.05.2026 • kobiety open • czas w sekundach',
        rule: 'Krótszy czas = lepszy wynik',
        xAxis: ['0', '15', '30', '45', '60 s'],
        unit: 's',
        lowerIsBetter: true,
        maxScale: 55.0,
        rows: [
          { athlete: 'Natalia Kaczmarek', score: 49.98, display: '49,98 s', isLeader: true },
          { athlete: 'Anna Kiełbasińska', score: 50.85, display: '50,85 s' },
          { athlete: 'Justyna Święty-Ersetic', score: 51.42, display: '51,42 s' },
          { athlete: 'Iga Baumgart-Witan', score: 52.15, display: '52,15 s' },
          { athlete: 'Alicja Wrona-Kutrzepa', score: 52.88, display: '52,88 s' },
          { athlete: 'Karolina Łozowska', score: 53.40, display: '53,40 s' }
        ],
        metrics: [
          { val: '49,98 s', label: 'najlepszy czas' },
          { val: '51,78 s', label: 'średnia' },
          { val: '3,42 s', label: 'rozstęp wyników' }
        ]
      },
      'skok': {
        title: 'Skok w dal kobiet. Próby finałowe.',
        subtitle: '10.05.2026 • kobiety open • odległość w metrach',
        rule: 'Dłuższy skok = lepszy wynik',
        xAxis: ['0', '2', '4', '6', '8 m'],
        unit: 'm',
        lowerIsBetter: false,
        maxScale: 8.0,
        rows: [
          { athlete: 'Nikola Horowska', score: 6.68, display: '6,68 m', isLeader: true },
          { athlete: 'Roksana Jędraszak', score: 6.45, display: '6,45 m' },
          { athlete: 'Anna Matuszewicz', score: 6.32, display: '6,32 m' },
          { athlete: 'Magdalena Bokun', score: 6.20, display: '6,20 m' },
          { athlete: 'Joanna Kłodawska', score: 6.08, display: '6,08 m' },
          { athlete: 'Julia Adamczyk', score: 5.92, display: '5,92 m' }
        ],
        metrics: [
          { val: '6,68 m', label: 'najlepszy skok' },
          { val: '6,28 m', label: 'średnia' },
          { val: '0,76 m', label: 'rozstęp wyników' }
        ]
      }
    },
    all: {
      '100m': {
        title: '100 m open. Wszyscy startujący.',
        subtitle: '24.05.2026 • kobiety i mężczyźni open • czas w sekundach',
        rule: 'Krótszy czas = lepszy wynik',
        xAxis: ['0', '3', '6', '9', '12 s'],
        unit: 's',
        lowerIsBetter: true,
        maxScale: 12.0,
        rows: [
          { athlete: 'Jakub Nowak (M)', score: 10.84, display: '10,84 s', isLeader: true, gender: 'm' },
          { athlete: 'Michał Kowalski (M)', score: 10.96, display: '10,96 s', gender: 'm' },
          { athlete: 'Ewa Swoboda (K)', score: 11.05, display: '11,05 s', gender: 'k' },
          { athlete: 'Adam Wiśniewski (M)', score: 11.08, display: '11,08 s', gender: 'm' },
          { athlete: 'Kacper Wójcik (M)', score: 11.20, display: '11,20 s', gender: 'm' },
          { athlete: 'Martyna Kotwiła (K)', score: 11.24, display: '11,24 s', gender: 'k' }
        ],
        metrics: [
          { val: '10,84 s', label: 'najlepszy czas' },
          { val: '11,28 s', label: 'średnia ogólna' },
          { val: '0,91 s', label: 'rozstęp wyników' }
        ]
      },
      '400m': {
        title: '400 m open. Wszyscy startujący.',
        subtitle: '17.05.2026 • kobiety i mężczyźni open • czas w sekundach',
        rule: 'Krótszy czas = lepszy wynik',
        xAxis: ['0', '15', '30', '45', '60 s'],
        unit: 's',
        lowerIsBetter: true,
        maxScale: 55.0,
        rows: [
          { athlete: 'Mateusz Zieliński (M)', score: 48.12, display: '48,12 s', isLeader: true, gender: 'm' },
          { athlete: 'Bartosz Szymański (M)', score: 48.76, display: '48,76 s', gender: 'm' },
          { athlete: 'Tomasz Woźniak (M)', score: 49.20, display: '49,20 s', gender: 'm' },
          { athlete: 'Paweł Dąbrowski (M)', score: 49.84, display: '49,84 s', gender: 'm' },
          { athlete: 'Natalia Kaczmarek (K)', score: 49.98, display: '49,98 s', gender: 'k' },
          { athlete: 'Marcin Kozłowski (M)', score: 50.16, display: '50,16 s', gender: 'm' }
        ],
        metrics: [
          { val: '48,12 s', label: 'najlepszy czas' },
          { val: '50,64 s', label: 'średnia ogólna' },
          { val: '5,28 s', label: 'rozstęp wyników' }
        ]
      },
      'skok': {
        title: 'Skok w dal open. Wszyscy startujący.',
        subtitle: '10.05.2026 • kobiety i mężczyźni open • odległość w metrach',
        rule: 'Dłuższy skok = lepszy wynik',
        xAxis: ['0', '2', '4', '6', '8 m'],
        unit: 'm',
        lowerIsBetter: false,
        maxScale: 8.0,
        rows: [
          { athlete: 'Antoni Mazur (M)', score: 7.42, display: '7,42 m', isLeader: true, gender: 'm' },
          { athlete: 'Wojciech Krawczyk (M)', score: 7.30, display: '7,30 m', gender: 'm' },
          { athlete: 'Dawid Piotrowski (M)', score: 7.18, display: '7,18 m', gender: 'm' },
          { athlete: 'Igor Grabowski (M)', score: 7.06, display: '7,06 m', gender: 'm' },
          { athlete: 'Oskar Pawlak (M)', score: 6.94, display: '6,94 m', gender: 'm' },
          { athlete: 'Nikola Horowska (K)', score: 6.68, display: '6,68 m', gender: 'k' }
        ],
        metrics: [
          { val: '7,42 m', label: 'najlepszy skok' },
          { val: '6,70 m', label: 'średnia ogólna' },
          { val: '1,50 m', label: 'rozstęp wyników' }
        ]
      }
    }
  };

  function updateChart(disciplineKey) {
    const genderKey = state.gender === 'kobiety' ? 'kobiety' : (state.gender === 'mezczyzni' ? 'mezczyzni' : 'all');
    const genderGroup = chartDataSetsByGender[genderKey] || chartDataSetsByGender.all;
    const data = genderGroup[disciplineKey] || genderGroup['100m'];
    if (!data) return;

    if (chartTitleEl) chartTitleEl.textContent = data.title;
    if (chartSubtitleEl) chartSubtitleEl.textContent = data.subtitle;

    const legendRule = document.querySelector('.legend-rule');
    if (legendRule) legendRule.textContent = data.rule;

    // Aktualizacja etykiet i widoczności legendy
    const legFemale = document.getElementById('legend-item-female');
    const legMale = document.getElementById('legend-item-male');
    const legLabelLeader = document.getElementById('legend-label-leader');
    const legLabelFemale = document.getElementById('legend-label-female');
    const legLabelMale = document.getElementById('legend-label-male');

    if (legLabelLeader) legLabelLeader.textContent = '1. miejsce (Złoto)';

    if (genderKey === 'kobiety') {
      if (legFemale) legFemale.style.display = 'inline-flex';
      if (legLabelFemale) legLabelFemale.textContent = 'Kobiety (Różowy)';
      if (legMale) legMale.style.display = 'none';
    } else if (genderKey === 'mezczyzni') {
      if (legFemale) legFemale.style.display = 'none';
      if (legMale) legMale.style.display = 'inline-flex';
      if (legLabelMale) legLabelMale.textContent = 'Mężczyźni (Błękitny)';
    } else {
      if (legFemale) legFemale.style.display = 'inline-flex';
      if (legLabelFemale) legLabelFemale.textContent = 'Kobiety (Różowy)';
      if (legMale) legMale.style.display = 'inline-flex';
      if (legLabelMale) legLabelMale.textContent = 'Mężczyźni (Błękitny)';
    }

    if (barChartContainer) {
      const rowsHtml = data.rows.map((row, idx) => {
        const percent = Math.min(100, Math.max(10, (row.score / data.maxScale) * 100)).toFixed(2);
        
        // Złoty dla 1. miejsca, Różowy dla kobiet, Błękitny dla mężczyzn
        let barClass = '';
        if (row.isLeader || idx === 0) {
          barClass = ' bar-gold bar-leader';
        } else if (row.gender === 'k' || genderKey === 'kobiety') {
          barClass = ' bar-female';
        } else {
          barClass = ' bar-male';
        }

        return `
          <div class="chart-row">
            <span class="row-athlete">${escapeHtml(row.athlete)}</span>
            <div class="row-track">
              <div class="chart-bar${barClass}" style="--bar-width: ${percent}%;" aria-label="${escapeHtml(row.athlete)}: ${escapeHtml(row.display)}"></div>
            </div>
            <span class="row-value">${escapeHtml(row.display)}</span>
          </div>
        `;
      }).join('');

      const xAxisHtml = `
        <div class="chart-x-axis" aria-hidden="true">
          ${data.xAxis.map((t, idx) => `<span class="x-tick tick-${idx * 3}">${escapeHtml(t)}</span>`).join('')}
        </div>
      `;

      barChartContainer.innerHTML = rowsHtml + xAxisHtml;
    }

    if (chartSummaryStats && data.metrics) {
      chartSummaryStats.innerHTML = data.metrics.map(m => `
        <div class="summary-metric">
          <span class="metric-val">${escapeHtml(m.val)}</span>
          <span class="metric-label">${escapeHtml(m.label)}</span>
        </div>
      `).join('');
    }
  }

  function updateAnalysisSection(gender) {
    const kpiValTotal = document.getElementById('kpi-val-total');
    const kpiDescTotal = document.getElementById('kpi-desc-total');
    const kpiValAvg100 = document.getElementById('kpi-val-avg100');
    const kpiDescAvg100 = document.getElementById('kpi-desc-avg100');
    const pill = document.getElementById('analiza-category-pill');
    const meta = document.getElementById('analiza-meta-text');

    const rankingMeta100 = document.getElementById('ranking-meta-100m');
    const rankingList100 = document.getElementById('ranking-list-100m');
    const rankingMetaSkok = document.getElementById('ranking-meta-skok');
    const rankingListSkok = document.getElementById('ranking-list-skok');
    const leaderTitle = document.getElementById('leader-400m-title');
    const leaderPerson = document.getElementById('leader-400m-person');
    const leaderScore = document.getElementById('leader-400m-score');

    if (gender === 'kobiety') {
      if (pill) pill.textContent = 'Kobiety open';
      if (meta) meta.textContent = 'Kobiety • 18 startów • 3 konkurencje';
      if (kpiValTotal) kpiValTotal.textContent = '18';
      if (kpiDescTotal) kpiDescTotal.textContent = '18 zawodniczek • wszystkie konkurencje';
      if (kpiValAvg100) kpiValAvg100.innerHTML = '11,41 <span class="kpi-unit">s</span>';
      if (kpiDescAvg100) kpiDescAvg100.textContent = 'Średnia arytmetyczna z 6 wyników kobiet na 100 m';

      if (rankingMeta100) rankingMeta100.textContent = 'Czas rosnąco • 6 zawodniczek';
      if (rankingList100) {
        rankingList100.innerHTML = `
          <li class="ranking-item">
            <span class="rank-pos pos-1">1</span>
            <div class="rank-details"><span class="rank-name">Ewa Swoboda</span><span class="rank-club">AZS Warszawa</span></div>
            <div class="rank-result"><span class="rank-score">11,05 s</span><span class="badge-rz">RŻ</span></div>
          </li>
          <li class="ranking-item">
            <span class="rank-pos pos-2">2</span>
            <div class="rank-details"><span class="rank-name">Martyna Kotwiła</span><span class="rank-club">KS Sprint Kraków</span></div>
            <div class="rank-result"><span class="rank-score">11,24 s</span><span class="badge-rz">RŻ</span></div>
          </li>
          <li class="ranking-item">
            <span class="rank-pos pos-3">3</span>
            <div class="rank-details"><span class="rank-name">Magdalena Stefanowicz</span><span class="rank-club">WKS Poznań</span></div>
            <div class="rank-result"><span class="rank-score">11,36 s</span></div>
          </li>
        `;
      }

      if (rankingMetaSkok) rankingMetaSkok.textContent = 'Odległość malejąco • 6 zawodniczek';
      if (rankingListSkok) {
        rankingListSkok.innerHTML = `
          <li class="ranking-item">
            <span class="rank-pos pos-1">1</span>
            <div class="rank-details"><span class="rank-name">Nikola Horowska</span><span class="rank-club">KS Sprint Kraków</span></div>
            <div class="rank-result"><span class="rank-score">6,68 m</span><span class="badge-rz">RŻ</span></div>
          </li>
          <li class="ranking-item">
            <span class="rank-pos pos-2">2</span>
            <div class="rank-details"><span class="rank-name">Roksana Jędraszak</span><span class="rank-club">WKS Poznań</span></div>
            <div class="rank-result"><span class="rank-score">6,45 m</span><span class="badge-rz">RŻ</span></div>
          </li>
          <li class="ranking-item">
            <span class="rank-pos pos-3">3</span>
            <div class="rank-details"><span class="rank-name">Anna Matuszewicz</span><span class="rank-club">AZS Warszawa</span></div>
            <div class="rank-result"><span class="rank-score">6,32 m</span></div>
          </li>
        `;
      }

      if (leaderTitle) leaderTitle.textContent = 'Liderka 400 m';
      if (leaderPerson) leaderPerson.textContent = 'Natalia Kaczmarek • AZS Warszawa';
      if (leaderScore) leaderScore.textContent = '49,98 s';

    } else if (gender === 'mezczyzni') {
      if (pill) pill.textContent = 'Mężczyźni open';
      if (meta) meta.textContent = 'Mężczyźni • 19 startów • 3 konkurencje';
      if (kpiValTotal) kpiValTotal.textContent = '19';
      if (kpiDescTotal) kpiDescTotal.textContent = '19 zawodników • wszystkie konkurencje';
      if (kpiValAvg100) kpiValAvg100.innerHTML = '11,14 <span class="kpi-unit">s</span>';
      if (kpiDescAvg100) kpiDescAvg100.textContent = 'Średnia arytmetyczna z wyników mężczyzn na 100 m';

      if (rankingMeta100) rankingMeta100.textContent = 'Czas rosnąco • 6 zawodników';
      if (rankingList100) {
        rankingList100.innerHTML = `
          <li class="ranking-item">
            <span class="rank-pos pos-1">1</span>
            <div class="rank-details"><span class="rank-name">Jakub Nowak</span><span class="rank-club">AZS Warszawa</span></div>
            <div class="rank-result"><span class="rank-score">10,84 s</span><span class="badge-rz">RŻ</span></div>
          </li>
          <li class="ranking-item">
            <span class="rank-pos pos-2">2</span>
            <div class="rank-details"><span class="rank-name">Michał Kowalski</span><span class="rank-club">KS Sprint Kraków</span></div>
            <div class="rank-result"><span class="rank-score">10,96 s</span><span class="badge-rz">RŻ</span></div>
          </li>
          <li class="ranking-item">
            <span class="rank-pos pos-3">3</span>
            <div class="rank-details"><span class="rank-name">Adam Wiśniewski</span><span class="rank-club">WKS Poznań</span></div>
            <div class="rank-result"><span class="rank-score">11,08 s</span></div>
          </li>
        `;
      }

      if (rankingMetaSkok) rankingMetaSkok.textContent = 'Odległość malejąco • 6 zawodników';
      if (rankingListSkok) {
        rankingListSkok.innerHTML = `
          <li class="ranking-item">
            <span class="rank-pos pos-1">1</span>
            <div class="rank-details"><span class="rank-name">Antoni Mazur</span><span class="rank-club">AZS Warszawa</span></div>
            <div class="rank-result"><span class="rank-score">7,42 m</span><span class="badge-rz">RŻ</span></div>
          </li>
          <li class="ranking-item">
            <span class="rank-pos pos-2">2</span>
            <div class="rank-details"><span class="rank-name">Wojciech Krawczyk</span><span class="rank-club">KS Sprint Kraków</span></div>
            <div class="rank-result"><span class="rank-score">7,30 m</span><span class="badge-rz">RŻ</span></div>
          </li>
          <li class="ranking-item">
            <span class="rank-pos pos-3">3</span>
            <div class="rank-details"><span class="rank-name">Dawid Piotrowski</span><span class="rank-club">WKS Poznań</span></div>
            <div class="rank-result"><span class="rank-score">7,18 m</span></div>
          </li>
        `;
      }

      if (leaderTitle) leaderTitle.textContent = 'Lider 400 m';
      if (leaderPerson) leaderPerson.textContent = 'Mateusz Zieliński • WKS Poznań';
      if (leaderScore) leaderScore.textContent = '48,12 s';

    } else {
      if (pill) pill.textContent = 'Wszyscy open';
      if (meta) meta.textContent = 'Cała baza • 37 startów • 3 konkurencje';
      if (kpiValTotal) kpiValTotal.textContent = '37';
      if (kpiDescTotal) kpiDescTotal.textContent = '37 zawodników i zawodniczek • wszystkie konkurencje';
      if (kpiValAvg100) kpiValAvg100.innerHTML = '11,28 <span class="kpi-unit">s</span>';
      if (kpiDescAvg100) kpiDescAvg100.textContent = 'Średnia arytmetyczna ze wszystkich wyników na 100 m';

      if (rankingMeta100) rankingMeta100.textContent = 'Czas rosnąco • Top liderzy';
      if (rankingList100) {
        rankingList100.innerHTML = `
          <li class="ranking-item">
            <span class="rank-pos pos-1">1</span>
            <div class="rank-details"><span class="rank-name">Jakub Nowak <span class="badge-gender badge-gender-m">M</span></span><span class="rank-club">AZS Warszawa</span></div>
            <div class="rank-result"><span class="rank-score">10,84 s</span><span class="badge-rz">RŻ</span></div>
          </li>
          <li class="ranking-item">
            <span class="rank-pos pos-2">2</span>
            <div class="rank-details"><span class="rank-name">Michał Kowalski <span class="badge-gender badge-gender-m">M</span></span><span class="rank-club">KS Sprint Kraków</span></div>
            <div class="rank-result"><span class="rank-score">10,96 s</span><span class="badge-rz">RŻ</span></div>
          </li>
          <li class="ranking-item">
            <span class="rank-pos pos-3">3</span>
            <div class="rank-details"><span class="rank-name">Ewa Swoboda <span class="badge-gender badge-gender-k">K</span></span><span class="rank-club">AZS Warszawa</span></div>
            <div class="rank-result"><span class="rank-score">11,05 s</span><span class="badge-rz">RŻ</span></div>
          </li>
        `;
      }

      if (rankingMetaSkok) rankingMetaSkok.textContent = 'Odległość malejąco • Top liderzy';
      if (rankingListSkok) {
        rankingListSkok.innerHTML = `
          <li class="ranking-item">
            <span class="rank-pos pos-1">1</span>
            <div class="rank-details"><span class="rank-name">Antoni Mazur <span class="badge-gender badge-gender-m">M</span></span><span class="rank-club">AZS Warszawa</span></div>
            <div class="rank-result"><span class="rank-score">7,42 m</span><span class="badge-rz">RŻ</span></div>
          </li>
          <li class="ranking-item">
            <span class="rank-pos pos-2">2</span>
            <div class="rank-details"><span class="rank-name">Wojciech Krawczyk <span class="badge-gender badge-gender-m">M</span></span><span class="rank-club">KS Sprint Kraków</span></div>
            <div class="rank-result"><span class="rank-score">7,30 m</span><span class="badge-rz">RŻ</span></div>
          </li>
          <li class="ranking-item">
            <span class="rank-pos pos-3">3</span>
            <div class="rank-details"><span class="rank-name">Dawid Piotrowski <span class="badge-gender badge-gender-m">M</span></span><span class="rank-club">WKS Poznań</span></div>
            <div class="rank-result"><span class="rank-score">7,18 m</span></div>
          </li>
        `;
      }

      if (leaderTitle) leaderTitle.textContent = 'Lider 400 m (Open)';
      if (leaderPerson) leaderPerson.textContent = 'Mateusz Zieliński (48,12 s) & Natalia Kaczmarek (49,98 s)';
      if (leaderScore) leaderScore.textContent = '48,12 s';
    }

    // Aktualizacja wykresu
    const currentDisc = chartDisciplineSelect ? chartDisciplineSelect.value : '100m';
    updateChart(currentDisc);
  }

  if (chartDisciplineSelect) {
    chartDisciplineSelect.addEventListener('change', (e) => {
      updateChart(e.target.value);
    });
  }

  // ==========================================================================
  // 8. PERSONALIZACJA WYGLĄDU (MOTYW, POGRUBIENIE, ROZMIAR, AKCENTY)
  // ==========================================================================
  const btnThemeQuickToggle = document.getElementById('btn-theme-quick-toggle');
  const btnCustomizationToggle = document.getElementById('btn-customization-toggle');
  const customizationPanel = document.getElementById('customization-panel');
  const btnCloseCustomization = document.getElementById('btn-close-customization');
  const themeOptionBtns = document.querySelectorAll('.theme-option-btn');
  const segmentBtns = document.querySelectorAll('.segmented-control .segment-btn');
  const fontSizeBtns = document.querySelectorAll('.font-size-group .font-size-btn');
  const fontSizeSlider = document.getElementById('font-size-slider');
  const accentChipBtns = document.querySelectorAll('.accent-colors-grid .accent-chip');
  const btnResetCustomization = document.getElementById('btn-reset-customization');

  // Elementy powiadomienia Toast
  const appToast = document.getElementById('app-toast');
  const toastMessage = document.getElementById('toast-message');
  const toastIcon = document.getElementById('toast-icon');
  let toastTimer = null;

  /**
   * Wyświetla subtelny toast z informacją o zmianie ustawień kosmetycznych
   */
  function showToast(message, icon = '✓') {
    if (!appToast) return;
    if (toastMessage) toastMessage.textContent = message;
    if (toastIcon) toastIcon.textContent = icon;

    appToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      appToast.classList.remove('show');
    }, 2500);
  }

  /**
   * Aplikuje motyw kolorystyczny (jasny, ciemny, systemowy)
   */
  function applyTheme(theme, notify = false) {
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('bieznia_theme', theme);

    themeOptionBtns.forEach(btn => {
      const val = btn.getAttribute('data-theme-val');
      const active = val === theme;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-checked', active ? 'true' : 'false');
    });

    if (btnThemeQuickToggle) {
      btnThemeQuickToggle.setAttribute('title', isDark ? 'Przełącz na motyw jasny' : 'Przełącz na motyw ciemny');
    }

    if (notify) {
      let msg = 'Włączono motyw jasny ☀️';
      if (theme === 'system') {
        msg = isDark ? 'Motyw automatyczny (systemowy ciemny) 💻' : 'Motyw automatyczny (systemowy jasny) 💻';
      } else if (isDark) {
        msg = 'Włączono motyw ciemny 🌙';
      }
      showToast(msg, isDark ? '🌙' : '☀️');
    }
  }

  /**
   * Aplikuje pogrubienie czcionki (możliwość pogrubienia czcionki na życzenie użytkownika)
   */
  function applyFontWeight(weight, notify = false) {
    if (weight === 'bold') {
      document.documentElement.setAttribute('data-font-weight', 'bold');
    } else {
      document.documentElement.removeAttribute('data-font-weight');
    }
    localStorage.setItem('bieznia_font_weight', weight);

    segmentBtns.forEach(btn => {
      const val = btn.getAttribute('data-font-weight-val');
      const active = val === weight;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-checked', active ? 'true' : 'false');
    });

    if (notify) {
      showToast(
        weight === 'bold' ? 'Włączono pogrubienie czcionki 🔠' : 'Przywrócono standardową czcionkę 🔤',
        weight === 'bold' ? '🔠' : '🔤'
      );
    }
  }

  /**
   * Aplikuje rozmiar tekstu (normalny, średni +10%, duży +20%)
   */
  function applyFontSize(size, notify = false) {
    if (size && size !== 'normal') {
      document.documentElement.setAttribute('data-font-size', size);
    } else {
      document.documentElement.removeAttribute('data-font-size');
    }
    localStorage.setItem('bieznia_font_size', size);

    fontSizeBtns.forEach(btn => {
      const val = btn.getAttribute('data-font-size-val');
      const active = val === size;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-checked', active ? 'true' : 'false');
    });

    const sliderMap = { normal: 1, medium: 2, large: 3 };
    if (fontSizeSlider && sliderMap[size]) {
      fontSizeSlider.value = sliderMap[size];
    }

    if (notify) {
      const labels = {
        normal: 'Domyślny (100%)',
        medium: 'Powiększony (110%)',
        large: 'Duży (120%)'
      };
      showToast(`Rozmiar tekstu: ${labels[size] || size} 🔍`, '🔍');
    }
  }

  /**
   * Aplikuje akcent kolorystyczny (błękit, szmaragd, sprint pomarańcz, fiolet)
   */
  function applyAccent(accent, notify = false) {
    if (accent && accent !== 'blue') {
      document.documentElement.setAttribute('data-accent', accent);
    } else {
      document.documentElement.removeAttribute('data-accent');
    }
    localStorage.setItem('bieznia_accent', accent);

    accentChipBtns.forEach(btn => {
      const val = btn.getAttribute('data-accent-val');
      const active = val === accent;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-checked', active ? 'true' : 'false');
    });

    if (notify) {
      const labels = {
        blue: 'Błękit lekkoatletyczny',
        emerald: 'Szmaragd stadionu',
        orange: 'Tartanowy sprint',
        violet: 'Królewski fiolet'
      };
      showToast(`Kolor akcentu: ${labels[accent] || accent} 🎨`, '🎨');
    }
  }

  /**
   * Otwiera lub zamyka pływający panel personalizacji
   */
  function setPanelOpen(open) {
    if (!customizationPanel) return;

    if (open) {
      customizationPanel.classList.add('open');
      customizationPanel.setAttribute('aria-hidden', 'false');
      if (btnCustomizationToggle) {
        btnCustomizationToggle.classList.add('active');
        btnCustomizationToggle.setAttribute('aria-expanded', 'true');
      }
    } else {
      customizationPanel.classList.remove('open');
      customizationPanel.setAttribute('aria-hidden', 'true');
      if (btnCustomizationToggle) {
        btnCustomizationToggle.classList.remove('active');
        btnCustomizationToggle.setAttribute('aria-expanded', 'false');
      }
    }
  }

  /**
   * Przywraca wszystkie ustawienia do wartości domyślnych
   */
  function resetCustomization() {
    localStorage.removeItem('bieznia_theme');
    localStorage.removeItem('bieznia_font_weight');
    localStorage.removeItem('bieznia_font_size');
    localStorage.removeItem('bieznia_accent');

    applyTheme('light', false);
    applyFontWeight('normal', false);
    applyFontSize('normal', false);
    applyAccent('blue', false);

    showToast('Przywrócono domyślne ustawienia wyglądu 🔄', '🔄');
  }

  // --- Podłączenie zdarzeń interaktywnych ---

  // Szybki przełącznik motywu (słońce / księżyc)
  if (btnThemeQuickToggle) {
    btnThemeQuickToggle.addEventListener('click', () => {
      const currentSetting = localStorage.getItem('bieznia_theme') || 'light';
      let nextTheme = 'dark';
      if (currentSetting === 'dark') {
        nextTheme = 'light';
      } else if (currentSetting === 'light') {
        nextTheme = 'dark';
      } else if (currentSetting === 'system') {
        const isSysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        nextTheme = isSysDark ? 'light' : 'dark';
      }
      applyTheme(nextTheme, true);
    });
  }

  // Przycisk otwierający/zamykający panel personalizacji
  if (btnCustomizationToggle) {
    btnCustomizationToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = customizationPanel && customizationPanel.classList.contains('open');
      setPanelOpen(!isOpen);
    });
  }

  // Kliknięcie wewnątrz panelu nie zamyka go
  if (customizationPanel) {
    customizationPanel.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  if (btnCloseCustomization) {
    btnCloseCustomization.addEventListener('click', (e) => {
      e.stopPropagation();
      setPanelOpen(false);
    });
  }

  // Zamykanie panelu przy kliknięciu poza jego obszarem
  document.addEventListener('click', (e) => {
    if (customizationPanel && customizationPanel.classList.contains('open')) {
      if (!customizationPanel.contains(e.target) && !btnCustomizationToggle.contains(e.target)) {
        setPanelOpen(false);
      }
    }
  });

  // Zamykanie klawiszem Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && customizationPanel && customizationPanel.classList.contains('open')) {
      setPanelOpen(false);
    }
  });

  // Opcje motywu w panelu
  themeOptionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-theme-val');
      applyTheme(val, true);
    });
  });

  // Opcje grubości czcionki w panelu
  segmentBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-font-weight-val');
      applyFontWeight(val, true);
    });
  });

  // Opcje rozmiaru tekstu w panelu (przyciski)
  fontSizeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-font-size-val');
      applyFontSize(val, true);
    });
  });

  // Interaktywny suwak rozmiaru tekstu
  if (fontSizeSlider) {
    const sizeSteps = ['normal', 'medium', 'large'];
    fontSizeSlider.addEventListener('input', (e) => {
      const idx = parseInt(e.target.value, 10) - 1;
      const sizeVal = sizeSteps[idx] || 'normal';
      applyFontSize(sizeVal, true);
    });
  }

  // Opcje koloru akcentu w panelu
  accentChipBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-accent-val');
      applyAccent(val, true);
    });
  });

  // Przycisk przywrócenia domyślnych
  if (btnResetCustomization) {
    btnResetCustomization.addEventListener('click', resetCustomization);
  }

  // Automatyczna reakcja na zmianę motywu systemowego Windows/MacOS
  try {
    const sysMedia = window.matchMedia('(prefers-color-scheme: dark)');
    sysMedia.addEventListener('change', () => {
      const currentSetting = localStorage.getItem('bieznia_theme') || 'light';
      if (currentSetting === 'system') {
        applyTheme('system', false);
      }
    });
  } catch (e) {}

  // Wczytanie początkowych wartości do kontrolek UI
  const initialTheme = localStorage.getItem('bieznia_theme') || 'light';
  applyTheme(initialTheme, false);

  const initialWeight = localStorage.getItem('bieznia_font_weight') || 'normal';
  applyFontWeight(initialWeight, false);

  const initialSize = localStorage.getItem('bieznia_font_size') || 'normal';
  applyFontSize(initialSize, false);

  const initialAccent = localStorage.getItem('bieznia_accent') || 'blue';
  applyAccent(initialAccent, false);

  // ==========================================================================
  // 9. MODUŁ BEZPIECZEŃSTWA: UWIERZYTELNIANIE, SESJE, RBAC I DZIENNIK AUDYTU
  // Zaimplementowany na przedmiot "Bezpieczeństwo i ochrona danych".
  // ==========================================================================

  /**
   * Zwraca nagłówki z opcjonalnym tokenem Bearer i zabezpieczeniem CSRF
   */
  function getAuthHeaders(extra = {}) {
    const headers = {
      'X-Requested-With': 'XMLHttpRequest',
      ...extra
    };
    const token = sessionStorage.getItem('bieznia_session_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Sprawdza aktualny stan sesji użytkownika w oparciu o ciasteczko sesyjne lub token
   */
  async function checkAuthStatus() {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        credentials: 'same-origin',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        currentUser = data;
      }
    } catch (e) {
      console.warn('Nie udało się sprawdzić stanu uwierzytelnienia:', e);
    }
    updateAuthUI();
  }

  /**
   * Aktualizuje interfejs użytkownika w zależności od stanu sesji i roli (RBAC)
   */
  function updateAuthUI() {
    const isAuth = currentUser && currentUser.authenticated && currentUser.user;
    const role = isAuth ? currentUser.user.role : null;
    const isAdmin = role === 'admin';
    const isJudge = role === 'sedzia' || isAdmin;

    // 1. Pasek nagłówka (Przycisk Zaloguj vs Badge użytkownika)
    if (btnOpenLogin && userBadge) {
      if (isAuth) {
        btnOpenLogin.style.display = 'none';
        userBadge.style.display = 'inline-flex';
        if (userNameDisplay) userNameDisplay.textContent = currentUser.user.username;
        if (userRoleDisplay) {
          const roleMap = {
            sedzia: 'Sędzia PZLA',
            admin: 'Administrator',
            uzytkownik: 'Kibic / Odczyt',
            zawodnik: 'Zawodnik'
          };
          userRoleDisplay.textContent = roleMap[role] || role;
        }
        if (userAvatarInitials) {
          userAvatarInitials.textContent = (currentUser.user.username[0] || 'U').toUpperCase();
        }
        if (btnOpenAudit) {
          btnOpenAudit.style.display = isAdmin ? 'inline-flex' : 'none';
        }
      } else {
        btnOpenLogin.style.display = 'inline-flex';
        userBadge.style.display = 'none';
        if (btnOpenAudit) btnOpenAudit.style.display = 'none';
      }
    }

    // 2. Kolumna akcji administratora w tabeli wyników
    if (colAdminHeader) {
      colAdminHeader.style.display = isAdmin ? 'table-cell' : 'none';
    }

    // 3. Kontrola dostępu do formularza dodawania wyników (RBAC)
    if (addResultAuthBarrier && addResultAuthSuccess && formLayoutGrid) {
      if (isJudge) {
        addResultAuthBarrier.style.display = 'none';
        addResultAuthSuccess.style.display = 'flex';
        formLayoutGrid.classList.remove('form-locked');
        if (judgeNameLabel) judgeNameLabel.textContent = currentUser.user.username;
        if (judgeRoleLabel) judgeRoleLabel.textContent = isAdmin ? 'Administrator' : 'Sędzia PZLA';
      } else {
        addResultAuthBarrier.style.display = 'flex';
        addResultAuthSuccess.style.display = 'none';
        formLayoutGrid.classList.add('form-locked');
      }
    }

    // Przerenderuj tabelę jeśli mamy już wyniki w pamięci podręcznej stanu
    if (state.results && state.results.length > 0) {
      renderTable(state.results);
    }
  }

  /**
   * Otwiera modal uwierzytelniania
   */
  function openAuthModal(tab = 'login', prefillRole = null) {
    if (!authModal) return;
    authModal.style.display = 'flex';
    authModal.setAttribute('aria-hidden', 'false');
    if (authModalAlert) {
      authModalAlert.style.display = 'none';
      authModalAlert.textContent = '';
    }

    switchAuthTab(tab);

    if (prefillRole && DEMO_CREDENTIALS[prefillRole]) {
      const demo = DEMO_CREDENTIALS[prefillRole];
      const loginInput = document.getElementById('login-identifier');
      const passInput = document.getElementById('login-password');
      if (loginInput) loginInput.value = demo.login;
      if (passInput) passInput.value = demo.password;
    }
  }

  /**
   * Zamyka modal uwierzytelniania
   */
  function closeAuthModal() {
    if (!authModal) return;
    authModal.style.display = 'none';
    authModal.setAttribute('aria-hidden', 'true');
    if (authModalAlert) authModalAlert.style.display = 'none';
  }

  /**
   * Przełącza zakładki Logowanie / Rejestracja
   */
  function switchAuthTab(tabName) {
    if (tabName === 'login') {
      if (tabBtnLogin) tabBtnLogin.classList.add('active');
      if (tabBtnRegister) tabBtnRegister.classList.remove('active');
      if (authPanelLogin) authPanelLogin.style.display = 'block';
      if (authPanelRegister) authPanelRegister.style.display = 'none';
    } else {
      if (tabBtnRegister) tabBtnRegister.classList.add('active');
      if (tabBtnLogin) tabBtnLogin.classList.remove('active');
      if (authPanelRegister) authPanelRegister.style.display = 'block';
      if (authPanelLogin) authPanelLogin.style.display = 'none';
    }
    if (authModalAlert) authModalAlert.style.display = 'none';
  }

  /**
   * Wyświetla alert statusu w modalu uwierzytelniania
   */
  function showAuthAlert(type, msg) {
    if (!authModalAlert) return;
    authModalAlert.className = `auth-alert alert-${type}`;
    authModalAlert.textContent = msg;
    authModalAlert.style.display = 'block';
  }

  /**
   * Dynamiczny wskaźnik siły hasła zgodnie z wytycznymi OWASP
   */
  function updatePasswordStrengthMeter(password) {
    const fillEl = document.getElementById('pw-strength-fill');
    const labelEl = document.getElementById('pw-strength-label');
    const ruleLen = document.getElementById('pw-rule-len');
    const ruleUpper = document.getElementById('pw-rule-upper');
    const ruleNum = document.getElementById('pw-rule-num');
    const ruleSpec = document.getElementById('pw-rule-spec');

    const hasLen = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasNum = /[0-9]/.test(password);
    const hasSpec = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password);

    if (ruleLen) ruleLen.classList.toggle('valid', hasLen);
    if (ruleUpper) ruleUpper.classList.toggle('valid', hasUpper);
    if (ruleNum) ruleNum.classList.toggle('valid', hasNum);
    if (ruleSpec) ruleSpec.classList.toggle('valid', hasSpec);

    const score = (hasLen ? 1 : 0) + (hasUpper ? 1 : 0) + (hasNum ? 1 : 0) + (hasSpec ? 1 : 0);

    if (!fillEl || !labelEl) return;
    fillEl.className = 'pw-strength-fill';

    if (password.length === 0) {
      fillEl.style.width = '0%';
      labelEl.textContent = 'Wpisz hasło';
      labelEl.style.color = 'var(--color-text-muted)';
    } else if (score === 1) {
      fillEl.classList.add('weak');
      labelEl.textContent = 'Bardzo słabe';
      labelEl.style.color = '#ef4444';
    } else if (score === 2) {
      fillEl.classList.add('fair');
      labelEl.textContent = 'Średnie';
      labelEl.style.color = '#f59e0b';
    } else if (score === 3) {
      fillEl.classList.add('good');
      labelEl.textContent = 'Dobre';
      labelEl.style.color = '#3b82f6';
    } else if (score === 4) {
      fillEl.classList.add('strong');
      labelEl.textContent = 'Silne (OWASP ✓)';
      labelEl.style.color = '#10b981';
    }
  }

  // Event Listenery Modala Uwierzytelniania
  if (btnOpenLogin) {
    btnOpenLogin.addEventListener('click', () => openAuthModal('login'));
  }
  if (btnBarrierLogin) {
    btnBarrierLogin.addEventListener('click', () => openAuthModal('login', 'sedzia'));
  }
  if (authModalClose) {
    authModalClose.addEventListener('click', closeAuthModal);
  }
  if (authModalBackdrop) {
    authModalBackdrop.addEventListener('click', closeAuthModal);
  }
  if (tabBtnLogin) {
    tabBtnLogin.addEventListener('click', () => switchAuthTab('login'));
  }
  if (tabBtnRegister) {
    tabBtnRegister.addEventListener('click', () => switchAuthTab('register'));
  }

  // Przyciski szybkiego logowania demo (ułatwienie oceny zadania)
  demoButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const demoRole = btn.getAttribute('data-demo');
      const demo = DEMO_CREDENTIALS[demoRole];
      if (!demo) return;

      switchAuthTab('login');
      const loginInput = document.getElementById('login-identifier');
      const passInput = document.getElementById('login-password');
      if (loginInput) loginInput.value = demo.login;
      if (passInput) passInput.value = demo.password;

      if (loginForm) {
        loginForm.requestSubmit();
      }
    });
  });

  // Przełączniki widoczności hasła (Pokaż / Ukryj)
  document.querySelectorAll('.btn-toggle-pw').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;
      const isPw = input.type === 'password';
      input.type = isPw ? 'text' : 'password';
      btn.style.color = isPw ? 'var(--color-primary)' : 'var(--color-text-muted)';
    });
  });

  // Analiza siły hasła przy wpisywaniu
  const regPasswordInput = document.getElementById('reg-password');
  if (regPasswordInput) {
    regPasswordInput.addEventListener('input', (e) => {
      updatePasswordStrengthMeter(e.target.value);
    });
  }

  // Obsługa wysłania formularza logowania
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const login = (document.getElementById('login-identifier')?.value || '').trim();
      const password = document.getElementById('login-password')?.value || '';

      if (!login || !password) {
        showAuthAlert('error', 'Wpisz login oraz hasło.');
        return;
      }

      const submitBtn = document.getElementById('btn-submit-login');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Weryfikacja tożsamości (PBKDF2)...</span>';
      }

      try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          credentials: 'same-origin',
          body: JSON.stringify({ login, password })
        });

        const data = await res.json();

        if (res.ok && data.success) {
          if (data.session_token) {
            sessionStorage.setItem('bieznia_session_token', data.session_token);
          }
          currentUser = {
            authenticated: true,
            user: data.user
          };
          updateAuthUI();
          closeAuthModal();
          showNotificationToast(`Zalogowano pomyślnie jako ${data.user.username} (${data.user.role})`);
        } else {
          let errText = data.error || 'Błąd logowania.';
          if (data.attempts_left !== undefined) {
            errText += ` Pozostało prób przed blokadą: ${data.attempts_left}.`;
          }
          showAuthAlert('error', errText);
        }
      } catch (err) {
        showAuthAlert('error', 'Błąd połączenia z serwerem uwierzytelniania.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Zaloguj się</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
        }
      }
    });
  }

  // Obsługa wysłania formularza rejestracji
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = (document.getElementById('reg-username')?.value || '').trim();
      const email = (document.getElementById('reg-email')?.value || '').trim();
      const role = document.getElementById('reg-role')?.value || 'uzytkownik';
      const password = document.getElementById('reg-password')?.value || '';

      const submitBtn = document.getElementById('btn-submit-register');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Generowanie soli i haszowanie...</span>';
      }

      try {
        const res = await fetch(`${API_BASE}/api/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          credentials: 'same-origin',
          body: JSON.stringify({ username, email, password, role })
        });

        const data = await res.json();

        if (res.ok && data.success) {
          if (data.session_token) {
            sessionStorage.setItem('bieznia_session_token', data.session_token);
          }
          currentUser = {
            authenticated: true,
            user: data.user
          };
          updateAuthUI();
          closeAuthModal();
          showNotificationToast(`Konto ${data.user.username} zostało pomyślnie utworzone!`);
        } else {
          showAuthAlert('error', data.error || 'Nie udało się utworzyć konta.');
        }
      } catch (err) {
        showAuthAlert('error', 'Błąd połączenia z serwerem.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Utwórz bezpieczne konto</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
        }
      }
    });
  }

  // Obsługa wylogowania
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: getAuthHeaders(),
          credentials: 'same-origin'
        });
      } catch (e) {}

      sessionStorage.removeItem('bieznia_session_token');
      currentUser = { authenticated: false, user: null };
      updateAuthUI();
      showNotificationToast('Wylogowano pomyślnie. Sesja została unieważniona.');
    });
  }

  // Dziennik Audytu Bezpieczeństwa (Tylko Administrator)
  if (btnOpenAudit) {
    btnOpenAudit.addEventListener('click', openAuditModal);
  }
  if (auditModalClose) {
    auditModalClose.addEventListener('click', closeAuditModal);
  }
  if (auditModalBackdrop) {
    auditModalBackdrop.addEventListener('click', closeAuditModal);
  }
  if (btnRefreshAudit) {
    btnRefreshAudit.addEventListener('click', loadAuditLogs);
  }

  function openAuditModal() {
    if (!auditModal) return;
    auditModal.style.display = 'flex';
    auditModal.setAttribute('aria-hidden', 'false');
    loadAuditLogs();
  }

  function closeAuditModal() {
    if (!auditModal) return;
    auditModal.style.display = 'none';
    auditModal.setAttribute('aria-hidden', 'true');
  }

  async function loadAuditLogs() {
    if (!auditTbody) return;
    auditTbody.innerHTML = '<tr><td colspan="6" class="audit-loading">Odpytywanie bazy SQLite (tabela audit_logs)...</td></tr>';

    try {
      const res = await fetch(`${API_BASE}/api/audit-logs`, {
        credentials: 'same-origin',
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        auditTbody.innerHTML = '<tr><td colspan="6" style="color: var(--color-error); text-align: center; padding: 1.5rem;">Brak uprawnień lub błąd odczytu dziennika audytu.</td></tr>';
        return;
      }

      const logs = await res.json();
      if (logs.length === 0) {
        auditTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 1.5rem; color: var(--color-text-muted);">Dziennik audytu jest pusty.</td></tr>';
        return;
      }

      const getBadgeClass = (eventType) => {
        if (eventType === 'LOGIN_SUCCESS' || eventType === 'REGISTER_SUCCESS' || eventType === 'RESULT_ADDED') return 'badge-audit-success';
        if (eventType === 'LOGIN_FAILED' || eventType === 'REGISTER_CONFLICT') return 'badge-audit-failed';
        if (eventType === 'ACCOUNT_LOCKED' || eventType === 'LOGIN_LOCKED_ATTEMPT') return 'badge-audit-locked';
        return 'badge-audit-denied';
      };

      auditTbody.innerHTML = logs.map(l => `
        <tr>
          <td>#${l.id}</td>
          <td style="white-space: nowrap;">${escapeHtml(l.created_at)}</td>
          <td><span class="audit-badge ${getBadgeClass(l.event_type)}">${escapeHtml(l.event_type)}</span></td>
          <td><strong>${escapeHtml(l.username || '—')}</strong></td>
          <td><code>${escapeHtml(l.ip_address || '—')}</code></td>
          <td style="color: var(--color-text-muted);">${escapeHtml(l.details || '—')}</td>
        </tr>
      `).join('');
    } catch (err) {
      auditTbody.innerHTML = '<tr><td colspan="6" style="color: var(--color-error); text-align: center; padding: 1.5rem;">Błąd komunikacji z serwerem.</td></tr>';
    }
  }

  // Usuwanie rekordu z tabeli przez Administratora (RBAC DELETE)
  if (resultsTbody) {
    resultsTbody.addEventListener('click', async (e) => {
      const deleteBtn = e.target.closest('.btn-delete-row');
      if (!deleteBtn) return;

      const recordId = deleteBtn.getAttribute('data-id');
      const athlete = deleteBtn.getAttribute('data-athlete') || 'zawodnika';

      if (!confirm(`[ADMINISTRATOR]: Czy na pewno chcesz trwale usunąć wynik zawodnika ${athlete} (ID: ${recordId}) z bazy danych?`)) {
        return;
      }

      deleteBtn.disabled = true;
      deleteBtn.textContent = 'Usuwanie...';

      try {
        const res = await fetch(`${API_BASE}/api/wyniki?id=${recordId}`, {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: getAuthHeaders()
        });

        const data = await res.json();

        if (res.ok && data.success) {
          showNotificationToast(`Rekord ID ${recordId} został usunięty.`);
          await fetchResults();
        } else {
          alert(data.error || 'Nie udało się usunąć rekordu.');
        }
      } catch (err) {
        alert('Błąd połączenia z serwerem podczas usuwania rekordu.');
      }
    });
  }

  // ==========================================================================
  // 10. INICJALIZACJA APLIKACJI
  // ==========================================================================
  checkAuthStatus();
  fetchResults();
  updateAnalysisSection(state.gender);
});
