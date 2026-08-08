import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PartnerPricingContent, ConsumerPricingContent, PricingFaq, PAID_CHECKOUT, SAMPLE_REPORT } from '@resomix/ui';
import { useAuthStore } from '@resomix/stores';
import type { BillingPlansResponse, BillingSubscriptionSummary } from '@resomix/api-client';

/**
 * /subscribe was still on the older visual language — 10px radii, `backdrop-blur-md`, rounded-full
 * pill toggles, dotted slate borders, centred headers — while every marketing page had moved to
 * square hairline panels, mono eyebrows and the Benzin headline ramp. It read as a different site.
 *
 * The billing behaviour is deliberately untouched, so these cover the presentation contract plus
 * the fact that the section still renders its plans and CTAs.
 */

const readUi = (p: string) =>
  readFileSync(resolve(process.cwd(), `../../packages/ui/src/Billing/${p}`), 'utf8');

/**
 * Code only. The comments in these files name the old treatment on purpose — explaining why it was
 * replaced — so asserting against raw text would flag the explanation as the thing it describes.
 */
const ui = (p: string) =>
  readUi(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const PAGE_FILES = [
  'PricingContent.tsx',
  'ConsumerPricingContent.tsx',
  'PartnerPricingContent.tsx',
  'PricingChrome.tsx',
  'PricingButton.tsx',
];

const BILLING_DIR = resolve(process.cwd(), '../../packages/ui/src/Billing');

const FREE_LIMITS = {
  searches_per_day: 3,
  uploads_per_month: 5,
  top_sk_max: 20,
  dropdown_max_tracks: 50,
  library_playlists_max: 5,
  exports_per_day: 1,
  export_track_limit: 20,
  can_view_full_analysis: false,
  can_similarity_upload: true,
};

const PRO_LIMITS = {
  searches_per_day: null as number | null,
  uploads_per_month: 50,
  top_sk_max: 100,
  dropdown_max_tracks: 100,
  library_playlists_max: null as number | null,
  exports_per_day: null as number | null,
  export_track_limit: 100,
  can_view_full_analysis: true,
  can_similarity_upload: true,
};

/**
 * A healthy, renewing Pro subscription. Override only the fields a test is about.
 *
 * Exists so that adding a field to `BillingSubscription` does not break every fixture in the
 * file — which is exactly what happened when `cancellation` was introduced.
 */
function mockSubscription(
  overrides: Partial<NonNullable<BillingSubscriptionSummary['subscription']>> = {},
): NonNullable<BillingSubscriptionSummary['subscription']> {
  return {
    status: 'active',
    currency: 'EUR',
    current_period_end: '2027-03-14T00:00:00Z',
    cancel_at_period_end: false,
    cancel_at: null,
    canceled_at: null,
    ended_at: null,
    cancellation_reason: null,
    trial_end: null,
    cancellation: null,
    ...overrides,
  };
}

function mockPlans(overrides: Partial<BillingPlansResponse> = {}): BillingPlansResponse {
  return {
    currency: 'EUR',
    current_plan_code: null,
    beta: { end_date: '2027-02-01T00:00:00Z', founding_active: true },
    plans: [
      {
        code: 'free',
        name: 'Free',
        is_free: true,
        unit_amount_cents: 0,
        currency: 'EUR',
        interval: 'month',
        purchasable: false,
        coming_soon: false,
        is_current: false,
        limits: FREE_LIMITS,
      },
      {
        code: 'pro',
        name: 'Pro',
        is_free: false,
        unit_amount_cents: 799,
        currency: 'EUR',
        interval: 'month',
        purchasable: true,
        coming_soon: false,
        is_current: false,
        is_founding_price: true,
        list_unit_amount_cents: 999,
        limits: PRO_LIMITS,
        offers: [
          {
            interval: 'month',
            unit_amount_cents: 799,
            currency: 'EUR',
            is_founding_price: true,
            list_unit_amount_cents: 999,
          },
          {
            interval: 'year',
            unit_amount_cents: 6900,
            currency: 'EUR',
            is_founding_price: true,
            list_unit_amount_cents: 9590,
          },
        ],
      },
      {
        code: 'basic',
        name: 'Basic',
        is_free: false,
        unit_amount_cents: null,
        currency: 'EUR',
        interval: 'month',
        purchasable: false,
        coming_soon: true,
        is_current: false,
        limits: FREE_LIMITS,
      },
      {
        code: 'max',
        name: 'Max',
        is_free: false,
        unit_amount_cents: null,
        currency: 'EUR',
        interval: 'month',
        purchasable: false,
        coming_soon: true,
        is_current: false,
        limits: PRO_LIMITS,
      },
    ],
    ...overrides,
  };
}

vi.mock('@resomix/api-client', async () => {
  const actual = await vi.importActual<typeof import('@resomix/api-client')>('@resomix/api-client');
  return {
    ...actual,
    getBillingPlans: vi.fn(),
    getBillingSubscription: vi.fn(),
    startBillingCheckout: vi.fn(),
    openBillingPortal: vi.fn(),
  };
});

import {
  getBillingPlans,
  getBillingSubscription,
} from '@resomix/api-client';

describe('pricing page adopts the marketing system', () => {
  it('uses the canonical hero ramp for the page headline', () => {
    const src = ui('PricingContent.tsx');
    expect(src).toContain('font-benzin');
    expect(src).toContain('font-black');
    expect(src).toContain('text-[length:var(--px-32)]');
    expect(src).toContain('md:text-[length:var(--px-36)]');
    expect(src).toContain('lg:text-[length:var(--px-48)]');
  });

  it('accents part of the headline, like every other hero', () => {
    expect(ui('PricingContent.tsx')).toContain('text-[var(--color-neon-orange)]');
  });

  it('uses the shared 44/52 block padding', () => {
    const src = ui('PricingContent.tsx');
    expect(src).toContain('py-[var(--px-44)]');
    expect(src).toContain('lg:py-[var(--px-52)]');
  });

  it.each(PAGE_FILES)('%s drops the old rounded/blurred treatment', (file) => {
    const src = ui(file);
    expect(src, 'backdrop blur').not.toContain('backdrop-blur');
    expect(src, 'pill shapes').not.toContain('rounded-full');
    expect(src, 'dotted slate edges').not.toContain('border-dotted');
    expect(src, 'slate palette').not.toContain('slate-200');
    expect(src, '10px radius').not.toContain('rounded-[var(--px-10)]');
  });

  it('no longer pulls in ButtonSleek', () => {
    for (const f of PAGE_FILES) expect(ui(f)).not.toContain('ButtonSleek');
  });
});

describe('marketing button spec', () => {
  it('the filled primary carries the corner notch and accent fill', () => {
    const src = ui('PricingButton.tsx');
    expect(src).toContain('clipPath');
    expect(src).toContain('calc(100% - 10px)');
    expect(src).toContain('bg-[var(--color-neon-orange)]');
    expect(src).toContain('text-[#101010]');
    expect(src).toContain('hover:bg-[#f2603f]');
  });

  it('matches the marketing type spec', () => {
    const src = ui('PricingButton.tsx');
    expect(src).toContain('font-fira');
    expect(src).toContain('text-[length:var(--px-12)]');
    expect(src).toContain('tracking-[0.09em]');
    expect(src).toContain('min-h-[var(--px-44)]');
  });
});

describe('partner section still works', () => {
  const renderPartner = () => render(<PartnerPricingContent partnersUrl="https://example.test/partners" />);

  it('renders all three tiers', () => {
    renderPartner();
    for (const name of ['Starter', 'Growth', 'Enterprise']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
  });

  it('keeps the annual/monthly toggle working', () => {
    renderPartner();
    expect(screen.getByText('82.50')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^monthly$/i }));
    expect(screen.getByText('99')).toBeInTheDocument();
  });

  it('exposes the toggle state to assistive tech', () => {
    renderPartner();
    expect(screen.getByRole('button', { name: /annually/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /monthly/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('sends every plan CTA to the partners form', () => {
    const href = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { set href(v: string) { href(v); } } });
    renderPartner();
    fireEvent.click(screen.getByRole('button', { name: /get starter key/i }));
    expect(href).toHaveBeenCalledWith('https://example.test/partners');
  });
});

describe('consumer pricing upgrade contract', () => {
  beforeEach(() => {
    vi.spyOn(useAuthStore, 'getState').mockReturnValue({
      isAuthenticated: false,
      user: null,
    } as never);
    vi.mocked(getBillingPlans).mockResolvedValue({ success: true, data: mockPlans() });
    vi.mocked(getBillingSubscription).mockResolvedValue({ success: true, data: null as unknown as BillingSubscriptionSummary });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders only Free and Pro — Basic and Max are absent from the DOM', async () => {
    render(<ConsumerPricingContent />);
    await waitFor(() => expect(screen.getAllByText('Free').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Pro').length).toBeGreaterThan(0);
    expect(screen.queryByText('Basic')).not.toBeInTheDocument();
    expect(screen.queryByText('Max')).not.toBeInTheDocument();
  });

  it('updates every dependent string when the interval changes', async () => {
    render(<ConsumerPricingContent />);
    await waitFor(() => expect(screen.getByRole('radiogroup')).toBeInTheDocument());

    const slot = (name: string) =>
      Array.from(document.querySelectorAll(`[data-slot="${name}"]`)).map((n) => n.textContent || '');

    expect(slot('amount').some((a) => /7[.,]?99/.test(a))).toBe(true);
    expect(slot('per').some((p) => /month/i.test(p))).toBe(true);
    expect(slot('cardnote').join(' ')).toMatch(/month|Founding offer|February/i);
    expect(slot('tableprice').some((t) => /month/i.test(t))).toBe(true);
    expect(slot('finalline').join(' ')).toMatch(/month/i);
    expect(slot('closing-price').join(' ')).toMatch(/month/i);

    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: /yearly/i }));
    });

    await waitFor(() => {
      expect(slot('amount').some((a) => /69/.test(a))).toBe(true);
      expect(slot('per').some((p) => /year/i.test(p))).toBe(true);
      expect(slot('tableprice').some((t) => /year/i.test(t))).toBe(true);
      expect(slot('finalline').join(' ')).toMatch(/year/i);
      expect(slot('closing-price').join(' ')).toMatch(/year/i);
    });

    expect(slot('amount').every((a) => !/7[.,]?99/.test(a))).toBe(true);
    expect(slot('tableprice').every((t) => !/7[.,]?99/.test(t))).toBe(true);
    expect(slot('closing-price').every((t) => !/7[.,]?99/.test(t))).toBe(true);
  });

  it('never renders Guest as a purchasable card or with a Guest purchase CTA', async () => {
    render(<ConsumerPricingContent />);
    await waitFor(() => expect(screen.getByText(/no account yet/i)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /^guest$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /choose guest|buy guest|start guest/i })).not.toBeInTheDocument();
  });

  it('never prints Unlimited without (fair use)', async () => {
    render(<ConsumerPricingContent />);
    await waitFor(() => expect(screen.getByTestId('plan-comparison')).toBeInTheDocument());
    const unlimited = screen.getAllByText(/Unlimited/i);
    for (const node of unlimited) {
      expect(node.textContent).toMatch(/fair use/i);
    }
  });

  it('does not contain the retired taglines', async () => {
    render(<ConsumerPricingContent />);
    await waitFor(() => expect(screen.getAllByText('Pro').length).toBeGreaterThan(0));
    expect(screen.queryByText(/priority processing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/always free/i)).not.toBeInTheDocument();
  });

  it('shows Manage billing and no purchase CTA for a current Pro subscriber', async () => {
    vi.spyOn(useAuthStore, 'getState').mockReturnValue({
      isAuthenticated: true,
      user: { uuid: 'u1' },
    } as never);
    const plans = mockPlans({ current_plan_code: 'pro' });
    plans.plans = plans.plans.map((p) =>
      p.code === 'pro' ? { ...p, is_current: true } : p.code === 'free' ? { ...p, is_current: false } : p,
    );
    vi.mocked(getBillingPlans).mockResolvedValue({ success: true, data: plans });
    vi.mocked(getBillingSubscription).mockResolvedValue({
      success: true,
      data: {
        plan: { code: 'pro', name: 'Pro' },
        subscription: mockSubscription(),
        grant: null,
        usage: [],
      } satisfies BillingSubscriptionSummary,
    });

    render(<ConsumerPricingContent />);
    await waitFor(() => expect(screen.getByRole('button', { name: /manage billing/i })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /choose pro|upgrade to pro|subscribe/i })).not.toBeInTheDocument();
  });

  /**
   * Both cancellation mechanisms must produce the same notice.
   *
   * `cancel_at_period_end` is set only for a plain cancel on an unmanaged subscription. Every
   * founding subscriber has a schedule attached, and cancelling one of those leaves the boolean
   * FALSE — the server reports it through `cancellation` instead. Reading the boolean alone told
   * customers who had just cancelled that their plan would renew.
   */
  it.each([
    [
      'cancel_at_period_end (unmanaged subscription)',
      mockSubscription({
        cancel_at_period_end: true,
        cancellation: {
          pending: true,
          ended: false,
          effective_at: '2027-03-14T00:00:00Z',
          reason: 'cancellation_requested',
        },
      }),
    ],
    [
      'cancel_at only (schedule-managed founding subscription)',
      mockSubscription({
        cancel_at_period_end: false,
        cancel_at: '2027-03-14T00:00:00Z',
        cancellation: {
          pending: true,
          ended: false,
          effective_at: '2027-03-14T00:00:00Z',
          reason: 'cancellation_requested',
        },
      }),
    ],
  ])('%s prints active-until and never next renewal', async (_label, subscription) => {
    vi.spyOn(useAuthStore, 'getState').mockReturnValue({
      isAuthenticated: true,
      user: { uuid: 'u1' },
    } as never);
    const plans = mockPlans({ current_plan_code: 'pro' });
    plans.plans = plans.plans.map((p) =>
      p.code === 'pro' ? { ...p, is_current: true } : p,
    );
    vi.mocked(getBillingPlans).mockResolvedValue({ success: true, data: plans });
    vi.mocked(getBillingSubscription).mockResolvedValue({
      success: true,
      data: {
        plan: { code: 'pro', name: 'Pro' },
        subscription,
        grant: null,
        usage: [],
      } satisfies BillingSubscriptionSummary,
    });

    render(<ConsumerPricingContent />);
    await waitFor(() => expect(screen.getByText(/Pro active until/i)).toBeInTheDocument());
    expect(screen.queryByText(/next renewal/i)).not.toBeInTheDocument();
  });
});

