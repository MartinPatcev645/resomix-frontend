import { useEffect, useState } from 'react';
import {
  handleTidalCallback,
  checkTidalGuardKey,
  setTidalGuardKey
} from "@resomix/hooks/Transfer/tidalService.js";

export function TidalRedirect() {
  const [canClose, setCanClose] = useState(true);
  const message = 'Finishing TIDAL authentication…';

  useEffect(() => {
    (async () => {
      const inParams = new URLSearchParams(window.location.search);
      const code = inParams.get('code') || '';
      const state = inParams.get('state') || '';
      const error = inParams.get('error') || '';
      const errorDescription =
        inParams.get('error_description') ||
        inParams.get('errorDescription') ||
        '';

      const finish = (payload: any) => {
        try {
          window.opener?.postMessage(
            { type: 'TIDAL_AUTH_RESULT', ...payload },
            window.location.origin
          );
        } catch { }
        try {
          window.close();
        } catch {
          setCanClose(false);
        }
      };

      if (error) {
        const errMsg = `TIDAL authorization failed: ${errorDescription || error}`;
        localStorage.setItem('tidal_last_error', errMsg);
        finish({ success: false, error: errMsg });
        return;
      }

      if (checkTidalGuardKey(state)) {
        return;
      }
      setTidalGuardKey(state);

      if (code && state) {
        try {
          const res = await handleTidalCallback(code, state);
          if (res?.success) {
            localStorage.setItem('tidal_connected_at', String(Date.now()));
            finish({ success: true });
            return;
          } else {
            const errMsg = res?.error || 'Failed to connect to TIDAL';
            localStorage.setItem('tidal_last_error', errMsg);
            finish({ success: false, error: errMsg });
            return;
          }
        } catch (e: any) {
          const errMsg = e?.message || 'Unexpected error during TIDAL callback';
          localStorage.setItem('tidal_last_error', errMsg);
          finish({ success: false, error: errMsg });
          return;
        }
      }

      const errMsg = 'Missing OAuth parameters';
      localStorage.setItem('tidal_last_error', errMsg);
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
