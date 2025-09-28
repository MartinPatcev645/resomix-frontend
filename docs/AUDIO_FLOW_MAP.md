# Audio Flow Map - Resomix Web Application

A comprehensive guide to the audio playback architecture, components, hooks, stores, and flow in the Resomix application.

## 📁 File Structure & Responsibilities

### 🎵 Core Audio Components

#### **InputPlayer** - `apps/webapp/src/components/Playlist/InputPlayer.tsx`
- **Purpose**: Handles playback of the original uploaded/searched track
- **Key Features**:
  - Always visible in the UI (persistent player)
  - Uses AudioProvider for gesture preservation (BeMusic pattern)
  - Integrates with WaveformPlayer for visualization
  - Auto-starts when `autoPlay` prop is enabled
  - Skip forward/backward (±10 seconds)
  - Volume control with mute functionality
  - Progress tracking and time updates

#### **SimilarityPlayer** - `apps/webapp/src/components/Playlist/SimilarityPlayer.tsx`
- **Purpose**: Handles playback of similar tracks from the playlist
- **Key Features**:
  - Changes based on user selection in playlist table
  - Same controls as InputPlayer (skip, volume, progress)
  - Shares global volume settings via PlayerManager
  - Auto-advances to next track when finished (if autoplay enabled)
  - Uses AudioProvider for persistent audio element

#### **WaveformPlayer** - `apps/webapp/src/components/Playlist/WaveformPlayer.tsx`
- **Purpose**: Visual waveform component using WaveSurfer.js
- **Key Features**:
  - Renders interactive waveforms using WaveSurfer.js
  - Handles play/pause state synchronization
  - Provides seek functionality by clicking on waveform
  - Updates progress in real-time
  - Supports both persistent audio elements and direct URLs

#### **PeaksPlayer** - `apps/webapp/src/components/Playlist/PeaksPlayer.tsx`
- **Purpose**: Legacy waveform component using Peaks.js (used only in test pages)
- **Key Features**:
  - Alternative waveform visualization using Peaks.js
  - Used in TestTwo.tsx for testing purposes
  - Not used in production playlist pages

### 🔧 Core Audio Hooks

#### **usePlayerManager** - `packages/hooks/src/Player/usePlayerManager.ts`
- **Purpose**: Central orchestrator for all audio playback control
- **Key Features**:
  - Manages which track is currently playing (`currentTrackId`)
  - Handles track switching and autoplay logic
  - Synchronizes volume across all players
  - Controls playlist navigation (next/previous/first/last)
  - Integrates with MediaSession API for iOS controls
  - Provides playlist statistics and track utilities

#### **useAudioProvider** - `packages/hooks/src/Player/useAudioProvider.tsx`
- **Purpose**: Manages persistent audio elements (BeMusic pattern)
- **Key Features**:
  - Creates audio element immediately when component mounts
  - Handles gesture unlocking for iOS with silent audio
  - Provides consistent audio element across track changes
  - Manages playback state and callbacks
  - MediaSession API integration for better iOS support
  - Interruption handling and recovery

#### **useAudioProviderRef** - `packages/hooks/src/Player/useAudioProvider.tsx`
- **Purpose**: Hook to manage AudioProvider reference
- **Key Features**:
  - Provides ref to AudioProvider component
  - Access to audio element and provider readiness state
  - Used by both InputPlayer and SimilarityPlayer

#### **useAudioContextUnlocker** - `packages/hooks/src/Player/useAudioContextUnlocker.ts`
- **Purpose**: iOS gesture preservation helper
- **Key Features**:
  - Implements BeMusic's strategy for preserving user gestures
  - Creates and unlocks audio element with silent audio immediately
  - Handles AudioContext state management
  - Used for iOS-specific audio unlocking

#### **useWaveform** - `packages/hooks/src/Waveform/useWaveform.ts`
- **Purpose**: Main waveform management hook using WaveSurfer.js
- **Key Features**:
  - Initializes WaveSurfer.js instances
  - Fetches pre-computed peaks from API (`/peaks/?uuid=${trackId}`)
  - Handles audio loading and playback
  - Manages shared AudioContext (iOS optimization)
  - Provides gesture preservation for mobile
  - Peak data fetching, caching, and error handling
  - Progress tracking callbacks

#### **usePeaks** - `packages/hooks/src/Waveform/usePeaks.ts`
- **Purpose**: Legacy waveform hook using Peaks.js
- **Key Features**:
  - Lightweight React hook wrapping Peaks.js initialization
  - Fetches waveform data from API
  - Used only in test pages, not production

### 🗄️ State Management Stores

#### **usePlayerStore** - `packages/stores/src/usePlayer.ts`
- **Purpose**: Central state for all audio playback
- **Key State**:
  - `currentTrackId`: Currently playing track ID
  - `inputWs`/`similarityWs`: WaveSurfer instances
  - `volume`: Global volume (0-1, persisted in localStorage)
  - `autoplay`: Auto-advance tracks (persisted in localStorage)
  - `inputCurrentTime`/`similarityCurrentTime`: Real-time playback positions
  - `inputProviderReady`/`similarityProviderReady`: AudioProvider readiness states
  - `uploadedUrl`/`uploadedCoverArt`: Local upload data

#### **usePlaylistStore** - `packages/stores/src/usePlayList.ts`
- **Purpose**: Manages playlist data and track information
- **Key State**:
  - `playlistData`: Current playlist with queried track and similar tracks
  - `trackRatings`: User ratings for tracks
  - `isLoading`/`error`: Loading and error states

### 🎛️ Playlist Orchestration

