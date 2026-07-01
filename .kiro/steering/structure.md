# Project Structure

```
Finance Tracker/
├── index.html                    # PWA shell — viewport, fonts, meta tags
├── vite.config.js                # Vite + React + Tailwind v4 + PWA + Vitest config
├── package.json
│
├── public/
│   ├── icon-192.png
│   └── icon-512.png
│
└── src/
    ├── main.jsx                  # React root mount
    ├── index.css                 # @import "tailwindcss", body background, keyframe animations
    ├── App.jsx                   # Phone frame shell + screen router + overlay state
    │
    ├── db.js                     # Dexie DB schema, populate hook (seed), updateOverdueBills()
    ├── utils.js                  # Pure helpers: baht(), fmt(), whenStr(), statusBadge(),
    │                             #   monthRange(), monthLabel(), catMeta(), DEFAULT_CATEGORIES
    │
    ├── components/
    │   ├── BottomNav.jsx         # 5-button nav bar + green FAB
    │   ├── Dashboard.jsx         # Balance card, pending total, due-soon list, SparkBars
    │   ├── History.jsx           # Month picker, search, type filter, transaction list
    │   ├── Payments.jsx          # Tab (All/Bills/Plans), status chips, markPaid()
    │   ├── PlanDetail.jsx        # Installment detail, payment schedule, markNextPaid(), close early
    │   ├── Summary.jsx           # Period tabs, stats row, 6-month bar chart, category %, CSV export
    │   └── AddSheet.jsx          # Bottom sheet: Expense / Income / Bill / Plan tabs
    │
    └── __tests__/
        └── finance.test.js       # Vitest unit tests (DB logic, balance calc, markPaid, etc.)
```

## Key Data Flows

### Add Transaction (Immediate)
```
AddSheet (Expense tab) → db.transactions.add() → Dashboard/History re-render via useLiveQuery
```

### Add Bill
```
AddSheet (Bill tab) → db.bills.add({ status: 'upcoming' }) → Payments re-render
```

### Add Installment Plan
```
AddSheet (Plan tab) → db.installments.add() + genBills() → bills for each period added → Payments/PlanDetail re-render
```

### Mark Bill Paid
```
Payments.markPaid(id) [with in-flight lock]
  → db.bills.update(id, { status: 'paid', paid_date, paid_amount })
  → (NO db.transactions.add)
  → Payments, History, Dashboard, Summary re-render via useLiveQuery
```

### History Expense Aggregation
```
History.jsx:
  allTx = [
    ...db.transactions (income + expense),
    ...paidBills.map(b => ({ type: 'expense', amount: b.paid_amount, ... }))  // synthesised
  ]
  → sorted newest-first, filtered by month/type/search
```

### Balance Calculation (Dashboard)
```
balance     = sum(income transactions) − sum(expense transactions) − sum(paid bill amounts)
pendingTotal= sum(bills where status ∈ {upcoming, overdue})
              + sum(installment bills where status ∈ {upcoming, overdue})
safeToSpend = balance − pendingTotal
```
