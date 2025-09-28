# Audio Control Flow Guide for Resomix

A comprehensive guide for new developers to understand the audio playback architecture and waveform management in the Resomix application.

## 🎵 Overview

The Resomix audio system is built around **similarity-based music discovery**. Users upload or search for a track (the "input"), and the system generates a playlist of similar tracks. The audio flow manages two concurrent players:

1. **Input Player** - Plays the original uploaded/searched track
2. **Similarity Player** - Plays the currently selected similar track

Both players work together with shared volume controls and seamless track switching.

## 🏗️ Architecture Overview

```
User Upload/Search
       ↓
   Playlist Data
       ↓
┌─────────────────┬─────────────────┐
│   Input Player  │ Similarity Player│
│   (Original)    │  (Current Track) │
└─────────────────┴─────────────────┘
       ↓                 ↓
   WaveformPlayer    WaveformPlayer
       ↓                 ↓
    useWaveform      useWaveform
       ↓                 ↓
    WaveSurfer.js    WaveSurfer.js
```

## 🎛️ Core Components

### 1. Player Management (`usePlayerManager`)

**Location**: `packages/hooks/src/Player/usePlayerManager.ts`

The central orchestrator that:
- Manages which track is currently playing
- Handles track switching and autoplay
- Synchronizes volume across all players
- Controls playlist navigation (next/previous)

```typescript
const { 
  currentTrackId,      // ID of currently playing track
  startPlaying,        // Start playing a specific track
  stopPlaying,         // Stop current playback
  playNext,           // Advance to next track
  volume,             // Global volume (0-1)
  setVolume          // Update global volume
} = usePlayerManager();
```

### 2. Input Player (`InputPlayer`)

**Location**: `apps/webapp/src/components/Playlist/InputPlayer.tsx`

Handles the **original uploaded/searched track**:
- Always visible in the UI
- Uses `AudioProvider` for gesture preservation
- Integrates with `WaveformPlayer` for visualization
- Automatically starts when `autoPlay` is enabled

**Key Features**:
- Persistent audio element (BeMusic pattern)
- Skip forward/backward (±10 seconds)
- Volume control with mute functionality
- Progress tracking and time updates

### 3. Similarity Player (`SimilarityPlayer`)

**Location**: `apps/webapp/src/components/Playlist/SimilarityPlayer.tsx`

Handles **similar tracks from the playlist**:
- Changes based on user selection
- Same controls as Input Player
- Shares global volume settings
- Auto-advances to next track when finished

### 4. Waveform Player (`WaveformPlayer`)

**Location**: `apps/webapp/src/components/Playlist/WaveformPlayer.tsx`

The visual waveform component that:
- Renders interactive waveforms using WaveSurfer.js
- Handles play/pause state synchronization
- Provides seek functionality by clicking on waveform
- Updates progress in real-time



## 🔧 Core Hooks

### `useWaveform`

**Location**: `packages/hooks/src/Waveform/useWaveform.ts`

The main waveform management hook:
- Initializes WaveSurfer.js instances
- Fetches pre-computed peaks from API
- Handles audio loading and playback
- Manages shared AudioContext (iOS optimization)
- Provides gesture preservation for mobile

**Key Features**:
- Peak data fetching and caching
- iOS-specific optimizations
- Error handling and fallbacks
- Progress tracking callbacks



### `useAudioProvider`

**Location**: `packages/hooks/src/Player/useAudioProvider.tsx`

Manages persistent audio elements:
- **BeMusic Pattern**: Creates audio element immediately on mount
- Handles gesture unlocking for iOS
- Provides consistent audio element across track changes
- Manages playback state and callbacks

**Key Methods**:
```typescript
const { audioProviderRef, getAudioElement } = useAudioProviderRef();

// Access audio element
const audio = getAudioElement();
```

## 🗄️ State Management

### Player Store (`usePlayerStore`)

**Location**: `packages/stores/src/usePlayer.ts`

Central state for all audio playback:

```typescript
interface PlayerStore {
  // Current playback
  currentTrackId: string | null;
  
  // WaveSurfer instances
  inputWs: WaveSurfer | null;        // Input player waveform
  similarityWs: WaveSurfer | null;   // Similarity player waveform
  
  // Playback controls
  volume: number;                    // Global volume (0-1)
  autoplay: boolean;                 // Auto-advance tracks
  
  // Progress tracking
  inputCurrentTime: number;          // Input player position
  similarityCurrentTime: number;     // Similarity player position
  
  // Provider readiness (BeMusic pattern)
  inputProviderReady: boolean;
  similarityProviderReady: boolean;
}
```

### Playlist Store (`usePlaylistStore`)

**Location**: `packages/stores/src/usePlayList.ts`

Manages playlist data and track information:

