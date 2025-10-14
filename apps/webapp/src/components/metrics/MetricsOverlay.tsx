import { useEffect, useRef, useState } from "react";
import { onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";

type Metrics = {
  LCP?: number;
  INP?: number;
  CLS?: number;
  FCP?: number;
  TTFB?: number;
  TBT?: number;
};

export function MetricsOverlay() {
  const [metrics, setMetrics] = useState<Metrics>({});
  const initedRef = useRef(false);
  const longTaskObserverRef = useRef<PerformanceObserver | null>(null);
  const fcpTimeRef = useRef<number | null>(null);
  const tbtRef = useRef(0);

  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;

    const set = (key: keyof Metrics, val: number) => {
      setMetrics((m) => ({ ...m, [key]: val }));
    };

    onFCP((m) => {
      set("FCP", m.value);
      fcpTimeRef.current = m.value;
      setupLongTasksObserver();
    });

    onLCP((m) => set("LCP", m.value));
    onINP((m) => set("INP", m.value));
    onCLS((m) => set("CLS", m.value));
    onTTFB((m) => set("TTFB", m.value));

    const onHidden = () => {
      if (longTaskObserverRef.current) {
        longTaskObserverRef.current.disconnect();
        longTaskObserverRef.current = null;
      }
    };
    document.addEventListener("visibilitychange", onHidden, { once: true });

    return () => {
      onHidden();
      document.removeEventListener("visibilitychange", onHidden);
    };

    function setupLongTasksObserver() {
      if (!("PerformanceObserver" in window)) return;
      try {
        const po = new PerformanceObserver((list) => {
          const fcp = fcpTimeRef.current ?? 0;
          for (const entry of list.getEntries()) {
            if (entry.entryType === "longtask" && entry.startTime >= fcp) {
              const over = entry.duration - 50;
              if (over > 0) {
                tbtRef.current += over;
                set("TBT", tbtRef.current);
              }
            }
          }
        });
        po.observe({ type: "longtask", buffered: true } as PerformanceObserverInit);
        longTaskObserverRef.current = po;
      } catch(e) {
        if (process.env.NODE_ENV !== "production") {
          console.debug("[MetricsOverlay] Long Tasks not supported:", e);
        }
      }
    }
  }, []);

  const fmtMs = (v?: number) => (v == null ? "-" : Math.round(v) + " ms");
  const fmtCls = (v?: number) => (v == null ? "-" : (Math.round(v * 1000) / 1000).toFixed(3));

  return (
    <div
      style={{
        position: "fixed",
        right: 12,
        bottom: 12,
        zIndex: 999999,
        background: "rgba(0,0,0,0.75)",
        color: "#fff",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: 12,
        lineHeight: 1.3,
        padding: "10px 12px",
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
        pointerEvents: "none",
        minWidth: 180,
      }}
    >
      <div style={{ opacity: 0.9, marginBottom: 4, fontWeight: 600 }}>Web Vitals</div>
      <div>LCP: {fmtMs(metrics.LCP)}</div>
      <div>INP: {fmtMs(metrics.INP)}</div>
      <div>CLS: {fmtCls(metrics.CLS)}</div>
      <div>FCP: {fmtMs(metrics.FCP)}</div>
      <div>TTFB: {fmtMs(metrics.TTFB)}</div>
      <div>TBT: {fmtMs(metrics.TBT)}</div>
    </div>
  );
}