const ACCENT = '#0caa78';

export default function BottomNav({ screen, onGo, onOpenAdd }) {
  const active = '#15271f';
  const inactive = '#aab2ab';

  const col = (s) => (screen === s ? active : inactive);

  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, height: 92,
      background: 'rgba(244,243,239,.92)', backdropFilter: 'blur(14px)',
      borderTop: '1px solid rgba(20,40,30,.06)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      padding: '14px 14px 0', zIndex: 20,
    }}>
      <NavBtn color={col('dashboard')} label="Home" onClick={() => onGo('dashboard')}>
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>
        </svg>
      </NavBtn>

      <NavBtn color={col('history')} label="Transaction" onClick={() => onGo('history')}>
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>
        </svg>
      </NavBtn>

      {/* FAB */}
      <button onClick={onOpenAdd} style={{
        flexShrink: 0, border: 'none', cursor: 'pointer',
        width: 56, height: 56, margin: '-18px 6px 0',
        borderRadius: '50%', background: ACCENT,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 14px 28px -10px rgba(12,170,120,.7)',
      }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
      </button>

      <NavBtn color={col('payments')} label="Payments" onClick={() => onGo('payments')}>
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2"/>
          <path d="M21 11h-6a2 2 0 0 0 0 4h6v-4Z"/>
        </svg>
      </NavBtn>

      <NavBtn color={col('summary')} label="Stats" onClick={() => onGo('summary')}>
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18"/>
          <rect x="7" y="11" width="3" height="6" rx="1"/><rect x="13" y="7" width="3" height="10" rx="1"/>
        </svg>
      </NavBtn>
    </div>
  );
}

function NavBtn({ color, label, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, border: 'none', background: 'none', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
      color, fontFamily: 'inherit',
    }}>
      {children}
      <span style={{ fontSize: 9, fontWeight: 700 }}>{label}</span>
    </button>
  );
}
