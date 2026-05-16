import { axiosWrapper, handleApiError } from "./utils";
import { API_CONFIG } from "./config";
import authClient from "./authClient";
import type { ApiResponse, RequestOptions } from "./types/api";
import type {
  CartResponse,
  AddToCartPayload,
  AddCartRequest,
  PromoCodeResponse,
  CheckoutSessionResponse,
} from "./types/cart";

// Re-export cart types for consumer convenience
export type {
  CartItem,
  CartResponse,
  AddToCartPayload,
  AddCartRequest,
  TrackFormat,
  PromoCodeResponse,
  CheckoutSessionResponse,
} from "./types/cart";

// ─── Cart API Functions ──────────────────────────────────────────────────────

/**
 * Hydrate the user's cart from the backend.
 * The backend checks Redis first, then falls back to MariaDB.
 */
export const getCart = async (): Promise<CartResponse | ReturnType<typeof handleApiError>> => {
  try {
    const data = await axiosWrapper<{ success: boolean; data: CartResponse }>(
      authClient.get(API_CONFIG.ENDPOINTS.CART_GET),
    );

    if (data.success === true) return data.data;
    return {
      success: false,
      error: (data as ApiResponse).error || "Failed to load cart.",
      details: (data as ApiResponse).details ?? null,
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Add one or more items to the cart.
 * Supports single tracks, bulk track arrays, or entire playlists by ID.
 *
 * @param payload - AddCartRequest containing items array OR playlist_id
 * @param options - Optional request options including idempotency key
 */
export const addToCart = async (
  payload: AddCartRequest,
  options?: RequestOptions,
): Promise<{ success: boolean } | ReturnType<typeof handleApiError>> => {
  try {
    const data = await axiosWrapper<any>(
      authClient.post(API_CONFIG.ENDPOINTS.CART_ADD, payload, {
        ...(options?.idempotencyKey
          ? ({ idempotencyKey: options.idempotencyKey } as any)
          : {}),
      }),
    );

    if (data.success === true) return data;
    return {
      success: false,
      error: data.error || "Failed to add item(s) to cart.",
      details: data.details ?? null,
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Remove a specific track variant from the cart.
 *
 * @param trackFormatId - The unique ID of the track-format combination
 */
export const removeFromCart = async (
  trackFormatId: number,
): Promise<{ success: boolean } | ReturnType<typeof handleApiError>> => {
  try {
    const data = await axiosWrapper<any>(
      authClient.delete(`${API_CONFIG.ENDPOINTS.CART_REMOVE}${trackFormatId}`),
    );

    if (data.success === true) return data;
    return {
      success: false,
      error: data.error || "Failed to remove item from cart.",
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Remove all tracks belonging to a specific playlist from the cart.
 *
 * @param playlistId - The unique ID of the playlist
 */
export const removePlaylistFromCart = async (
  playlistId: string,
): Promise<{ success: boolean } | ReturnType<typeof handleApiError>> => {
  try {
    const data = await axiosWrapper<any>(
      authClient.delete(`${API_CONFIG.ENDPOINTS.CART_REMOVE_PLAYLIST}${playlistId}`),
    );

    if (data.success === true) return data;
    return {
      success: false,
      error: data.error || "Failed to remove playlist from cart.",
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Apply a promo code to the active cart.
 * Returns updated pricing with the discount applied.
 */
export const applyPromoCode = async (
  code: string,
): Promise<PromoCodeResponse | ReturnType<typeof handleApiError>> => {
  try {
    const data = await axiosWrapper<{ success: boolean; data: PromoCodeResponse }>(
      authClient.post(API_CONFIG.ENDPOINTS.CART_PROMO, { code }),
    );

    if (data.success === true) return data.data;
    return {
      success: false,
      error: (data as ApiResponse).error || "Invalid promo code.",
      details: (data as ApiResponse).details ?? null,
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Clear all items from the user's cart.
 */
export const clearCart = async (): Promise<{ success: boolean } | ReturnType<typeof handleApiError>> => {
  try {
    const data = await axiosWrapper<any>(
      authClient.delete(API_CONFIG.ENDPOINTS.CART_CLEAR),
    );

    if (data.success === true) return data;
    return {
      success: false,
      error: data.error || "Failed to clear cart.",
      details: data.details ?? null,
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Initialize a Stripe Checkout session.
 * Returns a URL to redirect the user to Stripe's hosted payment page.
 * Currently returns a mocked URL until the production Stripe account is linked.
 * 
 * @param options - Optional request options including idempotency key
 */
export const createCheckoutSession = async (
  options?: RequestOptions,
): Promise<
  CheckoutSessionResponse | ReturnType<typeof handleApiError>
> => {
  try {
    const data = await axiosWrapper<{ success: boolean; data: CheckoutSessionResponse }>(
      authClient.post(API_CONFIG.ENDPOINTS.CHECKOUT_CREATE_SESSION, {}, {
        ...(options?.idempotencyKey
          ? ({ idempotencyKey: options.idempotencyKey } as any)
          : {}),
      }),
    );

    if (data.success === true) return data.data;
    return {
      success: false,
      error: (data as ApiResponse).error || "Failed to create checkout session.",
      details: (data as ApiResponse).details ?? null,
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};
