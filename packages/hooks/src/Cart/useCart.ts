import { useEffect, useCallback, useRef } from "react";
import { useCartStore } from "@resomix/stores";
import { useAuthStore } from "@resomix/stores";
import {
  getCart,
  addToCart,
  removeFromCart,
  removePlaylistFromCart,
  applyPromoCode,
  clearCart,
  createCheckoutSession,
} from "@resomix/api-client";
import type { AddToCartPayload, AddCartRequest } from "@resomix/api-client";

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Primary cart hook — bridges the API client and the Zustand store.
 *
 * Auto-hydrates the cart from the backend when the user is authenticated.
 * All mutation functions follow the write-through pattern:
 *   1. Call the backend (MariaDB + Redis update)
 *   2. Re-hydrate the store with fresh server state
 *
 * This ensures the frontend is always in sync with the source of truth.
 */
export function useCart() {
  const store = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const hydratedRef = useRef(false);

  // ── Auto-hydrate on mount when authenticated ───────────────────────────────
  useEffect(() => {
    if (isAuthenticated && !hydratedRef.current) {
      hydratedRef.current = true;
      hydrateCart();
    }
    if (!isAuthenticated) {
      hydratedRef.current = false;
    }
  }, [isAuthenticated]);

  // ── Hydrate ────────────────────────────────────────────────────────────────
  const hydrateCart = useCallback(async () => {
    store.setLoading(true);
    try {
      const result = await getCart();
      if ("items" in result) {
        store.setCart(result);
      } else if ("error" in result) {
        store.setError(result.error as string);
      }
    } catch (e) {
      store.setError("Failed to load cart.");
      console.error("[Cart] Hydration failed:", e);
    } finally {
      store.setLoading(false);
    }
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getCartItem = useCallback(
    (trackId: string) => {
      return store.items.find((item) => item.track_id === trackId);
    },
    [store.items],
  );

  const isInCart = useCallback(
    (trackId: string) => {
      return store.items.some((item) => item.track_id === trackId);
    },
    [store.items],
  );

  // ── Add to Cart ────────────────────────────────────────────────────────────
  const addItem = useCallback(
    async (payload: AddCartRequest) => {
      if (!payload.items?.length && !payload.playlist_id) return false;

      store.setLoading(true);
      store.setError(null);
      try {
        const result = await addToCart(payload);
        if ("success" in result && result.success) {
          // Re-hydrate to get the updated cart from the server
          await hydrateCart();
          return true;
        }
        const errorMsg =
          "error" in result ? (result.error as string) : "Failed to add to cart.";
        store.setError(errorMsg);
        return false;
      } catch (e) {
        store.setError("Failed to add to cart.");
        console.error("[Cart] Add failed:", e);
        return false;
      } finally {
        store.setLoading(false);
      }
    },
    [hydrateCart],
  );

  // ── Remove from Cart ──────────────────────────────────────────────────────
  const removeItem = useCallback(
    async (trackId: string) => {
      store.setLoading(true);
      store.setError(null);
      try {
        const result = await removeFromCart(trackId);
        if ("success" in result && result.success) {
          await hydrateCart();
          return true;
        }
        const errorMsg =
          "error" in result ? (result.error as string) : "Failed to remove item.";
        store.setError(errorMsg);
        return false;
      } catch (e) {
        store.setError("Failed to remove item.");
        console.error("[Cart] Remove failed:", e);
        return false;
      } finally {
        store.setLoading(false);
      }
    },
    [hydrateCart],
  );

  // ── High-level Actions ──────────────────────────────────────────────────────

  /** Toggle a single track in/out of the cart */
  const toggleItem = useCallback(
    async (trackId: string, sourcePlaylistId?: string) => {
      const existing = getCartItem(trackId);
      if (existing) {
        return removeItem(trackId);
      } else if (!existing) {
        return addItem({
          items: [{ track_id: trackId, source_playlist_id: sourcePlaylistId }],
        });
      }
      return false;
    },
    [getCartItem, addItem, removeItem],
  );

  /** Add all tracks from a playlist to the cart (backend resolves tracks) */
  const addPlaylist = useCallback(
    async (playlistId: string) => {
      return addItem({ playlist_id: playlistId });
    },
    [addItem],
  );

  /** Remove all tracks belonging to a specific playlist from the cart */
  const removePlaylist = useCallback(
    async (playlistId: string) => {
      store.setLoading(true);
      store.setError(null);
      try {
        const result = await removePlaylistFromCart(playlistId);
        if ("success" in result && result.success) {
          await hydrateCart();
          return true;
        }
        const errorMsg =
          "error" in result ? (result.error as string) : "Failed to remove playlist.";
        store.setError(errorMsg);
        return false;
      } catch (e) {
        store.setError("Failed to remove playlist.");
        console.error("[Cart] Remove playlist failed:", e);
        return false;
      } finally {
        store.setLoading(false);
      }
    },
    [hydrateCart],
  );

  // ── Apply Promo Code ──────────────────────────────────────────────────────
  const applyPromo = useCallback(
    async (code: string) => {
      if (!code.trim()) {
        store.setError("Please enter a promo code.");
        return false;
      }

      store.setLoading(true);
      store.setError(null);
      try {
        const result = await applyPromoCode(code.trim());
        if ("subtotal_cents" in result) {
          // Re-hydrate to get the full updated cart
          await hydrateCart();
          return true;
        }
        const errorMsg =
          "error" in result ? (result.error as string) : "Invalid promo code.";
        store.setError(errorMsg);
        return false;
      } catch (e) {
        store.setError("Failed to apply promo code.");
        console.error("[Cart] Promo apply failed:", e);
        return false;
      } finally {
        store.setLoading(false);
      }
    },
    [hydrateCart],
  );

  // ── Clear Cart ─────────────────────────────────────────────────────────────
  const clearAll = useCallback(async () => {
    store.setLoading(true);
    store.setError(null);
    try {
      const result = await clearCart();
      if ("success" in result && result.success) {
        store.reset();
        return true;
      }
      const errorMsg =
        "error" in result ? (result.error as string) : "Failed to clear cart.";
      store.setError(errorMsg);
      return false;
    } catch (e) {
      store.setError("Failed to clear cart.");
      console.error("[Cart] Clear failed:", e);
      return false;
    } finally {
      store.setLoading(false);
    }
  }, []);

  // ── Checkout ───────────────────────────────────────────────────────────────
  const checkout = useCallback(async () => {
    if (store.itemCount === 0) {
      store.setError("Your cart is empty.");
      return false;
    }

    store.setLoading(true);
    store.setError(null);
    try {
      const result = await createCheckoutSession();
      if ("stripe_url" in result) {
        // Full-page redirect to Stripe-hosted checkout
        window.location.href = result.stripe_url;
        return true;
      }
      const errorMsg =
        "error" in result ? (result.error as string) : "Failed to start checkout.";
      store.setError(errorMsg);
      return false;
    } catch (e) {
      store.setError("Failed to start checkout.");
      console.error("[Cart] Checkout failed:", e);
      return false;
    } finally {
      store.setLoading(false);
    }
  }, [store.itemCount]);

  return {
    // State
    items: store.items,
    subtotalCents: store.subtotalCents,
    discountCents: store.discountCents,
    totalCents: store.totalCents,
    promoCode: store.promoCode,
    itemCount: store.itemCount,
    isLoading: store.isLoading,
    error: store.error,

    // Actions
    hydrateCart,
    addItem,
    removeItem,
    removePlaylist,
    toggleItem,
    addPlaylist,
    applyPromo,
    clearAll,
    checkout,

    // Helpers
    isInCart,
    getCartItem,

    // Auth context
    isAuthenticated,
  };
}
