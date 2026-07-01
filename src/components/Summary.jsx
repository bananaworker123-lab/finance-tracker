import { useState } from 'react';
import { useLiveQuery } from '../useQuery';
import { db } from '../db';
import { baht, fmt, monthRange, monthLabel, catMeta } from '../utils';

export default function Summary() {
  const [period, setPeriod] = useState('month'); // week | month | quarter

  const { start, end } = monthRange(0);

  const transactions = useLiveQuery(() => db.transactions.toArray(), [], 'transactions');
  const bills = useLiveQuery(() => db.bills.where('status').equals('paid').toArray(), [], 'bills');
  const unpaidBills = useLiveQuery(() => db.bills.where('status').anyOf(['upcoming','overdue']).toArray(), [], 'bills');

  if (!transactions || !bills || !unpaidBills) return <div style={{ padding: 40, color: '#8d968f', textAlign: 'center' }}>Loading...</div>;

  const monthTx = transactions.filter(t => { const d = new Date(t.date); return d >= start && d <= end; });
  const paidBillsMonth = bills.filter(b => b.paid_date && new Date(b.paid_date) >= start && new Date(b.paid_date) <= end);

  const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0) +
    paidBillsMonth.reduce((s, b) => s + (b.paid_amount || b.amount), 0);
  const pending = unpaidBills.filter(b => { const d = new Date(b.due_date); return d >= start && d <= end; }).reduce((s, b) => s + b.amount, 0);

  // Category breakdown
  const catMap = {};
  monthTx.filter(t => t.type === 'expense').forEach(t => {
    catMap[t.category] = (catMap[t.category] || 0) + t.amount;
  });
  paidBillsMonth.forEach(b => {
    catMap[b.category] = (catMap[b.category] || 0) + (b.paid_amount || b.amount);
  });

  const totalSpent = Object.values(catMap).reduce((s, v) => s + v, 0);
  const breakdown = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => {
      const meta = catMeta(name);
      const pct = totalSpent > 0 ? Math.round(amount / totalSpent * 100) : 0;
      return { name, amount, pctLabel: pct + '%', barWidth: pct + '%', ...meta };
    });

  // Bar chart: last 6 months
  const bars = Array.from({ length: 6 }, (_, i) => {
    const { start: ms, end: me } = monthRange(5 - i);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const txm = transactions.filter(t => { const d = new Date(t.date); return d >= ms && d <= me; });
    const inc = txm.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = txm.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { label: months[ms.getMonth()], inc, exp, isCurrentMonth: i === 5 };
  });
  const maxVal = Math.max(...bars.map(b => Math.max(b.inc, b.exp)), 1);
  const barH = (v) => Math.round((v / maxVal) * 130) + 'px';

  function exportCSV() {
    const all = [...transactions, ...bills.map(b => ({
      type: 'expense', amount: b.paid_amount || b.amount,
      category: b.category, date: b.paid_date || b.due_date, note: b.name,
    }))].sort((a, b) => new Date(b.date) - new Date(a.date));

    const rows = [['Date','Type','Category','Amount','Note']];
    all.forEach(t => {
      rows.push([
        new Date(t.date).toISOString().split('T')[0],
        t.type,
        t.category,
        t.amount,
        (t.note || '').replace(/,/g, ';'),
      ]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transactions.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const currentMonthName = `${months[start.getMonth()]} ${start.getFullYear()}`;

  return (
    <div style={{ padding: '6px 20px 124px' }}>
      <div style={{ margin: '4px 0 16px' }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#15271f', letterSpacing: '-.5px' }}>Summary</div>
        <div style={{ fontSize: 13, color: '#8d968f', fontWeight: 500, marginTop: 2 }}>{currentMonthName}</div>
      </div>

      {/* Period tabs */}
      <div style={{ display: 'flex', gap: 6, background: '#eceee9', padding: 5, borderRadius: 16 }}>
        {['week','month','quarter'].map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            flex: 1, textAlign: 'center', fontSize: 13,
            fontWeight: period === p ? 700 : 600,
            color: period === p ? '#fff' : '#8d968f',
            padding: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: period === p ? '#15271f' : 'transparent', borderRadius: 12,
          }}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
        {[
          { label: 'Income', value: income, color: '#0caa78' },
          { label: 'Expense', value: expense, color: '#15271f' },
          { label: 'Pending', value: pending, color: '#e8a13a' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: '#fff', borderRadius: 18, padding: 14, boxShadow: '0 12px 30px -26px rgba(20,40,30,.4)' }}>
            <div style={{ fontSize: 11.5, color: '#8d968f', fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: s.color, marginTop: 5 }}>{baht(s.value)}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div style={{ background: '#fff', borderRadius: 24, padding: '20px 18px 14px', marginTop: 14, boxShadow: '0 14px 34px -28px rgba(20,40,30,.42)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 160, gap: 6 }}>
          {bars.map((b, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 140 }}>
                <div style={{ width: 9, height: barH(b.inc), background: b.isCurrentMonth ? '#0caa78' : '#cfe3d6', borderRadius: 4 }} />
                <div style={{ width: 9, height: barH(b.exp), background: b.isCurrentMonth ? '#e0564f' : '#f0c0bd', borderRadius: 4 }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: b.isCurrentMonth ? '#15271f' : '#aab2ab' }}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Category breakdown */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '22px 2px 12px' }}>
        <span style={{ fontSize: 16.5, fontWeight: 700, color: '#15271f' }}>By category</span>
        <button onClick={exportCSV} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, color: '#0caa78' }}>Export CSV</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {breakdown.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#aab2ab', fontSize: 14 }}>No expenses this month</div>
        )}
        {breakdown.map(bk => (
          <div key={bk.name} style={{ background: '#fff', borderRadius: 18, padding: '14px 15px', boxShadow: '0 10px 26px -24px rgba(20,40,30,.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: bk.tile, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>{bk.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#15271f' }}>{bk.name}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#15271f' }}>{baht(bk.amount)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 7 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 4, background: '#eef0ec', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: bk.barWidth, background: '#0caa78', borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#9aa39c', width: 30, textAlign: 'right' }}>{bk.pctLabel}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