```typescript
interface PlaylistStore {
  playlistData: PlaylistData | null;  // Current playlist
  trackRatings: Record<string, number>; // User ratings
  isLoading: boolean;                  // Loading state
  error: string | null;               // Error messages
}
```

## 🔄 Audio Flow Walkthrough

### 1. Initial Setup
1. User uploads audio file or searches for a track
2. `useUpload` or `useSearch` hooks process the request
3. API returns playlist data with similar tracks
4. `PlaylistStore` receives and stores the data

### 2. Player Initialization
1. `InputPlayer` mounts with the original track
2. `AudioProvider` creates persistent audio element
3. `WaveformPlayer` initializes WaveSurfer.js
4. `useWaveform` fetches peaks data from API
5. Players register their WaveSurfer instances in `PlayerStore`

### 3. Playback Control
1. User clicks play on any player
2. `usePlayerManager` updates `currentTrackId`
3. Corresponding player receives `isPlaying={true}`
4. `WaveformPlayer` calls `wavesurfer.play()`
5. Progress updates flow back through `onProgress` callbacks

### 4. Track Switching
1. User selects different track from playlist
2. `usePlayerManager.startPlaying(newTrackId)` called
3. Previous player stops, new player starts
4. `SimilarityPlayer` updates with new track data
5. Waveform re-initializes with new peaks data

### 5. Volume Control
1. User adjusts volume slider
2. `PlayerStore.setVolume()` updates global volume
3. `usePlayerManager` syncs volume to all WaveSurfer instances
4. `AudioProvider` elements also receive volume updates

## 🎯 Key Patterns

### BeMusic Pattern
- **Persistent Audio Elements**: Create audio elements immediately, not on user interaction
- **Gesture Preservation**: Unlock audio playback with silent audio on mount
- **Source Switching**: Change `src` attribute instead of creating new elements

### Dual Player Architecture
- **Input Player**: Always shows original track
- **Similarity Player**: Changes based on selection
- **Shared Controls**: Volume and playback state synchronized
- **Independent Progress**: Each player tracks its own position

### Mobile Optimizations
- **Shared AudioContext**: Prevents iOS 6-context limit
- **Gesture Unlocking**: Immediate silent audio playback
- **iOS Attributes**: `playsinline`, `webkit-playsinline` for mobile Safari

## 🛠️ Development Tips

### Adding New Audio Features
1. **State First**: Add required state to `PlayerStore` or `PlaylistStore`
2. **Hook Integration**: Use `usePlayerManager` for playback control
3. **Component Props**: Pass state down through component props
4. **Callback Flow**: Use callbacks for state updates (e.g., `onProgress`)

### Debugging Audio Issues
1. **Check Browser Console**: WaveSurfer logs are prefixed with component names
2. **Provider Readiness**: Ensure `inputProviderReady`/`similarityProviderReady` are true
3. **Gesture Unlock**: Verify silent audio playback succeeded on mobile
4. **Network Requests**: Check peaks API calls in Network tab

### Common Gotchas
- **iOS Context Limit**: Always use shared AudioContext
- **Gesture Requirements**: Audio must be triggered by user interaction
- **WaveSurfer Lifecycle**: Properly destroy instances to prevent memory leaks
- **Peak Data Format**: API returns different formats - handle both arrays and objects

### Legacy Components
- **PeaksPlayer**: Exists but is only used in test pages (`TestTwo.tsx`). The main application uses `WaveformPlayer` with WaveSurfer.js for all waveform visualization.
- **usePeaks**: Available but not used in production. All waveform functionality uses `useWaveform` with WaveSurfer.js.

## 📁 File Structure Reference

```
packages/
├── hooks/src/Player/
│   ├── usePlayerManager.ts      # Central playback control
│   ├── useAudioProvider.tsx     # Persistent audio elements
│   └── useAudioContextUnlocker.ts # Gesture handling
├── hooks/src/Waveform/
│   ├── useWaveform.ts          # WaveSurfer.js integration
│   └── usePeaks.ts             # Peaks.js integration
├── stores/src/
│   ├── usePlayer.ts            # Playback state
│   └── usePlayList.ts          # Playlist data
└── api-client/src/
    └── peaks.ts                # Waveform data API

apps/webapp/src/components/Playlist/
├── InputPlayer.tsx             # Original track player
├── SimilarityPlayer.tsx        # Similar track player
└── WaveformPlayer.tsx          # Waveform visualization
```

## 🚀 Getting Started

1. **Understand the Flow**: Start with `usePlayerManager` to see how tracks are controlled
2. **Follow a Track**: Trace how a track goes from upload → playlist → playback
3. **Examine State**: Use React DevTools to inspect `PlayerStore` and `PlaylistStore`
4. **Test Mobile**: Always test audio features on actual mobile devices
5. **Read Console Logs**: Component logging helps understand the audio lifecycle

This architecture provides a robust, mobile-friendly audio system that handles complex similarity-based playlists while maintaining smooth user experience across devices. 