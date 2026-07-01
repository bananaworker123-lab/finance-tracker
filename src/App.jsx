import { useState, useEffect } from 'react';
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
      width: '100%',
      minHeight: '100dvh',
      background: '#f4f3ef',
      fontFamily: "'Plus Jakarta Sans','Noto Sans Thai',sans-serif",
      overflow: 'hidden',
    }}>
      {/* Scrollable content */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflowY: 'auto', overflowX: 'hidden' }}>
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
