import { useEffect, useRef, useState } from "react";
import { onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";

type Metrics = {
  LCP?: number;
  INP?: number;
  CLS?: number;
  FCP?: number;
  TTFB?: number;
  TBT?: number; // total blocking time (sum of long tasks >50ms after FCP)
};

type LoadStats = {
  fps: number;           // average FPS over the window
  jankPercent: number;   // share of "bad" frames >16.7ms
  longTasksCount: number;
  longTasksMs: number;   // total long task time in the window
  busyPercent: number;   // estimated main-thread busy time
};

const WINDOW_MS = 10000; // aggregation window: 10s
const FRAME_BUDGET = 31.4; // per-frame budget for 32 FPS

export function MetricsOverlay() {
  const [metrics, setMetrics] = useState<Metrics>({});
  const [load, setLoad] = useState<LoadStats>({
    fps: 0,
    jankPercent: 0,
    longTasksCount: 0,
    longTasksMs: 0,
    busyPercent: 0,
  });

  const initedRef = useRef(false);
  const longTaskObserverRef = useRef<PerformanceObserver | null>(null);
  const fcpTimeRef = useRef<number | null>(null);
  const tbtRef = useRef(0);

  // For Busy% and FPS
  const frameSamplesRef = useRef<Array<{ t: number; delta: number }>>([]);
  const longTasksRef = useRef<Array<{ startTime: number; duration: number }>>([]);

  useEffect(() => {
    // 1) Register web-vitals and long task observer once
    if (!initedRef.current) {
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
    }

    // 2) Start rAF loop and periodic recomputation
    let rafId = 0;
    let prevTime: number | undefined;

    const onFrame = (t: number) => {
      if (prevTime !== undefined) {
        const delta = t - prevTime;
        frameSamplesRef.current.push({ t, delta });
      }
      prevTime = t;
      rafId = requestAnimationFrame(onFrame);
    };
    rafId = requestAnimationFrame(onFrame);

    const intervalId = window.setInterval(recomputeLoadStats, 500);

    // 3) Pause when the tab is hidden
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        cancelAnimationFrame(rafId);
        window.clearInterval(intervalId);
      } else {
        // resume: restart the rAF loop
        prevTime = undefined;
        rafId = requestAnimationFrame(onFrame);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // 4) Cleanup only our timers/listeners (do NOT trigger onHidden)
    return () => {
      cancelAnimationFrame(rafId);
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  function setupLongTasksObserver() {
    if (!("PerformanceObserver" in window)) return;

    // Safe access to supportedEntryTypes without any
    const supportedTypes = (PerformanceObserver as unknown as {
      supportedEntryTypes?: ReadonlyArray<string>;
    }).supportedEntryTypes;

    const supportsLongTasks = Array.isArray(supportedTypes)
      ? supportedTypes.includes("longtask")
      : true; // if unknown — try and catch below

    try {
      const po = new PerformanceObserver((list) => {
        type LongTaskEntry = PerformanceEntry & { duration: number; startTime: number };
        const fcp = fcpTimeRef.current ?? 0;

        for (const entry of list.getEntries() as LongTaskEntry[]) {
          // Sum TBT: only portions exceeding 50ms after FCP
          if (entry.startTime >= fcp) {
            const over = entry.duration - 50;
            if (over > 0) {
              tbtRef.current += over;
              setMetrics((m) => ({ ...m, TBT: tbtRef.current }));
            }
          }
          // For Busy% and long task stats — collect all long tasks
          longTasksRef.current.push({ startTime: entry.startTime, duration: entry.duration });
        }
      });

      if (supportsLongTasks) {
        po.observe({ type: "longtask", buffered: true });
      } else {
        po.observe({ entryTypes: ["longtask"] });
      }

      longTaskObserverRef.current = po;
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.debug("[MetricsOverlay] Long Tasks not supported:", err);
      }
    }
  }

  function recomputeLoadStats() {
    const now = performance.now();
    const cutoff = now - WINDOW_MS;

    // Frames: drop old samples, compute FPS, jank, and over-budget time
    const frames = frameSamplesRef.current.filter((s) => s.t >= cutoff);
    frameSamplesRef.current = frames;

    const framesCount = frames.length;
    const fps = framesCount > 0 ? (framesCount * 1000) / WINDOW_MS : 0;

    const jankFrames = frames.reduce((acc, s) => acc + (s.delta > FRAME_BUDGET ? 1 : 0), 0);
    const jankPercent = framesCount ? (jankFrames / framesCount) * 100 : 0;

    const overBudgetMs = frames.reduce((sum, s) => sum + Math.max(0, s.delta - FRAME_BUDGET), 0);

    // Long tasks within window: account for overlap with the window
    const lt = longTasksRef.current.filter((e) => e.startTime + e.duration >= cutoff);
    longTasksRef.current = lt;

    let longTasksMs = 0;
    for (const e of lt) {
      const overlap = Math.min(e.startTime + e.duration, now) - Math.max(e.startTime, cutoff);
      if (overlap > 0) longTasksMs += overlap;
    }

    // Main-thread busy estimate: over-budget frame time + long tasks
    // This is an upper bound, useful to highlight heavy animations/rendering
    const busyPercent = Math.max(
      0,
      Math.min(100, ((overBudgetMs + longTasksMs) / WINDOW_MS) * 100)
    );

    setLoad({
      fps: Number(fps.toFixed(1)),
      jankPercent: Number(jankPercent.toFixed(1)),
      longTasksCount: lt.length,
      longTasksMs: Math.round(longTasksMs),
      busyPercent: Math.round(busyPercent),
    });
  }

  // Formatting helpers
  const fmtMs = (v?: number) => (v == null ? "-" : Math.round(v) + " ms");
  const fmtCls = (v?: number) => (v == null ? "-" : (Math.round(v * 1000) / 1000).toFixed(3));

  const colorBy = (val: number, [good, warn]: [number, number]) => {
    // Simple threshold-based coloring
    return val <= good ? "#35c759" : val <= warn ? "#ff9f0a" : "#ff3b30";
  };

  return (
    <div
      style={{
        position: "fixed",
        right: 12,
        bottom: 12,
        zIndex: 999999,
        background: "rgba(0,0,0,0.78)",
        color: "#fff",
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: 12,
        lineHeight: 1.3,
        padding: "10px 12px",
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
        pointerEvents: "none",
        minWidth: 220,
      }}
    >
      <div style={{ opacity: 0.9, marginBottom: 4, fontWeight: 600 }}>Web Vitals</div>
      <div>LCP: {fmtMs(metrics.LCP)}</div>
      <div>INP: {fmtMs(metrics.INP)}</div>
      <div>CLS: {fmtCls(metrics.CLS)}</div>
      <div>FCP: {fmtMs(metrics.FCP)}</div>
      <div>TTFB: {fmtMs(metrics.TTFB)}</div>
      <div>TBT: {fmtMs(metrics.TBT)}</div>

      <div style={{ opacity: 0.9, margin: "8px 0 4px", fontWeight: 600 }}>Load</div>
      <div>
        FPS:{" "}
        <span style={{ color: colorBy(load.fps, [55, 45]) }}>{load.fps}</span>
      </div>
      <div>
        Jank:{" "}
        <span style={{ color: colorBy(load.jankPercent, [5, 15]) }}>
      {load.jankPercent} %
    </span>
      </div>
      <div>
        Long tasks: {load.longTasksCount} / {load.longTasksMs} ms
      </div>
      <div>
        Busy:{" "}
        <span style={{ color: colorBy(load.busyPercent, [30, 60]) }}>
          {load.busyPercent} %
        </span>
      </div>
    </div>
  );
}