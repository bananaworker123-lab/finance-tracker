import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

// แทนที่ useLiveQuery — ดึงข้อมูลครั้งแรก แล้ว subscribe real-time จาก Supabase
export function useLiveQuery(fetcher, deps = [], table = null) {
  const [data, setData] = useState(undefined);

  const load = useCallback(async () => {
    const result = await fetcher();
    setData(result);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!table) return;
    const channel = supabase
      .channel(`rt-${table}-${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [table, load]);

  return data;
}
