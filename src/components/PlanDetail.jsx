import { useRef, useState } from 'react';
import { useLiveQuery } from '../useQuery';
import { db } from '../db';
import { baht, formatDate, statusBadge } from '../utils';

export default function PlanDetail({ planId, onBack }) {
  const paying = useRef(false);
  const [editingId, setEditingId] = useState(null);
  const [editingAmount, setEditingAmount] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);

  const inst = useLiveQuery(() => db.installments.get(planId), [planId], 'installments');
  const allBills = useLiveQuery(() =>
    db.bills.where('installment_id').equals(planId).sortBy('installment_index'), [planId], 'bills');

  if (!inst || !allBills) return <div style={{ padding: 40, color: '#8d968f', textAlign: 'center' }}>Loading...</div>;

  const paid = allBills.filter(b => b.status === 'paid').length;
  const totalPer = allBills.length;
  const totalAmt = allBills.reduce((s, b) => s + b.amount, 0);
  const paidAmt = allBills.filter(b => b.status === 'paid').reduce((s, b) => s + (b.paid_amount || b.amount), 0);
  const nextBill = allBills.find(b => b.status !== 'paid' && b.status !== 'cancelled');
  const pct = totalPer > 0 ? Math.round(paid / totalPer * 100) + '%' : '0%';
  const done = allBills.every(b => b.status === 'paid');

  async function markNextPaid() {
    if (!nextBill) return;
    if (paying.current) return;
    paying.current = true;
    await db.bills.update(nextBill.id, {
      status: 'paid',
      paid_date: new Date().toISOString(),
      paid_amount: nextBill.amount,
    });
    paying.current = false;
  }

  async function undoPaid(bill) {
    const isOverdue = new Date(bill.due_date) < new Date();
    await db.bills.update(bill.id, {
      status: isOverdue ? 'overdue' : 'upcoming',
      paid_date: null,
      paid_amount: null,
    });
  }

  function startEdit(bill) {
    setEditingId(bill.id);
    setEditingAmount(String(bill.amount));
  }

  async function saveAmount(bill) {
    const newAmt = parseFloat(editingAmount);
    if (!newAmt || newAmt <= 0) { setEditingId(null); return; }
    const update = { amount: newAmt };
    if (bill.status === 'paid') update.paid_amount = newAmt;
    await db.bills.update(bill.id, update);
    setEditingId(null);
  }

  async function deleteBill(bill) {
    if (bill.status === 'paid') return;
    await db.bills.delete(bill.id);
    const remaining = await db.bills
      .where('installment_id').equals(planId)
      .sortBy('installment_index');
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].installment_index !== i + 1)
        await db.bills.update(remaining[i].id, { installment_index: i + 1 });
    }
    await db.installments.update(planId, { total_installments: remaining.length });
  }

  async function addPeriod() {
    const lastBill = allBills[allBills.length - 1];
    const lastDue = new Date(lastBill.due_date);
    const newDue = new Date(lastDue.getFullYear(), lastDue.getMonth() + 1, lastDue.getDate());
    const newIndex = allBills.length + 1;
    await db.bills.add({
      installment_id: planId,
      name: `${inst.name} · งวดที่ ${newIndex}`,
      emoji: inst.emoji,
      tile: inst.tile,
      amount: lastBill.amount,
      due_date: newDue.toISOString(),
      category: inst.category,
      status: newDue < new Date() ? 'overdue' : 'upcoming',
      paid_date: null,
      paid_amount: null,
      note: '',
      installment_index: newIndex,
    });
    await db.installments.update(planId, { total_installments: newIndex });
  }

  async function closeEarlyAsPaid() {
    const now = new Date().toISOString();
    const remaining = allBills.filter(b => b.status !== 'paid');
    for (const b of remaining) {
      await db.bills.update(b.id, { status: 'paid', paid_date: now, paid_amount: b.amount });
    }
    setConfirmClose(false);
  }

  const dotColor = (status) => {
    if (status === 'paid') return '#0caa78';
    if (status === 'overdue') return '#e0564f';
    if (status === 'cancelled') return '#d0d4ce';
    return '#e8a13a';
  };

  const hasMultiSegs = inst.segments.length > 1;
  let segIdx = 0;
  const legend = inst.segments.map((sg) => {
    const from = segIdx + 1;
    segIdx += sg.periods;
    return { range: `Payments ${from}–${segIdx}`, amountStr: baht(sg.amount_per_period) };
  });

  return (
    <div style={{ padding: '6px 20px 124px' }}>
      {/* Back + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '4px 0 18px' }}>
        <button onClick={onBack} style={{
          border: 'none', cursor: 'pointer', width: 40, height: 40, borderRadius: 13,
          background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 20px -16px rgba(20,40,30,.4)',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#15271f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#15271f' }}>Plan details</span>
      </div>

      {/* Summary card */}
      <div style={{ background: '#fff', borderRadius: 26, padding: 22, boxShadow: '0 18px 40px -28px rgba(20,40,30,.45)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 54, height: 54, borderRadius: 17, background: inst.tile, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{inst.emoji}</div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: '#15271f' }}>{inst.name}</div>
            <div style={{ fontSize: 12.5, color: '#9aa39c', fontWeight: 500, marginTop: 2 }}>Installment plan</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', margin: '18px 0 8px' }}>
          <div>
            <div style={{ fontSize: 12, color: '#8d968f', fontWeight: 600 }}>Paid so far</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#15271f', letterSpacing: '-.5px' }}>{baht(paidAmt)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: '#8d968f', fontWeight: 600 }}>Total</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#9aa39c' }}>{baht(totalAmt)}</div>
          </div>
        </div>
        <div style={{ height: 9, borderRadius: 6, background: '#eef0ec', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: pct, background: '#0caa78', borderRadius: 6, transition: 'width .4s ease' }} />
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0caa78', marginTop: 9 }}>
          {paid} / {totalPer} payments completed
        </div>
      </div>

      {/* Pay next button */}
      {!done && nextBill && (
        <button onClick={markNextPaid} style={{
          width: '100%', marginTop: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#0caa78', color: '#fff', padding: '15px 18px', borderRadius: 18,
          boxShadow: '0 14px 30px -14px rgba(12,170,120,.7)',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, fontWeight: 700 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            Mark Payment {paid + 1} paid
          </span>
          <span style={{ fontSize: 15, fontWeight: 800 }}>{baht(nextBill.amount)}</span>
        </button>
      )}

      {/* Tiers legend */}
      {hasMultiSegs && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#15271f', marginBottom: 9 }}>Payment tiers</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {legend.map((lg, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderRadius: 14, padding: '11px 15px', boxShadow: '0 8px 22px -22px rgba(20,40,30,.4)' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#5d7167' }}>{lg.range}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#15271f' }}>{lg.amountStr}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment schedule */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '20px 0 10px' }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: '#15271f' }}>Payment schedule</span>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: '#9aa39c' }}>tap row to edit</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {allBills.map(r => {
          const b = statusBadge(r.status);
          const isPaid = r.status === 'paid';
          const isEditing = editingId === r.id;

          return (
            <div key={r.id} style={{ background: '#fff', borderRadius: 16, padding: '13px 15px', boxShadow: '0 8px 22px -24px rgba(20,40,30,.4)' }}>
              {/* Main row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: dotColor(r.status), flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#15271f' }}>Payment {r.installment_index}</div>
                  <div style={{ fontSize: 12, color: '#9aa39c', fontWeight: 500, marginTop: 1 }}>
                    {isPaid ? `Paid · ${formatDate(r.paid_date)}` : formatDate(r.due_date)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#15271f' }}>{baht(r.paid_amount || r.amount)}</div>
                    <div style={{ display: 'inline-block', marginTop: 3, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 7, background: b.bg, color: b.color }}>{b.label}</div>
                  </div>

                  {/* Action buttons */}
                  {isPaid ? (
                    // Undo paid
                    <button onClick={() => undoPaid(r)} title="Undo paid" style={{
                      border: 'none', cursor: 'pointer', width: 30, height: 30, borderRadius: 9,
                      background: '#f0faf6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0caa78" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 7v6h6"/><path d="M3 13A9 9 0 1 0 5.17 6.5"/>
                      </svg>
                    </button>
                  ) : (
                    // Edit amount + delete
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <button onClick={() => startEdit(r)} title="Edit amount" style={{
                        border: 'none', cursor: 'pointer', width: 30, height: 30, borderRadius: 9,
                        background: '#f4f3ef', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5d7167" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/>
                        </svg>
                      </button>
                      <button onClick={() => deleteBill(r)} title="Delete period" style={{
                        border: 'none', cursor: 'pointer', width: 30, height: 30, borderRadius: 9,
                        background: '#fef2f1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e0564f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6 6 18M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Inline amount editor */}
              {isEditing && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid #f0f2ef' }}>
                  <input
                    type="number"
                    value={editingAmount}
                    onChange={e => setEditingAmount(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveAmount(r)}
                    autoFocus
                    placeholder="New amount"
                    style={{
                      flex: 1, border: '1.5px solid #0caa78', borderRadius: 10, padding: '8px 12px',
                      fontSize: 15, fontWeight: 700, fontFamily: 'inherit', outline: 'none', color: '#15271f',
                    }}
                  />
                  <button onClick={() => saveAmount(r)} style={{
                    border: 'none', cursor: 'pointer', background: '#0caa78', color: '#fff',
                    padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                  }}>Save</button>
                  <button onClick={() => setEditingId(null)} style={{
                    border: 'none', cursor: 'pointer', background: '#f0f2ef', color: '#5d7167',
                    padding: '8px 12px', borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                  }}>Cancel</button>
                </div>
              )}
            </div>
          );
        })}

        {/* Add period */}
        <button onClick={addPeriod} style={{
          width: '100%', border: '1.5px dashed #c8cfc7', background: 'transparent',
          color: '#8d968f', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
          padding: 13, borderRadius: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Add period
        </button>
      </div>

      {/* Close plan early → mark all paid */}
      {!done && (
        <button onClick={() => setConfirmClose(true)} style={{
          width: '100%', marginTop: 18, border: '1.5px solid #e6cbc9', background: '#fff',
          color: '#e0564f', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
          padding: 14, borderRadius: 16, cursor: 'pointer',
        }}>
          Close plan early
        </button>
      )}

      {/* Confirm dialog */}
      {confirmClose && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(21,39,31,.55)',
          display: 'flex', alignItems: 'flex-end', zIndex: 100,
        }} onClick={() => setConfirmClose(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', background: '#fff', borderRadius: '28px 28px 0 0',
            padding: '28px 24px 36px',
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#15271f', marginBottom: 8 }}>Close plan early?</div>
            <div style={{ fontSize: 13.5, color: '#6b746e', lineHeight: 1.6, marginBottom: 24 }}>
              งวดที่เหลือทั้งหมดจะถูกบันทึกว่า <strong>Paid</strong> ด้วยยอดเต็ม<br/>
              การดำเนินการนี้ไม่สามารถยกเลิกได้
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmClose(false)} style={{
                flex: 1, border: '1.5px solid #dde0db', background: '#fff',
                color: '#5d7167', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                padding: 14, borderRadius: 14, cursor: 'pointer',
              }}>ยกเลิก</button>
              <button onClick={closeEarlyAsPaid} style={{
                flex: 1, border: 'none', background: '#0caa78',
                color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                padding: 14, borderRadius: 14, cursor: 'pointer',
              }}>Mark all paid</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
