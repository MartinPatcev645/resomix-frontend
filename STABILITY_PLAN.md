# Stability Plan: Fixing the "Black Screen" on Multiple Tabs

## The Root Cause

Browsers have a **hard limit on active WebGL contexts**.

- **Chrome/Desktop:** ~16 active contexts.
- **Safari/Mobile:** ~8-16 active contexts (and very aggressive about killing background ones).

When you open 12 tabs, you create 12 contexts. As soon as you hit the limit (e.g., tab #13-17), the browser **forcefully kills** the oldest contexts to free up memory. This is not a bug in our code; it is a browser resource protection mechanism.

Large companies (Apple, Stripe, Linear) avoid this by not using raw WebGL for every single page instance in this way. They use one of the solutions below.

---

## Option 1: The "Video" Approach (Recommended for Stability)

**Concept:** We record a perfect 30-60s loop of the nebula and serve it as a high-quality (4K/HD) `<video>` tag.
**Why it works:** Video decoders are separate from the WebGL context limit. You can open 50 tabs with `<video>` backgrounds, and the browser handles it effortlessly.

| Feature         | Rating           | Notes                                                                                |
| :-------------- | :--------------- | :----------------------------------------------------------------------------------- |
| **Stability**   | 🛡️ **100%**      | Zero risk of WebGL context loss. Works on every device.                              |
| **Performance** | ⚡ **High**      | Hardware decoded. Very low CPU/GPU usage compared to live simulation.                |
| **Visuals**     | 🎨 **Identical** | We record the exact shader we just built.                                            |
| **Dynamism**    | 📉 **Low**       | Passing `speed` props won't change the video speed instantly. It's a pre-baked loop. |

**Implementation:**

1. I record the current GLSL animation to a seamless looping MP4/WebM.
2. We replace `StaticNoise.tsx` with a `<video loop muted playsInline ... />` component.
3. **Done forever.**

---

## Option 2: Aggressive Lifecycle Management (The Logic Fix)

**Concept:** We assume the user **cannot** see 12 tabs at once. We force `StaticNoise` to **destroy itself** completely when the tab is hidden and **rebuild itself** when the tab is visible.
**Why it works:** If you have 20 tabs open, only the _active_ tab (and maybe 1-2 others) acts as a "live" WebGL context. The other 18 are just empty `<div>`s, consuming 0 WebGL resources.

| Feature         | Rating            | Notes                                                                                                                                         |
| :-------------- | :---------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stability**   | 🛡️ **95%**        | Solves the "16 context limit" because invalid tabs don't count.                                                                               |
| **Performance** | ⚡ **Medium**     | Re-initializing the shader takes ~50-100ms when you switch tabs. Might see a tiny "pop" or fade-in.                                           |
| **Visuals**     | 🎨 **Live**       | Keeps all the live procedural generation and prop controls.                                                                                   |
| **Risks**       | ⚠️ **Edge Cases** | Dragging a window to a second monitor so _two_ windows are visible simultaneously means 2 active contexts. (Still way below the limit of 16). |

**Implementation:**

1. Modify `StaticNoise` to aggressively call `gl.getExtension('WEBGL_lose_context').loseContext()` on `document.hidden`.
2. Re-run `initGL()` on `document.visible`.

---

## Option 3: The Hybrid Failover (The "Safety Net")

**Concept:** We keep the current WebGL code but take a "screenshot" of the nebula. We set that screenshot as the `background-image` of the container.
**Why it works:** If WebGL crashes/dies, the canvas becomes transparent, revealing the static screenshot underneath. The user sees a "still" nebula instead of a black void.

| Feature         | Rating       | Notes                                                              |
| :-------------- | :----------- | :----------------------------------------------------------------- |
| **Stability**   | 🛡️ **High**  | You never see "nothing". You see either animation or a nice image. |
| **Performance** | ⚡ **Low**   | Doesn't actually _fix_ the crash, just hides it.                   |
| **Visuals**     | 🎨 **Mixed** | If it crashes, it stops moving.                                    |

**Implementation:**

1. Generate a high-res JPG of the nebula.
2. Set it as `backgroundImage` in CSS.
3. Keep existing WebGL logic on top.

---

## My Recommendation

- **If you want "Set it and forget it" stability:** Choose **Option 1 (Video)**. This is how most production "hero" backgrounds work.
- **If you need the animation to be live/randomized per load:** Choose **Option 2 (Aggressive Lifecycle)**.

**Which path shall we take?**
