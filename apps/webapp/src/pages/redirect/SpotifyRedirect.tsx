import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export function SpotifyRedirect() {
  const navigate = useNavigate();
  const { search } = useLocation();

  useEffect(() => {
    const inParams = new URLSearchParams(search);

    const code = inParams.get('code') || '';
    const state = inParams.get('state') || '';
    const error = inParams.get('error') || '';

    const outParams = new URLSearchParams();

    // id must equal state
    if (state) {
      outParams.set('id', decodeURI(state));
      outParams.set('state', state);
      outParams.set('share', 'true');
    }

    if (code) {
      outParams.set('code', code);
    }

    // Forward error if present
    if (error) {
      outParams.set('error', error);
    }

    const target = `/sonic-discovery${outParams.toString() ? `?${outParams.toString()}` : ''}`;

    // Replace history entry so the redirect page doesn’t remain in back stack
    navigate(target, { replace: true });
  }, [search, navigate]);

  return <div>Redirecting…</div>;
}