### Howler.js + Peaks.js Integration Guide (Resomix Web Monorepo)

This guide provides step-by-step instructions to replace the dual-player (HTMLAudio + WaveSurfer) with Howler.js for playback and Peaks.js for waveform rendering, plus best practices and migration/testing checklists.

---

## 1) Install Dependencies (pnpm workspaces)

Run from repo root so workspace hoists and links are correct.

```bash
pnpm add howler -w
pnpm add peaks.js konva waveform-data -w
```

Notes:
- Peaks.js recommends Konva 8.x. If you hit API mismatches, pin `konva@^8`.  
- Packages/apps that import these libs will get them from the workspace.

---

## 2) Howler Integration (Playback)

Goal: Manage all playback through a `Howl` instance, not the DOM `<audio>` API.

### 2.1 Create a central player module/hook
- Location suggestions: `packages/hooks/src/Player/usePlayerManager.ts` or inside the app player component where you already centralize playback.
- Responsibilities:
  - Create/destroy `Howl` per track
  - Expose controls: play, pause, seek, stop, setVolume
  - Emit events to stores/UI: onplay, onpause, onend, onseek

Example shape (TypeScript-ish):
```ts
import { Howl, Howler } from 'howler';

export type PlayerController = {
  load: (url: string, opts?: { volume?: number }) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (timeSeconds: number) => void;
  getSeek: () => number;
  getDuration: () => number;
  unload: () => void;
  getHtmlAudioNode: () => HTMLAudioElement | null; // for Peaks
};

let currentHowl: Howl | null = null;

export function createPlayerController(on: {
  onPlay?: () => void;
  onPause?: () => void;
  onEnd?: () => void;
  onSeek?: (time: number) => void;
  onLoad?: () => void;
} = {}): PlayerController {
  const load = (url: string, opts?: { volume?: number }) => {
    if (currentHowl) {
      currentHowl.unload();
      currentHowl = null;
    }
    currentHowl = new Howl({
      src: [url],
      format: ['mp3'],
      html5: true,
      preload: true,
      volume: opts?.volume ?? 1,
      onload: () => on.onLoad?.(),
      onplay: () => on.onPlay?.(),
      onpause: () => on.onPause?.(),
      onend: () => on.onEnd?.(),
      onseek: () => on.onSeek?.(currentHowl?.seek() as number),
    });
  };

  return {
    load,
    play: () => currentHowl?.play(),
    pause: () => currentHowl?.pause(),
    stop: () => currentHowl?.stop(),
    seek: (t) => {
      if (!currentHowl) return;
      currentHowl.seek(Math.max(0, t));
    },
    getSeek: () => (currentHowl ? (currentHowl.seek() as number) : 0),
    getDuration: () => currentHowl?.duration() ?? 0,
    unload: () => {
      currentHowl?.unload();
      currentHowl = null;
    },
    getHtmlAudioNode: () => {
      // Access Howler's internal HTML5 audio node
      // Ensure a sound exists (after load/play)
      const anyHowl = currentHowl as any;
      const node: HTMLAudioElement | undefined = anyHowl?._sounds?.[0]?._node;
      return node ?? null;
    },
  };
}
```

Best practices:
- Set `html5: true` for streaming and iOS reliability.
- Use one `Howl` per track; call `unload()` when switching.
- Wire `onend` to advance playlist automatically.
- Update your store (`packages/stores/src/usePlayer.ts`) from these callbacks for UI state.

### 2.2 Preload the next track (optional, recommended)
- When current track reaches "loaded" or near end, create a new `Howl` for the next track with `preload: true` to warm the cache. Start playback instantly when needed.
- Keep a reference to next `Howl` and `unload()` it if the queue changes.

### 2.3 MediaSession (lock screen controls)
- After `play()`, set metadata and action handlers as you do today, but call into the controller methods.
- Example actions: `navigator.mediaSession.setActionHandler('pause', controller.pause)` etc.

---

## 3) Peaks.js Integration (Waveform)

Goal: Render waveform using your precomputed peaks JSON and keep the playhead in sync with the Howler audio element.

### 3.1 Data format
- If your JSON is an array of normalized positives (0..1 per second), mirror values for min/max pairs if needed: for each value `v`, produce `[-v, v]`.
- If the server can emit audiowaveform-style JSON (min/max interleaved with metadata), that's ideal. Otherwise, small client transform is fine.

