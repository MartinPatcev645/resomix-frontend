// PlayerPage.tsx
import { useEffect, useRef } from 'react';
import { useHowler2 } from '@resomix/hooks';
import { usePeaks2 } from '@resomix/hooks';

// --- Put your test IDs here (no props) ---
const INPUT_ID = '67adb0d5799206f8d65102a8';
const SIM_ID   = '67ad9cec799206f8d64acdf1';

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function PlayerUnit({ label, id }: { label: string; id: string }) {
  // 1) Peaks — draw immediately
  const overviewRef = useRef<HTMLDivElement | null>(null);
  const { loading: wfLoading, error: wfError, attachMediaElement } = usePeaks2(overviewRef, id);

  // 2) Howler — preload; user clicks Play to start
  const {
    isLoaded,
    isPlaying,
    duration,
    currentTime,
    play,
    pause,
    seek,
    getHtmlAudioNode,
  } = useHowler2(id);

  // bind Peaks to the REAL <audio> from Howler so the playhead moves
  const audioNode = getHtmlAudioNode();
  useEffect(() => {
    if (audioNode) attachMediaElement(audioNode);
  }, [audioNode, attachMediaElement]);

  // click-to-seek on the waveform
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
    <div className="w-full max-w-xl rounded-xl border border-gray-700 bg-[#111] p-4 text-white">
      <h3 className="mb-3 text-lg font-semibold">{label}</h3>

      {/* Waveform container */}
      <div
        ref={overviewRef}
        className="relative h-20 w-full overflow-hidden rounded-md border border-gray-700 bg-[#222] peaks-container"
      >
        {/* SoundCloud-ish progress tint overlay */}
        <div
          className="pointer-events-none absolute inset-0 mix-blend-screen"
          style={{
            width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%',
            background:
              'linear-gradient(to right, rgba(255,107,107,0.6), rgba(255,107,107,0.0))',
          }}
        />
      </div>

      {/* Loading & errors for waveform */}
      {wfLoading && <div className="mt-2 text-sm/relaxed text-white/70">Loading waveform…</div>}
      {wfError && <div className="mt-2 text-sm/relaxed text-red-400">Waveform error: {wfError}</div>}

      {/* Controls */}
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => seek(Math.max(0, currentTime - 10))}
          className="px-3 py-1 bg-gray-600 rounded"
        >
          -10s
        </button>
        {!isPlaying ? (
          <button
            className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
            onClick={play}
            disabled={!isLoaded}
          >
            Play
          </button>
        ) : (
          <button
            className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-black"
            onClick={pause}
          >
            Pause
          </button>
        )}
        <button
          onClick={() => seek(Math.min(duration, currentTime + 10))}
          className="px-3 py-1 bg-gray-600 rounded"
        >
          +10s
        </button>

        <div className="text-sm tabular-nums text-white/90">
          {fmt(currentTime)} / {fmt(duration)}
        </div>
      </div>
    </div>
  );
}

export default function PlayerPage() {
  return (
    <div className="min-h-screen w-full bg-[#0b0b0b] p-6 text-white">
      {/* Hide Peaks rulers/axes; make base waveform slightly dimmer */}
      <style>{`
        .peaks-container .peaks-ruler,
        .peaks-container .peaks-axis,
        .peaks-overview-container .peaks-ruler,
        .peaks-overview-container .peaks-axis {
          display: none !important;
        }
        .peaks-overview-container canvas { opacity: 0.85; }
      `}</style>

      <h2 className="mb-6 text-2xl font-bold">Simple Player (Peaks + Howler)</h2>

      <div className="flex flex-col gap-6">
        {/* Two independent players sharing the same page */}
        <PlayerUnit label="Input Track" id={INPUT_ID} />
        <PlayerUnit label="Similarity Track" id={SIM_ID} />
      </div>
    </div>
  );
}
