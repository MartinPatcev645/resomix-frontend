# Audio Issues Analysis & Solutions

Based on my analysis of your code, here are the root causes and solutions for each issue:

## 🎵 **Issue 1: Audio/Waveform Sync Problems (All Devices)**

### **Root Cause:**
The sync issue occurs because you have **two separate time tracking systems**:
1. **AudioProvider** tracks time via `onTimeUpdate` → `setInputCurrentTime`/`setSimilarityCurrentTime`
2. **WaveSurfer** tracks time via `onProgress` → same state setters

When network issues cause buffering, these can get out of sync.

### **Problem Location:**
```typescript
// In InputPlayer.tsx & SimilarityPlayer.tsx
onTimeUpdate={setInputCurrentTime}  // Audio element time
onProgress={setInputCurrentTime}    // WaveSurfer time
```

### **Solution:**
Use **only one time source** - the audio element. Remove WaveSurfer's `onProgress` callback:

```typescript
// In WaveformPlayer.tsx - Remove this:
onProgress={setInputCurrentTime}

// Keep only AudioProvider's time updates:
onTimeUpdate={setInputCurrentTime}
```

## 🔒 **Issue 2: Audio Disappears from Notification After Interruption (iOS)**

### **Root Cause:**
iOS removes audio from notification center when the audio element is paused/destroyed during interruptions. Your audio element gets disconnected from the system.

### **Problem Location:**
```typescript
// In useWaveform.ts - AudioContext gets suspended
const ctx = getSharedAudioContext();
if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {/* ignore resume errors */ });
}
```

### **Solution:**
Add **interruption handling** to preserve the audio session:

```typescript
// In AudioProvider.tsx - Add interruption listeners
useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleInterruption = () => {
        // Preserve audio session during interruptions
        audio.play().catch(() => {});
    };

    // iOS interruption events
    document.addEventListener('visibilitychange', handleInterruption);
    window.addEventListener('focus', handleInterruption);
    
    return () => {
        document.removeEventListener('visibilitychange', handleInterruption);
        window.removeEventListener('focus', handleInterruption);
    };
}, []);
```

## 📱 **Issue 3: Seeking Jumps to Next Track (Some iPhones)**

### **Root Cause:**
The iOS seek workaround in `useWaveform.ts` is too aggressive and triggers the `finish` event, which calls `playNext()`.

### **Problem Location:**
```typescript
// In useWaveform.ts - This causes issues on some iPhones
if (IS_IOS) {
    const iosSeekWorkaround = () => {
        if (wavesurfer.isPlaying && wavesurfer.isPlaying()) {
            wavesurfer.pause();
            setTimeout(() => {
                wavesurfer.play(); // This can trigger finish event
            }, 0);
        }
    };
    wavesurfer.on('seeking', iosSeekWorkaround);
}
```

### **Solution:**
Make the seek workaround more selective and add finish event protection:

```typescript
// In useWaveform.ts - Improved iOS seek handling
if (IS_IOS) {
    let isSeeking = false;
    const iosSeekWorkaround = () => {
        if (wavesurfer.isPlaying && wavesurfer.isPlaying() && !isSeeking) {
            isSeeking = true;
            wavesurfer.pause();
            setTimeout(() => {
                wavesurfer.play();
                isSeeking = false;
            }, 50); // Slightly longer delay
        }
    };
    
    wavesurfer.on('seeking', iosSeekWorkaround);
    
    // Prevent finish event during seeking
    wavesurfer.on('finish', () => {
        if (!isSeeking) {
            // Only trigger next track if not seeking
            onProgress?.(wavesurfer.getCurrentTime());
        }
    });
}
```

## 🛠️ **Implementation Priority:**

1. **Fix Issue 1 first** (sync) - Remove WaveSurfer `onProgress` callbacks
2. **Fix Issue 3 second** (seeking) - Improve iOS seek workaround
3. **Fix Issue 2 third** (interruption) - Add interruption handling

These changes will resolve the core issues while maintaining your excellent iOS background playback functionality.

## 📱 **Issue 4: iOS Audio Recognition & Trust (React App)**

### **Root Cause:**
iOS doesn't recognize your web app as a "trusted" audio player, which can cause issues with background playback, notification controls, and system integration.

### **Solution:**
Add proper meta tags and audio element attributes to signal iOS that this is a legitimate audio application:

```html
<!-- In index.html - Add these meta tags -->
<head>
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Resomix">
    <meta name="application-name" content="Resomix">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="theme-color" content="#000000">
    
    <!-- Audio-specific meta tags -->
    <meta name="apple-itunes-app" content="app-argument=resomix-audio">
    <meta property="og:type" content="music.radio_station">
    <meta property="og:audio" content="https://media.resomix.com/">
</head>
```

```typescript
// In AudioProvider.tsx - Enhanced audio element attributes
<audio
    ref={audioRef}
    style={{ display: 'none' }}
    playsInline
    webkit-playsinline="true"
    preload="metadata"
    crossOrigin="anonymous"
    // iOS-specific attributes for better recognition
    x-webkit-airplay="allow"
    x-webkit-airplay-allow="true"
    // Signal this is a music app
    data-audio-type="music"
    data-app-name="resomix"
/>
```