### 3.2 Initialization strategy
- Create a React component or hook that:
  - Receives `trackId` and a function `getHtmlAudioNode()` from the player controller
  - Initializes Peaks when both audio node and data URL are ready
  - Destroys Peaks on unmount/track change

Skeleton:
```ts
import Peaks from 'peaks.js';

export function initPeaks({
  container: HTMLElement,
  audio: HTMLAudioElement,
  peaksJsonUrl: string,
  height = 80,
}: {
  container: HTMLElement;
  audio: HTMLAudioElement;
  peaksJsonUrl: string;
  height?: number;
}) {
  return new Promise<import('peaks.js').PeaksInstance | null>((resolve) => {
    const options = {
      containers: { overview: container },
      mediaElement: audio,
      dataUri: { json: peaksJsonUrl },
      height,
      zoomLevels: [256, 512, 1024],
    } as any;

    Peaks.init(options, (err, peaks) => {
      if (err) {
        console.error('Peaks init failed', err);
        resolve(null);
        return;
      }
      resolve(peaks!);
    });
  });
}
```

### 3.3 Click-to-seek
- Add a click listener to the container; compute `time = (x / width) * audio.duration` and call `controller.seek(time)`.
- Because Peaks syncs to the same `audio` element, the playhead updates automatically.

### 3.4 Styling
- Use a single `overview` container for a static waveform (SoundCloud-like). Control height in options or CSS.
- Customize colors via Peaks options or canvas styling.

Best practices:
- Initialize Peaks only after the Howler audio node exists (after `load()` or first `play()`).
- Destroy the instance on unmount/track change: `peaks.destroy()`.
- If you need buffered display, read `audio.buffered` from the node and render a background buffer bar yourself.

---

## 4) Wiring Howler to Peaks

- From the controller, obtain the HTML5 audio node: `controller.getHtmlAudioNode()`.
- Pass that node to Peaks' `mediaElement` option during initialization.
- Re-initialize Peaks when the `trackId` changes (new data URL, new audio element).

Flow per track:
1) `controller.load(track.url)`
2) Wait briefly for the audio node to be ready (after `onload` or first `play()`)
3) Initialize Peaks with `mediaElement: controller.getHtmlAudioNode()` and `dataUri.json: /peaks?uuid=trackId`
4) Add click-to-seek handler
5) On track change: `peaks.destroy()`, `controller.unload()`, then repeat

---

## 5) Migration Checklist (WaveSurfer → Peaks, DOM Audio → Howler)

- Remove WaveSurfer usage from waveform components/hooks.
- Stop manually syncing progress to waveform; Peaks follows the `mediaElement` timeline.
- Replace `<audio>` element control code with `Howl` methods in your player logic.
- Replace `onended` DOM handler with Howler's `onend` to trigger next track.
- Remove shared AudioContext hacks and any dummy/silent audio unlock logic.
- Keep MediaSession integration but call controller methods.

---

## 6) Testing Matrix

- Desktop: Chrome/Firefox/Safari/Edge — play, pause, seek, next/prev, rapid track changes.
- Mobile Android: Chrome/Firefox — seek and autoplay-next after user-initiated first play.
- Mobile iOS (Safari/Chrome): play/pause from lock screen; seek during buffering; interruption behavior.
- Network throttling: verify seeking triggers range requests and resumes smoothly.

---

## 7) Operational Tips & Best Practices

- Use `html5: true` for better streaming and iOS behavior.
- Preload the next track with a background `Howl` for instant transitions.
- Always `unload()` old `Howl` instances to free resources.
- Prefer one controller as the source of truth (Howler); use Peaks only for rendering and click-to-seek UI.
- If your peaks JSON is single-sided (only positive values), mirror to min/max pairs if visual asymmetry occurs.
- Keep waveform and player components modular; communicate via a store or narrow props.

---

## 8) Where to put things in this repo

- Player controller: `packages/hooks/src/Player/` or app-level persistent player component (`apps/webapp/src/components/Playlist/InputPlayer.tsx` if central).
- Peaks wiring: the component that renders the waveform in playlist/upload pages (`apps/webapp/src/components/Playlist/PeaksPlayer.tsx` or new component).
- Store updates: `packages/stores/src/usePlayer.ts` remains the UI-facing state, updated from Howler events.

---

## 9) Quick Start (TL;DR)

