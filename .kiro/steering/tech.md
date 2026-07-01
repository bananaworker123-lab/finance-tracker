# Technical Stack & Conventions

## Runtime & Build
- **Framework:** React 19 (functional components + hooks only, no class components)
- **Build tool:** Vite 8
- **Language:** JavaScript ES Modules (`.jsx` / `.js`) — no TypeScript
- **PWA:** `vite-plugin-pwa` with Workbox (offline-capable, installable)

## Styling
- **CSS:** Tailwind CSS v4 via `@tailwindcss/vite` plugin
- **Approach:** Inline `style` props for component-level dynamic styles, Tailwind utilities for layout/typography only
- **Fonts:** Plus Jakarta Sans (Latin) + Noto Sans Thai — loaded via Google Fonts in `index.html`
- **Design tokens:**
  | Token | Value | Usage |
  |---|---|---|
  | Shell background | `#15271f` | Phone frame |
  | App background | `#f4f3ef` | Content area |
  | Accent green | `#0caa78` | CTAs, paid status |
  | Overdue red | `#e0564f` | Overdue badges |
  | Pending amber | `#e8a13a` | Upcoming badges |

## Data Layer
- **Database:** Dexie.js v4 (IndexedDB wrapper) with `dexie-react-hooks` for reactive queries
- **Pattern:** `useLiveQuery(() => db.<store>.toArray(), [])` — components re-render automatically on DB write
- **Stores:**
  | Store | Index fields | Description |
  |---|---|---|
  | `transactions` | `type, category, date` | Immediate income/expense |
  | `bills` | `installment_id, status, due_date` | Standalone bills + installment periods |
  | `installments` | `category, start_month` | Parent record for installment plans |
  | `categories` | `name` | User-defined + default categories |

## State Management
- **No global state library** — props + local `useState` + `useLiveQuery` only
- **Navigation state:** `useState` in `App.jsx` (`screen`, `planId`)
- **Sheet state:** `addOpen` (boolean) + `addType` ('expense'|'income'|'bill'|'plan') in `App.jsx`

## Testing
- **Framework:** Vitest 4 with `fake-indexeddb/auto` for IndexedDB polyfill
- **Location:** `src/__tests__/`
- **Run:** `npm test` (single run) or `npm run test:watch` (watch mode)
- **Scope:** Business logic only (DB operations, calculations) — no React component rendering

## Concurrency Pattern (Critical)
Mark-as-paid functions use an **in-flight lock** to prevent double-fire on rapid taps:
```js
// Acquire lock BEFORE the first await — synchronously
if (payingIds.current.has(billId)) return;
payingIds.current.add(billId);          // ← must be here, NOT after any await
const bill = await db.bills.get(billId);
// ... update ...
payingIds.current.delete(billId);
```

## Source of Truth Rule (Critical)
- Paid bills are the **sole source of truth** for bill expenses
- `db.bills` record with `status: 'paid'` IS the expense record
- **NEVER write a `db.transactions` record when marking a bill paid** — History and Dashboard derive bill expenses directly from `db.bills` via `paidBillsAsTx` synthesis
- Violating this causes double-counting in History, Dashboard, and Summary

## File Conventions
- One component per file, named same as export
- Components in `src/components/`
- Shared utilities in `src/utils.js`
- DB definition + seed in `src/db.js`
- No barrel index files
