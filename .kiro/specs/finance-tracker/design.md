# Technical Design — Finance Tracker PWA

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│                 App.jsx                     │
│  phone frame shell + screen router          │
│  state: screen, planId, addOpen, addType    │
└──────────┬──────────────────────┬───────────┘
           │ props                │ overlay
    ┌──────▼──────┐         ┌────▼──────┐
    │  BottomNav  │         │  AddSheet │
    └─────────────┘         └───────────┘
           │ screen prop
    ┌──────▼────────────────────────────┐
    │   Screen Components               │
    │  Dashboard / History / Payments   │
    │  PlanDetail / Summary             │
    └──────────────┬────────────────────┘
                   │ useLiveQuery
    ┌──────────────▼────────────────────┐
    │   Dexie.js (IndexedDB)            │
    │  transactions / bills /           │
    │  installments / categories        │
    └───────────────────────────────────┘
```

## Data Model

### `transactions` store
```js
{
  id:        number,      // auto-increment PK
  type:      'income' | 'expense',
  amount:    number,      // บาท, positive
  category:  string,      // category name
  emoji:     string,
  tile:      string,      // background color hex
  date:      string,      // ISO 8601
  note:      string,
}
```

### `bills` store
```js
{
  id:              number,
  installment_id:  number | null,    // null = standalone bill
  name:            string,
  emoji:           string,
  tile:            string,
  amount:          number,
  due_date:        string,           // ISO 8601
  category:        string,
  status:          'upcoming' | 'overdue' | 'paid' | 'cancelled',
  paid_date:       string | null,    // set when status = 'paid'
  paid_amount:     number | null,    // set when status = 'paid'
  note:            string,
  // installment-only fields:
  installment_index: number | undefined,  // 1-based period number
}
```

### `installments` store
```js
{
  id:                 number,
  name:               string,
  emoji:              string,
  tile:               string,
  start_month:        string,   // "YYYY-MM" (month index 0-based internally)
  due_day:            number,   // day of month for each bill
  category:           string,
  note:               string,
  segments:           Array<{ amount_per_period: number, periods: number }>,
  total_installments: number,   // sum of all segment periods
}
```

### `categories` store
```js
{
  id:    number,
  name:  string,
  emoji: string,
  color: string,  // hex background for tile
}
```

## Component Responsibilities

### App.jsx
- Renders phone mockup frame (402×858px, `overflow: hidden`)
- Maintains navigation state (`screen`: 'dashboard'|'history'|'payments'|'plan'|'summary')
- Maintains plan navigation (`planId`: number | null)
- Maintains AddSheet state (`addOpen`: bool, `addType`: string)
- Calls `updateOverdueBills()` once on mount
- Passes `onOpenPlan(id)` callback to Payments, `onClosePlan()` to PlanDetail

### Dashboard.jsx
```
useLiveQuery: db.transactions, db.bills
computed:
  totalIncome    = sum(transactions where type='income')
  totalExpense   = sum(transactions where type='expense')
  paidBillsTotal = sum(bills where status='paid', paid_amount)
  balance        = totalIncome - totalExpense - paidBillsTotal
  pendingTotal   = sum(bills where status ∈ {upcoming, overdue}, amount)
  safeToSpend    = balance - pendingTotal
  dueSoon        = bills where status≠'paid' AND due_date ≤ today+7days
```

### History.jsx
```
useLiveQuery: db.transactions (filtered by month), db.bills (filtered by month)
computed:
  paidBillsAsTx = bills
    .filter(b => b.paid_date && monthRange(paid_date) === selectedMonth)
    .map(b => ({ id: 'bill_'+b.id, type: 'expense', amount: b.paid_amount, ... }))
  allTx = [...transactions, ...paidBillsAsTx]
    .filter(typeFilter)
    .filter(searchFilter)
    .sort(newest-first)
```

### Payments.jsx
```
useLiveQuery: db.bills, db.installments
computed:
  standaloneBills = bills.filter(b => !b.installment_id)
  instBills       = bills.filter(b => b.installment_id)
  
markPaid(billId):  [in-flight lock: useRef(new Set())]
  1. if lock.has(id) → return
  2. lock.add(id)          ← BEFORE first await
  3. bill = await db.bills.get(id)
  4. if !bill || paid || cancelled → lock.delete, return
  5. await db.bills.update(id, { status:'paid', paid_date, paid_amount })
  6. lock.delete(id)
  // NO db.transactions.add()