describe('no hardcoded prices or dates in Billing sources', () => {
  it('greps clean for price and date literals', () => {
    const files = readdirSync(BILLING_DIR).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
    const banned = /7\.99|9\.99|€69|95\.90|February 2027|22 (cycles|monthly)/;
    for (const f of files) {
      const src = ui(f);
      expect(src, f).not.toMatch(banned);
    }
  });

  it('consumer files have no priority processing / always free / free forever / AI-powered', () => {
    for (const f of [
      'ConsumerPricingContent.tsx',
      'PlanComparison.tsx',
      'PricingFaq.tsx',
      'pricingCopy.ts',
      'PricingContent.tsx',
    ]) {
      const src = ui(f);
      expect(src, f).not.toMatch(/priority processing|always free|free forever|AI-powered/i);
    }
  });

  it('ConsumerPricingContent never names Basic or Max', () => {
    expect(ui('ConsumerPricingContent.tsx')).not.toMatch(/\bBasic\b|\bMax\b/);
  });
});

describe('FAQ tabs and accordion', () => {
  it('exposes tablist / tab / tabpanel roles and arrow-key navigation', async () => {
    render(
      <PricingFaq
        beta={{
          foundingActive: true,
          endDateLabel: '1 February 2027',
          monthlyFounding: '€7.99',
          monthlyList: '€9.99',
          yearlyFounding: '€69',
          yearlyList: '€95.90',
        }}
      />,
    );

    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();

    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');

    expect(document.querySelectorAll('details').length).toBeGreaterThan(0);
    expect(document.querySelector('details > summary')).toBeInTheDocument();
  });
});