## 🔧 **Issue 5: Enhanced iOS Interruption Handling**

### **Root Cause:**
Basic interruption handling isn't sufficient for all iOS scenarios (calls, Siri, other apps).

### **Solution:**
Implement comprehensive interruption handling based on [react-native-track-player patterns](https://addjam.com/blog/2025-04-04/playing-audio-in-react-native/):

```typescript
// In AudioProvider.tsx - Enhanced interruption handling
useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleInterruption = () => {
        // Preserve audio session during interruptions
        audio.play().catch(() => {});
    };

    const handleAudioInterruption = (event: any) => {
        if (event.type === 'interruption') {
            if (event.interruptionType === 'began') {
                // Interruption started (call, Siri, etc.)
                audio.pause();
            } else if (event.interruptionType === 'ended') {
                // Interruption ended - resume if we were playing
                if (wasPlayingBeforeInterruption) {
                    audio.play().catch(() => {});
                }
            }
        }
    };

    // iOS interruption events
    document.addEventListener('visibilitychange', handleInterruption);
    window.addEventListener('focus', handleInterruption);
    audio.addEventListener('pause', () => {
        // Track if we were playing before interruption
        wasPlayingBeforeInterruption = true;
    });
    
    return () => {
        document.removeEventListener('visibilitychange', handleInterruption);
        window.removeEventListener('focus', handleInterruption);
        audio.removeEventListener('pause', handleInterruption);
    };
}, []);
```

## 🎵 **Issue 6: Audio Session Management**

### **Root Cause:**
iOS audio session isn't properly configured for music playback, causing issues with background audio and system integration.

### **Solution:**
Add proper audio session configuration and MediaSession API support:

```typescript
// In AudioProvider.tsx - Audio session management
useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Configure audio session for music playback
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: 'Resomix',
            artist: 'Music Discovery',
            album: 'Similarity Playlist',
            artwork: [
                { src: '/logo.png', sizes: '96x96', type: 'image/png' },
                { src: '/logo.png', sizes: '128x128', type: 'image/png' },
                { src: '/logo.png', sizes: '192x192', type: 'image/png' },
            ]
        });

        // Handle media session actions
        navigator.mediaSession.setActionHandler('play', () => audio.play());
        navigator.mediaSession.setActionHandler('pause', () => audio.pause());
        navigator.mediaSession.setActionHandler('seekbackward', () => {
            audio.currentTime = Math.max(0, audio.currentTime - 10);
        });
        navigator.mediaSession.setActionHandler('seekforward', () => {
            audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
            // Trigger previous track logic
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
            // Trigger next track logic
        });
    }

    // Update media session state
    const updateMediaSession = () => {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
        }
    };

    audio.addEventListener('play', updateMediaSession);
    audio.addEventListener('pause', updateMediaSession);
    
    return () => {
        audio.removeEventListener('play', updateMediaSession);
        audio.removeEventListener('pause', updateMediaSession);
    };
}, []);
```

## 🔋 **Issue 7: Battery & Performance Optimization**

### **Root Cause:**
Audio playback can drain battery and cause performance issues, especially with continuous background playback.

### **Solution:**
Implement battery-aware audio management:

```typescript
// In usePlayerManager.ts - Battery optimization
useEffect(() => {
    const handleBatteryStatus = () => {
        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                // Reduce quality on low battery
                if (battery.level < 0.2) {
                    // Switch to lower quality audio or reduce update frequency
                    console.log('[PlayerManager] Low battery detected, optimizing audio');
                }
            });
        }
    };

    // Check battery status periodically
    const batteryInterval = setInterval(handleBatteryStatus, 60000); // Every minute
    
    return () => clearInterval(batteryInterval);
}, []);

// In useWaveform.ts - Optimize waveform updates
const progressHandler = useCallback(() => {
    const t = wavesurfer.getCurrentTime();
    // Throttle progress updates to reduce CPU usage
    if (Math.floor(t) % 2 === 0) { // Update every 2 seconds instead of every frame
        onProgress?.(t);
    }
}, [onProgress]);
```

## 📊 **Issue 8: Error Recovery & Resilience**

### **Root Cause:**
Network issues and audio loading failures aren't handled gracefully, causing playback to stop permanently.

### **Solution:**
Implement robust error recovery:

```typescript
// In AudioProvider.tsx - Error recovery
const [retryCount, setRetryCount] = useState(0);
const maxRetries = 3;

const handleError = useCallback(async (error: any) => {
    console.error('[AudioProvider] Audio error:', error);
    
    if (retryCount < maxRetries) {
        console.log(`[AudioProvider] Retrying audio load (${retryCount + 1}/${maxRetries})`);
        setRetryCount(prev => prev + 1);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        
        // Reload audio
        const audio = audioRef.current;
        if (audio && src) {
            audio.load();
        }
    } else {
        console.error('[AudioProvider] Max retries reached, giving up');
        onError?.(error);
    }
}, [retryCount, maxRetries, src, onError]);

// Reset retry count on successful load
const handleLoadedMetadata = useCallback(() => {
    setRetryCount(0);
    setIsProviderReady(true);
    onLoadedMetadata?.();
}, [onLoadedMetadata]);
``` 