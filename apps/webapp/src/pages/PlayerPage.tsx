// PlayerPage.tsx
import { useEffect, useRef, useState } from 'react';
import { useHowler2, usePeaks2 } from '@resomix/hooks';

const INPUT_ID = '67adb0d5799206f8d65102a8';
const SIM_ID = '67ad9cec799206f8d64acdf1';
const THIRD_ID = '67adbb7b799206f8d652cf37';

// Track order for autoplay
const TRACK_ORDER = [INPUT_ID, SIM_ID, THIRD_ID];
// const TRACK_ORDER = [INPUT_ID];

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
  const { loading: wfLoading, error: wfError, setTime, attachMediaElement } = usePeaks2(overviewRef, id);

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

  useEffect(() => {
    if (!isLoaded) return;
    setTime(currentTime);
  }, [isLoaded, currentTime, setTime]);

  // Load saved position from localStorage on mount
  useEffect(() => {
    if (isLoaded) {
      const savedPosition = localStorage.getItem(`track-position-${id}`);
      if (savedPosition) {
        const position = parseFloat(savedPosition);
        if (position < duration) {
          seek(position);
        }
      }
    }
  }, [isLoaded, duration, id, seek]);

  // Save position to localStorage when it changes
  useEffect(() => {
    if (isLoaded && currentTime > 0) {
      localStorage.setItem(`track-position-${id}`, currentTime.toString());
    }
  }, [currentTime, isLoaded, id]);

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
      // Reset position to 0 when track ends
      localStorage.setItem(`track-position-${id}`, '0');
      onEnded();
    };

    audioNode.addEventListener('ended', handleEnded);
    return () => audioNode.removeEventListener('ended', handleEnded);
  }, [getHtmlAudioNode, onEnded, id]);

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
      if (duration > 0) {
        const newPosition = x * duration;
        seek(newPosition);
        localStorage.setItem(`track-position-${id}`, newPosition.toString());
      }
    };
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [isLoaded, duration, seek, id]);

  // Handle seek buttons
  const handleSeek = (timeChange: number) => {
    const newTime = Math.max(0, Math.min(duration, currentTime + timeChange));
    seek(newTime);
    localStorage.setItem(`track-position-${id}`, newTime.toString());
  };

  return (

    <div className="w-full max-w-xl rounded-xl border border-gray-700 bg-[#111] p-4 text-white">
      <h3 className="mb-3 text-lg font-semibold">{label}</h3>

      {/* Waveform container */}
      <div
        ref={overviewRef}
        className="relative h-20 w-full overflow-hidden  peaks-container"
      >
        {/* SoundCloud-ish progress tint overlay */}
        <div
          className="pointer-events-none absolute inset-0 mix-blend-screen"
          style={{
            width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%',
          }}
        />
      </div>

      {/* Loading & errors for waveform */}
      {wfLoading && <div className="mt-2 text-sm/relaxed text-white/70">Loading waveform…</div>}
      {wfError && <div className="mt-2 text-sm/relaxed text-red-400">Waveform error: {wfError}</div>}

      {/* Controls */}
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => handleSeek(-10)}
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
          onClick={() => handleSeek(10)}
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
        {/* Three players with autoplay functionality */}
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
