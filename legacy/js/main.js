import { appState, resetSessionState, setCurrentUser, setMovies } from './state.js';
import {
  clearSession,
  createId,
  getMovies,
  getSession,
  getUsers,
  hashPassword,
  saveMovies,
  saveSession,
  saveUsers,
  verifyPassword,
  verifySessionUser
} from './storage.js';
import {
  destroyCharts,
  fillYearFilter,
  getElement,
  getValue,
  renderTable,
  renderTopPicks,
  showAuthMessage,
  showImportMessage,
  showImportPreview,
  showView,
  toggleSidebar
} from './ui.js';

function today() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateString) {
  if (!dateString) return null;
  const match = String(dateString).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10) - 1;
    const day = Number.parseInt(match[3], 10);
    return new Date(year, month, day).getTime();
  }
  const parsed = new Date(dateString).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function switchTab(tab, presetEmail = '') {
  document.querySelectorAll('.auth-tab').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });
  getElement('login-form').classList.toggle('hidden', tab !== 'login');
  getElement('register-form').classList.toggle('hidden', tab !== 'register');
  getElement('auth-msg').innerHTML = '';
  if (tab === 'register' && presetEmail) {
    const regEmailInput = getElement('rg-email');
    regEmailInput.value = presetEmail;
    getElement('rg-pass').focus();
  }
}

async function doLogin() {
  const email = getValue('li-email').trim().toLowerCase();
  const password = getValue('li-pass');
  if (!email || !password) {
    showAuthMessage('Please fill in all fields.', 'error');
    return;
  }

  const users = getUsers();
  const user = users.find(candidate => candidate.email === email);
  if (!user || !(await verifyPassword(password, user.ph))) {
    showAuthMessage('Invalid email or password.', 'error');
    return;
  }

  if (!String(user.ph).startsWith('pbkdf2$')) {
    user.ph = await hashPassword(password);
  }
  user.sessionToken = createId();
  saveUsers(users);

  saveSession(user);
  bootApp(user);
}

async function doRegister() {
  const email = getValue('rg-email').trim().toLowerCase();
  const password = getValue('rg-pass');
  const confirmPassword = getValue('rg-pass2');
  if (!email || !password) {
    showAuthMessage('Please fill in all fields.', 'error');
    return;
  }
  if (password.length < 6) {
    showAuthMessage('Password must be at least 6 characters.', 'error');
    return;
  }
  if (password !== confirmPassword) {
    showAuthMessage('Passwords do not match.', 'error');
    return;
  }

  const users = getUsers();
  if (users.some(user => user.email === email)) {
    showAuthMessage('Email already registered.', 'error');
    return;
  }

  const user = {
    id: createId(),
    email,
    ph: await hashPassword(password),
    sessionToken: createId(),
    createdAt: Date.now()
  };
  saveUsers([...users, user]);
  saveSession(user);
  bootApp(user);
}

function doLogout() {
  clearSession();
  resetSessionState();
  destroyCharts();
  getElement('auth-screen').style.display = 'flex';
  getElement('app-screen').style.display = 'none';
  getElement('li-email').value = '';
  getElement('li-pass').value = '';
}

function bootApp(user) {
  setCurrentUser(user);
  setMovies(getMovies(user.id));
  getElement('auth-screen').style.display = 'none';
  getElement('app-screen').style.display = 'block';
  getElement('sb-email').textContent = user.email;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  getElement('dash-sub').textContent = `${greeting} — your film journal`;
  getElement('a-date').value = today();
  showView('dashboard');
}

function doAddMovie() {
  const title = getValue('a-title').trim();
  const movieYear = Number.parseInt(getValue('a-myear'), 10);
  const date = getValue('a-date');
  const ratingText = getValue('a-rating').trim();
  const notes = getValue('a-notes').trim();
  const messageElement = getElement('add-msg');

  if (!title || !movieYear) {
    messageElement.innerHTML = '<div class="msg msg-error">Title and year are required.</div>';
    return;
  }

  let rating = null;
  if (ratingText !== '') {
    const parsedRating = Number.parseFloat(ratingText);
    if (!Number.isNaN(parsedRating)) rating = parsedRating;
  }

  const movie = {
    id: createId(),
    title,
    movieYear,
    watchedAt: parseLocalDate(date),
    rating,
    rewatched: getElement('a-rw').checked,
    notes
  };
  appState.movies.push(movie);
  saveMovies(appState.currentUser.id, appState.movies);
  fillYearFilter();

  ['a-title', 'a-myear', 'a-rating', 'a-notes'].forEach(id => {
    getElement(id).value = '';
  });
  getElement('a-rw').checked = false;
  getElement('a-date').value = today();
  messageElement.innerHTML = '<div class="msg msg-success">✓ Added to your journal!</div>';
  setTimeout(() => {
    messageElement.innerHTML = '';
  }, 3000);
}

