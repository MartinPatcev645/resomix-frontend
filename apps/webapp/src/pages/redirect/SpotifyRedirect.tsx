import { useEffect, useState } from 'react';
import { handleSpotifyCallback, checkGuardKey, setGuardKey } from '../../services/spotifyService.ts';

export function SpotifyRedirect() {
  const [canClose, setCanClose] = useState(true);
  const message = 'Finishing Spotify authentication…';

  useEffect(() => {
    (async () => {
      const inParams = new URLSearchParams(window.location.search);
      const code = inParams.get('code') || '';
      const state = inParams.get('state') || '';
      const error = inParams.get('error') || '';

      const finish = (payload: any) => {
        try {
          window.opener?.postMessage(
            { type: 'SPOTIFY_AUTH_RESULT', ...payload },
            window.location.origin
          );
        } catch {}
        try {
          window.close();
        } catch {
          setCanClose(false);
        }
      };

      // Error from Spotify
      if (error) {
        const errMsg = `Spotify authorization failed: ${error}`;
        localStorage.setItem('spotify_last_error', errMsg);
        finish({ success: false, error: errMsg });
        return;
      }

      // Guard against double-processing (StrictMode/re-render)
      if (checkGuardKey(state)) {
        // Already handled — just navigate to the playlist page
        // window.location.replace(backUrl);
        return;
      }
      setGuardKey(state);


      if (code && state) {
        try {
          const res = await handleSpotifyCallback(code, state);
          if (res.success) {
            localStorage.setItem('spotify_connected_at', String(Date.now()));
            // optionally: localStorage.setItem('spotify_last_state', state);
            finish({ success: true });
            return;
          } else {
            const errMsg = res.error || 'Failed to connect to Spotify';
            localStorage.setItem('spotify_last_error', errMsg);
            finish({ success: false, error: errMsg });
            return;
          }
        } catch (e: any) {
          const errMsg = e?.message || 'Unexpected error during Spotify callback';
          localStorage.setItem('spotify_last_error', errMsg);
          finish({ success: false, error: errMsg });
          return;
        }
      }

      const errMsg = 'Missing OAuth parameters';
      localStorage.setItem('spotify_last_error', errMsg);
      finish({ success: false, error: errMsg });
    })();

  }, []);

  if (!canClose) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 8 }}>{message}</div>
        <button onClick={() => window.close()}>Close this window</button>
      </div>
    );
  }
  return <div>Finishing…</div>;
}