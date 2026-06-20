import { useState, useMemo } from "react";
import { useCart } from "@resomix/hooks";
import { ButtonSleek } from "@resomix/ui";
import type { CartItem } from "@resomix/api-client";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format cents to display price string (e.g. 149 → "$1.49") */
function formatPrice(cents: number): string {
  if (cents === undefined || cents === null || isNaN(cents)) return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
}

/** Format duration in seconds to "M:SS" */
function formatDuration(seconds?: number): string {
  if (seconds === undefined || seconds === null || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

interface CartItemRowProps {
  item: CartItem;
  onRemove: (trackId: string) => void;
  isLoading: boolean;
}

function CartItemRow({ item, onRemove, isLoading }: CartItemRowProps) {
  const displayTitle = item.title || item.track_title || "Unknown Track";
  const displayArtist = item.artist || item.track_artist || "Unknown Artist";
  const displayFormat = item.format_name || item.audio_format || "Digital";

  return (
    <div
      className="flex items-center justify-between py-[var(--px-12)] border-b"
      style={{ borderColor: "rgba(255,255,255,0.1)" }}
    >
      <div className="flex-1 min-w-0 pr-[var(--px-16)]">
        <p
          className="text-[var(--px-14)] font-medium truncate"
          style={{ color: "#ffffff" }}
        >
          {displayTitle}
        </p>
        <p
          className="text-[var(--px-12)] truncate"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          {displayArtist} &middot; {formatDuration(item.track_duration)}
        </p>
      </div>

      {/* Format badge */}
      <div className="flex items-center gap-[var(--px-12)]">
        <span
          className="text-[var(--px-11)] font-semibold uppercase px-[var(--px-8)] py-[2px] rounded"
          style={{
            backgroundColor: "#ffffff",
            color: "#000000",
          }}
        >
          {displayFormat}
        </span>

        {/* Price */}
        <span
          className="text-[var(--px-14)] font-medium min-w-[var(--px-60)] text-right"
          style={{ color: "#ffffff" }}
        >
          {formatPrice(item.price_cents)}
        </span>

        {/* Remove button */}
        <button
          onClick={() => onRemove(item.track_id)}
          disabled={isLoading}
          className="ml-[var(--px-8)] text-[var(--px-18)] leading-none transition-colors"
          style={{
            color: "rgba(255,255,255,0.4)",
            cursor: isLoading ? "not-allowed" : "pointer",
          }}
          aria-label={`Remove ${displayTitle}`}
          title="Remove from cart"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ─── Grouped Cart Items ──────────────────────────────────────────────────────

interface GroupedItems {
  /** Items added individually (no playlist association) */
  individual: CartItem[];
  /** Items grouped by source playlist */
  playlists: Map<string, { name: string; items: CartItem[] }>;
}

function groupCartItems(items: CartItem[]): GroupedItems {
  const individual: CartItem[] = [];
  const playlists = new Map<string, { name: string; items: CartItem[] }>();

  for (const item of items) {
    if (item.source_playlist_id === null || item.source_playlist_id === undefined) {
      individual.push(item);
    } else {
      const key = String(item.source_playlist_id);
      const existing = playlists.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        playlists.set(key, {
          name: item.playlist_name || `Playlist #${key}`,
          items: [item],
        });
      }
    }
  }

  return { individual, playlists };
}

// ─── Main Cart Page ──────────────────────────────────────────────────────────

export function CartPage() {
  const {
    items,
    subtotalCents,
    discountCents,
    totalCents,
    promoCode,
    itemCount,
    isLoading,
    error,
    removeItem,
    removePlaylist,
    applyPromo,
    clearAll,
    checkout,
  } = useCart();

  const [promoInput, setPromoInput] = useState("");

  const grouped = useMemo(() => groupCartItems(items), [items]);

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return;
    const success = await applyPromo(promoInput);
    if (success) {
      setPromoInput("");
    }
  };

  // ── Empty State ──────────────────────────────────────────────────────────
  if (itemCount === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-[var(--px-20)]">
        <p
          className="text-[var(--px-18)] font-medium"
          style={{ color: "#ffffff" }}
        >
          Your cart is empty
        </p>
        <p
          className="text-[var(--px-14)]"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          Discover music and add tracks to your cart to purchase.
        </p>
      </div>
    );
  }

  return (
    <div
      className="w-full max-w-[var(--px-700)] mx-auto py-[var(--px-40)] px-[var(--px-20)]"
      style={{ minHeight: "50vh" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-[var(--px-30)]">
        <h1
          className="text-[var(--px-24)] font-bold"
          style={{ color: "#ffffff" }}
        >
          Cart ({itemCount})
        </h1>
        {itemCount > 0 && (
          <button
            onClick={clearAll}
            disabled={isLoading}
            className="text-[var(--px-13)] transition-opacity hover:opacity-80"
            style={{
              color: "rgba(255,255,255,0.6)",
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
          >
            Clear All
          </button>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div
          className="mb-[var(--px-16)] p-[var(--px-12)] rounded text-[var(--px-13)]"
          style={{
            backgroundColor: "rgba(220, 38, 38, 0.2)",
            color: "#ff4444",
          }}
        >
          {error}
        </div>
      )}

      {/* Playlist-grouped Items */}
      {Array.from(grouped.playlists.entries()).map(([playlistId, group]) => (
        <div key={playlistId} className="mb-[var(--px-24)]">
          <div className="flex items-center justify-between mb-[var(--px-8)]">
            <h2
              className="text-[var(--px-13)] font-semibold uppercase tracking-wider"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              Playlist: {group.name}
            </h2>
            <button
              onClick={() => removePlaylist(playlistId)}
              disabled={isLoading}
              className="text-[var(--px-11)] font-medium underline opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: "#ffffff" }}
            >
              Remove All
            </button>
          </div>
          {group.items.map((item) => (
            <CartItemRow
              key={item.id}
              item={item}
              onRemove={removeItem}
              isLoading={isLoading}
            />
          ))}
        </div>
      ))}

      {/* Individual Items */}
      {grouped.individual.length > 0 && (
        <div className="mb-[var(--px-24)]">
          {grouped.playlists.size > 0 && (
            <h2
              className="text-[var(--px-13)] font-semibold uppercase tracking-wider mb-[var(--px-8)]"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              Individual Tracks
            </h2>
          )}
          {grouped.individual.map((item) => (
            <CartItemRow
              key={item.id}
              item={item}
              onRemove={removeItem}
              isLoading={isLoading}
            />
          ))}
        </div>
      )}

      {/* Promo Code Input */}
      <div className="flex gap-[var(--px-8)] mb-[var(--px-24)]">
        <input
          type="text"
          placeholder="Promo code"
          value={promoInput}
          onChange={(e) => setPromoInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleApplyPromo();
          }}
          disabled={isLoading}
          className="flex-1 px-[var(--px-12)] py-[var(--px-8)] text-[var(--px-14)] rounded outline-none"
          style={{
            border: "1px solid rgba(255,255,255,0.1)",
            backgroundColor: "rgba(255,255,255,0.05)",
            color: "#ffffff",
          }}
          id="cart-promo-input"
        />
        <ButtonSleek
          text="Apply"
          onClick={handleApplyPromo}
          customWidth="min-w-[var(--px-80)]"
          className="promo-apply-button"
          id="cart-promo-apply-button"
        />
      </div>

      {/* Applied promo display */}
      {promoCode && (
        <div
          className="mb-[var(--px-16)] text-[var(--px-13)]"
          style={{ color: "rgba(255,255,255,0.7)" }}
        >
          Applied: <strong>{promoCode}</strong>
        </div>
      )}

      {/* Financial Summary */}
      <div
        className="py-[var(--px-16)] mb-[var(--px-24)] space-y-[var(--px-8)]"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div className="flex justify-between text-[var(--px-14)]">
          <span style={{ color: "rgba(255,255,255,0.6)" }}>Subtotal</span>
          <span style={{ color: "#ffffff" }}>
            {formatPrice(subtotalCents)}
          </span>
        </div>
        {discountCents > 0 && (
          <div className="flex justify-between text-[var(--px-14)]">
            <span style={{ color: "rgba(255,255,255,0.6)" }}>
              Discount
            </span>
            <span style={{ color: "#4ade80" }}>
              -{formatPrice(discountCents)}
            </span>
          </div>
        )}
        <div className="flex justify-between text-[var(--px-16)] font-bold">
          <span style={{ color: "#ffffff" }}>Total</span>
          <span style={{ color: "#ffffff" }}>
            {formatPrice(totalCents)}
          </span>
        </div>
      </div>

      {/* Checkout Button */}
      <div className="flex justify-center">
        <ButtonSleek
          text={isLoading ? "Processing..." : "Proceed to Checkout"}
          onClick={checkout}
          customWidth="w-full max-w-[var(--px-400)]"
          className="checkout-button"
          id="cart-checkout-button"
        />
      </div>
    </div>
  );
}

export default CartPage;
