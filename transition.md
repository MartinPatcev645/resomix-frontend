# Backend Alignment Guide: `new_database.sql` to Code

**Scope:** Models first, then Repositories, Services, Controllers.
**Goal:** Every table in scope maps 1-to-1 with a SQLAlchemy model column.

**Convention reminders:**
- All primary keys: `BigInteger` (unsigned in DB = positive Python ints).
- All async DB operations use `AsyncSession` from `sqlalchemy.ext.asyncio`.
- Every file needs a module-level docstring (Version, Date, Author, Email).
- Never expose `password_hash`, token strings, or internal IDs in response bodies.
- All responses MUST use `format_response(success, data, error)` from `app/utils/response_utils.py`.

---

## PHASE 1 — Models

### `app/models/user.py`

**Why:** `users` table now has `stripe_customer_id`. The three token tables have been collapsed into one `user_tokens` table.

**Step 1 — Add `stripe_customer_id` to `User` class:**
- Add: `stripe_customer_id = Column(String(255), nullable=True, unique=True)`.
- This is critical for the Stripe checkout flow. Must be unique but nullable.

**Step 2 — Replace three token classes with one `UserToken` class:**
- Remove: `EmailVerificationToken`, `PasswordResetToken`, `TwoFactorEmailCode`.
- Add new class `UserToken` targeting `__tablename__ = "user_tokens"`.
- Columns: `id` (BigInt PK), `user_id` (FK users CASCADE), `token` (String 255, indexed), `token_type` (Enum: email_verification, password_reset, 2fa), `expires_at` (DateTime), `created_at` (server default).
- **Important:** Old tables had `consumed_at`. New table does NOT. Pattern: once verified, DELETE the token row.

**Step 3 — Update `User` relationships:**
- Remove old token relationships.
- Add: `tokens = relationship("UserToken", back_populates="user", cascade="all, delete-orphan")`.

---

### `app/models/artist.py`

**Why:** The `artists` table changed from a simple name table to a full DDEX entity.

**Steps:**
- Replace `name = Column(String(100))` with `full_name = Column(String(512), nullable=False, index=True)`.
- Add `party_id = Column(String(100), ForeignKey("parties.party_id"), nullable=False, index=True)`.
- Add `isni = Column(String(30), nullable=True)`.
- Add `ipn = Column(String(30), nullable=True)`.
- Add `artist_type = Column(Enum("MainArtist","FeaturedArtist","Remixer","Composer","Lyricist","Producer","Conductor","Orchestra","Other", name="artist_type_enum"), default="MainArtist")`.
- Remove the `albums` relationship — `albums` table no longer exists.
- Keep `track_artists` relationship.

---

### `app/models/label.py`

**Why:** `labels` is now a DDEX entity. Old `name` and `website` columns are gone.

**Steps:**
- Replace `name = Column(String(120))` with `label_name = Column(String(512), nullable=False, index=True)`.
- Remove `website = Column(String(255))`.
- Ensure `party_id`, `dpid`, `label_type` columns are present and correct.
- Keep `tracks` relationship.

---

### `app/models/track.py`

**Why:** Many new DDEX fields; `album_id` removed; `isrc` is now NOT NULL.

**Steps:**
- Remove `album_id` FK and its relationship.
- Remove `year = Column(Integer)`.
- Fix `isrc`: must be `nullable=False`.
- Replace `title = Column(String(255))` with `String(1024)`.
- Add: `release_id`, `party_id`, `resource_ref`, `proprietary_id`, `version_title`, `display_artist`, `track_number`, `disk_number`, `duration_seconds`, `duration_iso`, `key_signature`, `audio_language`, `language_of_lyrics`, `genre` (inline), `sub_genre`, `price_cents`, `mix_name`, `audio_path`, `file_size_bytes`, `audio_codec`, `bit_depth`, `sample_rate`, `channels`, `p_line_year`, `p_line_text`, `deal_terms` (JSON), `parental_warning` (Enum), `is_explicit` (Boolean), `is_instrumental` (Boolean), `is_active` (Boolean, indexed).
- Replace `musical_key = Column(String(5))` with `String(10)`.
- Replace `file_path = Column(String(500))` with `String(1024)`.
- Add `updated_at` with `onupdate`.
- Remove `uploader` relationship from `User` side (dangerous with delete-orphan).
- Import `JSON` from sqlalchemy.

---

### `app/models/ecommerce.py`

**Steps for `TrackFormat`:** `is_generated` and `last_downloaded_at` are already added. Verify `audio_format` Enum matches SQL exactly.

**Steps for `PromoCode`:**
- Add `stripe_coupon_id = Column(String(255), nullable=True, unique=True)`.
- Add `stripe_promo_code_id = Column(String(255), nullable=True, unique=True)`.

**Steps for `Order`:**
- Add `payment_intent_id = Column(String(255), nullable=True, unique=True)` — for dispute webhook lookups.
- Add `base_currency = Column(String(3), default="USD")`.

**Steps for `Purchase`:**
- `release_id` FK must use `BigInteger` (not `Integer`) → `ForeignKey("releases.id", ondelete="RESTRICT")`.

**Cart/CartItem:** Match SQL. No changes needed.

---

### `app/models/consumption_event.py`

`track_format_id` column and `track_format` relationship are already added. Verify FK: `ForeignKey("track_formats.id", ondelete="SET NULL")`.

---

### `app/models/album.py` — DELETE THIS FILE

The `albums` table does not exist in `new_database.sql`. Remove file and all imports.

---

### `app/models/party.py` (exists) — Review Only

