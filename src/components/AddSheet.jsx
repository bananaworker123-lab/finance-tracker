import { useState, useEffect } from 'react';
import { useLiveQuery } from '../useQuery';
import { db } from '../db';
import { DEFAULT_CATEGORIES, baht, fmt } from '../utils';
import MoneyInput from './MoneyInput';

const TABS = [
  { key: 'income',      label: 'Income' },
  { key: 'expense',     label: 'Expense' },
  { key: 'saving',      label: 'Saving' },
  { key: 'bill',        label: 'Bill' },
  { key: 'installment', label: 'Plan' },
];

export default function AddSheet({ type, onClose }) {
  const [tab, setTab] = useState(type || 'income');

  function switchTab(t) {
    setTab(t);
    setCategory(''); // reset so income category doesn't leak into expense
  }
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');

  // Bill fields
  const [billName, setBillName] = useState('');
  const [dueDate, setDueDate] = useState(nextMonthEndStr());
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);

  // Template management
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [newTplName, setNewTplName] = useState('');
  const [editingTpl, setEditingTpl] = useState(null); // {id, name}

  // Installment fields
  const [instName, setInstName] = useState('');
  const [startMonth, setStartMonth] = useState(currentMonthStr());
  const [dueDay, setDueDay] = useState('15');
  const [segments, setSegments] = useState([]);
  const [addingSegment, setAddingSegment] = useState(false);
  const [draftAmt, setDraftAmt] = useState('');
  const [draftPeriods, setDraftPeriods] = useState('');

  const allCategories = useLiveQuery(() => db.categories.toArray(), [], 'categories') || DEFAULT_CATEGORIES;
  const templates = useLiveQuery(() => db.bill_templates.toArray(), [], 'bill_templates') || [];
  const allBills = useLiveQuery(() => db.bills.toArray(), [], 'bills') || [];

  // template ที่ใช้ไปแล้วเดือนนี้ (ทุก status)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const usedTemplateIds = new Set(
    allBills
      .filter(b => b.template_id && new Date(b.due_date) >= monthStart && new Date(b.due_date) <= monthEnd)
      .map(b => b.template_id)
  );
  const availableTemplates = templates.filter(t => !usedTemplateIds.has(t.id));
  const categories = (() => {
    if (tab === 'income')      return allCategories.filter(c => c.type === 'income');
    if (tab === 'expense')     return allCategories.filter(c => c.type === 'expense' || !c.type);
    if (tab === 'bill')        return allCategories.filter(c => c.type === 'bill' || c.name === 'Shopping');
    if (tab === 'installment') return allCategories.filter(c => c.name === 'Credit Card' || c.name === 'Vehicle' || c.name === 'Shopping');
    return allCategories;
  })();

  async function save() {
    if (tab === 'expense' || tab === 'income') {
      if (!amount || !category) return;
      const meta = categories.find(c => c.name === category) || {};
      await db.transactions.add({
        type: tab,
        amount: parseFloat(amount),
        category,
        emoji: meta.emoji || '💸',
        tile: meta.color || '#eef0ec',
        date: new Date(date).toISOString(),
        note,
      });
    } else if (tab === 'saving') {
      if (!amount) return;
      await db.transactions.add({
        type: 'saving',
        amount: parseFloat(amount),
        category: 'Saving',
        emoji: '🐷',
        tile: '#e0f0ff',
        date: new Date(date).toISOString(),
        note,
      });
    } else if (tab === 'bill') {
      if (!amount || !billName) return;
      const meta = categories.find(c => c.name === category) || {};
      await db.bills.add({
        installment_id: null,
        template_id: selectedTemplateId || null,
        name: billName,
        emoji: meta.emoji || '📋',
        tile: meta.color || '#eef0ec',
        amount: parseFloat(amount),
        due_date: new Date(dueDate).toISOString(),
        category: category || 'Other',
        status: 'upcoming',
        note,
      });
    } else if (tab === 'installment') {
      if (!instName || segments.length === 0) return;
      const meta = categories.find(c => c.name === category) || {};
      const totalInstallments = segments.reduce((s, sg) => s + sg.periods, 0);
      const instId = await db.installments.add({
        name: instName,
        emoji: meta.emoji || '📋',
        tile: meta.color || '#eef0ec',
        start_month: startMonth,
        due_day: parseInt(dueDay),
        category: category || 'Other',
        note,
        segments: segments.map(s => ({ amount_per_period: s.amount, periods: s.periods })),
        total_installments: totalInstallments,
      });
      // Generate bills (month is 0-indexed in Date constructor)
      const [sy, sm] = startMonth.split('-').map(Number);
      let mi = sm - 1, yr = sy, idx = 0;
      const billRows = [];
      const now = new Date();
      for (const seg of segments) {
        for (let k = 0; k < seg.periods; k++) {
          idx++;
          const dDate = new Date(yr, mi, parseInt(dueDay));
          billRows.push({
            installment_id: instId,
            name: `${instName} · Payment ${idx}`,
            emoji: meta.emoji || '📋',
            tile: meta.color || '#eef0ec',
            amount: seg.amount,
            due_date: dDate.toISOString(),
            category: category || 'Other',
            status: dDate < now ? 'overdue' : 'upcoming',
            note: '',
            installment_index: idx,
          });
          mi++;
          if (mi > 11) { mi = 0; yr++; }
        }
      }
      await db.bills.addBatch(billRows);
    }
    onClose();
  }

  function addSegment() {
    const a = parseFloat(draftAmt);
    const p = parseInt(draftPeriods);
    if (!a || !p || p < 1) return;
    setSegments(prev => [...prev, { amount: a, periods: p }]);
    setDraftAmt('');
    setDraftPeriods('');
    setAddingSegment(false);
  }

  const segTotal = segments.reduce((s, sg) => s + sg.periods, 0);
  const segTotalAmt = segments.reduce((s, sg) => s + sg.amount * sg.periods, 0);
  const draftTotal = parseFloat(draftAmt || 0) * parseInt(draftPeriods || 0);

  const saveLabel = tab === 'expense' ? 'Add Expense' : tab === 'income' ? 'Add Income' : tab === 'saving' ? 'Add Saving' : tab === 'bill' ? 'Add Bill' : 'Create Plan';

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} className="overlay-enter" style={{
        position: 'absolute', inset: 0, background: 'rgba(15,28,22,.42)', zIndex: 40,
      }} />

      {/* Sheet */}
      <div className="sheet-enter" style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '90%',
        background: '#f4f3ef', borderRadius: '30px 30px 0 0', zIndex: 41,
        padding: '14px 20px 28px', overflowY: 'auto',
        boxShadow: '0 -20px 50px -20px rgba(15,28,22,.4)',
      }}>
        <div style={{ width: 42, height: 5, borderRadius: 3, background: '#d3d8d1', margin: '0 auto 14px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 19, fontWeight: 800, color: '#15271f' }}>
            {tab === 'expense' ? 'Add Expense' : tab === 'income' ? 'Add Income' : tab === 'bill' ? 'Add Bill' : 'New Plan'}
          </span>
          <button onClick={onClose} style={{ border: 'none', cursor: 'pointer', width: 34, height: 34, borderRadius: 11, background: '#e7e9e4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5d7167" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 5, background: '#e7e9e4', padding: 5, borderRadius: 15, marginBottom: 18 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => switchTab(t.key)} style={{
              flex: 1, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12.5, fontWeight: 700, padding: '9px 4px', borderRadius: 11,
              background: tab === t.key ? '#fff' : 'transparent',
              color: tab === t.key ? '#15271f' : '#8d968f',
              boxShadow: tab === t.key ? '0 2px 6px -3px rgba(20,40,30,.2)' : 'none',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Amount (expense/income/bill) */}
        {tab !== 'installment' && (
          <div style={{ textAlign: 'center', padding: '8px 0 18px' }}>
            <div style={{ fontSize: 12.5, color: '#8d968f', fontWeight: 600 }}>Amount (THB)</div>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <span style={{ fontSize: 44, fontWeight: 800, color: '#15271f', letterSpacing: -1 }}>฿</span>
              <MoneyInput
                value={amount}
                onChange={setAmount}
                placeholder="0"
                style={{
                  fontSize: 44, fontWeight: 800, color: '#15271f', letterSpacing: -1,
                  border: 'none', outline: 'none', background: 'none', width: 180,
                  fontFamily: 'inherit', textAlign: 'left',
                }}
              />
            </div>
          </div>
        )}

        {/* Expense / Income form */}
        {(tab === 'expense' || tab === 'income') && (
          <div>
            <CategoryGrid categories={categories} selected={category} onSelect={setCategory} />
            <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden' }}>
              <Row label="Date">
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, color: '#15271f', background: 'none', textAlign: 'right' }} />
              </Row>
              <Row label="Note" last>
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional"
                  style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 13.5, color: '#aab2ab', background: 'none', textAlign: 'right', width: '100%' }} />
              </Row>
            </div>
          </div>
        )}

        {/* Saving form */}
        {tab === 'saving' && (
          <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden' }}>
            <Row label="Date">
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, color: '#15271f', background: 'none', textAlign: 'right' }} />
            </Row>
            <Row label="Note" last>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional"
                style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 13.5, color: '#aab2ab', background: 'none', textAlign: 'right', width: '100%' }} />
            </Row>
          </div>
        )}

        {/* Bill form */}
        {tab === 'bill' && (
          <div>
            {/* Template picker */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#15271f' }}>รายการประจำ</span>
                <button onClick={() => { setShowAddTemplate(t => !t); setNewTplName(''); }} style={{
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 12, fontWeight: 700, color: '#0caa78', background: '#e3f3ec',
                  padding: '5px 11px', borderRadius: 10,
                }}>+ เพิ่มรายการ</button>
              </div>

              {/* Add template form */}
              {showAddTemplate && (
                <div style={{ background: '#fff', borderRadius: 14, padding: '13px 14px', marginBottom: 10, display: 'flex', gap: 8 }}>
                  <input value={newTplName} onChange={e => setNewTplName(e.target.value)}
                    placeholder="ชื่อรายการ เช่น Visa KBank"
                    style={{ flex: 1, border: '1.5px solid #e3e6e0', borderRadius: 10, padding: '8px 12px', fontFamily: 'inherit', fontSize: 13.5, outline: 'none', color: '#15271f' }} />
                  <button onClick={async () => {
                    if (!newTplName.trim()) return;
                    await db.bill_templates.add({ name: newTplName.trim(), emoji: '📋', tile: '#eef0ec', category: 'Other' });
                    setNewTplName(''); setShowAddTemplate(false);
                  }} style={{
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 13, fontWeight: 700, color: '#fff', background: '#0caa78',
                    padding: '8px 14px', borderRadius: 10,
                  }}>บันทึก</button>
                </div>
              )}

              {/* Template list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {templates.length === 0 && (
                  <div style={{ fontSize: 12.5, color: '#aab2ab', textAlign: 'center', padding: '10px 0' }}>ยังไม่มีรายการ กด + เพิ่มรายการ</div>
                )}
                {templates.map(tpl => {
                  const used = usedTemplateIds.has(tpl.id);
                  const selected = selectedTemplateId === tpl.id;
                  const isEditing = editingTpl?.id === tpl.id;
                  return (
                    <div key={tpl.id} style={{
                      background: selected ? '#e3f3ec' : used ? '#f7f7f5' : '#fff',
                      borderRadius: 13, padding: '11px 13px',
                      border: selected ? '1.5px solid #0caa78' : '1.5px solid transparent',
                      opacity: used ? 0.5 : 1,
                    }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input value={editingTpl.name} onChange={e => setEditingTpl(p => ({ ...p, name: e.target.value }))}
                            style={{ flex: 1, border: '1.5px solid #0caa78', borderRadius: 9, padding: '6px 10px', fontFamily: 'inherit', fontSize: 13.5, outline: 'none', color: '#15271f' }} />
                          <button onClick={async () => {
                            if (!editingTpl.name.trim()) return;
                            await db.bill_templates.update(editingTpl.id, { name: editingTpl.name.trim() });
                            setEditingTpl(null);
                          }} style={{ border: 'none', cursor: 'pointer', background: '#0caa78', color: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 9 }}>บันทึก</button>
                          <button onClick={() => setEditingTpl(null)} style={{ border: 'none', cursor: 'pointer', background: '#eef0ec', color: '#5d7167', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, padding: '6px 10px', borderRadius: 9 }}>ยกเลิก</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <button onClick={() => {
                            if (used) return;
                            if (selected) { setSelectedTemplateId(null); setBillName(''); setCategory(''); return; }
                            setSelectedTemplateId(tpl.id);
                            setBillName(tpl.name);
                            setCategory(tpl.category || '');
                          }} style={{ flex: 1, border: 'none', background: 'none', cursor: used ? 'default' : 'pointer', textAlign: 'left', padding: 0, fontFamily: 'inherit' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                              <span style={{ fontSize: 18 }}>{tpl.emoji || '📋'}</span>
                              <span style={{ fontSize: 13.5, fontWeight: 700, color: used ? '#aab2ab' : '#15271f' }}>{tpl.name}</span>
                              {used && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#aab2ab', background: '#f0f0ee', padding: '2px 7px', borderRadius: 7 }}>ใช้แล้วเดือนนี้</span>}
                              {selected && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#0caa78' }}>✓ เลือกแล้ว</span>}
                            </div>
                          </button>
                          {/* Edit / Delete — layout เหมือน History */}
                          <button onClick={() => setEditingTpl({ id: tpl.id, name: tpl.name })} style={{
                            border: 'none', cursor: 'pointer', width: 30, height: 30, borderRadius: 9,
                            background: '#f4f3ef', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5d7167" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
                          </button>
                          <button onClick={() => db.bill_templates.delete(tpl.id)} style={{
                            border: 'none', cursor: 'pointer', width: 30, height: 30, borderRadius: 9,
                            background: '#fef2f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e0564f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <CategoryGrid categories={categories} selected={category} onSelect={setCategory} />
            <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden' }}>
              <Row label="Bill name">
                <input value={billName} onChange={e => setBillName(e.target.value)} placeholder="e.g. Internet"
                  style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, color: '#15271f', background: 'none', textAlign: 'right', width: '100%' }} />
              </Row>
              <Row label="Due date">
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, color: '#15271f', background: 'none', textAlign: 'right' }} />
              </Row>
              <Row label="Note" last>
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional"
                  style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 13.5, color: '#aab2ab', background: 'none', textAlign: 'right', width: '100%' }} />
              </Row>
            </div>
          </div>
        )}

        {/* Installment builder */}
        {tab === 'installment' && (
          <div>
            <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
              <Row label="Plan name">
                <input value={instName} onChange={e => setInstName(e.target.value)} placeholder="e.g. iPhone 16"
                  style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, color: '#15271f', background: 'none', textAlign: 'right', width: '100%' }} />
              </Row>
              <Row label="Start month">
                <input type="month" value={startMonth} onChange={e => setStartMonth(e.target.value)}
                  style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, color: '#15271f', background: 'none', textAlign: 'right' }} />
              </Row>
              <Row label="Due day" last>
                <input type="number" value={dueDay} onChange={e => setDueDay(e.target.value)} min="1" max="31"
                  style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, color: '#15271f', background: 'none', textAlign: 'right', width: 60 }} />
              </Row>
            </div>

            <CategoryGrid categories={categories} selected={category} onSelect={setCategory} />

            {/* Segments */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#15271f' }}>Payment segments</span>
              <button onClick={() => setAddingSegment(true)} style={{
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 12, fontWeight: 700, color: '#0caa78', background: '#e3f3ec', padding: '6px 12px', borderRadius: 10,
              }}>+ Add segment</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {segments.map((sg, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 14, padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 8px 22px -24px rgba(20,40,30,.4)' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 10, background: '#e3f3ec', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#0caa78' }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#15271f' }}>{baht(sg.amount)} <span style={{ fontSize: 12, color: '#9aa39c', fontWeight: 500 }}>/ payment</span></div>
                    <div style={{ fontSize: 12, color: '#9aa39c', fontWeight: 500, marginTop: 1 }}>{sg.periods} payment{sg.periods !== 1 ? 's' : ''}</div>
                  </div>
                  <button onClick={() => setSegments(prev => prev.filter((_, j) => j !== i))} style={{ border: 'none', cursor: 'pointer', width: 28, height: 28, borderRadius: 9, background: '#f7eceb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e0564f" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14"/></svg>
                  </button>
                </div>
              ))}
            </div>

            {addingSegment && (
              <div style={{ marginTop: 11, background: '#fff', border: '1.5px solid #cdeede', borderRadius: 18, padding: '17px 18px', boxShadow: '0 14px 32px -24px rgba(12,170,120,.5)' }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#15271f', marginBottom: 16 }}>New segment</div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: '#8d968f', fontWeight: 600, marginBottom: 7 }}>Amount / payment (THB)</div>
                  <MoneyInput value={draftAmt} onChange={setDraftAmt} placeholder="0"
                    style={{ width: '100%', border: '1.5px solid #e3e6e0', borderRadius: 12, padding: '13px 15px', fontFamily: 'inherit', fontSize: 17, fontWeight: 800, color: '#15271f', background: '#fafbf9', outline: 'none' }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: '#8d968f', fontWeight: 600, marginBottom: 7 }}>Number of payments</div>
                  <input type="number" value={draftPeriods} onChange={e => setDraftPeriods(e.target.value)} placeholder="0"
                    style={{ width: '100%', border: '1.5px solid #e3e6e0', borderRadius: 12, padding: '13px 15px', fontFamily: 'inherit', fontSize: 17, fontWeight: 800, color: '#15271f', background: '#fafbf9', outline: 'none' }} />
                </div>
                <div style={{ fontSize: 12.5, color: '#0caa78', fontWeight: 700, padding: '11px 0 14px', borderTop: '1px solid #eef0ec' }}>
                  Segment total · {draftTotal > 0 ? baht(draftTotal) : '฿0'}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setAddingSegment(false); setDraftAmt(''); setDraftPeriods(''); }} style={{ flex: 1, border: '1.5px solid #e3e6e0', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, color: '#6b746e', background: '#fff', padding: 12, borderRadius: 13 }}>Cancel</button>
                  <button onClick={addSegment} style={{ flex: 2, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, color: '#fff', background: '#0caa78', padding: 12, borderRadius: 13 }}>Add segment</button>
                </div>
              </div>
            )}

            {segments.length > 0 && (
              <div style={{ marginTop: 16, background: 'linear-gradient(135deg,#15271f,#1d4036)', borderRadius: 18, padding: '17px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#9fb3a7', fontWeight: 600 }}>Auto-generated</div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 3 }}>{segTotal} payments</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: '#9fb3a7', fontWeight: 600 }}>Total amount</div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 3 }}>{baht(segTotalAmt)}</div>
                </div>
              </div>
            )}
          </div>
        )}

        <button onClick={save} style={{
          width: '100%', marginTop: 20, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 15, fontWeight: 700, color: '#fff', background: '#0caa78',
          padding: 16, borderRadius: 18, boxShadow: '0 14px 28px -14px rgba(12,170,120,.7)',
        }}>
          {saveLabel}
        </button>
      </div>
    </>
  );
}

function CategoryGrid({ categories, selected, onSelect }) {
  return (
    <>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#15271f', marginBottom: 10 }}>Category</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {categories.map(cat => (
          <div key={cat.name} onClick={() => onSelect(cat.name)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <div style={{
              width: '100%', aspectRatio: 1, borderRadius: 16,
              background: cat.color || cat.tile,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
              border: selected === cat.name ? '2px solid #0caa78' : '2px solid transparent',
              boxSizing: 'border-box',
            }}>{cat.emoji}</div>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: selected === cat.name ? '#0caa78' : '#5d7167' }}>{cat.name}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function Row({ label, children, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderBottom: last ? 'none' : '1px solid #eef0ec' }}>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: '#5d7167', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>{children}</div>
    </div>
  );
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}
function nextMonthEndStr() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return d.toISOString().split('T')[0];
}
function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`;
}
