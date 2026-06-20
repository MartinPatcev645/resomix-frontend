import { create } from "zustand";
import type { CartItem } from "@resomix/api-client";

// ─── Store Interface ─────────────────────────────────────────────────────────

export interface CartStore {
  // ── State ──────────────────────────────────────────────────────────────────
  /** Cart items hydrated from the backend */
  items: CartItem[];
  /** Price before discounts (cents) */
  subtotalCents: number;
  /** Discount amount from promo code (cents) */
  discountCents: number;
  /** Final price after discounts (cents) */
  totalCents: number;
  /** Currently applied promo code, if any */
  promoCode: string | null;
  /** Total number of items in the cart */
  itemCount: number;
  /** Whether a cart operation is in progress */
  isLoading: boolean;
  /** Last error message from a cart operation */
  error: string | null;

  // ── Actions ────────────────────────────────────────────────────────────────
  /** Replace the entire cart state with fresh data from the backend */
  setCart: (cart: {
    items: CartItem[];
    subtotal_cents: number;
    discount_cents: number;
    total_cents: number;
    promo_code: string | null;
    item_count: number;
  }) => void;
  /** Set loading state for cart operations */
  setLoading: (loading: boolean) => void;
  /** Set or clear an error message */
  setError: (error: string | null) => void;
  /** Reset cart to empty state (called on logout) */
  reset: () => void;
}

// ─── Initial State ───────────────────────────────────────────────────────────

const INITIAL_STATE = {
  items: [] as CartItem[],
  subtotalCents: 0,
  discountCents: 0,
  totalCents: 0,
  promoCode: null as string | null,
  itemCount: 0,
  isLoading: false,
  error: null as string | null,
};

// ─── Store ───────────────────────────────────────────────────────────────────

/**
 * Cart store — no persistence middleware.
 *
 * The backend (Redis cache → MariaDB) is the source of truth.
 * This store is a client-side mirror that is hydrated on mount
 * and updated after every mutation.
 */
export const useCartStore = create<CartStore>((set) => ({
  ...INITIAL_STATE,

  setCart: (cart) =>
    set({
      items: cart.items,
      subtotalCents: cart.subtotal_cents,
      discountCents: cart.discount_cents,
      totalCents: cart.total_cents,
      promoCode: cart.promo_code,
      itemCount: cart.item_count,
      error: null,
    }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  reset: () => set({ ...INITIAL_STATE }),
}));

export default useCartStore;