```

### PlanDetail.jsx
```
props: installment_id, onClose
useLiveQuery: db.installments.get(id), db.bills (filtered by installment_id)
computed:
  totalPer    = bills.length
  paid        = bills.filter(status='paid').length
  paidAmt     = sum(paid bills, paid_amount)
  totalAmt    = sum(all bills, amount)
  nextBill    = bills.find(status ∈ {upcoming,overdue})
  pct         = paid / totalPer * 100

markNextPaid():  [in-flight lock: useRef(false)]
  → markPaid logic, same as Payments.jsx, no transaction
  
closeEarly():
  → db.bills.bulkUpdate(unpaidIds, { status: 'cancelled' })
```

### Summary.jsx
```
useLiveQuery: db.transactions, db.bills
period = 'month' | '3months' | '6months'
computed:
  monthList     = last N months
  monthlyData   = monthList.map(month => {
    income  = sum(transactions income in month)
    expense = sum(transactions expense in month)
             + sum(paid bills in month, paid_amount)
  })
  categoryBreak = group allExpenses by category, sort desc, calc %

exportCSV():
  → generate CSV string from allTx in period
  → trigger browser download
```

### AddSheet.jsx
```
props: open, type, onClose
tabs: Expense | Income | Bill | Plan
state: amount, category, note, name, due_date, segments, start_month, due_day

onSave (Expense/Income):
  → db.transactions.add({ type, amount, category, emoji, tile, date: now, note })

onSave (Bill):
  → db.bills.add({ ..., status: 'upcoming', installment_id: null })

onSave (Plan):
  → db.installments.add({ ..., segments, total_installments })
  → genBills(inst, instId, 0)  // 0 paid at creation

genBills(inst, instId, paidCount):
  → loop through segments × periods
  → compute dueDate per period
  → status = idx≤paidCount ? 'paid' : dueDate<now ? 'overdue' : 'upcoming'
  → db.bills.add(...)
```

## Critical Invariants

### 1. No Double-Count Invariant
```
∀ bill b: b.status = 'paid'
  → b appears in paidBillsAsTx (History, Summary, Dashboard)
  → b MUST NOT have a corresponding db.transactions record
```

### 2. Lock-Before-Await Invariant
```
∀ markPaid call sequence:
  if (lock.has(id)) return          // check
  lock.add(id)                      // acquire ← must be synchronous
  const x = await db.bills.get(id) // first suspension point
```

### 3. Balance Formula Invariant
```
balance = Σ income_tx.amount
        - Σ expense_tx.amount
        - Σ paid_bills.paid_amount   // paid_amount, not amount

pendingTotal = Σ bills[status∈{upcoming,overdue}].amount
safeToSpend  = balance - pendingTotal
```

### 4. Bill Generation Invariant
```
genBills(inst, instId, paidCount):
  ∀ idx ≤ paidCount   → status = 'paid'
  ∀ idx = paidCount+1 AND dueDate < now → status = 'overdue'
  ∀ otherwise         → status = 'upcoming'
```

## State Machine — Bill Status

```
         app open (past due_date)
upcoming ─────────────────────────► overdue
    │                                   │
    │ markPaid()                        │ markPaid()
    ▼                                   ▼
  paid                               paid
    
upcoming ──────────────────────────► cancelled  (closeEarly)
overdue  ──────────────────────────► cancelled  (closeEarly)
```

## DB Initialization Sequence

```
1. App loads → Dexie opens 'FinanceTracker'
2. First open only: db.on('populate') fires
   a. bulkAdd categories (13 defaults)
   b. bulkAdd transactions (seed demo data)
   c. bulkAdd standalone bills (seed)
   d. add installments + genBills for each
3. Every open: App.jsx useEffect → updateOverdueBills()
   → queries bills where status='upcoming'
   → for each: if due_date < now → update status='overdue'
4. React components mount, useLiveQuery subscribes, render
```

## Animation & UI Patterns

### Bottom Sheet (AddSheet)
```css
@keyframes sheet-enter {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
.sheet-enter { animation: sheet-enter 280ms cubic-bezier(0.32, 0.72, 0, 1); }
```

### Phone Mockup Frame
```
position: relative; width: 402px; height: 858px; overflow: hidden;
background: #f4f3ef;
border-radius: 48px;
box-shadow: 0 0 0 14px #15271f, 0 0 0 16px #2a4a37, ...notch...
```

### Scrollable Content Area
```
position: absolute; inset: 0;
overflow-y: auto; overflow-x: hidden;
padding-top: [status bar height];
padding-bottom: [bottom nav height];
-webkit-overflow-scrolling: touch;
```
