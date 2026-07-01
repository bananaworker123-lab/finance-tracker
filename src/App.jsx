import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, updateOverdueBills } from './db';
import Dashboard from './components/Dashboard';
import History from './components/History';
import Payments from './components/Payments';
import PlanDetail from './components/PlanDetail';
import Summary from './components/Summary';
import AddSheet from './components/AddSheet';
import BottomNav from './components/BottomNav';

export default function App() {
  const [screen, setScreen] = useState('dashboard'); // dashboard | history | payments | plan | summary
  const [planId, setPlanId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState('expense');

  useEffect(() => { updateOverdueBills(); }, []);

  const go = (s) => setScreen(s);
  const openAdd = (type = 'expense') => { setAddType(type); setAddOpen(true); };
  const closeAdd = () => setAddOpen(false);
  const openPlan = (id) => { setPlanId(id); setScreen('plan'); };

  return (
    <div style={{
      position: 'relative',
      width: 402,
      height: 858,
      background: '#f4f3ef',
      borderRadius: 48,
      boxShadow: '0 40px 90px -30px rgba(20,40,30,.45), 0 0 0 11px #11231c, 0 0 0 13px #2c3b34',
      overflow: 'hidden',
      fontFamily: "'Plus Jakarta Sans','Noto Sans Thai',sans-serif",
    }}>
      {/* Status bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 52,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '0 30px 8px', zIndex: 30, pointerEvents: 'none',
      }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#15271f', letterSpacing: '.2px' }}>9:41</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="18" height="12" viewBox="0 0 18 12" fill="#15271f"><rect x="0" y="7" width="3" height="5" rx="1"/><rect x="5" y="4" width="3" height="8" rx="1"/><rect x="10" y="1.5" width="3" height="10.5" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1" opacity=".35"/></svg>
          <svg width="17" height="12" viewBox="0 0 17 12" fill="none" stroke="#15271f" strokeWidth="1.6" strokeLinecap="round"><path d="M1 4.2C4.8 1 12.2 1 16 4.2"/><path d="M3.4 6.8C6 4.6 11 4.6 13.6 6.8"/><path d="M6 9.4c1.4-1.1 3.6-1.1 5 0"/></svg>
          <svg width="26" height="13" viewBox="0 0 26 13" fill="none"><rect x="1" y="1" width="21" height="11" rx="3" stroke="#15271f" strokeOpacity=".4" strokeWidth="1.2"/><rect x="2.6" y="2.6" width="16" height="7.8" rx="1.6" fill="#15271f"/><rect x="23.4" y="4.4" width="1.8" height="4.2" rx="1" fill="#15271f" fillOpacity=".4"/></svg>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ position: 'absolute', top: 52, left: 0, right: 0, bottom: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        {screen === 'dashboard' && <Dashboard onOpenAdd={openAdd} onGoPay={() => go('payments')} onGoSummary={() => go('summary')} />}
        {screen === 'history' && <History />}
        {screen === 'payments' && <Payments onOpenPlan={openPlan} onOpenAdd={openAdd} />}
        {screen === 'plan' && planId != null && <PlanDetail planId={planId} onBack={() => go('payments')} />}
        {screen === 'summary' && <Summary />}
      </div>

      {/* Bottom nav */}
      <BottomNav screen={screen} onGo={go} onOpenAdd={() => openAdd('expense')} />

      {/* Add sheet */}
      {addOpen && <AddSheet type={addType} onClose={closeAdd} />}
    </div>
  );
}