function deleteMovie(id) {
  if (!window.confirm('Remove this film from your journal?')) return;
  setMovies(appState.movies.filter(movie => movie.id !== id));
  saveMovies(appState.currentUser.id, appState.movies);
  fillYearFilter();
  renderTable();
}

const months = {
  'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3, 'мая': 4, 'июня': 5,
  'июля': 6, 'августа': 7, 'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11
};

function parseTxt(content) {
  const lines = content.split(/\r?\n/);
  let year = new Date().getFullYear();
  const movies = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const yearHeader = line.match(/просмотренные фильмы\s+(\d{4})/i);
    if (yearHeader) {
      year = Number.parseInt(yearHeader[1], 10);
      continue;
    }

    if (!/^\d/.test(line)) continue;
    const stripped = line.replace(/^\d+[\.\s\t]+/, '').trim();
    if (!stripped) continue;

    const separatorIndex = findSeparator(stripped);
    if (separatorIndex < 0) continue;
    const titlePart = stripped.substring(0, separatorIndex).trim();
    const infoPart = stripped.substring(separatorIndex).replace(/^\s*[-–]\s*/, '').trim();
    const titleMatch = titlePart.match(/^(.+?)\s*\((\d{4})\)\s*$/);
    if (!titleMatch) continue;

    movies.push({
      id: createId(),
      title: titleMatch[1].trim(),
      movieYear: Number.parseInt(titleMatch[2], 10),
      watchedAt: parseDate(infoPart, year),
      rating: parseRating(infoPart),
      rewatched: /🔁|Пересмотрел/i.test(rawLine),
      notes: cleanNotes(infoPart).substring(0, 120)
    });
  }
  return movies;
}

function findSeparator(text) {
  const pattern = /\(\d{4}\)\s*[-–]/g;
  let match;
  let lastMatch = null;
  while ((match = pattern.exec(text)) !== null) lastMatch = match;
  if (lastMatch) return lastMatch.index + lastMatch[0].indexOf(')') + 1;
  return text.indexOf(' - ');
}

