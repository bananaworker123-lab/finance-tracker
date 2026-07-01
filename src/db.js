import { supabase } from './supabase';

// ─── transactions ────────────────────────────────────────────────────────────
export const db = {
  transactions: {
    toArray: () => supabase.from('transactions').select('*').then(r => r.data || []),
    add: (row) => supabase.from('transactions').insert(row).select().single().then(r => r.data?.id),
  },
  bills: {
    toArray: () => supabase.from('bills').select('*').then(r => r.data || []),
    get: (id) => supabase.from('bills').select('*').eq('id', id).single().then(r => r.data),
    add: (row) => supabase.from('bills').insert(row).select().single().then(r => r.data?.id),
    update: (id, patch) => supabase.from('bills').update(patch).eq('id', id),
    delete: (id) => supabase.from('bills').delete().eq('id', id),
    where: (col) => ({
      equals: (val) => ({
        toArray: () => supabase.from('bills').select('*').eq(col, val).then(r => r.data || []),
        sortBy: (sortCol) => supabase.from('bills').select('*').eq(col, val).order(sortCol).then(r => r.data || []),
      }),
      anyOf: (vals) => ({
        toArray: () => supabase.from('bills').select('*').in(col, vals).then(r => r.data || []),
      }),
    }),
  },
  installments: {
    toArray: () => supabase.from('installments').select('*').then(r => r.data || []),
    get: (id) => supabase.from('installments').select('*').eq('id', id).single().then(r => r.data),
    add: (row) => supabase.from('installments').insert(row).select().single().then(r => r.data?.id),
    update: (id, patch) => supabase.from('installments').update(patch).eq('id', id),
  },
  categories: {
    toArray: () => supabase.from('categories').select('*').then(r => r.data || []),
  },
};

export async function updateOverdueBills() {
  const { data: upcoming } = await supabase
    .from('bills')
    .select('id, due_date')
    .eq('status', 'upcoming');
  if (!upcoming) return;
  const now = new Date();
  for (const bill of upcoming) {
    if (new Date(bill.due_date) < now) {
      await supabase.from('bills').update({ status: 'overdue' }).eq('id', bill.id);
    }
  }
}