#### **PlaylistHero** - `apps/webapp/src/sections/desktop/Playlist/PlaylistHero.tsx`
- **Purpose**: Renders the input track player at the top
- **Key Features**:
  - Displays uploaded/searched track information
  - Renders InputPlayer component
  - Shows track metadata and status

#### **PlaylistTable** - `apps/webapp/src/sections/desktop/Playlist/PlaylistTable.tsx`
- **Purpose**: Renders the list of similar tracks with players
- **Key Features**:
  - Maps through similar tracks from playlist data
  - Renders SimilarityPlayer for currently selected track
  - Handles play/pause button clicks
  - Manages track ratings and interactions

#### **PlaylistPage** - `apps/webapp/src/pages/desktop/PlaylistPage.tsx`
- **Purpose**: Main playlist page orchestrating all components
- **Key Features**:
  - Combines PlaylistHero and PlaylistTable
  - Handles loading and error states
  - Manages page layout and navigation

## 🔄 Complete Audio Flow

### 1. **Initial Setup & Data Loading**
```
User Upload/Search → API Request → PlaylistStore.setPlaylistData() → PlaylistPage renders
```

### 2. **Player Initialization**
```
PlaylistPage mounts → PlaylistHero renders InputPlayer → AudioProvider creates persistent audio element → WaveformPlayer initializes WaveSurfer → useWaveform fetches peaks → Player registers WaveSurfer in PlayerStore
```

### 3. **Autoplay Flow**
```
InputPlayer mounts with autoPlay=true → useEffect triggers startPlaying(effectiveId) → usePlayerManager.cueTrack() → setCurrentTrack(trackId) → WaveformPlayer receives isPlaying=true → WaveSurfer.play() → Audio starts playing
```

### 4. **Track Switching Flow**
```
User clicks play on different track → PlaylistTable.handlePlayPause(trackId) → usePlayerManager.startPlaying(newTrackId) → cueTrack(newTrackId) → setCurrentTrack(newTrackId) → Previous player stops, new player starts → SimilarityPlayer updates with new track data → Waveform re-initializes with new peaks
```

### 5. **Volume Control Flow**
```
User adjusts volume slider → PlayerStore.setVolume(newVolume) → usePlayerManager syncs volume to all WaveSurfer instances → AudioProvider elements receive volume updates → All players update simultaneously
```

### 6. **Autoplay Next Track Flow**
```
Current track ends → AudioProvider.onEnded() → usePlayerManager.playNext() → Checks autoplay setting → If enabled: cueTrack(nextTrackId) → If disabled: stopPlaying() → New track starts or playback stops
```

### 7. **iOS Gesture Preservation Flow**
```
AudioProvider mounts → Creates audio element immediately → Unlocks with silent audio → Sets iOS-specific attributes → MediaSession API integration → Audio ready for user interaction
```

## 🎯 Key Patterns & Strategies

### **BeMusic Pattern**
- **Persistent Audio Elements**: Create audio elements immediately, not on user interaction
- **Gesture Preservation**: Unlock audio playback with silent audio on mount
- **Source Switching**: Change `src` attribute instead of creating new elements
- **Provider Readiness**: Track when audio metadata is loaded

### **Dual Player Architecture**
- **Input Player**: Always shows original track (persistent)
- **Similarity Player**: Changes based on selection (dynamic)
- **Shared Controls**: Volume and playback state synchronized
- **Independent Progress**: Each player tracks its own position

### **Mobile Optimizations**
- **Shared AudioContext**: Prevents iOS 6-context limit
- **Gesture Unlocking**: Immediate silent audio playback
- **iOS Attributes**: `playsinline`, `webkit-playsinline` for mobile Safari
- **MediaSession API**: Better iOS integration and controls

### **Waveform Management**
- **Peak Data**: Pre-computed peaks from API for fast loading
- **Fallback Generation**: Generate peaks from audio when API data unavailable
- **Shared AudioContext**: Single context across all waveforms
- **Persistent Elements**: Use AudioProvider elements when available

## 🚀 Getting Started with Audio Development

### **Adding New Audio Features**
1. **State First**: Add required state to `PlayerStore` or `PlaylistStore`
2. **Hook Integration**: Use `usePlayerManager` for playback control
3. **Component Props**: Pass state down through component props
4. **Callback Flow**: Use callbacks for state updates (e.g., `onProgress`)

### **Debugging Audio Issues**
1. **Check Browser Console**: WaveSurfer logs are prefixed with component names
2. **Provider Readiness**: Ensure `inputProviderReady`/`similarityProviderReady` are true
3. **Gesture Unlock**: Verify silent audio playback succeeded on mobile
4. **Network Requests**: Check peaks API calls in Network tab

### **Common Gotchas**
- **iOS Context Limit**: Always use shared AudioContext
- **Gesture Requirements**: Audio must be triggered by user interaction
- **WaveSurfer Lifecycle**: Properly destroy instances to prevent memory leaks
- **Peak Data Format**: API returns different formats - handle both arrays and objects

## 📚 Legacy Components
- **PeaksPlayer**: Exists but is only used in test pages (`TestTwo.tsx`). The main application uses `WaveformPlayer` with WaveSurfer.js for all waveform visualization.
- **usePeaks**: Available but not used in production. All waveform functionality uses `useWaveform` with WaveSurfer.js.

## 🔗 API Integration
- **Peaks API**: `GET /peaks/?uuid=${trackId}` - Returns pre-computed waveform data
- **Audio API**: `GET /signed-audio/?uuid=${trackId}` - Returns signed audio stream
- **Rating API**: `POST /rate` - Submits user track ratings

This architecture provides a robust, mobile-optimized audio playback system with gesture preservation, autoplay capabilities, and seamless track switching while maintaining excellent user experience across all devices. 
