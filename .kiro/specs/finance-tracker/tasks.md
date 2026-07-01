# Implementation Tasks — Finance Tracker PWA

## Status Legend
- `[ ]` Not started
- `[x]` Completed
- `[-]` In progress

---

## Phase 1 — Project Scaffold

- [x] **T-001** สร้างโปรเจกต์ Vite + React 19
- [x] **T-002** ติดตั้ง Tailwind CSS v4 via `@tailwindcss/vite`
- [x] **T-003** ติดตั้ง `vite-plugin-pwa` + เพิ่ม manifest (name, icons, theme_color)
- [x] **T-004** ติดตั้ง Dexie.js + `dexie-react-hooks`
- [x] **T-005** เพิ่ม Google Fonts (Plus Jakarta Sans + Noto Sans Thai) ใน `index.html`
- [x] **T-006** สร้าง `src/index.css` — import tailwindcss, body background, keyframe animations

---

## Phase 2 — Data Layer (`src/db.js`)

- [x] **T-010** กำหนด Dexie schema version 1 — stores: transactions, bills, installments, categories
- [x] **T-011** เขียน `db.on('populate')` hook สำหรับ seed categories (13 default)
- [x] **T-012** Seed demo transactions (income × 2, expense × 3)
- [x] **T-013** Seed demo standalone bills (overdue × 1, upcoming × 1, paid × 1)
- [x] **T-014** เขียน `genBills(db, inst, instId, paidCount)` function
- [x] **T-015** Seed installment plans ×2 ด้วย `genBills()`
- [x] **T-016** Export `updateOverdueBills()` function — promote past-due upcoming bills

---

## Phase 3 — Utilities (`src/utils.js`)

- [x] **T-020** `baht(n)` — format number เป็น "฿1,234"
- [x] **T-021** `fmt(isoStr)` — format date เป็น "12 Jun"
- [x] **T-022** `whenStr(isoStr)` — relative due label + color ("Overdue · 3 days", "Due in 5 days")
- [x] **T-023** `statusBadge(status)` — return `{ label, bg, color }` สำหรับ badge
- [x] **T-024** `monthRange(date)` — return `{ start, end }` ของเดือนนั้น
- [x] **T-025** `monthLabel(date)` — return "Jun 2025"
- [x] **T-026** `catMeta(categoryName)` — return emoji + tile color จาก categories store หรือ DEFAULT_CATEGORIES
- [x] **T-027** `DEFAULT_CATEGORIES` constant array

---

## Phase 4 — App Shell (`src/App.jsx`)

- [x] **T-030** สร้าง phone mockup frame (402×858px, rounded corners, dark shell)
- [x] **T-031** Implement screen router (`screen` state → render component)
- [x] **T-032** Pass `planId` state + `onOpenPlan` / `onClosePlan` callbacks
- [x] **T-033** Render `BottomNav` fixed at bottom of frame
- [x] **T-034** Render `AddSheet` overlay ด้านบน content
- [x] **T-035** Call `updateOverdueBills()` ใน `useEffect([], [])` on mount

---

## Phase 5 — Navigation (`src/components/BottomNav.jsx`)

- [x] **T-040** 5 nav buttons: Dashboard, History, FAB (+), Payments, Summary
- [x] **T-041** FAB (+) กลางเป็น green circle สูงกว่า nav bar
- [x] **T-042** Active state highlight ของปุ่ม nav
- [x] **T-043** FAB trigger `onAdd('expense')` → เปิด AddSheet tab Expense

---

## Phase 6 — Dashboard (`src/components/Dashboard.jsx`)

- [x] **T-050** Subscribe ด้วย `useLiveQuery` → transactions, bills
- [x] **T-051** คำนวณ balance, pendingTotal, safeToSpend ตาม formula ใน design.md
- [x] **T-052** แสดง Available Balance card (ตัวใหญ่, สีเขียว)
- [x] **T-053** แสดง Pending และ Safe to Spend แถวเดียวกัน
- [x] **T-054** แสดง Due Soon list (7 วันข้างหน้า, เรียงตาม due_date)
- [x] **T-055** SparkBars — 6-month income vs expense mini chart

---

## Phase 7 — History (`src/components/History.jsx`)

- [x] **T-060** Month picker component (< YYYY-MM >)
- [x] **T-061** Subscribe transactions + bills ด้วย `useLiveQuery`
- [x] **T-062** Synthesise `paidBillsAsTx` จาก paid bills ในเดือนที่เลือก
- [x] **T-063** Merge + sort newest-first
- [x] **T-064** Type filter chips (All / Income / Expense)
- [x] **T-065** Search input — filter by note + category (case-insensitive)
- [x] **T-066** Render แต่ละ row: emoji, ชื่อ, วันที่, amount (income สีเขียว, expense ลบ)
- [x] **T-067** Empty state เมื่อไม่มี record

---

## Phase 8 — Payments (`src/components/Payments.jsx`)

- [x] **T-070** Subscribe bills + installments ด้วย `useLiveQuery`
- [x] **T-071** Tab selector: All / Bills / Plans
- [x] **T-072** Status filter chips: All / Upcoming / Overdue / Paid
- [x] **T-073** Standalone bill cards — แสดง name, due_date, amount, status badge
- [x] **T-074** "Mark as paid" button สำหรับ unpaid bills
- [x] **T-075** `markPaid(billId)` with in-flight lock (lock acquire BEFORE first await)
- [x] **T-076** Installment plan cards — name, progress (N/M payments), paid amount, next due
- [x] **T-077** "Mark Payment N paid" button บน installment card
- [x] **T-078** Click installment card → `onOpenPlan(instId)`
- [x] **T-079** Sort: overdue first → upcoming → paid