1) Install deps (root): `pnpm add howler peaks.js konva waveform-data -w`
2) Implement a `createPlayerController` around Howler with `html5:true`
3) Replace audio DOM control with controller methods in your player UI
4) Initialize Peaks with `mediaElement: controller.getHtmlAudioNode()` and `dataUri.json: /peaks?uuid=trackId`
5) Add click-to-seek that calls `controller.seek(time)`
6) On track change, `peaks.destroy()` and `controller.unload()` before creating new instances
7) Keep MediaSession logic; call controller methods for play/pause/seek/next/prev

---

## 10) File-by-File Migration Steps (Based on Current Implementation)

Based on your current setup, here are the specific files to modify and the exact changes needed:

### 10.1 Create New Howler Controller Hook
**File**: `packages/hooks/src/Player/useHowlerController.ts` (NEW FILE)
```ts
import { useCallback, useRef, useEffect } from 'react';
import { Howl, Howler } from 'howler';
import { usePlayerStore } from '@resomix/stores';

export interface HowlerController {
  load: (url: string, trackId: string) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (timeSeconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  unload: () => void;
  getHtmlAudioNode: () => HTMLAudioElement | null;
}

export function useHowlerController() {
  const currentHowlRef = useRef<Howl | null>(null);
  const currentTrackIdRef = useRef<string | null>(null);
  
  const { 
    setCurrentTrack, 
    setVolume, 
    volume,
    setInputCurrentTime,
    setSimilarityCurrentTime 
  } = usePlayerStore();

  const load = useCallback((url: string, trackId: string) => {
    // Unload previous track
    if (currentHowlRef.current) {
      currentHowlRef.current.unload();
      currentHowlRef.current = null;
    }

    // Create new Howl instance
    const howl = new Howl({
      src: [url],
      format: ['mp3'],
      html5: true,
      preload: true,
      volume: volume,
      onload: () => {
        console.log('[HowlerController] Track loaded:', trackId);
      },
      onplay: () => {
        console.log('[HowlerController] Track playing:', trackId);
        setCurrentTrack(trackId);
      },
      onpause: () => {
        console.log('[HowlerController] Track paused:', trackId);
      },
      onend: () => {
        console.log('[HowlerController] Track ended:', trackId);
        // Trigger next track logic (handled by usePlayerManager)
        setCurrentTrack(null);
      },
      onseek: () => {
        const currentTime = howl.seek() as number;
        // Update appropriate time in store based on track type
        if (trackId === 'uploaded-local' || trackId === currentTrackIdRef.current) {
          setInputCurrentTime(currentTime);
        } else {
          setSimilarityCurrentTime(currentTime);
        }
      },
      ontimeupdate: () => {
        const currentTime = howl.seek() as number;
        if (trackId === 'uploaded-local' || trackId === currentTrackIdRef.current) {
          setInputCurrentTime(currentTime);
        } else {
          setSimilarityCurrentTime(currentTime);
        }
      }
    });

    currentHowlRef.current = howl;
    currentTrackIdRef.current = trackId;
  }, [volume, setCurrentTrack, setInputCurrentTime, setSimilarityCurrentTime]);

  const play = useCallback(() => {
    currentHowlRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    currentHowlRef.current?.pause();
  }, []);

  const stop = useCallback(() => {
    currentHowlRef.current?.stop();
  }, []);

  const seek = useCallback((time: number) => {
    if (currentHowlRef.current) {
      currentHowlRef.current.seek(Math.max(0, time));
    }
  }, []);

  const getCurrentTime = useCallback(() => {
    return currentHowlRef.current ? (currentHowlRef.current.seek() as number) : 0;
  }, []);

  const getDuration = useCallback(() => {
    return currentHowlRef.current?.duration() ?? 0;
  }, []);

  const unload = useCallback(() => {
    if (currentHowlRef.current) {
      currentHowlRef.current.unload();
      currentHowlRef.current = null;
    }
    currentTrackIdRef.current = null;
  }, []);

  const getHtmlAudioNode = useCallback(() => {
    const anyHowl = currentHowlRef.current as any;
    return anyHowl?._sounds?.[0]?._node ?? null;
  }, []);

  // Sync volume changes
  useEffect(() => {
    if (currentHowlRef.current) {
      currentHowlRef.current.volume(volume);
    }
  }, [volume]);

  return {
    load,
    play,
    pause,
    stop,
    seek,
    getCurrentTime,
    getDuration,
    unload,
    getHtmlAudioNode
  };
}
```

