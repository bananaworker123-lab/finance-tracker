import { useState, useMemo } from 'react';
import { useLiveQuery } from '../useQuery';
import { db } from '../db';
import { baht, fmt, formatDate, monthRange, monthLabel } from '../utils';

export default function History() {
  const [filter, setFilter] = useState('all');
  const [monthIdx, setMonthIdx] = useState(0);
  const [monthOpen, setMonthOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { start, end } = monthRange(monthIdx);

  const transactions = useLiveQuery(() => db.transactions.toArray(), [], 'transactions');
  const bills = useLiveQuery(() =>
    db.bills.where('status').equals('paid').toArray(), [], 'bills');

  if (!transactions || !bills) return <div style={{ padding: 40, color: '#8d968f', textAlign: 'center' }}>Loading...</div>;

  const paidBillsAsTx = bills
    .filter(b => b.paid_date)
    .map(b => ({
      id: 'bill_' + b.id,
      type: 'expense',
      amount: b.paid_amount || b.amount,
      category: b.category,
      emoji: b.emoji,
      tile: b.tile,
      date: b.paid_date,
      note: b.name,
    }));

  const allTx = [...transactions, ...paidBillsAsTx];

  const filtered = allTx
    .filter(t => {
      const d = new Date(t.date);
      if (d < start || d > end) return false;
      if (filter !== 'all' && t.type !== filter) return false;
      if (search && !(t.note || '').toLowerCase().includes(search.toLowerCase()) && !(t.category || '').toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const monthList = Array.from({ length: 13 }, (_, i) => ({
    label: monthLabel(i),
    idx: i,
    active: i === monthIdx,
  }));

  const chip = (k, label) => ({
    key: k, label,
    bg: filter === k ? '#15271f' : '#ffffff',
    color: filter === k ? '#ffffff' : '#6b746e',
  });
  const chips = [chip('all', 'All'), chip('income', 'Income'), chip('expense', 'Expense')];

  return (
    <div style={{ padding: '6px 20px 124px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', margin: '4px 0 16px' }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#15271f', letterSpacing: '-.5px' }}>Transaction</div>
        <div style={{ position: 'relative', zIndex: 15 }}>
          <button onClick={() => setMonthOpen(o => !o)} style={{
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 7,
            background: '#fff', padding: '9px 13px', borderRadius: 13,
            boxShadow: '0 8px 20px -16px rgba(20,40,30,.4)',
            fontSize: 13, fontWeight: 700, color: '#15271f',
          }}>
            {monthLabel(monthIdx)}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8d968f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          {monthOpen && (
            <div style={{
              position: 'absolute', top: 46, right: 0, width: 182, maxHeight: 264,
              overflowY: 'auto', background: '#fff', borderRadius: 16,
              boxShadow: '0 20px 44px -16px rgba(20,40,30,.42)', padding: 6, zIndex: 50,
            }}>
              {monthList.map(ml => (
                <button key={ml.idx} onClick={() => { setMonthIdx(ml.idx); setMonthOpen(false); }} style={{
                  width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 13.5,
                  fontWeight: ml.active ? 700 : 500,
                  color: ml.active ? '#15271f' : '#6b746e',
                  background: ml.active ? '#f0f5f2' : 'transparent',
                  padding: '11px 13px', borderRadius: 11,
                }}>
                  {ml.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, background: '#fff', borderRadius: 16, padding: '12px 15px', boxShadow: '0 12px 30px -26px rgba(20,40,30,.4)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aab2ab" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search transactions"
          style={{ border: 'none', outline: 'none', background: 'none', fontFamily: 'inherit', fontSize: 14, color: '#15271f', width: '100%' }}
        />
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 9, margin: '15px 0 4px' }}>
        {chips.map(c => (
          <button key={c.key} onClick={() => setFilter(c.key)} style={{
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 13, fontWeight: 700, padding: '9px 18px', borderRadius: 14,
            background: c.bg, color: c.color,
            boxShadow: '0 8px 20px -18px rgba(20,40,30,.5)',
          }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Transactions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#aab2ab', fontSize: 14 }}>No transactions found</div>
        )}
        {filtered.map(t => (
          <div key={t.id} style={{ background: '#fff', borderRadius: 18, padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 13, boxShadow: '0 10px 26px -24px rgba(20,40,30,.4)' }}>
            <div style={{ width: 43, height: 43, borderRadius: 13, background: t.tile || '#eef0ec', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              {t.emoji || '💸'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: '#15271f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.note || t.category}</div>
              <div style={{ fontSize: 12, color: '#9aa39c', fontWeight: 500, marginTop: 2 }}>{formatDate(t.date)}</div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.type === 'income' ? '#0caa78' : '#15271f', whiteSpace: 'nowrap' }}>
              {t.type === 'income' ? '+ ' : '− '}{baht(t.amount)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
