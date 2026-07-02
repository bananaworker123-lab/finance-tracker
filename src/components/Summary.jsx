import { useState } from 'react';
import { useLiveQuery } from '../useQuery';
import { db } from '../db';
import { baht, monthRange, monthLabel, catMeta } from '../utils';

const CHART_H = 130;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function Summary() {
  const [chartFilter, setChartFilter] = useState('all');

  const { start, end } = monthRange(0);

  const transactions = useLiveQuery(() => db.transactions.toArray(), [], 'transactions');
  const bills = useLiveQuery(() => db.bills.toArray(), [], 'bills');

  if (!transactions || !bills) return <div style={{ padding: 40, color: '#8d968f', textAlign: 'center' }}>Loading...</div>;

  const paidBills = bills.filter(b => b.status === 'paid');
  const unpaidBills = bills.filter(b => b.status === 'upcoming' || b.status === 'overdue');

  const monthTx = transactions.filter(t => { const d = new Date(t.date); return d >= start && d <= end; });
  const paidBillsMonth = paidBills.filter(b => b.paid_date && new Date(b.paid_date) >= start && new Date(b.paid_date) <= end);
  const pendingThisMonth = unpaidBills.filter(b => { const d = new Date(b.due_date); return d >= start && d <= end; });

  const totalIncome = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    + paidBillsMonth.reduce((s, b) => s + (b.paid_amount || b.amount), 0);
  const totalSaving = monthTx.filter(t => t.type === 'saving').reduce((s, t) => s + t.amount, 0);
  const totalPending = pendingThisMonth.reduce((s, b) => s + b.amount, 0);

  // Category breakdowns
  const incomeMap = {};
  monthTx.filter(t => t.type === 'income').forEach(t => {
    incomeMap[t.category] = (incomeMap[t.category] || 0) + t.amount;
  });

  const expenseMap = {};
  monthTx.filter(t => t.type === 'expense').forEach(t => {
    expenseMap[t.category] = (expenseMap[t.category] || 0) + t.amount;
  });
  paidBillsMonth.forEach(b => {
    expenseMap[b.category] = (expenseMap[b.category] || 0) + (b.paid_amount || b.amount);
  });

  const toBreakdown = (map, total) =>
    Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, amount]) => ({
      name, amount, pct: total > 0 ? Math.round(amount / total * 100) : 0, ...catMeta(name),
    }));

  const incomeBreakdown = toBreakdown(incomeMap, totalIncome);
  const expenseBreakdown = toBreakdown(expenseMap, totalExpense);

  // Chart: last 6 months
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const { start: ms, end: me } = monthRange(5 - i);
    const txm = transactions.filter(t => { const d = new Date(t.date); return d >= ms && d <= me; });
    const paidM = paidBills.filter(b => b.paid_date && new Date(b.paid_date) >= ms && new Date(b.paid_date) <= me);
    const inc = txm.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = txm.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      + paidM.reduce((s, b) => s + (b.paid_amount || b.amount), 0);
    const sav = txm.filter(t => t.type === 'saving').reduce((s, t) => s + t.amount, 0);
    return { label: MONTHS[ms.getMonth()], inc, exp, sav, isCurrent: i === 5 };
  });

  const currentMonthName = `${MONTHS[start.getMonth()]} ${start.getFullYear()}`;

  function exportCSV() {
    const all = [
      ...transactions,
      ...paidBills.map(b => ({ type: 'expense', amount: b.paid_amount || b.amount, category: b.category, date: b.paid_date || b.due_date, note: b.name })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));
    const rows = [['Date','Type','Category','Amount','Note']];
    all.forEach(t => rows.push([new Date(t.date).toISOString().split('T')[0], t.type, t.category, t.amount, (t.note || '').replace(/,/g, ';')]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'transactions.csv';
    a.click();
  }

  return (
    <div style={{ padding: '6px 20px 124px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 16px' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#15271f', letterSpacing: '-.5px' }}>Summary</div>
          <div style={{ fontSize: 13, color: '#8d968f', fontWeight: 500, marginTop: 2 }}>{currentMonthName}</div>
        </div>
        <button onClick={exportCSV} style={{ border: 'none', background: '#e3f3ec', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: '#0caa78', padding: '8px 14px', borderRadius: 12 }}>Export CSV</button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Income', value: totalIncome, color: '#0caa78' },
          { label: 'Expense', value: totalExpense, color: '#e0564f' },
          { label: 'Saving', value: totalSaving, color: '#1a6ea8' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: '#fff', borderRadius: 16, padding: '12px 13px', boxShadow: '0 10px 28px -24px rgba(20,40,30,.4)' }}>
            <div style={{ fontSize: 11, color: '#8d968f', fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: s.color, marginTop: 4 }}>{baht(s.value)}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div style={{ background: '#fff', borderRadius: 24, padding: '16px 16px 10px', marginBottom: 14, boxShadow: '0 14px 34px -28px rgba(20,40,30,.42)' }}>
        {/* Chart filter */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {[
            { key: 'all', label: 'All' },
            { key: 'income', label: 'Income' },
            { key: 'expense', label: 'Expense' },
            { key: 'saving', label: 'Saving' },
          ].map(f => (
            <button key={f.key} onClick={() => setChartFilter(f.key)} style={{
              flex: 1, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 11.5, fontWeight: 700, padding: '7px 4px', borderRadius: 10,
              background: chartFilter === f.key ? '#15271f' : '#f0f2ef',
              color: chartFilter === f.key ? '#fff' : '#8d968f',
            }}>{f.label}</button>
          ))}
        </div>
        <BarChart data={chartData} filter={chartFilter} />
      </div>

      {/* Category breakdown */}
      <Section title="Income" color="#0caa78" total={totalIncome} items={incomeBreakdown} />
      <Section title="Expense" color="#e0564f" total={totalExpense} items={expenseBreakdown}
        extra={totalPending > 0 ? { label: 'Pending bills', amount: totalPending, emoji: '⏳', tile: '#fff8ee' } : null} />
      {totalSaving > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1a6ea8' }}>🐷 Saving</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#15271f' }}>{baht(totalSaving)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function BarChart({ data, filter }) {
  const colorMap = { income: '#0caa78', expense: '#e0564f', saving: '#1a6ea8' };
  const color = colorMap[filter] || '#15271f';

  const maxVal = Math.max(...data.map(d =>
    filter === 'all' ? Math.max(d.inc, d.exp, d.sav)
    : filter === 'income' ? d.inc
    : filter === 'expense' ? d.exp
    : d.sav
  ), 1);

  const getH = (v) => Math.round((v / maxVal) * CHART_H * 0.88);

  // Trend line points in viewBox 600 x CHART_H
  const SLOT = 600 / data.length;
  const trendPoints = data.map((d, i) => {
    const v = filter === 'income' ? d.inc : filter === 'expense' ? d.exp : d.sav;
    const x = i * SLOT + SLOT / 2;
    const y = CHART_H - Math.round((v / maxVal) * CHART_H * 0.88);
    return { x, y, v };
  });

  return (
    <div>
      <div style={{ position: 'relative' }}>
        {/* Bars */}
        <div style={{ display: 'flex', alignItems: 'flex-end', height: CHART_H, gap: 5 }}>
          {data.map((d, i) => (
            <div key={i} style={{ flex: 1, height: CHART_H, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
              {filter === 'all' ? (
                <>
                  <div style={{ flex: 1, height: getH(d.inc), background: d.isCurrent ? '#0caa78' : '#c8e8d6', borderRadius: '3px 3px 0 0' }} />
                  <div style={{ flex: 1, height: getH(d.exp), background: d.isCurrent ? '#e0564f' : '#f0c0bd', borderRadius: '3px 3px 0 0' }} />
                  <div style={{ flex: 1, height: getH(d.sav), background: d.isCurrent ? '#1a6ea8' : '#a8c8e8', borderRadius: '3px 3px 0 0' }} />
                </>
              ) : (
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: CHART_H }}>
                  <div style={{
                    width: '40%',
                    height: getH(filter === 'income' ? d.inc : filter === 'expense' ? d.exp : d.sav),
                    background: d.isCurrent ? color : color + '55',
                    borderRadius: '4px 4px 0 0',
                  }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Trend line SVG — only for single filter */}
        {filter !== 'all' && (
          <svg viewBox={`0 0 600 ${CHART_H}`} preserveAspectRatio="none"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: CHART_H, pointerEvents: 'none' }}>
            <polyline
              points={trendPoints.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"
            />
            {trendPoints.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={data[i].isCurrent ? 5 : 3.5}
                fill={data[i].isCurrent ? color : '#fff'} stroke={color} strokeWidth="2" />
            ))}
          </svg>
        )}
      </div>

      {/* Month labels */}
      <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 10.5, fontWeight: 600, color: d.isCurrent ? '#15271f' : '#aab2ab' }}>{d.label}</div>
        ))}
      </div>

      {/* Legend for All */}
      {filter === 'all' && (
        <div style={{ display: 'flex', gap: 14, marginTop: 10, justifyContent: 'center' }}>
          {[['#0caa78','Income'],['#e0564f','Expense'],['#1a6ea8','Saving']].map(([c, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#5d7167' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: c, display: 'inline-block' }} />
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ title, color, total, items, extra }) {
  if (items.length === 0 && !extra) return null;
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color }}>{title}</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#15271f' }}>{baht(total)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {items.map(bk => (
          <div key={bk.name} style={{ background: '#fff', borderRadius: 16, padding: '13px 14px', boxShadow: '0 8px 24px -22px rgba(20,40,30,.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: bk.tile, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{bk.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: '#15271f' }}>{bk.name}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: '#15271f' }}>{baht(bk.amount)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 5, borderRadius: 3, background: '#eef0ec', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: bk.pct + '%', background: color, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#9aa39c', width: 28, textAlign: 'right' }}>{bk.pct}%</span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {extra && (
          <div style={{ background: '#fff8ee', borderRadius: 16, padding: '13px 14px', border: '1px solid #f5e0b0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: extra.tile, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{extra.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: '#e8a13a' }}>{extra.label}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: '#e8a13a' }}>{baht(extra.amount)}</span>
                </div>
                <div style={{ fontSize: 11.5, color: '#c8954e', marginTop: 4, fontWeight: 500 }}>ยังไม่ได้จ่ายเดือนนี้</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