function parseRating(text) {
  const match = text.match(/\(([~\d\.]+(?:[-–][\d\.]+)?)\s*\/\s*10\)/);
  if (!match) return null;
  const raw = match[1].replace('~', '');
  if (raw === '-' || !raw) return null;
  if (raw.search(/[-–]/) > 0) {
    const parts = raw.split(/[-–]/).map(Number.parseFloat);
    return Math.round((parts[0] + parts[1]) / 2 * 10) / 10;
  }
  const parsed = Number.parseFloat(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseDate(text, year) {
  for (const [monthName, monthIndex] of Object.entries(months)) {
    const match = text.match(new RegExp(`(\\d{1,2})(?:[-–]\\d{1,2})?\\s+${monthName}`, 'i'));
    if (match) {
      const day = Number.parseInt(match[1], 10);
      if (day >= 1 && day <= 31) return new Date(year, monthIndex, day).getTime();
    }
  }
  return null;
}

function cleanNotes(text) {
  return text
    .replace(/\([~\-\d\.]+(?:[-–][\d\.]+)?\s*\/\s*10\)/g, '')
    .replace(/\d{1,2}(?:[-–]\d{1,2})?\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/gi, '')
    .replace(/\d{1,2}[:\s]\d{2}/g, '')
    .replace(/🔁\s*Пересмотрел\.?/gi, '')
    .replace(/🔃\s*нужно пересмотреть/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseCSVLine(line) {
  const columns = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      columns.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  columns.push(current.trim());
  return columns;
}

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) return [];
  const headers = parseCSVLine(lines[0]).map(header =>
    header.trim().toLowerCase().replace(/['"]/g, '')
  );

  return lines.slice(1).map(line => {
    const columns = parseCSVLine(line);
    const row = Object.create(null);
    headers.forEach((header, index) => {
      row[header] = columns[index] !== undefined ? columns[index] : '';
    });

    const title = row.title || row.name || row.movie || '';
    if (!title) return null;

    let rating = null;
    const rawRating = row.rating;
    if (rawRating !== undefined && rawRating !== '') {
      const parsedRating = Number.parseFloat(rawRating);
      if (!Number.isNaN(parsedRating)) rating = parsedRating;
    }

    const rawWatched = row.date || row.watched || row.watchedat || '';

    return {
      id: createId(),
      title,
      movieYear: Number.parseInt(row.year || row.movieyear, 10) || null,
      watchedAt: rawWatched ? parseLocalDate(rawWatched) : null,
      rating,
      rewatched: row.rewatched === 'true' || row.rewatched === '1' || row.rewatched === 'yes',
      notes: row.notes || ''
    };
  }).filter(Boolean);
}

function normalizeImported(movie) {
  let rating = null;
  if (movie.rating !== undefined && movie.rating !== null && movie.rating !== '') {
    const parsedRating = Number.parseFloat(movie.rating);
    if (!Number.isNaN(parsedRating)) rating = parsedRating;
  }

  let watchedAt = null;
  if (movie.watchedAt != null) {
    const parsedWatched = Number(movie.watchedAt);
    if (!Number.isNaN(parsedWatched)) {
      watchedAt = parsedWatched;
    } else if (typeof movie.watchedAt === 'string') {
      watchedAt = parseLocalDate(movie.watchedAt);
    }
  }

  return {
    id: movie.id || createId(),
    title: movie.title || movie.name || '',
    movieYear: Number.parseInt(movie.movieYear || movie.year, 10) || null,
    watchedAt,
    rating,
    rewatched: Boolean(movie.rewatched),
    notes: movie.notes || ''
  };
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 20;
const MAX_IMPORT_ROWS = 10000;

async function parseFile(file) {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`File "${file.name}" exceeds 10 MB limit.`);
  }
  const content = await file.text();
  const extension = file.name.split('.').pop().toLowerCase();
  if (extension === 'txt') {
    const rows = parseTxt(content);
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new Error(`File "${file.name}" exceeds ${MAX_IMPORT_ROWS} row limit.`);
    }
    return rows;
  }
  if (extension === 'json') {
    const data = JSON.parse(content);
    const items = Array.isArray(data) ? data : data.movies || [];
    if (items.length > MAX_IMPORT_ROWS) {
      throw new Error(`File "${file.name}" exceeds ${MAX_IMPORT_ROWS} row limit.`);
    }
    return items.map(normalizeImported);
  }
  if (extension === 'csv') {
    const rows = parseCSV(content);
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new Error(`File "${file.name}" exceeds ${MAX_IMPORT_ROWS} row limit.`);
    }
    return rows;
  }
  return [];
}

async function handleFiles(files) {
  if (!files || !files.length) return;
  if (files.length > MAX_FILES) {
    showImportMessage(`Too many files selected (maximum ${MAX_FILES}).`, 'error');
    return;
  }
  const allMovies = [];
  const successfulFiles = [];
  const errors = [];

  for (const file of files) {
    try {
      const movies = await parseFile(file);
      if (allMovies.length + movies.length > MAX_IMPORT_ROWS) {
        errors.push(`Total imported rows cannot exceed ${MAX_IMPORT_ROWS}.`);
        break;
      }
      if (movies.length) {
        allMovies.push(...movies);
        successfulFiles.push(file.name);
      } else {
        errors.push(`"${file.name}" had no recognizable movies.`);
      }
    } catch (err) {
      console.error(`Error processing file "${file.name}":`, err);
      errors.push(`Failed to parse "${file.name}".`);
    }
  }

  if (!allMovies.length) {
    showImportMessage(errors.join(' ') || 'No movies found in uploaded file(s).', 'error');
    return;
  }

  appState.pendingImport = allMovies;
  const fileLabel = successfulFiles.length === 1
    ? successfulFiles[0]
    : `${successfulFiles.length} files (${successfulFiles.join(', ')})`;
  showImportPreview(allMovies, fileLabel);

  if (errors.length) {
    showImportMessage(errors.join(' '), 'error');
  }
}

function confirmImport() {
  if (!appState.pendingImport) return;

  const makeKey = movie =>
    `${(movie.title || '').trim().toLowerCase()}||${movie.movieYear || ''}||${movie.watchedAt || ''}`;
  const existing = new Set(appState.movies.map(makeKey));
  const moviesToAdd = [];
  let duplicates = 0;

  for (const movie of appState.pendingImport) {
    const key = makeKey(movie);
    if (!existing.has(key)) {
      existing.add(key);
      moviesToAdd.push(movie);
    } else {
      duplicates++;
    }
  }

  setMovies([...appState.movies, ...moviesToAdd]);
  saveMovies(appState.currentUser.id, appState.movies);
  fillYearFilter();
  getElement('import-preview').innerHTML = '';
  appState.pendingImport = null;

  let message = `✓ Imported ${moviesToAdd.length} movies.`;
  if (duplicates) message += ` (${duplicates} duplicates skipped)`;
  showImportMessage(message, 'success');
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(appState.movies, null, 2)], {
    type: 'application/json'
  });
  const link = document.createElement('a');
  const objectURL = URL.createObjectURL(blob);
  link.href = objectURL;
  link.download = `cinelog-${appState.currentUser.email.split('@')[0]}-${today()}.json`;
  link.click();
  URL.revokeObjectURL(objectURL);
}

function handleClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const tabButton = target.closest('.auth-tab');
  if (tabButton) {
    switchTab(tabButton.dataset.tab);
    return;
  }

  const switchTabLink = target.closest('[data-switch-tab]');
  if (switchTabLink) {
    const targetTab = switchTabLink.dataset.switchTab;
    const emailCandidate = targetTab === 'register' ? getValue('li-email').trim() : '';
    switchTab(targetTab, emailCandidate);
    return;
  }

  const viewLink = target.closest('[data-view]');
  if (viewLink) {
    showView(viewLink.dataset.view);
    return;
  }

  const actionElement = target.closest('[data-action]');
  if (actionElement) {
    const { action } = actionElement.dataset;
    if (action === 'login') void doLogin();
    if (action === 'register') void doRegister();
    if (action === 'logout') doLogout();
    if (action === 'add-movie') doAddMovie();
    if (action === 'export-json') exportJSON();
    if (action === 'confirm-import') confirmImport();
    if (action === 'delete-movie') deleteMovie(actionElement.dataset.movieId);
    if (action === 'toggle-sidebar') toggleSidebar();
    if (action === 'close-sidebar') toggleSidebar(false);
    return;
  }

  const backdrop = target.closest('#sidebar-backdrop');
  if (backdrop) {
    toggleSidebar(false);
    return;
  }

  const dropZone = target.closest('#drop-zone');
  if (dropZone && target.id !== 'file-inp') getElement('file-inp').click();
}

function handleInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;

  if (target.id === 'mv-search') {
    appState.filters.search = target.value;
    renderTable();
  } else if (target.id === 'top-thresh') {
    appState.topPicks.minimumRating = Number.parseFloat(target.value);
    renderTopPicks();
  }
}

function handleChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;

  if (target.id === 'mv-year') {
    appState.filters.watchedYear = target.value;
    renderTable();
  } else if (target.id === 'mv-sort') {
    appState.filters.sortBy = target.value;
    renderTable();
  } else if (target.id === 'mv-rw') {
    appState.filters.rewatchesOnly = target.checked;
    renderTable();
  } else if (target.id === 'top-sort') {
    appState.topPicks.sortBy = target.value;
    renderTopPicks();
  } else if (target.id === 'file-inp') {
    void handleFiles(Array.from(target.files));
    target.value = '';
  }
}

function setupDragAndDrop() {
  const dropZone = getElement('drop-zone');
  dropZone.addEventListener('dragover', event => {
    event.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });
  dropZone.addEventListener('drop', event => {
    event.preventDefault();
    dropZone.classList.remove('drag-over');
    void handleFiles(Array.from(event.dataTransfer.files));
  });
}

function setupKeyboardShortcuts() {
  ['li-email', 'li-pass'].forEach(id => {
    getElement(id).addEventListener('keydown', event => {
      if (event.key === 'Enter') void doLogin();
    });
  });
  ['rg-email', 'rg-pass', 'rg-pass2'].forEach(id => {
    getElement(id).addEventListener('keydown', event => {
      if (event.key === 'Enter') void doRegister();
    });
  });
}

function initializeApp() {
  document.addEventListener('click', handleClick);
  document.addEventListener('input', handleInput);
  document.addEventListener('change', handleChange);
  setupDragAndDrop();
  setupKeyboardShortcuts();

  const session = getSession();
  if (session) {
    const user = verifySessionUser(session, getUsers());
    if (user) {
      bootApp(user);
      return;
    }
  }
  getElement('auth-screen').style.display = 'flex';
}

initializeApp();
