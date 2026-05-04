// ─── Cart Domain Types ───────────────────────────────────────────────────────

/**
 * A purchasable format variant of a track (e.g., MP3 at $0.99, WAV at $1.49).
 * Maps to the `track_formats` table.
 */
export interface TrackFormat {
  id: number;
  track_id: string;
  audio_format: "mp3" | "wav" | "flac" | "aiff";
  price_cents: number;
}

/**
 * A single item in the user's shopping cart, hydrated with track metadata
 * from the backend JOIN.
 */
export interface CartItem {
  id: number;
  track_format_id: number;
  source_playlist_id: string | null;
  price_cents: number;
  added_at: string;
  // Hydrated fields (joined from tracks + track_formats)
  track_id: string;
  track_title: string;
  track_artist: string;
  track_duration: number;
  audio_format: "mp3" | "wav" | "flac" | "aiff";
  playlist_name?: string | null;
}

/**
 * Full cart state returned by `GET /api/cart`.
 */
export interface CartResponse {
  items: CartItem[];
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  promo_code: string | null;
  item_count: number;
}

/**
 * Payload for adding one or more items to the cart.
 * `source_playlist_id` is set when the user adds via "Add Playlist to Cart".
 */
export interface AddToCartPayload {
  track_id?: string;
  track_format_id?: number;
  source_playlist_id?: string | null;
}

/**
 * Top-level payload for adding to cart.
 * Can be a list of items OR a playlist_id (backend resolves tracks).
 */
export interface AddCartRequest {
  items?: AddToCartPayload[];
  playlist_id?: string;
}

/**
 * Response from `POST /api/checkout/create-session`.
 */
export interface CheckoutSessionResponse {
  stripe_url: string;
  session_id: string;
}

/**
 * Response from `POST /api/cart/promo`.
 */
export interface PromoCodeResponse {
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  promo_code: string;
}
