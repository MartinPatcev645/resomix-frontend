// PlayerPage.tsx
import { useEffect, useRef } from 'react';
import { useHowler2 } from '@resomix/hooks';
import { usePeaks2 } from '@resomix/hooks';

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PlayerPage(props: { id: string }) {
  const { id } = props;

  // Peaks — fire immediately on mount
  const overviewRef = useRef<HTMLDivElement | null>(null);
  const { loading: wfLoading, error: wfError } = usePeaks2(overviewRef, id);
  
  // Howler — create & preload; user clicks play to start
  const {
    isLoaded,
    isPlaying,
    duration,
    currentTime,
    play,
    pause,
    seek,
  } = useHowler2(id);

  // Optional: click-to-seek on overview after audio is loaded
  useEffect(() => {
    const el = overviewRef.current;
    if (!el || !isLoaded) return;
    const onClick = (ev: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      if (duration > 0) seek(x * duration);
    };
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [isLoaded, duration, seek]);

  return (
    <div style={{ padding: 16, color: '#fff', background: '#111', fontFamily: 'sans-serif' }}>
      <h2 style={{ marginTop: 0 }}>Simple Player</h2>

      {/* Waveform container (height via CSS) */}
      <div
        ref={overviewRef}
        style={{
          width: 600,
          height: 80,
          background: '#222',
          border: '1px solid #333',
          marginBottom: 12,
          position: 'relative',
        }}
      />
      {wfLoading && <div style={{ opacity: 0.7 }}>Loading waveform…</div>}
      {wfError && <div style={{ color: '#f66' }}>Waveform error: {wfError}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {!isPlaying ? (
          <button onClick={play} disabled={!isLoaded}>Play</button>
        ) : (
          <button onClick={pause}>Pause</button>
        )}
        <div>{fmt(currentTime)} / {fmt(duration)}</div>
      </div>
    </div>
  );
}
