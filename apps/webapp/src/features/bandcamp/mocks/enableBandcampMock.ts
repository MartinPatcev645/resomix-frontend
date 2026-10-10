/**
 * Starts the MSW browser worker with the Bandcamp handlers. Only ever imported from `main.tsx`
 * behind `import.meta.env.DEV && VITE_BANDCAMP_MOCK === "true"`, so production builds drop it.
 * Requests that no handler matches go to the real backend untouched.
 */
export async function enableBandcampMock(): Promise<void> {
  const [{ setupWorker }, { bandcampHandlers }] = await Promise.all([
    import("msw/browser"),
    import("./bandcampHandlers.ts"),
  ]);
  await setupWorker(...bandcampHandlers).start({ onUnhandledRequest: "bypass" });
  console.info("[bandcamp] Mock mode is ON — /api/v1/bandcamp/* is served by MSW.");
}
