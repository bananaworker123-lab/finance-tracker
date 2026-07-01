import { supabase } from './supabase';
import { notifyChange } from './useQuery';

function mutate(promise) {
  return promise.then(r => { notifyChange(); return r; });
}

export const db = {
  transactions: {
    toArray: () => supabase.from('transactions').select('*').then(r => r.data || []),
    add: (row) => mutate(supabase.from('transactions').insert(row).select().single()).then(r => r.data?.id),
    update: (id, patch) => mutate(supabase.from('transactions').update(patch).eq('id', id)),
    delete: (id) => mutate(supabase.from('transactions').delete().eq('id', id)),
  },
  bills: {
    toArray: () => supabase.from('bills').select('*').then(r => r.data || []),
    get: (id) => supabase.from('bills').select('*').eq('id', id).single().then(r => r.data),
    add: (row) => mutate(supabase.from('bills').insert(row).select().single()).then(r => r.data?.id),
    addBatch: (rows) => mutate(supabase.from('bills').insert(rows)),
    update: (id, patch) => mutate(supabase.from('bills').update(patch).eq('id', id)),
    delete: (id) => mutate(supabase.from('bills').delete().eq('id', id)),
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
    add: (row) => mutate(supabase.from('installments').insert(row).select().single()).then(r => r.data?.id),
    update: (id, patch) => mutate(supabase.from('installments').update(patch).eq('id', id)),
    delete: (id) => mutate(supabase.from('installments').delete().eq('id', id)),
  },
  categories: {
    toArray: () => supabase.from('categories').select('*').then(r => r.data || []),
  },
  bill_templates: {
    toArray: () => supabase.from('bill_templates').select('*').then(r => r.data || []),
    add: (row) => mutate(supabase.from('bill_templates').insert(row).select().single()).then(r => r.data?.id),
    update: (id, patch) => mutate(supabase.from('bill_templates').update(patch).eq('id', id)),
    delete: (id) => mutate(supabase.from('bill_templates').delete().eq('id', id)),
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
  notifyChange();
}
