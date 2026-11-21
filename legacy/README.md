# Cinelog — Movie Tracker & Film Journal

A lightweight, elegant, privacy-first personal film journal and movie tracking web application. Built entirely with vanilla modern web technologies (HTML5, modular CSS3, and ES6+ JavaScript modules), Cinelog runs client-side with zero build steps, zero external server dependencies, and complete data persistence in the browser.

---

## Table of Contents

1. [Overview & Philosophy](#overview--philosophy)
2. [Tech Stack](#tech-stack)
3. [File Tree & Architecture](#file-tree--architecture)
4. [Data Models & Schema](#data-models--schema)
5. [Storage Architecture](#storage-architecture)
6. [Core Modules Breakdown](#core-modules-breakdown)
   - [state.js](#jsstatejs)
   - [storage.js](#jsstoragejs)
   - [ui.js](#jsuijs)
   - [main.js](#jsmainjs)
   - [CSS Architecture](#css-architecture)
7. [Feature Deep-Dive](#feature-deep-dive)
   - [Authentication & Multi-Account Isolation](#authentication--multi-account-isolation)
   - [Dashboard & Summary Metrics](#dashboard--summary-metrics)
   - [All Movies View (Search, Filters, Sort)](#all-movies-view-search-filters-sort)
   - [Add Movie Logging](#add-movie-logging)
   - [Import Engine (.txt, .csv, .json)](#import-engine-txt-csv-json)
   - [Statistics & Visual Analytics](#statistics--visual-analytics)
   - [Top Picks & Rating Filter](#top-picks--rating-filter)
   - [Mobile Responsiveness & Navigation](#mobile-responsiveness--navigation)
8. [Developer & AI Agent Guidelines](#developer--ai-agent-guidelines)
   - [Code Conventions](#code-conventions)
   - [Critical Pitfalls & Past Fixes](#critical-pitfalls--past-fixes)
   - [How to Test & Run](#how-to-test--run)

---

## Overview & Philosophy

Cinelog was created for film lovers who want a dedicated journal for logging, reviewing, and analyzing their movie-watching history without being locked into third-party platforms, trackers, or paywalls.

* **100% Client-Side:** Everything executes directly in the user's browser.
* **Zero Build Step:** Uses native ES modules (`type="module"`). Open `index.html` via any static file server or localhost and it works immediately.
* **Offline-Ready & Persistent:** Uses `localStorage` for permanent data and `sessionStorage` for active session state.
* **Multi-Format Import:** Imports film diaries in Russian `.txt` diary format, standard `.csv`, or structured `.json`, with batch multi-file support.
* **Visual Analytics:** Interactive charts powered by Chart.js visualize viewing pace, seasonal trends, day-of-week habits, and score distribution.

---

## Tech Stack

* **HTML5:** Semantic document structure, accessible ARIA attributes, responsive layout.
* **CSS3:** Custom properties (design tokens in `css/variables.css`), CSS Grid, Flexbox, custom form controls, and responsive media queries (`<=900px` tablet, `<=640px` mobile).
* **JavaScript (ES2022+):** Native ES Modules, Async/Await, Web Crypto API (`crypto.subtle`), dynamic DOM manipulation with event delegation.
* **Chart.js v4.4.0 (CDN):** Visual charts (Bar, Line/Cumulative, Ratings distribution, Weekday distribution).
* **Google Fonts (CDN):**
  * `Playfair Display`: Serif headings and display typography.
  * `Outfit`: Clean sans-serif UI text.
  * `DM Mono`: Tabular numbers, IDs, ratings, and code elements.

---

## File Tree & Architecture

```text
Cinelog/
├── index.html              # Main single-page application entry point
├── README.md               # Master technical documentation
├── .gitattributes          # Git configuration
├── css/
│   ├── variables.css       # Design tokens (colors, fonts, theme constants)
│   ├── main.css            # Base resets, global layout, sidebar, main canvas
│   └── components.css      # Component styles (buttons, cards, tables, charts, mobile drawer)
└── js/
    ├── state.js            # Central reactive state store
    ├── storage.js          # Persistence layer (localStorage, sessionStorage, SHA-256)
    ├── ui.js               # UI renderers, Chart.js instances, modal/preview helpers
    └── main.js             # Bootstrap, event delegation, import parsers, form handlers
```

---

## Data Models & Schema

### 1. `User` Object
```typescript
interface User {
  id: string;          // Generated unique ID (timestamp + random base-36 string)
  email: string;       // Normalized lowercase email (e.g. "user@example.com")
  ph: string;          // Hex-encoded SHA-256 hash of password
  createdAt: number;   // Epoch timestamp (Date.now())
}
```

### 2. `Movie` Object
```typescript
interface Movie {
  id: string;              // Unique identifier (generated via createId())
  title: string;           // Film title (e.g. "Inception")
  movieYear: number | null;// Release year (e.g. 2010)
  watchedAt: number | null;// Epoch millisecond timestamp of watched date (local midnight)
  rating: number | null;   // Score from 0 to 10 (decimal supported, e.g. 8.5)
  rewatched: boolean;      // Whether this viewing was a rewatch
  notes: string;           // Optional user thoughts, emoji, or comments
}
```

### 3. `AppState` Object
```typescript
interface AppState {
  currentUser: User | null;
  movies: Movie[];
  activeView: 'dashboard' | 'movies' | 'add' | 'import' | 'stats' | 'top';
  filters: {
    search: string;
    watchedYear: string;   // '' for all years, or specific year as string (e.g. "2024")
    sortBy: 'date-d' | 'date-a' | 'rate-d' | 'rate-a' | 'az';
    rewatchesOnly: boolean;
  };
  topPicks: {
    minimumRating: number; // Defaults to 8
    sortBy: 'rate' | 'date' | 'az';
  };
  pendingImport: Movie[] | null;
}
```

---

## Storage Architecture

All data is partitioned safely in web storage under structured keys:

| Key | Storage | Content |
|---|---|---|
| `cl_users` | `localStorage` | JSON array of all registered `User` objects |
| `cl_sess` | `sessionStorage` | JSON representation of the currently logged-in `User` |
| `cl_mv_<userId>` | `localStorage` | JSON array of `Movie` objects belonging exclusively to `<userId>` |

* Corrupted or missing storage values are protected by a safe `readJSON` helper that returns fallbacks instead of crashing.
* Logging into another user account automatically scopes all movie operations to `cl_mv_<userId>`.

---

## Core Modules Breakdown

### `js/state.js`
The application's single source of truth:
* `appState`: Central mutable state tree holding active user, movie collection, filter settings, top-pick threshold, and pending import batch.
* `setCurrentUser(user)`: Updates current user.
* `setMovies(movies)`: Replaces movies array.
* `resetSessionState()`: Wipes in-memory user and movie state on logout.

### `js/storage.js`
Encapsulates all browser persistence and cryptographic operations:
* `readJSON(storage, key, fallback)`: Safe JSON parser with `try/catch`.
* `getUsers()`, `saveUsers(users)`: Reads and writes the global user directory.
* `getMovies(userId)`, `saveMovies(userId, movies)`: Reads and writes user-isolated movie entries.
* `getSession()`, `saveSession(user)`, `clearSession()`: Manages current session tokens.
* `hashPassword(password)`: Hashes plaintext passwords using native browser `crypto.subtle.digest('SHA-256')`.
* `createId()`: Generates collision-resistant base-36 IDs using current timestamp and entropy.

### `js/ui.js`
Handles UI rendering, Chart.js lifecycle, and view toggling:
* `showView(viewName)`: Navigates between screens (`dashboard`, `movies`, `add`, `import`, `stats`, `top`), updating nav link states and re-rendering active content.
* `renderDashboard()`: Computes aggregate statistics (total films, this year count, average rating, rewatch count, 8+ favorites count) and builds recently watched cards.
* `renderTable()`: Filters, searches, sorts, and renders the "All Movies" table view with rating badges and delete triggers.
* `fillYearFilter()`: Populates the year dropdown in the "All Movies" toolbar dynamically from actual logged years.
* `renderStats()`: Generates and mounts 4 Chart.js charts:
  1. `c-monthly`: Stacked/grouped bar chart of films watched per month across all years.
  2. `c-cumul`: Cumulative pacing line chart across day-of-year (1–366) with explicit month axis labels.
  3. `c-week`: Day-of-the-week watch frequency bar chart with count-based opacity gradients.
  4. `c-rate`: Rating distribution histogram from 1 to 10.
* `renderTopPicks()`: Renders high-rated films matching the interactive rating slider.
* `destroyCharts()`: Cleans up existing Chart.js instances before re-rendering to prevent canvas reuse errors and memory leaks.
* `toggleSidebar(forceState)`: Toggles mobile navigation drawer and modal backdrop.
* `showImportPreview(movies, fileLabel)`: Displays a formatted preview list of parsed movies awaiting import confirmation.

### `js/main.js`
Bootstrap orchestrator and event controller:
* **Event Delegation:** Listens on `document` for click, input, and change events, dispatching to appropriate actions (`login`, `register`, `logout`, `add-movie`, `export-json`, `confirm-import`, `delete-movie`, `toggle-sidebar`, etc.).
* **Keyboard Shortcuts:** Submits login and register forms on `Enter` key.
* **Drag-and-Drop:** Listens to drag-and-drop on the import dropzone.
* **Import Parsers:**
  * `parseTxt(content)`: Parses Russian film journals with date, time, and rating syntax.
  * `parseCSV(content)`: RFC 4180-compliant CSV reader handling quoted commas.
  * `parseFile(file)` / `handleFiles(files)`: Multi-file batch coordinator.
  * `confirmImport()`: Deduplicates and commits imported movies to state and storage.
* **Local Date Normalizer:** `parseLocalDate(dateString)` parses `"YYYY-MM-DD"` into local midnight to prevent UTC-offset day shifts.

### CSS Architecture
* `variables.css`: Sets global CSS variables for dark theme (`--bg: #07070e`, `--surface: #0c0c18`, `--card: #111122`, `--gold: #c8a84a`, `--text: #e2ddd4`, etc.).
* `main.css`: Base resets, responsive layout, sidebar positioning, view fade animations (`@keyframes fadeUp`), custom scrollbars.
* `components.css`: Form inputs, buttons, status messages (`.msg-error`, `.msg-success`), badges (`badge-high`, `badge-mid`, `badge-low`, `badge-rw`), dropzone, preview table, rating slider, and responsive drawer styles.

---

## Feature Deep-Dive

### Authentication & Multi-Account Isolation
* Registration requires an email and password ($\ge$ 6 characters) with password confirmation.
* Passwords are hashed with SHA-256 before storing in `localStorage`.
* Each registered user receives an isolated movie store (`cl_mv_<id>`), ensuring multiple users on the same machine cannot see or alter each other's journals.
* Auto-login persists via `sessionStorage` until the user clicks "Sign Out".

### Dashboard & Summary Metrics
The dashboard displays 5 real-time computed metric cards:
1. **Total Films:** Total movie records logged.
2. **This Year:** Movies watched in the current calendar year.
3. **Avg. Rating:** Mean score across all rated films (formatted to 1 decimal place).
4. **Rewatches:** Count of movies flagged as rewatches.
5. **Favourites:** Count of movies rated $\ge$ 8.0.
Below metrics, the 8 most recently watched films are rendered with release year, watch date, rating badge, and rewatch pill.

### All Movies View (Search, Filters, Sort)
* **Search:** Case-insensitive substring search matching film titles in real time.
* **Year Filter:** Dynamically discovers all unique watch years and provides a dropdown filter.
* **Sorting Options:**
  * Date: Newest first
  * Date: Oldest first
  * Rating: Highest first
  * Rating: Lowest first
  * Title: A–Z
* **Rewatches Only:** Instant toggle checkbox to view only repeat viewings.
* **JSON Export:** One-click download button generating a clean JSON backup file formatted as `cinelog-<username>-YYYY-MM-DD.json`.
* **Inline Deletion:** Remove any film with confirmation dialog; updates table, stats, and year filters instantly.

### Add Movie Logging
* Required fields: Movie Title and Movie Year (validated 1888–2030).
* Optional fields:
  * Date Watched: Defaults to today; saved as local midnight timestamp.
  * Your Rating: Supports 0.0 to 10.0 with decimal step (e.g. 8.5). Rating `0` is fully supported.
  * Rewatch Checkbox: Marks the entry as a rewatch.
  * Notes: Thoughts, cinema location, companion, or review notes.

### Import Engine (.txt, .csv, .json)
The import engine accepts single or multiple files via file dialog or drag-and-drop:

#### 1. Russian `.txt` Diary Format
Supports Russian annual movie diary logs:
```text
Просмотренные фильмы 2024
1. Inception (2010) - 23:30 5 января (8.5/10)
2. The Matrix (1999) - 03:00 3 января (9/10) 🔁 Пересмотрел.
```
* Identifies year headers like `Просмотренные фильмы 2024`.
* Extracts film title and release year in parentheses `(YYYY)`.
* Resolves Russian month names (`января`, `февраля`, etc.) and formats local timestamp.
* Parses ratings in parentheses (`(8/10)`, `(7.5/10)`, `(~8/10)`, or score ranges `(7-8/10)` averaged to `7.5`).
* Detects rewatch indicators (`🔁`, `Пересмотрел`).
* Strips dates, times, and ratings from the trailing string and saves the rest as `notes`.

#### 2. CSV Format
Accepts `.csv` files with flexible headers:
* Recognized headers: `title` / `name` / `movie`, `year` / `movieyear`, `date` / `watched` / `watchedat`, `rating`, `rewatched`, `notes`.
* Properly handles quoted values containing commas (e.g. `"Everything, Everywhere All at Once"`).

#### 3. JSON Format
Accepts raw JSON arrays of movie objects or Cinelog export files (`{ movies: [...] }`).

#### Batch Upload & Smart Deduplication
* Dropping multiple files processes all files in a single batch, summarizing total movies found.
* Deduplication compares `title + release year + watched date`.
* **Preserves Rewatches:** If you watched "The Matrix (1999)" in 2020 and again in 2024, both entries are preserved because their watch dates differ.
* Duplicate entries within the import batch or already in the database are safely skipped and reported in the confirmation message.

### Statistics & Visual Analytics
* **Films Watched per Month by Year:** Grouped bar chart comparing watch velocity across calendar months for every year recorded in the journal.
* **Cumulative Films per Day of Year:** Linear scale tracking total films logged from Day 1 to Day 366. Includes month markers on the x-axis (`Jan`, `Feb`, `Mar`, etc.) and leap-year support.
* **Day of Week:** Bar chart showing viewing patterns (Sunday through Saturday) with gold gradient styling based on peak days.
* **Rating Distribution:** Histogram with colored buckets: green for high ($\ge 7$), gold for medium ($\ge 5$), red for low ($< 5$).

### Top Picks & Rating Filter
* Features an interactive rating slider ranging from 5.0 to 10.0 (step 0.5).
* Displays live count of films matching the minimum rating threshold.
* Sortable by Rating, Watch Date, or Title A–Z.

### Mobile Responsiveness & Navigation
* On screens $> 640px$, fixed left sidebar (`220px` desktop, `190px` tablet).
* On screens $\le 640px$:
  * Displays a sticky top header with the Cinelog logo and a hamburger menu toggle button.
  * Sidebar transitions off-screen (`left: -260px`) and slides in smoothly when triggered.
  * Semi-transparent backdrop dims the background; tapping the backdrop or any nav link automatically closes the drawer.

---

## Developer & AI Agent Guidelines

If you are an AI assistant or software engineer working on this codebase, adhere strictly to these architectural guidelines:

### Code Conventions
1. **No External Build Tools:** Do not introduce Webpack, Vite, Babel, npm dependencies, or TypeScript compile steps unless explicitly instructed. Keep files directly executable by a static server.
2. **ES Module Imports:** Always use `.js` extensions in import statements (e.g. `import { appState } from './state.js';`).
3. **Event Delegation:** Do not attach inline `onclick` attributes to dynamically generated HTML elements. Instead, use `data-action="..."` attributes and handle them in `handleClick` in `main.js`.
4. **HTML Sanitization:** Whenever inserting user-provided text or titles into `innerHTML`, always wrap values with `escapeHTML()` to prevent XSS.
5. **Chart.js Instance Destruction:** Before rendering new Chart.js charts on canvas elements, always invoke `destroyCharts()`. Re-instantiating Chart.js on an active canvas throws runtime exceptions.

### Critical Pitfalls & Past Fixes
* **Timezone Offset Bug:** Never parse date strings from `<input type="date">` using `new Date("YYYY-MM-DD")` directly, as this parses as UTC midnight and will display as the previous calendar day in negative UTC timezones. Always use `parseLocalDate()` in `main.js`.
* **Daylight Saving Time (DST) in Day-of-Year:** When calculating day of year for the cumulative chart, use `Math.round((date - start) / 864e5)` instead of `Math.floor()`. Using `Math.floor()` causes a 1-day drop after spring DST transitions.
* **Rating `0` Coercion:** Do not use `rawRating || null` when parsing ratings, because `0 || null` evaluates to `null`. Always check `!isNaN(parsed)`.
* **Multi-File Batching:** In `handleFiles`, iterate and aggregate all movies into a single array before calling `showImportPreview`. Do not overwrite state on every file loop.
* **Safe Storage Access:** Always read storage through `readJSON(storage, key, fallback)` in `storage.js` to protect against corrupted JSON data.

### How to Test & Run
1. Start any local static HTTP server from the project directory:
   * **Python:** `python -m http.server 8000`
   * **Node / npx:** `npx serve .`
   * **VS Code:** "Live Server" extension
2. Open `http://localhost:8000` in any modern web browser (Chrome, Edge, Firefox, Safari).
3. Register a test user (e.g. `test@example.com` / `password123`).
4. Test manual movie addition, editing filters, importing sample `.txt` or `.csv` files, and inspecting charts in the Statistics tab.
