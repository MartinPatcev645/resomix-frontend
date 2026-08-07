/**
 * Which job a pricing surface is doing.
 *
 * The same components render on two different origins, and they are not the same page:
 *
 *   "marketing"  resomix.com/pricing — explains and compares the plans, then hands off. It never
 *                opens Stripe and never depends on a session, because the marketing site is not
 *                where anyone is signed in. Shows the comparison table and the FAQ.
 *
 *   "checkout"   beta.resomix.com/subscribe — the real flow. Checks the session, takes the EU
 *                withdrawal-waiver consent and opens Stripe Checkout. Drops the comparison table
 *                and the FAQ: someone who arrived here has already decided, and the long-form
 *                material lives on the page that sold it.
 */
export type PricingVariant = "marketing" | "checkout";