---

## Phase 9 — Plan Detail (`src/components/PlanDetail.jsx`)

- [x] **T-080** Subscribe `db.installments.get(id)` + `db.bills.where({installment_id})` 
- [x] **T-081** แสดง header: name, emoji, total amount, progress
- [x] **T-082** แสดง segment tiers legend (tier 1: ฿X × N งวด)
- [x] **T-083** Payment schedule list — แสดงทุกงวด (paid/overdue/upcoming)
- [x] **T-084** "Mark next paid" button + lock pattern (useRef(false))
- [x] **T-085** "Close plan early" button + confirmation dialog
- [x] **T-086** Close early → bulk update unpaid bills → `status: 'cancelled'`
- [x] **T-087** Back button → `onClose()`

---

## Phase 10 — Summary (`src/components/Summary.jsx`)

- [x] **T-090** Period tabs: This Month / Last 3 Months / Last 6 Months
- [x] **T-091** Subscribe transactions + bills
- [x] **T-092** คำนวณ income/expense/savings ต่อ period
- [x] **T-093** Stats row: Total Income, Total Expense, Net Savings
- [x] **T-094** 6-month bar chart (SVG หรือ div-based) — income vs expense bars
- [x] **T-095** Category breakdown: emoji, name, amount, % bar, เรียงจากสูงสุด
- [x] **T-096** Export CSV button → download file

---

## Phase 11 — Add Sheet (`src/components/AddSheet.jsx`)

- [x] **T-100** Bottom sheet container + slide-up animation (`sheet-enter` keyframe)
- [x] **T-101** Overlay backdrop → close on tap
- [x] **T-102** Tab selector: Expense / Income / Bill / Plan
- [x] **T-103** Amount input (numeric, large font)
- [x] **T-104** Category grid — แสดงจาก `db.categories`
- [x] **T-105** Note input (optional)
- [x] **T-106** Save Expense/Income → `db.transactions.add()`
- [x] **T-107** Bill tab: name, due_date, category, amount → `db.bills.add()`
- [x] **T-108** Plan tab: name, start_month, due_day, category
- [x] **T-109** Plan segment builder: add/remove rows (amount + periods)
- [x] **T-110** Save Plan → `db.installments.add()` + `genBills()`
- [x] **T-111** Fix: `currentMonthStr()` ใช้ `getMonth() + 1` (ไม่ใช่ `getMonth()`)

---

## Phase 12 — Testing (`src/__tests__/finance.test.js`)

- [x] **T-120** ติดตั้ง `vitest` + `fake-indexeddb`
- [x] **T-121** เพิ่ม `"test": "vitest run"` ใน package.json scripts
- [x] **T-122** เพิ่ม `test: { environment: 'node' }` ใน vite.config.js
- [x] **T-123** Suite 1: Seed data integrity (5 tx, 2 income + 3 expense, 3 bills)
- [x] **T-124** Suite 2: Balance calculation (income 75k, expense 2,350, paid 149, balance 72,501)
- [x] **T-125** Suite 3: markPaid — status='paid', paid_date set, NO transaction added
- [x] **T-126** Suite 4: Idempotency — mark paid twice → still 2 paid, count unchanged
- [x] **T-127** Suite 5: Concurrent double-fire → only 1 update via lock pattern
- [x] **T-128** Suite 6: updateOverdueBills — past-due → overdue, future → unchanged, paid → unchanged
- [x] **T-129** Suite 7: genBills — single-segment count, multi-segment amounts, paid/overdue sequence
- [x] **T-130** Suite 8: Installment markPaid — status, count +1, no transaction
- [x] **T-131** Suite 9: History aggregation — paid bills NOT in transactions, totals correct

---

## Phase 13 — Bug Fixes (Completed)

- [x] **T-140** ติดตั้ง `dexie-react-hooks` (ขาดในตอนแรก)
- [x] **T-141** Fix `currentMonthStr()` off-by-one (`getMonth()` → `getMonth() + 1`)
- [x] **T-142** Fix seed: installment `start_month` ใช้ month index ถูกต้อง
- [x] **T-143** Fix double-fire: lock acquire BEFORE first `await` ใน Payments.jsx `markPaid()`
- [x] **T-144** Fix double-fire: lock acquire BEFORE first `await` ใน PlanDetail.jsx `markNextPaid()`
- [x] **T-145** Fix double transaction: ลบ `db.transactions.add()` ออกจาก `markPaid()` (Payments.jsx)
- [x] **T-146** Fix double transaction: ลบ `db.transactions.add()` ออกจาก `markNextPaid()` (PlanDetail.jsx)

---

## Phase 14 — Future Enhancements (Backlog)

- [ ] **T-200** Dark mode support
- [ ] **T-201** Edit / Delete transaction
- [ ] **T-202** Edit / Delete bill
- [ ] **T-203** Custom categories (add/edit/delete)
- [ ] **T-204** Recurring bill auto-renewal (สร้างบิลเดือนหน้าอัตโนมัติหลังจ่าย)
- [ ] **T-205** Budget limits per category + alert เมื่อใกล้เกิน
- [ ] **T-206** Push notification เมื่อบิลใกล้ถึงกำหนด (Web Push API)
- [ ] **T-207** iCloud / Google Drive manual backup (export/import JSON)
- [ ] **T-208** Multi-currency support
- [ ] **T-209** Installment close-early with actual paid amount (กรณีจ่ายน้อยกว่า)
- [ ] **T-210** Summary: export range selector ที่กำหนดเองได้ (date picker)
