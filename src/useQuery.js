import { useState, useEffect, useCallback } from 'react';

// dispatch นี้หลังทุก mutation เพื่อให้ทุก hook โหลดข้อมูลใหม่
export function notifyChange() {
  window.dispatchEvent(new Event('db-change'));
}

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

  // re-fetch ทุกครั้งที่มี mutation ในแอป
  useEffect(() => {
    window.addEventListener('db-change', load);
    return () => window.removeEventListener('db-change', load);
  }, [load]);

  return data;
}
