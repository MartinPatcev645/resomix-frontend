// playerActions.ts
export function playTrack(trackId: string) {
  window.dispatchEvent(new CustomEvent('resomix:play-request', { detail: { trackId } }));
}