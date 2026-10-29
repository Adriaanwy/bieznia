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

  // ==========================================================================
  // 1. POBIERANIE I RENDEROWANIE WYNIKÓW Z BAZY DANYCH
  // ==========================================================================

  // Jeśli strona została otwarta jako plik lokalny (file:///...),
  // automatycznie kierujemy zapytania do lokalnego serwera bazy danych pod port 8000
  const API_BASE = window.location.protocol.startsWith('http') 
    ? '' 
    : 'http://127.0.0.1:8000';

  /**
   * Pobiera wyniki z backendu SQLite (/api/wyniki) zgodnie z aktualnymi filtrami i sortowaniem
   */
  async function fetchResults() {
    try {
      const params = new URLSearchParams({
        szukaj: state.search,
        konkurencja: state.discipline,
        klub: state.club,
        sortuj: state.sort
      });

      const response = await fetch(`${API_BASE}/api/wyniki?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Błąd serwera: ${response.status}`);
      }

      const data = await response.json();
      state.results = data;
      renderTable(data);
      updateCounts(data.length);
    } catch (error) {
      console.error('Błąd pobierania wyników:', error);
      renderErrorState();
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

    resultsTbody.innerHTML = results.map(row => {
      const rzBadgeHtml = row.is_rz 
        ? '<span class="badge-rz">RŻ</span>' 
        : '';

      return `
        <tr>
          <td>
            <span class="athlete-name-text">${escapeHtml(row.athlete_name)}</span>
            ${rzBadgeHtml}
          </td>
          <td>${escapeHtml(row.discipline)}</td>
          <td class="cell-result">${escapeHtml(row.score_formatted)}</td>
          <td>${escapeHtml(row.athlete_club)}</td>
          <td class="cell-date">${escapeHtml(row.event_date_formatted || row.event_date)}</td>
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
              <code style="display: block; background: #f1f5f9; padding: 0.35rem 0.65rem; border-radius: 4px; margin: 0.5rem 0; font-family: monospace;">python server.py</code>
              a następnie otwórz aplikację pod adresem:
              <br>
              <a href="http://127.0.0.1:8000" style="color: #2563eb; font-weight: 600; text-decoration: underline; margin-top: 0.35rem; display: inline-block;">
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

  // Przycisk "Wyczyść filtry"
  if (btnClearFilters) {
    btnClearFilters.addEventListener('click', () => {
      state.search = '';
      state.discipline = 'all';
      state.club = 'all';
      state.sort = 'data_desc';

      if (searchInput) searchInput.value = '';
      if (filterDiscipline) filterDiscipline.value = 'all';
      if (filterClub) filterClub.value = 'all';

      // Reset przycisków sortowania do domyślnego "Data malejąco ↓"
      sortButtons.forEach(btn => {
        const isDefault = btn.dataset.sort === 'data_desc';
        btn.classList.toggle('active', isDefault);
        btn.setAttribute('aria-pressed', isDefault ? 'true' : 'false');
      });

      if (colHeaderDate) colHeaderDate.textContent = 'DATA ↓';

      fetchResults();
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
          headers: {
            'Content-Type': 'application/json'
          },
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
    const str = String(text);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================================================
  // 6. INICJALNE POBRANIE DANYCH Z BAZY
  // ==========================================================================
  fetchResults();
});