describe('paid checkout launch gate', () => {
  beforeEach(() => {
    PAID_CHECKOUT.enabled = false;
    SAMPLE_REPORT.enabled = false;
    vi.spyOn(useAuthStore, 'getState').mockReturnValue({
      isAuthenticated: false,
      user: null,
    } as never);
    vi.mocked(getBillingPlans).mockResolvedValue({ success: true, data: mockPlans() });
    vi.mocked(getBillingSubscription).mockResolvedValue({
      success: true,
      data: null as unknown as BillingSubscriptionSummary,
    });
  });

  afterEach(() => {
    PAID_CHECKOUT.enabled = false;
    SAMPLE_REPORT.enabled = false;
    vi.restoreAllMocks();
  });

  it('shows the disabled notice and disables Pro when PAID_CHECKOUT.enabled is false', async () => {
    // The launch gate belongs to the surface that actually opens Stripe. On the marketing variant
    // the same button is a link to the app, so there is nothing to gate.
    render(<ConsumerPricingContent variant="checkout" />);
    await waitFor(() => expect(screen.getByTestId('checkout-disabled-notice')).toBeInTheDocument());
    expect(screen.getByTestId('checkout-disabled-notice').textContent).toMatch(
      /Checkout is temporarily unavailable/i,
    );
    const choosePro = screen.getAllByRole('button', { name: /choose pro/i })[0];
    expect(choosePro).toBeDisabled();
  });

  it('with PAID_CHECKOUT.enabled = true hides the notice and enables the Pro CTA', async () => {
    PAID_CHECKOUT.enabled = true;

    render(<ConsumerPricingContent />);
    await waitFor(() => expect(screen.getAllByText('Free').length).toBeGreaterThan(0));
    expect(screen.queryByTestId('checkout-disabled-notice')).not.toBeInTheDocument();
    await waitFor(() => {
      const choosePro = screen.getAllByRole('button', { name: /choose pro/i })[0];
      expect(choosePro).not.toBeDisabled();
    });
  });
});

