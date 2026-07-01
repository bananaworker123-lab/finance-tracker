import { useState, useEffect } from 'react';

function formatWithComma(raw) {
  if (!raw && raw !== 0) return '';
  const parts = String(raw).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

function stripComma(str) {
  return str.replace(/,/g, '');
}

// value = raw number string (ไม่มี comma)
// onChange = called with raw string (ไม่มี comma)
export default function MoneyInput({ value, onChange, placeholder = '0', style = {} }) {
  const [display, setDisplay] = useState(formatWithComma(value));

  useEffect(() => {
    // sync จากข้างนอก (เช่น reset form)
    if (!value && value !== 0) setDisplay('');
    else setDisplay(formatWithComma(value));
  }, [value]);

  function handleChange(e) {
    const raw = stripComma(e.target.value);
    // อนุญาตแค่ตัวเลขกับ .
    if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return;
    setDisplay(formatWithComma(raw));
    onChange(raw);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      placeholder={placeholder}
      style={style}
    />
  );
}
