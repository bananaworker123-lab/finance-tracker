import { useLiveQuery } from '../useQuery';
import { db } from '../db';
import { baht, fmt, whenStr, statusBadge, monthRange } from '../utils';

export default function Dashboard({ onOpenAdd, onGoPay, onGoSummary }) {
  const { start, end } = monthRange(0);

  const transactions = useLiveQuery(() => db.transactions.toArray(), [], 'transactions');
  const bills = useLiveQuery(() => db.bills.toArray(), [], 'bills');

  if (!transactions || !bills) return <Loading />;

  const monthTx = transactions.filter(t => {
    const d = new Date(t.date);
    return d >= start && d <= end;
  });

  const totalIncome = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalSaving = monthTx.filter(t => t.type === 'saving').reduce((s, t) => s + t.amount, 0);

  const paidBills = bills.filter(b => b.status === 'paid' && b.paid_date && new Date(b.paid_date) >= start && new Date(b.paid_date) <= end);
  const paidBillsTotal = paidBills.reduce((s, b) => s + (b.paid_amount || b.amount), 0);

  const balance = totalIncome - totalExpense - paidBillsTotal - totalSaving;

  // saving ทุกเวลา (ยอดสะสม)
  const totalSavingAllTime = transactions.filter(t => t.type === 'saving').reduce((s, t) => s + t.amount, 0);

  // Pending = เฉพาะเดือนนี้เท่านั้น
  const unpaidAll = bills.filter(b => b.status !== 'paid' && b.status !== 'cancelled');
  const pendingThisMonth = unpaidAll.filter(b => {
    const d = new Date(b.due_date);
    return d >= start && d <= end;
  });
  const pendingTotal = pendingThisMonth.reduce((s, b) => s + b.amount, 0);
  const safeToSpend = balance - pendingTotal;

  // Plan debt = ยอดงวดที่ยังไม่จ่ายในเดือนอนาคต (หลังเดือนนี้)
  const futurePlanBills = bills.filter(b =>
    b.installment_id &&
    b.status !== 'paid' &&
    b.status !== 'cancelled' &&
    new Date(b.due_date) > end
  );
  const planDebt = futurePlanBills.reduce((s, b) => s + b.amount, 0);

  const now = new Date();
  const in7 = new Date(now); in7.setDate(now.getDate() + 7);
  const dueSoon = unpaidAll
    .filter(b => new Date(b.due_date) <= in7)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 3);

  const overdueCount = bills.filter(b => b.status === 'overdue').length;
  const notifCount = overdueCount + dueSoon.filter(b => b.status !== 'overdue').length;

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const currentMonth = `${months[start.getMonth()]} ${start.getFullYear()}`;

  return (
    <div style={{ padding: '6px 20px 124px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%',
            background: 'linear-gradient(140deg,#1d4036,#0caa78)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: '#fff', fontWeight: 700,
          }}>F</div>
          <div>
            <div style={{ fontSize: 12.5, color: '#8d968f', fontWeight: 500 }}>Welcome back</div>
            <div style={{ fontSize: 16, color: '#15271f', fontWeight: 700 }}>Finance Tracker</div>
          </div>
        </div>
        <div style={{ position: 'relative', width: 42, height: 42, borderRadius: 14, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px -8px rgba(20,40,30,.3)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#15271f" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>
          </svg>
          {notifCount > 0 && (
            <span style={{ position: 'absolute', top: 7, right: 8, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: '#e0564f', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>{notifCount}</span>
          )}
        </div>
      </div>

      {/* Hero balance */}
      <div style={{ background: '#fff', borderRadius: 28, padding: '24px 24px 22px', boxShadow: '0 18px 40px -26px rgba(20,40,30,.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: '#8d968f', fontWeight: 600 }}>Available balance</span>
          <span style={{ fontSize: 11.5, color: '#0caa78', fontWeight: 700, background: '#e3f3ec', padding: '5px 10px', borderRadius: 20 }}>Real · paid only</span>
        </div>
        <div style={{ fontSize: 42, fontWeight: 800, color: '#15271f', letterSpacing: -1, margin: '8px 0 16px' }}>
          ฿{fmt(Math.floor(balance))}<span style={{ fontSize: 24, color: '#b6bdb6' }}>.00</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 18 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#0caa78', fontSize: 12, fontWeight: 700 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>
                Income
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#15271f', marginTop: 2 }}>{baht(totalIncome)}</div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#e0564f', fontSize: 12, fontWeight: 700 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M17 7 7 17M15 17H7V9"/></svg>
                Expense
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#15271f', marginTop: 2 }}>{baht(totalExpense + paidBillsTotal)}</div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#1a6ea8', fontSize: 12, fontWeight: 700 }}>
                <span>🐷</span>
                Saving
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#15271f', marginTop: 2 }}>{baht(totalSaving)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Pending + Safe to spend — เดือนนี้เท่านั้น */}
      <div style={{ display: 'flex', gap: 13, marginTop: 13 }}>
        <div style={{ flex: 1, background: '#15271f', borderRadius: 22, padding: '17px 18px', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9fb3a7', fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e8a13a', display: 'inline-block' }} />
            Pending this month
          </div>
          <div style={{ fontSize: 23, fontWeight: 800, marginTop: 8, letterSpacing: '-.5px' }}>{baht(pendingTotal)}</div>
          <div style={{ fontSize: 11.5, color: '#8a9d92', marginTop: 2, fontWeight: 500 }}>Bills due in {currentMonth}</div>
        </div>
        <div style={{ flex: 1, background: '#fff', borderRadius: 22, padding: '17px 18px', boxShadow: '0 14px 34px -26px rgba(20,40,30,.4)' }}>
          <div style={{ fontSize: 12, color: '#8d968f', fontWeight: 600 }}>Balance after pending</div>
          <div style={{ fontSize: 23, fontWeight: 800, color: '#15271f', marginTop: 8, letterSpacing: '-.5px' }}>{baht(safeToSpend)}</div>
          <div style={{ fontSize: 11.5, color: '#0caa78', marginTop: 2, fontWeight: 600 }}>Safe to spend</div>
        </div>
      </div>

      {/* Plan debt — ยอดหนี้งวดอนาคต */}
      {planDebt > 0 && (
        <div onClick={onGoPay} style={{
          marginTop: 13, borderRadius: 22, padding: '17px 18px', cursor: 'pointer',
          background: 'linear-gradient(135deg,#2d1f3d,#4a2060)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#c9aee8', fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#b47fe0', display: 'inline-block' }} />
              Plan debt (future)
            </div>
            <div style={{ fontSize: 23, fontWeight: 800, color: '#fff', marginTop: 8, letterSpacing: '-.5px' }}>{baht(planDebt)}</div>
            <div style={{ fontSize: 11.5, color: '#a98ccc', marginTop: 2, fontWeight: 500 }}>
              {futurePlanBills.length} payments remaining
            </div>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </div>
        </div>
      )}

      {/* Due soon */}
      {dueSoon.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '26px 2px 12px' }}>
            <span style={{ fontSize: 16.5, fontWeight: 700, color: '#15271f' }}>Due soon</span>
            <button onClick={onGoPay} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, color: '#8d968f', display: 'flex', alignItems: 'center', gap: 4 }}>
              View all
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {dueSoon.map(bill => {
              const w = whenStr(bill.due_date);
              const b = statusBadge(bill.status);
              return (
                <div key={bill.id} style={{ background: '#fff', borderRadius: 20, padding: '14px 15px', display: 'flex', alignItems: 'center', gap: 13, boxShadow: '0 12px 30px -26px rgba(20,40,30,.4)' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: bill.tile, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21 }}>{bill.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: '#15271f' }}>{bill.name}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: w.color, marginTop: 2 }}>{w.text}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#15271f' }}>{baht(bill.amount)}</div>
                    <div style={{ display: 'inline-block', marginTop: 4, fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: b.bg, color: b.color }}>{b.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Month teaser */}
      <div onClick={onGoSummary} style={{ marginTop: 13, background: 'linear-gradient(135deg,#e9f4ee,#dcefe3)', borderRadius: 22, padding: '17px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#15271f' }}>{currentMonth} summary</div>
          <div style={{ fontSize: 12, color: '#5d7167', fontWeight: 500, marginTop: 2 }}>
            Spent {baht(totalExpense + paidBillsTotal)} this month
          </div>
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: '#0caa78', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
      </div>
    </div>
  );
}

function SparkBars({ income, expense }) {
  const max = Math.max(income, expense, 1);
  const bars = [
    { h: 0.6, inc: true }, { h: 0.9, inc: true },
    { h: 0.45, inc: false }, { h: 0.75, inc: true },
    { h: 0.35, inc: false }, { h: income / max * 0.9, inc: income >= expense },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 42 }}>
      {bars.map((b, i) => (
        <div key={i} style={{ width: 5, height: `${b.h * 100}%`, background: b.inc ? '#0caa78' : '#e0564f', borderRadius: 3, opacity: i < 5 ? 0.5 : 1 }} />
      ))}
    </div>
  );
}

function Loading() {
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center', color: '#8d968f', fontSize: 14 }}>
      Loading...
    </div>
  );
}
