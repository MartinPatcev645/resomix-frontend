// PlayerPage.tsx
import { useEffect, useRef, useState } from 'react';
import { useHowler2 } from '@resomix/hooks';
import { usePeaks2 } from '@resomix/hooks';

const INPUT_ID = '67adb0d5799206f8d65102a8';
const SIM_ID   = '67ad9cec799206f8d64acdf1';
const THIRD_ID = '67adbb7b799206f8d652cf37';

// Track order for autoplay
const TRACK_ORDER = [INPUT_ID, SIM_ID, THIRD_ID];

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function PlayerUnit({
                      label,
                      id,
                      isPlaying,
                      onPlay,
                      onPause,
                      onEnded
                    }: {
  label: string;
  id: string;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
}) {
  // 1) Peaks — draw immediately
  const overviewRef = useRef<HTMLDivElement | null>(null);
  const { loading: wfLoading, error: wfError, attachMediaElement } = usePeaks2(overviewRef, id);

  // 2) Howler — preload; user clicks Play to start
  const {
    isLoaded,
    duration,
    currentTime,
    play,
    pause,
    seek,
    getHtmlAudioNode,
  } = useHowler2(id);

  // Handle play/pause from parent
  useEffect(() => {
    if (isPlaying) {
      play();
    } else {
      pause();
    }
  }, [isPlaying, play, pause]);

  // Listen for ended event
  useEffect(() => {
    const audioNode = getHtmlAudioNode();
    if (!audioNode) return;

    const handleEnded = () => {
      onEnded();
    };

    audioNode.addEventListener('ended', handleEnded);
    return () => audioNode.removeEventListener('ended', handleEnded);
  }, [getHtmlAudioNode, onEnded]);

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
            onClick={onPlay}
            disabled={!isLoaded}
          >
            Play
          </button>
        ) : (
          <button
            className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-black"
            onClick={onPause}
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
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);

  const handlePlay = (id: string) => {
    setCurrentlyPlaying(id);
  };

  const handlePause = (id: string) => {
    if (currentlyPlaying === id) {
      setCurrentlyPlaying(null);
    }
  };

  const handleEnded = (id: string) => {
    if (currentlyPlaying === id) {
      const currentIndex = TRACK_ORDER.indexOf(id);
      const nextIndex = (currentIndex + 1) % TRACK_ORDER.length;
      setCurrentlyPlaying(TRACK_ORDER[nextIndex]);
    }
  };

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
        .peaks-overview-container canvas { opacity: 1; }
        .konvajs-content {
            position: absolute !important;
            top: 20px;
        }
      `}</style>

      <h2 className="mb-6 text-2xl font-bold">Simple Player (Peaks + Howler)</h2>

      <div className="flex flex-col gap-6">
        <PlayerUnit
          label="Input Track"
          id={INPUT_ID}
          isPlaying={currentlyPlaying === INPUT_ID}
          onPlay={() => handlePlay(INPUT_ID)}
          onPause={() => handlePause(INPUT_ID)}
          onEnded={() => handleEnded(INPUT_ID)}
        />
        <PlayerUnit
          label="Similarity Track"
          id={SIM_ID}
          isPlaying={currentlyPlaying === SIM_ID}
          onPlay={() => handlePlay(SIM_ID)}
          onPause={() => handlePause(SIM_ID)}
          onEnded={() => handleEnded(SIM_ID)}
        />
        <PlayerUnit
          label="Third Track"
          id={THIRD_ID}
          isPlaying={currentlyPlaying === THIRD_ID}
          onPlay={() => handlePlay(THIRD_ID)}
          onPause={() => handlePause(THIRD_ID)}
          onEnded={() => handleEnded(THIRD_ID)}
        />
      </div>
    </div>
  );
}