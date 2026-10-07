# Site Usage Report: Animations, WebGL, and Resource Intensity

This report details the rendering technologies and resource intensity across key pages of the Resomix platform.

## Summary

The primary graphics load on the platform is the **StaticNoise (Seagull Nebula)** background, which is implemented in raw WebGL (GLSL Shaders) and rendered on the **GPU**. This component is present on **every page** in both the landing and web applications.

| Technology           | Resource Type | Intensity  | Notes                                                   |
| :------------------- | :------------ | :--------- | :------------------------------------------------------ |
| **WebGL (Raw GLSL)** | GPU           | High       | Used for Seagull Nebula background.                     |
| **Canvas2D**         | CPU           | Low/Medium | Used for static waveform drawing (Peaks.js).            |
| **SVG Animation**    | CPU           | Low        | Used in `WaveformLoader` for flowing curves.            |
| **CSS / JS (RAF)**   | CPU           | Very Low   | Used for `HoverFlow` scrolling text and UI transitions. |

---

## Page-Specific Analysis

### 1. Landing Site - Home Page

The landing page features several high-impact animations, many of which use WebGL or Canvas to achieve premium visual effects.

| Component          | Technology       | Impact       | Trigger / Lifecycle                                  |
| :----------------- | :--------------- | :----------- | :--------------------------------------------------- |
| **StaticNoise**    | WebGL (GPU)      | **High**     | Global (Full-screen). Always active.                 |
| **Tunnel**         | WebGL (GPU)      | **Medium**   | `HomeSix`. Only mounts when visible (useOnScreen).   |
| **Terrain**        | WebGL (GPU)      | **Medium**   | `HomeSeven`. Only mounts when visible (useOnScreen). |
| **SineWaves**      | Canvas2D (GPU)   | **Low/Med**  | `HomeFour`. Only mounts when visible (useOnScreen).  |
| **GoldenSpiral**   | SVG SMIL (GPU)   | **Low**      | `HomeNine`. Only mounts when visible (useOnScreen).  |
| **CodeTyping**     | JavaScript (CPU) | **Very Low** | Text revealing logic across several sections.        |
| **Scroll Scaling** | React/CSS (CPU)  | **Low**      | `HomeSix` text box scaling (Re-renders on scroll).   |
| **UI Hovers**      | CSS (GPU)        | **Minimal**  | `ButtonHeavyRight`, `IconComp` transitions.          |

> [!NOTE]  
> The use of `useOnScreen` with a margin (600px - 1000px) is a critical optimization. It ensures that only necessary WebGL contexts/Canvas elements are active at any given time.

### 2. Landing Site - About Page

- **StaticNoise (WebGL):** 1 Context (GPU). Persistent background.
- **About Graphics:** SVG/IMG (CPU). Static content graphics.

### 3. WebApp - Upload Page

- **StaticNoise (WebGL):** 1 Context (GPU). Persistent background.
- **Upload Hero:** SVG/CSS. Simple interactive elements.
- **Upload Loader:** CPU (CSS/JS). Uses CSS keyframes or JS-based SVG animations during the upload process.

### 4. WebApp - Playlist Page

- **StaticNoise (WebGL):** 1 Context (GPU). Persistent background.
- **Waveform Visualization (Peaks.js):** **Canvas2D** (CPU). Renders the static track waveform. This is likely the source of the `Canvas2D` console warnings.
- **WaveformLoader:** **SVG Animation** (CPU). Used during waveform generation.
- **HoverFlow:** CPU (JS/CSS). Uses `requestAnimationFrame` for smooth text scrolling.

---

## Conclusion & Stability Risks

The site is highly optimized for performance, with the only significant GPU load being the background shader. However, because each tab creates its own WebGL context, opening many tabs (>16) triggers browser-level context eviction.

**Stability Prediction:**

- 1 Tab: Extremely Stable.
- 5-10 Tabs: Stable.
- 16+ Tabs: **Context Loss Expected** (oldest tabs will go black).

**Recommendation:**
Implement **Aggressive Lifecycle Management** (destroying the background in hidden tabs) to allow virtually unlimited tabs without crashes.
