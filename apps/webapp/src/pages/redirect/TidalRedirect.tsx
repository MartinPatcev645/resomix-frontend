import React, { useEffect, useMemo, useState } from 'react';
// adjust the import path for your project
import { handleTidalCallback } from '../../services/tidalService.ts';

const TidalRedirect: React.FC = () => {
  const [status, setStatus] = useState<'processing' | 'error' | 'done'>('processing');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const allParams = useMemo(() => Object.fromEntries(params.entries()), [params]);

  const state = params.get('state') || '';
  const code = params.get('code') || '';
  const error = params.get('error') || '';
  const errorDescription =
    params.get('error_description') ||
    params.get('errorDescription') ||
    '';

  const backUrl = useMemo(() => {
    const url = new URL('/sonic-discovery', window.location.origin);
    if (state) url.searchParams.set('id', state);
    url.searchParams.set('share', 'true');
    return url.toString();
  }, [state]);

  useEffect(() => {
    // For debugging
    console.debug('[TIDAL Redirect] params:', allParams);

    // Error from TIDAL
    if (error) {
      setStatus('error');
      setErrorMsg(`TIDAL returned an error: ${errorDescription || error}`);
      return;
    }

    // Basic validation
    if (!state) {
      setStatus('error');
      setErrorMsg('The TIDAL response is missing the state parameter.');
      return;
    }
    if (!code) {
      setStatus('error');
      setErrorMsg('The TIDAL response is missing the code parameter.');
      return;
    }

    // Check against saved state
    const savedState = localStorage.getItem('tidal_auth_state');
    if (!savedState) {
      setStatus('error');
      setErrorMsg('Saved state (tidal_auth_state) not found. Please start the authorization again.');
      return;
    }
    if (savedState !== state) {
      setStatus('error');
      setErrorMsg('State does not match the saved value. A request tampering attempt may have occurred.');
      return;
    }

    // Guard against double-processing (StrictMode/re-render)
    const handledKey = `oauth_handled_tidal_${state}`;
    if (sessionStorage.getItem(handledKey)) {
      // Already handled — just navigate to the playlist page
      // window.location.replace(backUrl);
      return;
    }
    sessionStorage.setItem(handledKey, '1');

    // Exchange code for token(s)
    (async () => {
      try {
        const res = await handleTidalCallback(code, state);
        if (res?.success) {
          // Clear one-time PKCE/state values
          try {
            sessionStorage.removeItem('tidal_pkce');
            localStorage.removeItem('tidal_auth_state');
          } catch {}
          setStatus('done');

          // Small delay so the user sees the status
          setTimeout(() => {
            window.location.replace(backUrl);
          }, 200);
        } else {
          const msg = res?.error || 'Failed to complete TIDAL authorization.';
          setStatus('error');
          setErrorMsg(String(msg));
        }
      } catch (e: any) {
        setStatus('error');
        setErrorMsg(`Error while processing the TIDAL response: ${e?.message || 'Unknown error'}`);
      }
    })();
  }, [allParams, backUrl, code, error, errorDescription, state]);

  if (status === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'black', color: 'white', fontFamily: 'sans-serif', padding: 20 }}>
        <div style={{ maxWidth: 680 }}>
          <h1 style={{ fontSize: 20, marginBottom: 12 }}>TIDAL authorization error</h1>
          <p style={{ marginBottom: 16 }}>{errorMsg}</p>

          <details style={{ marginBottom: 16 }}>
            <summary>Show all response parameters</summary>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {JSON.stringify(allParams, null, 2)}
            </pre>
          </details>

          <a
            href={backUrl}
            style={{ display: 'inline-block', padding: '10px 16px', border: '1px solid #666', borderRadius: 6, color: 'white', textDecoration: 'none' }}
          >
            Return to playlist
          </a>
        </div>
      </div>
    );
  }

  // processing | done
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'black', color: 'white', fontFamily: 'sans-serif', padding: 20 }}>
      <div style={{ maxWidth: 640, textAlign: 'center' }}>
        <h1 style={{ fontSize: 20, marginBottom: 12 }}>Processing TIDAL response…</h1>
        <p>Please wait, we will return you to the playlist shortly.</p>
      </div>
    </div>
  );
};

export default TidalRedirect;