import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';

// ─── helpers ───────────────────────────────────────────────────────────────

let _id = 0;
function freshDb() {
  const db = new Dexie(`FinanceTracker_${++_id}`);
  db.version(1).stores({
    transactions: '++id, type, category, date',
    bills:        '++id, installment_id, status, due_date',
    installments: '++id, category, start_month',
    categories:   '++id, name',
  });
  return db;
}

const now   = new Date();
const y     = now.getFullYear();
const m     = now.getMonth();       // 0-indexed
const past  = (d) => new Date(y, m, d).toISOString();           // day this month
const future= (d) => new Date(y, m + 1, d).toISOString();       // day next month
const prev  = (d) => new Date(y, m - 1, d).toISOString();       // day last month

/** Reusable seed: 2 income + 3 expense transactions, 3 standalone bills */
async function seedStandard(db) {
  await db.transactions.bulkAdd([
    { type: 'income',  amount: 70000, category: 'Salary',    emoji: '💰', tile: '#e3f3ec', date: past(1),  note: 'เงินเดือน' },
    { type: 'income',  amount:  5000, category: 'Salary',    emoji: '💰', tile: '#e3f3ec', date: past(5),  note: 'ฟรีแลนซ์' },
    { type: 'expense', amount:  1200, category: 'Food',      emoji: '🍔', tile: '#fbeede', date: past(10), note: 'ค่าอาหาร' },
    { type: 'expense', amount:   800, category: 'Transport', emoji: '🚕', tile: '#e8f0fe', date: past(12), note: 'Grab/BTS' },
    { type: 'expense', amount:   350, category: 'Coffee',    emoji: '☕', tile: '#f6ede2', date: past(15), note: 'กาแฟ' },
  ]);
  await db.bills.bulkAdd([
    { installment_id: null, name: 'ค่าไฟ — MEA',    emoji: '⚡', tile: '#e3f3ec', amount:  500, due_date: past(5),  category: 'Bills',         status: 'overdue',  note: '' },
    { installment_id: null, name: 'Internet — AIS', emoji: '📶', tile: '#e3f3ec', amount:  599, due_date: future(1),category: 'Internet',      status: 'upcoming', note: '' },
    { installment_id: null, name: 'Spotify',        emoji: '🎧', tile: '#f1ebfc', amount:  149, due_date: past(3),  category: 'Entertainment', status: 'paid',
      paid_date: past(3), paid_amount: 149, note: '' },
  ]);
}

/** Business logic extracted from Payments.jsx markPaid */
async function markPaid(db, billId) {
  const bill = await db.bills.get(billId);
  if (!bill || bill.status === 'paid' || bill.status === 'cancelled') return;
  await db.bills.update(billId, {
    status: 'paid',
    paid_date: new Date().toISOString(),
    paid_amount: bill.amount,
  });
}

/** Business logic extracted from updateOverdueBills in db.js */
async function updateOverdueBills(db) {
  const upcoming = await db.bills.where('status').equals('upcoming').toArray();
  for (const bill of upcoming) {
    if (new Date(bill.due_date) < new Date()) {
      await db.bills.update(bill.id, { status: 'overdue' });
    }
  }
}

/** Generates installment bills — mirrors db.js genBills */
async function genBills(db, inst, instId, paidCount) {
  const [sy, sm] = inst.start_month.split('-').map(Number);
  let mi = sm, yr = sy, idx = 0;
  for (const seg of inst.segments) {
    for (let k = 0; k < seg.periods; k++) {
      idx++;
      const dueDate = new Date(yr, mi, inst.due_day);
      const status = idx <= paidCount
        ? 'paid'
        : (idx === paidCount + 1 && dueDate < new Date() ? 'overdue' : 'upcoming');
      await db.bills.add({
        installment_id: instId,
        name: `${inst.name} · งวดที่ ${idx}`,
        emoji: inst.emoji,
        tile: inst.tile,
        amount: seg.amount_per_period,
        due_date: dueDate.toISOString(),
        category: inst.category,
        status,
        paid_date:   status === 'paid' ? dueDate.toISOString() : null,
        paid_amount: status === 'paid' ? seg.amount_per_period  : null,
        note: '',
        installment_index: idx,
      });
      mi++;
      if (mi > 11) { mi = 0; yr++; }
    }
  }
}

// ─── test suites ────────────────────────────────────────────────────────────