### 10.2 Create New Peaks Waveform Hook
**File**: `packages/hooks/src/Waveform/usePeaksWaveform.ts` (NEW FILE)
```ts
import { useEffect, useRef, useState } from 'react';
import Peaks from 'peaks.js';

export interface UsePeaksWaveformProps {
  containerRef: React.RefObject<HTMLElement>;
  trackId?: string;
  audioElement: HTMLAudioElement | null;
  height?: number;
  onReady?: (peaks: any) => void;
}

export function usePeaksWaveform({
  containerRef,
  trackId,
  audioElement,
  height = 80,
  onReady
}: UsePeaksWaveformProps) {
  const peaksInstanceRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Peaks when container and audio are ready
  useEffect(() => {
    if (!containerRef.current || !audioElement || !trackId) {
      return;
    }

    const initPeaks = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Destroy previous instance
        if (peaksInstanceRef.current) {
          peaksInstanceRef.current.destroy();
          peaksInstanceRef.current = null;
        }

        const options = {
          containers: { overview: containerRef.current },
          mediaElement: audioElement,
          dataUri: { json: `https://media.resomix.com/peaks/?uuid=${trackId}` },
          height,
          zoomLevels: [256, 512, 1024],
        };

        Peaks.init(options, (err, peaks) => {
          if (err) {
            console.error('[usePeaksWaveform] Peaks init failed:', err);
            setError(err.message);
            setIsLoading(false);
            return;
          }

          peaksInstanceRef.current = peaks;
          setIsLoading(false);
          onReady?.(peaks);
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize Peaks');
        setIsLoading(false);
      }
    };

    initPeaks();

    return () => {
      if (peaksInstanceRef.current) {
        peaksInstanceRef.current.destroy();
        peaksInstanceRef.current = null;
      }
    };
  }, [containerRef, trackId, audioElement, height, onReady]);

  // Add click-to-seek functionality
  useEffect(() => {
    if (!containerRef.current || !peaksInstanceRef.current || !audioElement) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      const rect = containerRef.current!.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const containerWidth = rect.width;
      const duration = audioElement.duration || 0;
      
      if (duration > 0) {
        const seekTime = (clickX / containerWidth) * duration;
        audioElement.currentTime = seekTime;
      }
    };

    containerRef.current.addEventListener('click', handleClick);
    
    return () => {
      containerRef.current?.removeEventListener('click', handleClick);
    };
  }, [containerRef, audioElement]);

  return {
    peaksInstance: peaksInstanceRef.current,
    isLoading,
    error
  };
}
```

### 10.3 Update Player Store
**File**: `packages/stores/src/usePlayer.ts`
**Changes**: Remove WaveSurfer-specific state, add Howler controller state
```ts
// Remove these lines:
// inputWs: any | null
// setInputWs: (ws: any | null) => void
// similarityWs: any | null
// setSimilarityWs: (ws: any | null) => void

// Add these lines:
howlerController: any | null
setHowlerController: (controller: any | null) => void

// Update the store implementation:
howlerController: null,
setHowlerController: (controller) => set({ howlerController: controller }),
```

### 10.4 Update usePlayerManager
**File**: `packages/hooks/src/Player/usePlayerManager.ts`
**Changes**: Replace WaveSurfer logic with Howler controller logic
```ts
// Remove WaveSurfer imports and state
// Remove: inputWs, similarityWs, setInputWs, setSimilarityWs

// Add Howler controller integration
const { howlerController, setHowlerController } = usePlayerStore();

// Replace volume sync logic:
useEffect(() => {
  if (howlerController) {
    howlerController.volume = volume;
  }
}, [howlerController, volume]);

// Update MediaSession handlers to use Howler controller:
const handleMediaSessionPreviousTrack = () => {
  if (howlerController) {
    howlerController.pause();
    playPrevious();
  }
};

const handleMediaSessionNextTrack = () => {
  if (howlerController) {
    howlerController.pause();
    playNext();
  }
};
```

### 10.5 Update InputPlayer Component
**File**: `apps/webapp/src/components/Playlist/InputPlayer.tsx`
**Changes**: Replace AudioProvider + WaveformPlayer with Howler + Peaks
```ts
// Remove these imports:
// import WaveformPlayer, { type WaveformPlayerRef } from "./WaveformPlayer.tsx";
// import { AudioProvider, useAudioProviderRef } from "@resomix/hooks";

