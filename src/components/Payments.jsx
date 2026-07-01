import { useState, useRef } from 'react';
import { useLiveQuery } from '../useQuery';
import { db } from '../db';
import { baht, whenStr, statusBadge, formatDate } from '../utils';

export default function Payments({ onOpenPlan, onOpenAdd }) {
  const [tab, setTab] = useState('all'); // all | bills | installments
  const [statusFilter, setStatusFilter] = useState('all'); // all | upcoming | overdue | paid
  const payingIds = useRef(new Set());

  const bills = useLiveQuery(() => db.bills.toArray(), [], 'bills');
  const installments = useLiveQuery(() => db.installments.toArray(), [], 'installments');

  if (!bills || !installments) return <div style={{ padding: 40, color: '#8d968f', textAlign: 'center' }}>Loading...</div>;

  const standaloneBills = bills.filter(b => !b.installment_id);
  const instBills = bills.filter(b => b.installment_id);

  const filteredBills = standaloneBills.filter(b => {
    if (tab === 'installments') return false;
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    return true;
  });

  const filteredInst = installments.filter(() => {
    if (tab === 'bills') return false;
    return true;
  });

  const unpaidCount = standaloneBills.filter(b => b.status !== 'paid' && b.status !== 'cancelled').length;
  const unpaidInstCount = installments.length;
  const unpaidTotal = [...standaloneBills, ...instBills].filter(b => b.status !== 'paid' && b.status !== 'cancelled').reduce((s, b) => s + b.amount, 0);

  async function markPaid(billId) {
    if (payingIds.current.has(billId)) return;
    payingIds.current.add(billId); // acquire before first await
    const bill = await db.bills.get(billId);
    if (!bill || bill.status === 'paid' || bill.status === 'cancelled') {
      payingIds.current.delete(billId);
      return;
    }
    await db.bills.update(billId, {
      status: 'paid',
      paid_date: new Date().toISOString(),
      paid_amount: bill.amount,
    });
    payingIds.current.delete(billId);
  }

  const tabs = [
    { key: 'all', label: 'All', count: unpaidCount + unpaidInstCount },
    { key: 'bills', label: 'Bills', count: unpaidCount },
    { key: 'installments', label: 'Plans', count: installments.length },
  ];

  const statusChips = [
    { key: 'all', label: 'All', count: '' },
    { key: 'upcoming', label: 'Upcoming', count: standaloneBills.filter(b => b.status === 'upcoming').length },
    { key: 'overdue', label: 'Overdue', count: standaloneBills.filter(b => b.status === 'overdue').length },
    { key: 'paid', label: 'Paid', count: standaloneBills.filter(b => b.status === 'paid').length },
  ];

  const sortedBills = [...filteredBills].sort((a, b) => {
    const order = { overdue: 0, upcoming: 1, paid: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return new Date(a.due_date) - new Date(b.due_date);
  });

  return (
    <div style={{ padding: '6px 20px 124px' }}>
      <div style={{ margin: '4px 0 16px' }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#15271f', letterSpacing: '-.5px' }}>Payments</div>
        <div style={{ fontSize: 13, color: '#8d968f', fontWeight: 500, marginTop: 2 }}>
          {standaloneBills.filter(b => b.status !== 'paid').length + instBills.filter(b => b.status !== 'paid').length} unpaid · {baht(unpaidTotal)} to pay
        </div>
      </div>

      {/* Tab selector */}
      <div style={{ display: 'flex', gap: 6, background: '#eceee9', padding: 5, borderRadius: 16, marginBottom: 16 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontSize: 12.5, fontWeight: 700, padding: '10px 4px', borderRadius: 12,
            background: tab === t.key ? '#fff' : 'transparent',
            color: tab === t.key ? '#15271f' : '#8d968f',
            boxShadow: tab === t.key ? '0 2px 8px -4px rgba(20,40,30,.2)' : 'none',
          }}>
            {t.label}
            <span style={{
              minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
              fontSize: 10.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: tab === t.key ? '#15271f' : '#e0e3de',
              color: tab === t.key ? '#fff' : '#8d968f',
            }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Status chips (only for bills) */}
      {tab !== 'installments' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto' }}>
          {statusChips.map(sc => (
            <button key={sc.key} onClick={() => setStatusFilter(sc.key)} style={{
              flexShrink: 0, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 12,
              background: statusFilter === sc.key ? '#15271f' : '#fff',
              color: statusFilter === sc.key ? '#fff' : '#6b746e',
              boxShadow: '0 8px 20px -18px rgba(20,40,30,.5)', whiteSpace: 'nowrap',
            }}>
              {sc.label}
              {sc.count !== '' && <span style={{ marginLeft: 6, opacity: .55 }}>{sc.count}</span>}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Standalone bills */}
        {sortedBills.map(bill => {
          const w = whenStr(bill.due_date);
          const b = statusBadge(bill.status);
          const notPaid = bill.status !== 'paid' && bill.status !== 'cancelled';
          return (
            <div key={bill.id} style={{ background: '#fff', borderRadius: 20, padding: 15, boxShadow: '0 12px 30px -26px rgba(20,40,30,.4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ width: 46, height: 46, borderRadius: 14, background: bill.tile, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{bill.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: '#15271f' }}>{bill.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: bill.status === 'paid' ? '#0caa78' : w.color, marginTop: 2 }}>
                    {bill.status === 'paid' ? `Paid · ${formatDate(bill.paid_date)}` : w.text}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 15.5, fontWeight: 800, color: '#15271f' }}>{baht(bill.paid_amount || bill.amount)}</div>
                  <div style={{ display: 'inline-block', marginTop: 4, fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: b.bg, color: b.color }}>{b.label}</div>
                </div>
              </div>
              {notPaid && (
                <button onClick={() => markPaid(bill.id)} style={{
                  width: '100%', marginTop: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 13, fontWeight: 700, color: '#fff', background: '#0caa78',
                  padding: 12, borderRadius: 13,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  Mark as paid
                </button>
              )}
            </div>
          );
        })}

        {/* Installment cards */}
        {tab !== 'bills' && filteredInst.map(inst => {
          const instBillsForThis = instBills.filter(b => b.installment_id === inst.id);
          const totalPer = instBillsForThis.length;
          const paid = instBillsForThis.filter(b => b.status === 'paid').length;
          const totalAmt = inst.segments.reduce((s, sg) => s + sg.amount_per_period * sg.periods, 0);
          const paidAmt = instBillsForThis.filter(b => b.status === 'paid').reduce((s, b) => s + (b.paid_amount || b.amount), 0);
          const nextBill = instBillsForThis.find(b => b.status !== 'paid' && b.status !== 'cancelled');
          const done = paid >= totalPer;
          const hasOverdue = instBillsForThis.some(b => b.status === 'overdue');
          const badgeStatus = done ? 'paid' : hasOverdue ? 'overdue' : 'upcoming';
          const badge = statusBadge(badgeStatus);
          const pct = totalPer > 0 ? Math.round(paid / totalPer * 100) + '%' : '0%';
          const nextWhen = nextBill ? whenStr(nextBill.due_date) : null;

          return (
            <div key={inst.id} onClick={() => onOpenPlan(inst.id)} style={{ background: '#fff', borderRadius: 24, padding: 18, boxShadow: '0 16px 36px -28px rgba(20,40,30,.45)', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ width: 48, height: 48, borderRadius: 15, background: inst.tile, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 23 }}>{inst.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#15271f' }}>{inst.name}</div>
                  <div style={{ fontSize: 12.5, color: '#9aa39c', fontWeight: 500, marginTop: 2 }}>
                    {done ? 'Completed' : nextBill ? `Payment ${paid + 1} · due ${formatDate(nextBill.due_date)}` : 'No upcoming'}
                  </div>
                </div>
                <div style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 9, background: badge.bg, color: badge.color }}>{badge.label}</div>
              </div>

              {/* Progress */}
              <div style={{ marginTop: 15 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#15271f' }}>{paid} / {totalPer} payments</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#9aa39c' }}>{baht(paidAmt)} / {baht(totalAmt)}</span>
                </div>
                <div style={{ height: 8, borderRadius: 5, background: '#eef0ec', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: pct, background: '#0caa78', borderRadius: 5 }} />
                </div>
              </div>

              {!done && nextBill && (
                <button onClick={e => { e.stopPropagation(); markPaid(nextBill.id); }} style={{
                  width: '100%', marginTop: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  background: '#e3f3ec', color: '#0caa78', padding: '12px 15px', borderRadius: 13,
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    Mark Payment {paid + 1} paid
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{baht(nextBill.amount)}</span>
                </button>
              )}
            </div>
          );
        })}

        {(tab !== 'bills' ? filteredInst : []).length === 0 && sortedBills.length === 0 && (
          <div style={{ textAlign: 'center', padding: '54px 20px', color: '#aab2ab' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🎉</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Nothing here — you're all caught up</div>
          </div>
        )}
      </div>
    </div>
  );
}
