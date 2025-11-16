I'll scan each non-admin router to extract its endpoints, auth requirements, and request payload/params, then generate a concise markdown file summarizing them.

I’ll compile a concise routes reference with auth requirements and basic request shapes.

- I’m generating a short markdown now.

## Routes quick reference (non-admin)

- similarity
  - POST /get_similarity/ — Auth: Required (JWT). Body: file (UploadFile), top_sk (query, optional).
  - POST /get_selection_similarity/ — Auth: Required (JWT). Body: { track_id, top_sk? }.
  - GET /segment_status/{playlist_uuid} — Auth: Not required. Params: playlist_uuid (path).

- metadata
  - POST /metadata/ — Auth: Not required (no JWT; API key required). Body: file (UploadFile).

- search
  - GET /search_tracks/ — Auth: Not required. Query: query (string), mode? (artist|title|auto, default auto).

- feedback
  - POST /feedback/ — Auth: Optional (JWT optional). Body: { satisfaction, recommendation, feedback?, category?, user_id? }.
  - GET /feedback/{feedback_id} — Auth: Not required. Params: feedback_id (path).
  - PATCH /feedback/{feedback_id}/status — Auth: Not required. Body: { status }.

- contact
  - POST /contact/ — Auth: Optional (JWT optional). Body: { name, email, message, subject?, phone?, user_id? }.
  - GET /contact/{contact_id} — Auth: Not required. Params: contact_id (path).
  - PATCH /contact/{contact_id}/status — Auth: Not required. Body: { status }.

- health
  - GET / — Auth: Not required. No params.
  - GET /health — Auth: Not required. No params.

- preview
  - GET /preview/get_preview/ — Auth: Not required. Query: track_id (string).

- playlists
  - PUT /playlists/rename/ — Auth: Optional (JWT optional). Body: { playlist_id, new_name }.
  - PUT /playlists/visibility/ — Auth: Optional (JWT optional). Body: { playlist_id, is_public }.
  - GET /playlists/similarity/{playlist_id} — Auth: Optional (JWT optional). Params: playlist_id (path).
  - POST /playlists/fork/{playlist_id} — Auth: Required (JWT). Params: playlist_id (path).
  - GET /playlists/similarity-hls/{playlist_id}.m3u8 — Auth: Optional (JWT optional). Params: playlist_id (path).
  - GET /playlists/get-all-playlists/ — Auth: Required (JWT). Query: page?, page_size?, play_time?, num_tracks?, start_date?, end_date?, is_public?, own_favorites?, all_favorites?.

- monthly_pipeline
  - POST /monthly_pipeline/update_embeddings/ — Auth: Not required. No body.
  - POST /monthly_pipeline/track/ — Auth: Not required. Body: file (UploadFile), path (form string).

- ratings
  - POST /ratings/tracks/ — Auth: Optional (JWT optional). Body: { track_id, playlist_id, rating, user_id? }.
  - GET /ratings/tracks/{track_id}/playlist/{playlist_id} — Auth: Optional (JWT optional). Params: track_id, playlist_id (path). Query: user_id?.
  - DELETE /ratings/tracks/{track_id}/playlist/{playlist_id} — Auth: Optional (JWT optional). Params: track_id, playlist_id (path). Query: user_id?.
  - GET /ratings/tracks/{track_id}/stats — Auth: Not required. Params: track_id (path).
  - POST /ratings/playlists/ — Auth: Optional (JWT optional). Body: { playlist_id, rating, message?, user_id? }.
  - GET /ratings/playlists/{playlist_id} — Auth: Optional (JWT optional). Params: playlist_id (path). Query: user_id?.
  - DELETE /ratings/playlists/{playlist_id} — Auth: Optional (JWT optional). Params: playlist_id (path). Query: user_id?.
  - GET /ratings/playlists/{playlist_id}/stats — Auth: Not required. Params: playlist_id (path).

- spotify-transfer
  - POST /spotify/transfer-playlist/ — Auth: Required (JWT). Body: { playlist_id, access_token, playlist_name? }.
  - GET /spotify/app-client-id — Auth: Required (JWT). No params.

- tidal-transfer
  - POST /tidal/auth/token — Auth: Not required. Body: { code, code_verifier, redirect_uri, client_id? }.
  - POST /tidal/transfer-playlist/ — Auth: Not required. Body: { playlist_id, access_token, playlist_name? }.

- apple-music-transfer
  - GET /apple-music/developer-token/ — Auth: Not required. No params.
  - POST /apple-music/transfer-playlist/ — Auth: Not required. Body: { playlist_id, music_user_token, playlist_name? }.

- waitlist
  - POST /waitlist/ — Auth: Not required. Body: { email }.
  - GET /waitlist/ — Auth: Not required. Query: email.

- dummy
  - GET /dummy/dummy-hls/{playlist_id}.m3u8 — Auth: Not required. Params: playlist_id (path).

- authentication
  - POST /auth/register — Auth: Not required. Body: { email, username, password, name? }.
  - POST /auth/login — Auth: Not required. Body: { email_or_username, password }.
  - POST /auth/verify-2fa — Auth: Not required. Body: { user_id, code }.
  - GET /auth/verify-email — Auth: Not required. Query: token.
  - POST /auth/resend-verification — Auth: Not required. Body: { email }.
  - POST /auth/password-reset — Auth: Not required. Body: { email }.
  - POST /auth/password-reset-confirm — Auth: Not required. Body: { token, new_password }.
  - POST /auth/refresh — Auth: Not required. Cookie: refresh_token (HttpOnly).
  - POST /auth/logout — Auth: Not required. Cookie: refresh_token (HttpOnly).
  - POST /auth/logout-all — Auth: Required (conceptually; expects user_id; typically behind auth middleware).

- users
  - GET /users/search — Auth: Not required. Query: q, limit?.
  - GET /users/me — Auth: Required (JWT). No params.
  - PATCH /users/me — Auth: Required (JWT). Body: { name?, language?, timezone?, profile_picture? }.
  - POST /users/me/change-password — Auth: Required (JWT). Body: { current_password, new_password }.
  - GET /users/me/sessions — Auth: Required (JWT). No params.
  - DELETE /users/me/sessions/{session_id} — Auth: Required (JWT). Params: session_id (path).
  - POST /users/me/enable-2fa — Auth: Required (JWT). Body: { method }.
  - POST /users/me/disable-2fa — Auth: Required (JWT). Body: { password }.
  - DELETE /users/me — Auth: Required (JWT). Body: { password }.

Status: I reviewed each non-admin router and produced a concise auth/params summary in markdown.