describe('founding offer framing and locale', () => {
  beforeEach(() => {
    vi.spyOn(useAuthStore, 'getState').mockReturnValue({
      isAuthenticated: false,
      user: null,
    } as never);
    vi.mocked(getBillingPlans).mockResolvedValue({ success: true, data: mockPlans() });
    vi.mocked(getBillingSubscription).mockResolvedValue({
      success: true,
      data: null as unknown as BillingSubscriptionSummary,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints Founding offer and the deadline-is-not-beta sentence', async () => {
    render(<ConsumerPricingContent />);
    await waitFor(() => expect(screen.getAllByText(/Founding offer/i).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/The offer deadline is not the end of the Resomix beta/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Beta price/i)).not.toBeInTheDocument();
  });

  it('formats the offer date in en-GB regardless of environment locale', async () => {
    const spy = vi.spyOn(Date.prototype, 'toLocaleDateString');
    render(<ConsumerPricingContent />);
    await waitFor(() => expect(screen.getAllByText(/1 February 2027/i).length).toBeGreaterThan(0));
    expect(spy.mock.calls.some((c) => c[0] === 'en-GB')).toBe(true);
    spy.mockRestore();
  });

  it('binds the hero match count to Pro top_sk_max', async () => {
    render(<ConsumerPricingContent />);
    await waitFor(() =>
      expect(
        screen.getByText(/up to 100 matches per search and Full Track Intelligence/i),
      ).toBeInTheDocument(),
    );
  });

  it('does not render the sample-report band while SAMPLE_REPORT.enabled is false', async () => {
    render(<ConsumerPricingContent />);
    await waitFor(() => expect(screen.getAllByText('Pro').length).toBeGreaterThan(0));
    expect(screen.queryByText(/Open a full report/i)).not.toBeInTheDocument();
  });

  it('moves the closing CTA price with the interval control', async () => {
    render(<ConsumerPricingContent />);
    await waitFor(() => expect(screen.getByRole('radiogroup', { name: /billing interval/i })).toBeInTheDocument());

    const closing = () =>
      Array.from(document.querySelectorAll('[data-slot="closing-price"]'))
        .map((n) => n.textContent || '')
        .join(' ');

    expect(closing()).toMatch(/month/i);

    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: /yearly/i }));
    });

    await waitFor(() => {
      expect(closing()).toMatch(/year/i);
      expect(closing()).not.toMatch(/7[.,]?99/);
    });
  });
});

