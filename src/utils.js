export const ACCENT = '#0caa78';

export function fmt(n) {
  return Number(n).toLocaleString('en-US');
}

export function baht(n) {
  return '฿' + fmt(n);
}

export function daysUntil(dateStr) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - now) / 86400000);
}

export function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatShortDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function whenStr(dateStr) {
  const days = daysUntil(dateStr);
  if (days < 0) return { text: `Overdue · ${-days} day${-days !== 1 ? 's' : ''}`, color: '#e0564f' };
  if (days === 0) return { text: 'Due today', color: '#e0564f' };
  if (days <= 7) return { text: `Due in ${days} day${days !== 1 ? 's' : ''} · ${formatShortDate(dateStr)}`, color: '#c98a16' };
  return { text: `Due ${formatShortDate(dateStr)}`, color: '#8d968f' };
}

export function statusBadge(status) {
  if (status === 'paid') return { label: 'Paid', bg: '#e3f3ec', color: ACCENT };
  if (status === 'overdue') return { label: 'Overdue', bg: '#fdeceb', color: '#e0564f' };
  if (status === 'cancelled') return { label: 'Cancelled', bg: '#f0f0ee', color: '#9aa39c' };
  const days = 999;
  return { label: 'Upcoming', bg: '#eef0ec', color: '#8d968f' };
}

export function monthLabel(idx) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - idx);
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function monthRange(idx) {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() - idx;
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0, 23, 59, 59);
  return { start, end };
}

export const CATEGORY_META = {
  Food: { emoji: '🍔', tile: '#fbeede' },
  Transport: { emoji: '🚕', tile: '#e8f0fe' },
  Shopping: { emoji: '🛍️', tile: '#f1ebfc' },
  Bills: { emoji: '⚡', tile: '#e3f3ec' },
  Salary: { emoji: '💰', tile: '#e3f3ec' },
  Entertainment: { emoji: '🎬', tile: '#fdecef' },
  Health: { emoji: '💊', tile: '#e8f0fe' },
  Coffee: { emoji: '☕', tile: '#f6ede2' },
  Groceries: { emoji: '🛒', tile: '#e7f4ec' },
  Internet: { emoji: '📶', tile: '#e3f3ec' },
  Phone: { emoji: '📱', tile: '#e8f0fe' },
  Travel: { emoji: '✈️', tile: '#e8f0fe' },
  Other: { emoji: '💸', tile: '#eef0ec' },
};

export function catMeta(name) {
  return CATEGORY_META[name] || { emoji: '💸', tile: '#eef0ec' };
}

export const DEFAULT_CATEGORIES = Object.entries(CATEGORY_META).map(([name, v]) => ({ name, ...v }));