// Add these imports:
import { useHowlerController } from "@resomix/hooks";
import { usePeaksWaveform } from "@resomix/hooks";

// Replace AudioProvider usage with Howler controller:
const howlerController = useHowlerController();

// Replace WaveformPlayer with Peaks:
const waveformContainerRef = useRef<HTMLDivElement>(null);
const { peaksInstance, isLoading, error } = usePeaksWaveform({
  containerRef: waveformContainerRef,
  trackId: effectiveId,
  audioElement: howlerController.getHtmlAudioNode(),
  height: 50,
  onReady: () => console.log('[InputPlayer] Peaks ready')
});

// Update play/pause logic:
const togglePlay = () => {
  if (isPlaying) {
    howlerController.pause();
  } else {
    howlerController.play();
  }
};

// Update skip logic:
const skipBackward = useCallback(() => {
  const currentTime = howlerController.getCurrentTime();
  const newTime = Math.max(0, currentTime - 10);
  howlerController.seek(newTime);
}, [howlerController]);

const skipForward = useCallback(() => {
  const currentTime = howlerController.getCurrentTime();
  const duration = howlerController.getDuration();
  const newTime = Math.min(duration, currentTime + 10);
  howlerController.seek(newTime);
}, [howlerController]);

// Replace WaveformPlayer JSX with:
<div 
  ref={waveformContainerRef}
  className="h-[var(--px-50)] overflow-y-hidden w-[var(--px-280)] max-w-[var(--px-280)] lg:w-[var(--px-444)] lg:max-w-[var(--px-444)]"
>
  {isLoading && <div>Loading waveform...</div>}
  {error && <div>Error: {error}</div>}
</div>
```

### 10.6 Update SimilarityPlayer Component
**File**: `apps/webapp/src/components/Playlist/SimilarityPlayer.tsx`
**Changes**: Similar to InputPlayer - replace WaveformPlayer with Peaks
```ts
// Same changes as InputPlayer but for similarity tracks
// Use the same howlerController but load different tracks
```

### 10.7 Remove Legacy Files
**Files to delete or deprecate**:
- `packages/hooks/src/Waveform/useWaveform.ts` (replaced by usePeaksWaveform)
- `packages/hooks/src/Player/useAudioProvider.tsx` (replaced by useHowlerController)
- `packages/hooks/src/Player/useAudioContextUnlocker.ts` (no longer needed)
- `apps/webapp/src/components/Playlist/WaveformPlayer.tsx` (replaced by Peaks)

### 10.8 Update Package Dependencies
**File**: `package.json` (root)
**Changes**: Remove WaveSurfer, add Howler + Peaks
```json
{
  "dependencies": {
    // Remove: "wavesurfer.js": "^7.x.x",
    // Add:
    "howler": "^2.2.3",
    "peaks.js": "^1.4.0",
    "konva": "^8.4.0",
    "waveform-data": "^4.0.0"
  }
}
```

---

## 11) Migration Order

1. **Install dependencies** (pnpm add howler peaks.js konva waveform-data -w)
2. **Create useHowlerController hook** (replaces useAudioProvider)
3. **Create usePeaksWaveform hook** (replaces useWaveform)
4. **Update PlayerStore** (remove WaveSurfer state, add Howler state)
5. **Update usePlayerManager** (wire Howler controller)
6. **Update InputPlayer** (replace AudioProvider + WaveformPlayer with Howler + Peaks)
7. **Update SimilarityPlayer** (same changes as InputPlayer)
8. **Test thoroughly** on all platforms
9. **Remove legacy files** (WaveSurfer, AudioProvider, etc.)

---

## 12) Testing Checklist

- [ ] Play/pause works on all browsers
- [ ] Seeking works smoothly (no buffering delays)
- [ ] Autoplay next track works
- [ ] Volume control works across all players
- [ ] MediaSession controls work on iOS
- [ ] Waveform click-to-seek works
- [ ] Track switching is instant
- [ ] No memory leaks (check dev tools)
- [ ] Mobile iOS/Android compatibility
- [ ] Network throttling (seeking performance)

---

If you want, I can wire this into a specific component (e.g., `apps/webapp/src/components/Playlist/InputPlayer.tsx`) and create a minimal waveform component using Peaks next.