describe('1 · Seed data integrity', () => {
  let db;
  beforeEach(async () => { db = freshDb(); await seedStandard(db); });

  it('has 5 transactions', async () => {
    expect(await db.transactions.count()).toBe(5);
  });

  it('has 2 income + 3 expense', async () => {
    const income  = await db.transactions.where('type').equals('income').count();
    const expense = await db.transactions.where('type').equals('expense').count();
    expect(income).toBe(2);
    expect(expense).toBe(3);
  });

  it('has 3 standalone bills (overdue / upcoming / paid)', async () => {
    const bills = await db.bills.toArray();
    const statuses = bills.map(b => b.status).sort();
    expect(statuses).toEqual(['overdue', 'paid', 'upcoming']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('2 · Balance calculation', () => {
  let db;
  beforeEach(async () => { db = freshDb(); await seedStandard(db); });

  it('total income = 75,000', async () => {
    const rows = await db.transactions.where('type').equals('income').toArray();
    const total = rows.reduce((s, r) => s + r.amount, 0);
    expect(total).toBe(75000);
  });

  it('total expense transactions = 2,350', async () => {
    const rows = await db.transactions.where('type').equals('expense').toArray();
    const total = rows.reduce((s, r) => s + r.amount, 0);
    expect(total).toBe(2350);
  });

  it('paid bills total = 149', async () => {
    const paid = await db.bills.where('status').equals('paid').toArray();
    const total = paid.reduce((s, b) => s + (b.paid_amount || b.amount), 0);
    expect(total).toBe(149);
  });

  it('balance = income − expense_tx − paid_bills = 72,501', async () => {
    const income   = (await db.transactions.where('type').equals('income').toArray()).reduce((s,r) => s + r.amount, 0);
    const expTx    = (await db.transactions.where('type').equals('expense').toArray()).reduce((s,r) => s + r.amount, 0);
    const paidBill = (await db.bills.where('status').equals('paid').toArray()).reduce((s,b) => s + (b.paid_amount || b.amount), 0);
    expect(income - expTx - paidBill).toBe(72501);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('3 · Mark standalone bill paid', () => {
  let db, overdueId;
  beforeEach(async () => {
    db = freshDb();
    await seedStandard(db);
    const overdue = await db.bills.where('status').equals('overdue').first();
    overdueId = overdue.id;
  });

  it('changes bill status to paid', async () => {
    await markPaid(db, overdueId);
    const bill = await db.bills.get(overdueId);
    expect(bill.status).toBe('paid');
  });

  it('sets paid_date and paid_amount', async () => {
    await markPaid(db, overdueId);
    const bill = await db.bills.get(overdueId);
    expect(bill.paid_date).toBeTruthy();
    expect(bill.paid_amount).toBe(500); // ค่าไฟ 500 ฿
  });

  it('does NOT add a transaction record', async () => {
    const before = await db.transactions.count();
    await markPaid(db, overdueId);
    const after = await db.transactions.count();
    expect(after).toBe(before); // no new transaction
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('4 · Idempotency — mark paid twice', () => {
  let db, overdueId;
  beforeEach(async () => {
    db = freshDb();
    await seedStandard(db);
    const overdue = await db.bills.where('status').equals('overdue').first();
    overdueId = overdue.id;
  });

  it('calling markPaid twice leaves exactly 2 paid bills (not 3)', async () => {
    await markPaid(db, overdueId);
    await markPaid(db, overdueId); // second call should no-op
    const paidCount = await db.bills.where('status').equals('paid').count();
    expect(paidCount).toBe(2); // Spotify (seed) + ค่าไฟ
  });

  it('transaction count unchanged after second call', async () => {
    await markPaid(db, overdueId);
    const mid = await db.transactions.count();
    await markPaid(db, overdueId);
    expect(await db.transactions.count()).toBe(mid);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('5 · Concurrent double-fire prevention', () => {
  it('two simultaneous calls produce exactly one paid update', async () => {
    const db = freshDb();
    await db.bills.add({
      installment_id: null, name: 'Test Bill', emoji: '⚡', tile: '#e3f3ec',
      amount: 300, due_date: past(5), category: 'Bills', status: 'overdue', note: '',
    });
    const bill = (await db.bills.toArray()).find(b => b.name === 'Test Bill');

    // Simulate the in-flight lock from Payments.jsx (useRef pattern)
    const payingIds = new Set();
    async function markPaidWithLock(billId) {
      if (payingIds.has(billId)) return; // guard
      payingIds.add(billId);             // acquire BEFORE first await
      const b = await db.bills.get(billId);
      if (!b || b.status === 'paid' || b.status === 'cancelled') {
        payingIds.delete(billId);
        return;
      }
      await db.bills.update(billId, { status: 'paid', paid_date: new Date().toISOString(), paid_amount: b.amount });
      payingIds.delete(billId);
    }

    // Fire both "simultaneously"
    await Promise.all([markPaidWithLock(bill.id), markPaidWithLock(bill.id)]);

    const paidCount = await db.bills.where('status').equals('paid').count();
    expect(paidCount).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('6 · Auto overdue detection (updateOverdueBills)', () => {
  it('promotes a past-due upcoming bill to overdue', async () => {
    const db = freshDb();
    await db.bills.add({
      installment_id: null, name: 'Past Due', emoji: '💧', tile: '#e8f0fe',
      amount: 280, due_date: prev(10), // last month — clearly in the past
      category: 'Bills', status: 'upcoming', note: '',
    });

    await updateOverdueBills(db);

    const bill = (await db.bills.toArray()).find(b => b.name === 'Past Due');
    expect(bill.status).toBe('overdue');
  });

  it('leaves a future bill as upcoming', async () => {
    const db = freshDb();
    await db.bills.add({
      installment_id: null, name: 'Future Bill', emoji: '📶', tile: '#e3f3ec',
      amount: 599, due_date: future(15), // next month
      category: 'Internet', status: 'upcoming', note: '',
    });

    await updateOverdueBills(db);

    const bill = (await db.bills.toArray()).find(b => b.name === 'Future Bill');
    expect(bill.status).toBe('upcoming');
  });

  it('does not touch already-paid bills', async () => {
    const db = freshDb();
    await db.bills.add({
      installment_id: null, name: 'Already Paid', emoji: '🎧', tile: '#f1ebfc',
      amount: 149, due_date: prev(5),
      category: 'Entertainment', status: 'paid',
      paid_date: prev(5), paid_amount: 149, note: '',
    });

    await updateOverdueBills(db);

    const bill = (await db.bills.toArray()).find(b => b.name === 'Already Paid');
    expect(bill.status).toBe('paid'); // unchanged
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('7 · Installment plan generation', () => {
  it('single-segment: generates correct number of bills', async () => {
    const db = freshDb();
    const instId = await db.installments.add({
      name: 'ผ่อนโน้ตบุ๊ก', emoji: '💻', tile: '#e8f0fe',
      start_month: `${y}-${String(m + 1).padStart(2, '0')}`,
      due_day: 5, category: 'Shopping', note: '',
      segments: [{ amount_per_period: 5000, periods: 3 }],
      total_installments: 3,
    });
    const inst = await db.installments.get(instId);
    await genBills(db, inst, instId, 0);

    const bills = await db.bills.where('installment_id').equals(instId).toArray();
    expect(bills.length).toBe(3);
    expect(bills.every(b => b.amount === 5000)).toBe(true);
  });

  it('multi-segment: total bills = sum of all segment periods', async () => {
    const db = freshDb();
    const instId = await db.installments.add({
      name: 'ผ่อน iPhone 16', emoji: '📱', tile: '#e8f0fe',
      start_month: `${y}-${String(m - 1 < 0 ? 0 : m - 1).padStart(2, '0')}`,
      due_day: 15, category: 'Phone', note: '',
      segments: [{ amount_per_period: 3500, periods: 3 }, { amount_per_period: 2500, periods: 3 }],
      total_installments: 6,
    });
    const inst = await db.installments.get(instId);
    await genBills(db, inst, instId, 1);

    const bills = await db.bills.where('installment_id').equals(instId).toArray();
    expect(bills.length).toBe(6);

    // First 3 bills at 3500, next 3 at 2500
    const amounts = bills.map(b => b.amount);
    expect(amounts.slice(0, 3)).toEqual([3500, 3500, 3500]);
    expect(amounts.slice(3, 6)).toEqual([2500, 2500, 2500]);
  });

  it('first N bills are paid, N+1 is overdue/upcoming', async () => {
    const db = freshDb();
    const instId = await db.installments.add({
      name: 'ผ่อนทดสอบ', emoji: '📱', tile: '#e8f0fe',
      start_month: `${y}-${String(m - 2 < 0 ? 0 : m - 2).padStart(2, '0')}`,
      due_day: 15, category: 'Phone', note: '',
      segments: [{ amount_per_period: 3000, periods: 4 }],
      total_installments: 4,
    });
    const inst = await db.installments.get(instId);
    await genBills(db, inst, instId, 2); // 2 paid

    const bills = await db.bills.where('installment_id').equals(instId).sortBy('installment_index');
    expect(bills[0].status).toBe('paid');
    expect(bills[1].status).toBe('paid');
    expect(['overdue', 'upcoming']).toContain(bills[2].status); // 3rd = next
    expect(bills[3].status).toBe('upcoming'); // last is future
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('8 · Installment — mark next payment paid', () => {
  let db, instId;
  beforeEach(async () => {
    db = freshDb();
    instId = await db.installments.add({
      name: 'ผ่อน iPhone 16', emoji: '📱', tile: '#e8f0fe',
      start_month: `${y}-${String(m - 1 < 0 ? 0 : m - 1).padStart(2, '0')}`,
      due_day: 15, category: 'Phone', note: '',
      segments: [{ amount_per_period: 3500, periods: 3 }, { amount_per_period: 2500, periods: 3 }],
      total_installments: 6,
    });
    const inst = await db.installments.get(instId);
    await genBills(db, inst, instId, 1); // 1 already paid
  });

  it('next unpaid bill becomes paid', async () => {
    const next = await db.bills
      .where('installment_id').equals(instId)
      .filter(b => b.status !== 'paid' && b.status !== 'cancelled')
      .first();
    await markPaid(db, next.id);

    const updated = await db.bills.get(next.id);
    expect(updated.status).toBe('paid');
  });

  it('paid count increments from 1 to 2', async () => {
    const before = await db.bills.where('installment_id').equals(instId)
      .filter(b => b.status === 'paid').count();
    expect(before).toBe(1);

    const next = await db.bills
      .where('installment_id').equals(instId)
      .filter(b => b.status !== 'paid' && b.status !== 'cancelled')
      .first();
    await markPaid(db, next.id);

    const after = await db.bills.where('installment_id').equals(instId)
      .filter(b => b.status === 'paid').count();
    expect(after).toBe(2);
  });

  it('does NOT add a transaction record', async () => {
    const txBefore = await db.transactions.count();
    const next = await db.bills
      .where('installment_id').equals(instId)
      .filter(b => b.status !== 'paid' && b.status !== 'cancelled')
      .first();
    await markPaid(db, next.id);
    expect(await db.transactions.count()).toBe(txBefore);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('9 · History aggregation — no double counting', () => {
  let db;
  beforeEach(async () => { db = freshDb(); await seedStandard(db); });

  it('paid bills are NOT in transactions table', async () => {
    // Mark the overdue bill paid
    const overdue = await db.bills.where('status').equals('overdue').first();
    await markPaid(db, overdue.id);

    // transactions table should still have only the original 5
    expect(await db.transactions.count()).toBe(5);
  });

  it('synthesised paid-bill rows match db.bills paid records', async () => {
    const overdue = await db.bills.where('status').equals('overdue').first();
    await markPaid(db, overdue.id);

    // History synthesises paid bills as expense rows
    const paidBills = await db.bills.where('status').equals('paid').toArray();
    const paidAsTx = paidBills.map(b => ({
      id:       'bill_' + b.id,
      type:     'expense',
      amount:   b.paid_amount || b.amount,
      category: b.category,
      note:     b.name,
    }));

    // 2 paid bills now: Spotify (seed) + ค่าไฟ (just paid)
    expect(paidAsTx.length).toBe(2);
    expect(paidAsTx.every(r => r.type === 'expense')).toBe(true);
  });

  it('total expense = tx expenses + paid bills (no duplication)', async () => {
    const overdue = await db.bills.where('status').equals('overdue').first();
    await markPaid(db, overdue.id); // +500

    const txExpense  = (await db.transactions.where('type').equals('expense').toArray()).reduce((s, r) => s + r.amount, 0);
    const billExpense= (await db.bills.where('status').equals('paid').toArray()).reduce((s, b) => s + (b.paid_amount || b.amount), 0);

    // 2350 (tx) + 149 (Spotify, seed paid) + 500 (ค่าไฟ, just paid) = 2999
    expect(txExpense + billExpense).toBe(2999);
  });
});
