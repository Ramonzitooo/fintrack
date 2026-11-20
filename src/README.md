# FinTrack React Application (`src`)

## Overview
Primary React 19 + TypeScript application layer orchestrating global financial state (`AppState`), WAI-ARIA tab navigation, Apple Fluid Design transitions, privacy mode optical masking, theme management, and modal workflows.

## Interface
- `[src/App.tsx:App]`: Default export — root React application component managing `AppState`, navigation across 6 primary tabs (`'visao-geral'`, `'bancos'`, `'caixinhas'`, `'contracheque'`, `'cartoes'`, `'despesas'`) plus lazy-loaded `'diagnostico'` (`AuditDiagnosticView`), modal orchestration (`AppModals`), privacy/theme toggles, and undoable toast notifications.
- `[src/main.tsx:createRoot]`: Application entry point mounting `<App />` into DOM `#root` with `./index.css`.
- **Child Package Contracts**:
  - [UI Components (`./components/README.md`)](./components/README.md): Modular tab views (`OverviewTab`, `BanksTab`, `GoalsTab`, `PayrollTab`, `CardsTab`, `ExpensesTab`), `AuditDiagnosticView`, and `AppModals`.
  - [Core Utilities (`./utils/README.md`)](./utils/README.md): Deterministic financial math engine (`financeMath.ts`) and sanitized `localStorage` persistence (`storage.ts`).

## Invariants
- `[src/App.tsx:useEffect]`: Active competence month (`state.competenciaAtual`) is always initialized in `state.despesasPorMes` via `syncTemplatesToMonth` before `saveAppState(state)` persists state.
- `[src/App.tsx:handleExecutePix]`: Rejects transfers when `origId === destId` or `valor <= 0` and rounds resulting bank balances to 2 decimal places.
- `[src/App.tsx:recalcPayroll]`: Rounds `bruto` and `descontosTotal` to 2 decimal places and clamps `liquido` to `Math.max(0, Math.round((bruto - descontosTotal) * 100) / 100)`.
- `[src/App.tsx:handleSaveFireGoal]`: Maintains at most one `'aposentadoria'` caixinha in `state.caixinhas` (updating existing or inserting with `meta: 0`, `pctCDI: 105`).
- `[src/App.tsx:handleConfirmReceiveSalary]`: Requires `state.salario.liquido > 0` before invoking `receiveSalary`.
- `[src/App.tsx:handleSaveNewExpense]`, `[src/App.tsx:handleConfirmPayExpense]`, `[src/App.tsx:handleRefundExpense]`, `[src/App.tsx:handleEditExpenseAmount]`, `[src/App.tsx:handleDeleteExpense]`: Preserve symmetric bank balance and expense list reconciliation, with `structuredClone` snapshots for undo.
- `[src/App.tsx:handleExportCSV]`: Prefixes CSV output with UTF-8 BOM (`\uFEFF`), uses `;` delimiter, and sanitizes all cells via `sanitizeCsvCell`.
- `[src/App.tsx:AppModals.onImportJSON]`: Parses imported JSON with `safeJsonParse` and normalizes state with `normalizeState` before updating state.
- `[src/App.tsx:ExpensesTab.onRequestEditEnvelope]`: Clamps envelope monthly total to `Math.max(10, newTotal)`.
- `[src/App.tsx:handleTabKeyDown]`: Enforces cyclic WAI-ARIA `tablist` keyboard navigation (`ArrowRight`, `ArrowLeft`, `Home`, `End`) across `desktopTabRefs` and `mobileTabRefs`.

## Side Effects
- `[src/main.tsx:createRoot]`: Mounts React tree into `document.getElementById('root')!`.
- `[src/App.tsx:useState]`, `[src/App.tsx:useEffect]`: Reads and writes `localStorage` via `loadAppState`/`saveAppState`, `'FINTRACK_PRIVACIDADE'` (`'1'|'0'`), and `'FINTRACK_M3_THEME'` (`'dark'|'light'`), and reads `window.matchMedia('(prefers-color-scheme: dark)')`.
- `[src/App.tsx:useEffect]`: Toggles `'privacy-mode'` class on `document.body` and `'dark'` class plus `'data-theme'` attribute on `document.documentElement`.
- `[src/App.tsx:useEffect]`: Registers global `window` `'keydown'` listener for `Ctrl/Meta+K` (toggle `'cmdk'` modal), `Escape` (close modal), `'p'` (toggle `privacyMode`), and `'n'` (open `'newExpense'` modal) when focus is outside `INPUT`/`TEXTAREA`/`SELECT`.
- `[src/App.tsx:useEffect]`: Schedules a `5500ms` `setTimeout` to clear active toast notifications.
- `[src/App.tsx:handleExportJSON]`, `[src/App.tsx:handleExportCSV]`: Creates Blob URLs via `URL.createObjectURL`, triggers browser file downloads via synthetic `<a>.click()`, and revokes URLs via `URL.revokeObjectURL`.
- `[src/App.tsx:AppModals.onImportJSON]`: Reads local user files asynchronously via `FileReader.readAsText`.

## Verification
- Run: `npm test`
