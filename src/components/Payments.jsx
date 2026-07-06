import { useState, useRef } from 'react';
import { useLiveQuery } from '../useQuery';
import { db } from '../db';
import { baht, whenStr, statusBadge, formatDate, formatShortDate, DEFAULT_CATEGORIES } from '../utils';
import MoneyInput from './MoneyInput';

export default function Payments({ onOpenPlan, onOpenAdd }) {
  const [tab, setTab] = useState('all'); // all | bills | installments
  const [statusFilter, setStatusFilter] = useState('all'); // all | upcoming | overdue | paid
  const payingIds = useRef(new Set());
  const [editBill, setEditBill] = useState(null);
  const [deleteBillId, setDeleteBillId] = useState(null);

  const bills = useLiveQuery(() => db.bills.toArray(), [], 'bills');
  const installments = useLiveQuery(() => db.installments.toArray(), [], 'installments');
  const allCategories = useLiveQuery(() => db.categories.toArray(), [], 'categories') || DEFAULT_CATEGORIES;
  const billCategories = allCategories.filter(c => c.type === 'bill');

  if (!bills || !installments) return <div style={{ padding: 40, color: '#8d968f', textAlign: 'center' }}>Loading...</div>;

  const standaloneBills = bills.filter(b => !b.installment_id);
  const instBills = bills.filter(b => b.installment_id);

  const filteredBills = standaloneBills.filter(b => {
    if (tab === 'installments') return false;
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    return true;
  });

  const filteredInst = installments.filter(inst => {
    if (tab === 'bills') return false;
    if (statusFilter !== 'all') {
      const ib = instBills.filter(b => b.installment_id === inst.id);
      const paid = ib.filter(b => b.status === 'paid').length;
      const done = ib.length > 0 && paid >= ib.length;
      const hasOverdue = ib.some(b => b.status === 'overdue');
      const s = done ? 'paid' : hasOverdue ? 'overdue' : 'upcoming';
      if (s !== statusFilter) return false;
    }
    return true;
  });

  const unpaidCount = standaloneBills.filter(b => b.status !== 'paid' && b.status !== 'cancelled').length;
  const unpaidInstCount = installments.filter(inst =>
    instBills.filter(b => b.installment_id === inst.id).some(b => b.status !== 'paid' && b.status !== 'cancelled')
  ).length;
  const unpaidTotal = [...standaloneBills, ...instBills].filter(b => b.status !== 'paid' && b.status !== 'cancelled').reduce((s, b) => s + b.amount, 0);

  async function saveEditBill() {
    const amt = parseFloat(editBill.amount);
    if (!amt || amt <= 0) return;
    await db.bills.update(editBill.id, {
      amount: amt,
      name: editBill.name,
      due_date: new Date(editBill.due_date).toISOString(),
      emoji: editBill.emoji,
      tile: editBill.tile,
      category: editBill.category,
    });
    setEditBill(null);
  }

  async function confirmDeleteBill() {
    await db.bills.delete(deleteBillId);
    setDeleteBillId(null);
  }

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
    { key: 'installments', label: 'Plans', count: unpaidInstCount },
  ];

  // คำนวณ status ของแต่ละ installment plan
  const instStatusCounts = { upcoming: 0, overdue: 0, paid: 0 };
  if (tab !== 'bills') {
    installments.forEach(inst => {
      const ib = instBills.filter(b => b.installment_id === inst.id);
      const paid = ib.filter(b => b.status === 'paid').length;
      const done = ib.length > 0 && paid >= ib.length;
      const hasOverdue = ib.some(b => b.status === 'overdue');
      const s = done ? 'paid' : hasOverdue ? 'overdue' : 'upcoming';
      instStatusCounts[s]++;
    });
  }

  const billCount = (s) => tab === 'installments' ? 0 : standaloneBills.filter(b => b.status === s).length;
  const instCount = (s) => tab === 'bills' ? 0 : instStatusCounts[s];

  const statusChips = [
    { key: 'all', label: 'All', count: '' },
    { key: 'upcoming', label: 'Upcoming', count: billCount('upcoming') + instCount('upcoming') },
    { key: 'overdue', label: 'Overdue', count: billCount('overdue') + instCount('overdue') },
    { key: 'paid', label: 'Paid', count: billCount('paid') + instCount('paid') },
  ];

  const sortedBills = [...filteredBills].sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  const getInstNextBill = (inst) =>
    instBills.filter(b2 => b2.installment_id === inst.id && b2.status !== 'paid' && b2.status !== 'cancelled')
      .sort((x, y) => new Date(x.due_date) - new Date(y.due_date))[0];

  const sortedInst = [...filteredInst].sort((a, b) => {
    const nextA = getInstNextBill(a);
    const nextB = getInstNextBill(b);
    if (!nextA && !nextB) return 0;
    if (!nextA) return 1;
    if (!nextB) return -1;
    return new Date(nextA.due_date) - new Date(nextB.due_date);
  });

  // รวม bills + plans เรียงตามวันที่ใกล้สุด (ใช้เฉพาะ tab All)
  const mergedSorted = tab !== 'all' ? null : (() => {
    const billItems = sortedBills.map(b => ({ kind: 'bill', sortDate: new Date(b.due_date), data: b }));
    const instItems = sortedInst.map(inst => {
      const next = getInstNextBill(inst);
      return { kind: 'inst', sortDate: next ? new Date(next.due_date) : new Date('9999-01-01'), data: inst };
    });
    return [...billItems, ...instItems].sort((a, b) => a.sortDate - b.sortDate);
  })();

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
          <button key={t.key} onClick={() => { setTab(t.key); if (t.key === 'installments') setStatusFilter('all'); }} style={{
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
        {/* All tab: merged & sorted by date */}
        {tab === 'all' && mergedSorted.map(item =>
          item.kind === 'bill'
            ? <BillCard key={'b_' + item.data.id} bill={item.data} onEdit={b => setEditBill(b)} onDelete={id => setDeleteBillId(id)} onMarkPaid={markPaid} />
            : <InstCard key={'i_' + item.data.id} inst={item.data} instBills={instBills} onOpenPlan={onOpenPlan} onMarkPaid={markPaid} />
        )}

        {/* Bills tab: standalone bills only */}
        {tab === 'bills' && sortedBills.map(bill => (
          <BillCard key={bill.id} bill={bill} onEdit={b => setEditBill(b)} onDelete={id => setDeleteBillId(id)} onMarkPaid={markPaid} />
        ))}

        {/* Plans tab: installments only */}
        {tab === 'installments' && sortedInst.map(inst => (
          <InstCard key={inst.id} inst={inst} instBills={instBills} onOpenPlan={onOpenPlan} onMarkPaid={markPaid} />
        ))}

        {tab === 'all' && mergedSorted.length === 0 && (
          <div style={{ textAlign: 'center', padding: '54px 20px', color: '#aab2ab' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🎉</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Nothing here — you're all caught up</div>
          </div>
        )}
        {tab === 'bills' && sortedBills.length === 0 && (
          <div style={{ textAlign: 'center', padding: '54px 20px', color: '#aab2ab' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🎉</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Nothing here — you're all caught up</div>
          </div>
        )}
        {tab === 'installments' && sortedInst.length === 0 && (
          <div style={{ textAlign: 'center', padding: '54px 20px', color: '#aab2ab' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🎉</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Nothing here — you're all caught up</div>
          </div>
        )}
      </div>

      {/* Edit bill modal */}
      {editBill && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(21,39,31,.55)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}
          onClick={() => setEditBill(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#fff', borderRadius: '28px 28px 0 0', padding: '24px 20px 36px' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#15271f', marginBottom: 18 }}>Edit Bill</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Icon picker */}
              <div>
                <div style={{ fontSize: 12, color: '#8d968f', fontWeight: 600, marginBottom: 8 }}>Icon</div>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                  {billCategories.map(c => (
                    <button key={c.name} onClick={() => setEditBill(p => ({ ...p, emoji: c.emoji, tile: c.color || c.tile, category: c.name }))} style={{
                      flexShrink: 0, border: editBill.emoji === c.emoji ? '2px solid #0caa78' : '2px solid transparent',
                      borderRadius: 13, background: c.color || c.tile, width: 44, height: 44,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, cursor: 'pointer',
                    }}>{c.emoji}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#8d968f', fontWeight: 600, marginBottom: 6 }}>ชื่อ Bill</div>
                <input value={editBill.name} onChange={e => setEditBill(p => ({ ...p, name: e.target.value }))}
                  style={{ width: '100%', border: '1.5px solid #e3e6e0', borderRadius: 12, padding: '12px 14px', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#15271f', outline: 'none' }} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#8d968f', fontWeight: 600, marginBottom: 6 }}>Amount (THB)</div>
                <MoneyInput value={editBill.amount} onChange={v => setEditBill(p => ({ ...p, amount: v }))}
                  style={{ width: '100%', border: '1.5px solid #e3e6e0', borderRadius: 12, padding: '12px 14px', fontFamily: 'inherit', fontSize: 16, fontWeight: 700, color: '#15271f', outline: 'none' }} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#8d968f', fontWeight: 600, marginBottom: 6 }}>Due date</div>
                <input type="date" value={editBill.due_date} onChange={e => setEditBill(p => ({ ...p, due_date: e.target.value }))}
                  style={{ width: '100%', border: '1.5px solid #e3e6e0', borderRadius: 12, padding: '12px 14px', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#15271f', outline: 'none' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setEditBill(null)} style={{ flex: 1, border: '1.5px solid #e3e6e0', background: '#fff', color: '#5d7167', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, padding: 14, borderRadius: 14, cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveEditBill} style={{ flex: 2, border: 'none', background: '#0caa78', color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, padding: 14, borderRadius: 14, cursor: 'pointer' }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteBillId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(21,39,31,.55)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}
          onClick={() => setDeleteBillId(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#fff', borderRadius: '28px 28px 0 0', padding: '24px 20px 36px' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#15271f', marginBottom: 8 }}>Delete Bill?</div>
            <div style={{ fontSize: 13.5, color: '#6b746e', marginBottom: 24 }}>ไม่สามารถกู้คืนได้</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteBillId(null)} style={{ flex: 1, border: '1.5px solid #e3e6e0', background: '#fff', color: '#5d7167', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, padding: 14, borderRadius: 14, cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmDeleteBill} style={{ flex: 1, border: 'none', background: '#e0564f', color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, padding: 14, borderRadius: 14, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BillCard({ bill, onEdit, onDelete, onMarkPaid }) {
  const w = whenStr(bill.due_date);
  const b = statusBadge(bill.status);
  const notPaid = bill.status !== 'paid' && bill.status !== 'cancelled';
  const statusText = bill.status === 'paid'
    ? `Paid · ${formatDate(bill.paid_date)}`
    : w.text.startsWith('Due in') ? w.text.split(' · ')[0]
    : w.text.startsWith('Overdue') || w.text === 'Due today' ? w.text
    : '';
  return (
    <div style={{ background: '#fff', borderRadius: 20, padding: 15, boxShadow: '0 12px 30px -26px rgba(20,40,30,.4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <div style={{ width: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: bill.tile, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{bill.emoji}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b746e', lineHeight: 1, whiteSpace: 'nowrap' }}>{formatShortDate(bill.due_date)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: '#15271f' }}>{bill.name}</div>
          {statusText ? (
            <div style={{ fontSize: 12, fontWeight: 600, color: bill.status === 'paid' ? '#0caa78' : w.color, marginTop: 2 }}>{statusText}</div>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: '#15271f' }}>{baht(bill.paid_amount || bill.amount)}</div>
            <div style={{ display: 'inline-block', marginTop: 4, fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: b.bg, color: b.color }}>{b.label}</div>
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            <button onClick={() => onEdit({ ...bill, due_date: new Date(bill.due_date).toISOString().split('T')[0] })} style={{ border: 'none', cursor: 'pointer', width: 30, height: 30, borderRadius: 9, background: '#f4f3ef', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5d7167" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
            </button>
            <button onClick={() => onDelete(bill.id)} style={{ border: 'none', cursor: 'pointer', width: 30, height: 30, borderRadius: 9, background: '#fef2f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e0564f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
            </button>
          </div>
        </div>
      </div>
      {notPaid && (
        <button onClick={() => onMarkPaid(bill.id)} style={{ width: '100%', marginTop: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: '#fff', background: '#0caa78', padding: 12, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          Mark as paid
        </button>
      )}
    </div>
  );
}

function InstCard({ inst, instBills, onOpenPlan, onMarkPaid }) {
  const instBillsForThis = instBills.filter(b => b.installment_id === inst.id);
  const totalPer = instBillsForThis.length;
  const paid = instBillsForThis.filter(b => b.status === 'paid').length;
  const totalAmt = inst.segments.reduce((s, sg) => s + sg.amount_per_period * sg.periods, 0);
  const paidAmt = instBillsForThis.filter(b => b.status === 'paid').reduce((s, b) => s + (b.paid_amount || b.amount), 0);
  const nextBill = instBillsForThis
    .filter(b => b.status !== 'paid' && b.status !== 'cancelled')
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];
  const done = paid >= totalPer;
  const hasOverdue = instBillsForThis.some(b => b.status === 'overdue');
  const badgeStatus = done ? 'paid' : hasOverdue ? 'overdue' : 'upcoming';
  const badge = statusBadge(badgeStatus);
  const pct = totalPer > 0 ? Math.round(paid / totalPer * 100) + '%' : '0%';

  return (
    <div onClick={() => onOpenPlan(inst.id)} style={{ background: '#fff', borderRadius: 24, padding: 18, boxShadow: '0 16px 36px -28px rgba(20,40,30,.45)', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <div style={{ width: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: inst.tile, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{inst.emoji}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b746e', lineHeight: 1, whiteSpace: 'nowrap' }}>
            {nextBill ? formatShortDate(nextBill.due_date) : done ? '✓' : '—'}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#15271f' }}>{inst.name}</div>
          <div style={{ fontSize: 12, color: '#9aa39c', fontWeight: 500, marginTop: 2 }}>
            {done ? 'Completed' : nextBill ? `Payment ${paid + 1} of ${totalPer}` : 'No upcoming'}
          </div>
        </div>
        <div style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 9, background: badge.bg, color: badge.color }}>{badge.label}</div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#15271f' }}>{paid} / {totalPer} payments</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#9aa39c' }}>{baht(paidAmt)} / {baht(totalAmt)}</span>
        </div>
        <div style={{ height: 8, borderRadius: 5, background: '#eef0ec', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: pct, background: '#0caa78', borderRadius: 5 }} />
        </div>
      </div>

      {!done && nextBill && (
        <button onClick={e => { e.stopPropagation(); onMarkPaid(nextBill.id); }} style={{ width: '100%', marginTop: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: '#e3f3ec', color: '#0caa78', padding: '12px 15px', borderRadius: 13 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            Mark Payment {paid + 1} paid
          </span>
          <span style={{ fontSize: 13, fontWeight: 800 }}>{baht(nextBill.amount)}</span>
        </button>
      )}
    </div>
  );
}