describe('stuck comparison header keeps plan CTAs', () => {
  beforeEach(() => {
    vi.spyOn(useAuthStore, 'getState').mockReturnValue({
      isAuthenticated: false,
      user: null,
    } as never);
    vi.mocked(getBillingPlans).mockResolvedValue({ success: true, data: mockPlans() });
    vi.mocked(getBillingSubscription).mockResolvedValue({
      success: true,
      data: null as unknown as BillingSubscriptionSummary,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps Start free and Choose Pro present when the table is stuck', async () => {
    render(<ConsumerPricingContent />);
    const table = await waitFor(() => screen.getByTestId('plan-comparison'));
    table.classList.add('is-stuck');

    const header = within(table).getAllByRole('columnheader');
    expect(header.length).toBeGreaterThan(0);
    expect(table.querySelectorAll('.rx-cmp__ptry').length).toBeGreaterThanOrEqual(2);
    expect(within(table).getByRole('button', { name: /start free/i })).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: /choose pro/i })).toBeInTheDocument();
    // The comparison table only renders on the marketing variant, where Choose Pro is a hand-off
    // link to the app rather than a checkout trigger — so it stays clickable.
    expect(within(table).getByRole('button', { name: /choose pro/i })).toBeEnabled();
  });

  it('does not hide stuck-header CTAs with display:none', () => {
    // Fix 3A — owner overruled hiding CTAs in the stuck bar. Guard against silent regression.
    expect(ui('PlanComparison.tsx')).not.toMatch(
      /\.rx-cmp\.is-stuck[^{]*\.rx-cmp__ptry\s*\{\s*display:\s*none/,
    );
  });
});

describe('consumer source greps', () => {
  it('has no beta-price / beta-ends / beta-period phrasing', () => {
    for (const f of ['pricingCopy.ts', 'ConsumerPricingContent.tsx', 'PricingFaq.tsx']) {
      expect(ui(f), f).not.toMatch(/beta price|beta ends|beta period/i);
    }
  });

  it('never calls toLocaleDateString(undefined', () => {
    const files = readdirSync(BILLING_DIR).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
    for (const f of files) {
      expect(ui(f), f).not.toContain('toLocaleDateString(undefined');
    }
  });
});