Verify all columns match `parties` table: `id`, `party_id`, `party_name`, `dpid`, `email`, `is_active`, `created_at`, `updated_at`.

---

### `app/models/release.py` (exists) — Review Only

Key checks:
- `message_id` FK points to `messages.message_id` (string FK, not `messages.id`).
- `label_id` and `artist_id` use `BigInteger`.
- `p_line` and `c_line` short fields are separate from `p_line_text`.
- `is_compilation`, `is_active` are `Boolean`.

---

### `app/models/message.py` (exists) — Review Only

`ingest_log_id` FK → `ingest_log.id` (BigInteger, NOT NULL). All DDEX header fields present.

---

### NEW: `app/models/recording_artist.py`

Create model for `recording_artists` table (DDEX junction: tracks to artists).
- Columns: `id`, `track_id` (FK tracks CASCADE), `artist_id` (FK artists), `sequence_num`, `artist_role`.
- This is separate from the old `TrackArtist` model targeting `track_artists`.

---

### `app/models/__init__.py`

**Steps:**
- Remove: `from .album import Album` and `"Album"` from `__all__`.
- Remove: `from .user import EmailVerificationToken, PasswordResetToken, TwoFactorEmailCode`.
- Add: `from .user import UserToken`.
- Ensure new models registered: `Party`, `Release`, `Message`, `RecordingArtist`.
- **Import order matters for FK resolution:** `Party` → `Label` → `Artist` → `Release` → `Track`.

---

## PHASE 2 — Repositories

### `app/repositories/user_repository.py`

**Steps:**
- Remove: `EmailVerificationTokenRepository`, `PasswordResetTokenRepository`, `TwoFactorCodeRepository`.
- Create `UserTokenRepository` with:
  - `async_create_token(db, user_id, token, token_type, expires_at)`: Delete existing same-type token first, then insert.
  - `async_get_by_token(db, token, token_type)`: Filter by both token string AND token_type.
  - `async_delete_for_user(db, user_id, token_type)`: Delete all tokens of a given type for a user.
  - `async_cleanup_expired(db)`: Delete rows where `expires_at < now()`.
- Token verification pattern changes from "mark consumed" to **fetch → validate → delete**.
- Keep `UserSessionRepository` unchanged.

---

### `app/repositories/label_repository.py`

**Steps:**
- Replace all `Label.name` filter references with `Label.label_name`.
- Replace `Label(name=...)` constructor calls with `Label(label_name=...)`.

---

### `app/repositories/artist_repository.py`

**Steps:**
- Replace `Artist.name` with `Artist.full_name` in all queries.
- Replace `Artist(name=...)` with `Artist(full_name=...)`.

---

### `app/repositories/telemetry_repository.py`

**Steps:**
- The `isrc` SELECT is already live (no longer commented). Verify it still works.
- In `async_bulk_insert_events`, pass `track_format_id=event.get("track_format_id")` to `ConsumptionEvent` constructor for `download_success` events.

---

### `app/repositories/cart_repository.py`

**Steps:**
- The `selectinload` chain currently uses `TrackArtist` (`track_artists` table) for artist names. This is correct for now.
- No immediate change. Once DDEX ingestion populates `recording_artists`, plan a fallback join.

---

## PHASE 3 — Services

### `app/services/auth_service.py`

**Steps:**
1. Replace all three token repository instantiations with a single `UserTokenRepository()`.
2. Update `send_verification_email`: call `async_create_token(..., "email_verification", ...)`.
3. Update `verify_email`: call `async_get_by_token(..., "email_verification")`, then `async_delete_for_user` on success.
4. Update password reset flows with `"password_reset"` type.
5. Update 2FA flows with `"2fa"` type.
   - Old `purpose` field (`login` vs `password_change`) no longer exists. If distinction is needed, encode it in the service layer logic (e.g., use different expiry windows or check endpoint context).

---

### `app/services/cart_service.py`

- Artist name resolution uses `track.track_artists` — correct for now.
- When enqueueing `download_success` telemetry events after purchase, include `track_format_id` in the payload.

---

### `app/services/telemetry_service.py`

- In `enqueue_events`, ensure `track_format_id` is not dropped from the event dict during enrichment. Pass it through as-is.

---

## PHASE 4 — Controllers and Routers

### Auth Controller

- All token read/create/verify operations must use `UserTokenRepository`.
- Never expose token string values in API responses.

### Cart and Checkout Controller

- `POST /checkout/create-session` must:
  1. Check `user.stripe_customer_id`. If `None`, call Stripe API to create a Customer, then save `stripe_customer_id` back to the `User` row.
  2. Create Stripe Checkout Session with `cart_id` in `metadata`.
  3. Return `{"stripe_url": session.url}` via `format_response`.

---

## PHASE 5 — Cleanup Verification

Run these greps to confirm no stale references remain:

```bash
grep -r "email_verification_tokens" app/
grep -r "password_reset_tokens" app/
grep -r "two_factor_email_codes" app/
grep -r "from .album" app/
grep -r "Album" app/models/
grep -r "Artist\.name" app/
grep -r "Label\.name" app/
grep -r "album_id" app/models/ app/repositories/
grep -r "EmailVerificationToken\|PasswordResetToken\|TwoFactorEmailCode" app/
```

All should return 0 results.

**Final sanity test order:**
1. Start the app — check startup logs for SQLAlchemy mapper errors (FK mismatches show here).
2. `GET /api/cart` — should return empty cart, not 500.
3. `POST /auth/register` + `POST /auth/verify-email` — tests token creation and deletion.
4. Stream a track — check `consumption_events` receives a row.
