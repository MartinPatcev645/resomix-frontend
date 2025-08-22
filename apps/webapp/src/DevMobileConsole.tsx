import { useEffect } from 'react';

export default function DevMobileConsole() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    const hasEruda = (window as any).eruda;
    if (hasEruda) return;

    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/eruda';
    s.onload = () => (window as any).eruda?.init();
    document.body.appendChild(s);
  }, []);
  return null;
}
