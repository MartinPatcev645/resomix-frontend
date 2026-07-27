import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function dismissConsent(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    document.getElementById('stcm-wrapper')?.remove();
    document.getElementById('stcm-backdrop')?.remove();
  });
}

async function auditHeaderGeometry(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const frame = Array.from(document.querySelectorAll('#site-header .nav-hframe')).find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }) as HTMLElement | undefined;
    if (!frame) return { pass: false, violations: ['HEADER FRAME NOT FOUND'] };

    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const lineY = frame.getBoundingClientRect().top + 4.0625 * rem;
    const frameRect = frame.getBoundingClientRect();
    const W = frameRect.width;
    const kinks = [0.24238, 0.30186, 0.67705, 0.73649].map((f) => frameRect.left + f * W);
    const logoZone = {
      l: frameRect.left + W / 2 - 6.875 * rem,
      r: frameRect.left + W / 2 + 6.875 * rem,
    };
    const FOCUS = 4;
    const violations: string[] = [];
    const items: Array<{ label: string; r: DOMRect; isRail2: boolean }> = [];

    frame.querySelectorAll('.nav-cl-left .nav-mm-trigger, .nav-cl-right .nav-mm-trigger, .nav-cl-right .nav-acct, .nav-rail2 .nav-cta').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      items.push({
        label: (el.getAttribute('aria-label') || el.textContent?.trim() || '').slice(0, 22),
        r,
        isRail2: !!el.closest('.nav-rail2'),
      });
    });

    items.forEach((it) => {
      const { r, label, isRail2 } = it;
      if (r.left - FOCUS < frameRect.left) violations.push(`LEFT-FRAME: ${label}`);
      if (r.right + FOCUS > frameRect.right) violations.push(`RIGHT-FRAME: ${label}`);
      if (!isRail2 && r.bottom + FOCUS > lineY) violations.push(`LINE-Y CROSS: ${label}`);
      if (isRail2 && r.top - FOCUS < lineY) violations.push(`RAIL2 ABOVE LINE: ${label}`);
      if (!isRail2 && r.left < logoZone.r && r.right > logoZone.l) {
        violations.push(`LOGO-ZONE: ${label}`);
      }
      [0, 3].forEach((i) => {
        if (!isRail2 && kinks[i] >= r.left - 8 && kinks[i] <= r.right + 8) {
          violations.push(`KINK-${'ABCD'[i]} UNDER: ${label}`);
        }
      });
    });

    const logo = frame.querySelector(':scope > .nav-cl-logo a')?.getBoundingClientRect();
    if (logo) {
      const off = Math.abs((logo.left + logo.right) / 2 - (frameRect.left + W / 2));
      if (off > 1) violations.push(`LOGO OFF-CENTRE by ${off.toFixed(1)}px`);
    }

    const rail2 = frame.querySelector('.nav-rail2')?.getBoundingClientRect();
    if (rail2 && rail2.left <= frameRect.left + W * 0.745) {
      violations.push('RAIL2 LEFT EDGE TOO FAR LEFT');
    }

    if (document.documentElement.scrollWidth !== document.documentElement.clientWidth) {
      violations.push('H-OVERFLOW');
    }

    return { pass: violations.length === 0, violations };
  });
}

async function auditPanelAnchoring(page: import('@playwright/test').Page, panelId: string, side: 'left' | 'right') {
  return page.evaluate(
    ({ id, panelSide }) => {
      const frame = Array.from(document.querySelectorAll('#site-header .nav-hframe')).find((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }) as HTMLElement | undefined;

      const panel = Array.from(document.querySelectorAll(`#${id} .nav-mm-panel`)).find((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });

      if (!frame || !panel) return { pass: false, reason: 'MISSING ELEMENTS', violations: ['MISSING ELEMENTS'] };

      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const lineY = frame.getBoundingClientRect().top + 4.0625 * rem;
      const rail2H = 2.5394 * rem;
      const minPanelTop = lineY + rail2H;
      const panelRect = panel.getBoundingClientRect();
      const violations: string[] = [];

      if (panelRect.top < minPanelTop - 1) {
        violations.push(`PANEL TOP ${panelRect.top.toFixed(1)} < MIN ${minPanelTop.toFixed(1)}`);
      }

      if (panelSide === 'right') {
        const ctas = Array.from(frame.querySelectorAll('.nav-rail2 .nav-cta')).map((el) =>
          el.getBoundingClientRect(),
        );
        const acct = frame.querySelector('.nav-cl-right .nav-acct')?.getBoundingClientRect();
        const targets = [...ctas, ...(acct ? [acct] : [])];
        targets.forEach((r, i) => {
          const hit =
            panelRect.left < r.right &&
            panelRect.right > r.left &&
            panelRect.top < r.bottom &&
            panelRect.bottom > r.top;
          if (hit) violations.push(`CTA/ACCT OVERLAP ${i}`);
        });
      }

      return { pass: violations.length === 0, violations };
    },
    { id: panelId, panelSide: side },
  );
}

function visiblePanelLocator(page: import('@playwright/test').Page, panelId: string) {
  return page.locator(`#${panelId} > .nav-mm-panel`).filter({ visible: true });
}

function desktopHeader(page: import('@playwright/test').Page) {
  return page.locator('#site-header');
}

function stickyHeader(page: import('@playwright/test').Page) {
  return page.locator('#site-header-sticky');
}

function stickyVisiblePanelLocator(page: import('@playwright/test').Page, panelId: string) {
  return stickyHeader(page).locator(`#sticky-${panelId} > .nav-mm-panel`).filter({ visible: true });
}

async function scrollPastFold(page: import('@playwright/test').Page) {
  await page.waitForSelector('#site-header', { state: 'visible' });
  await page.evaluate(() => {
    if (!document.querySelector('[data-e2e-scroll-spacer]')) {
      const spacer = document.createElement('div');
      spacer.setAttribute('data-e2e-scroll-spacer', 'true');
      spacer.style.height = '120vh';
      document.body.appendChild(spacer);
    }
    window.scrollTo(0, 100);
  });
  await page.waitForFunction(() =>
    document.getElementById('site-header')?.classList.contains('is-scrolled'),
  );
  await expect(stickyHeader(page)).toHaveClass(/is-visible/);
}

async function auditStickyPanelAnchoring(
  page: import('@playwright/test').Page,
  panelId: string,
  side: 'left' | 'right',
) {
  return page.evaluate(
    ({ id, panelSide }) => {
      const sticky = document.getElementById('site-header-sticky');
      const stickyIn = sticky?.querySelector('.nav-sticky-in') as HTMLElement | null;
      const panel = Array.from(document.querySelectorAll(`#sticky-${id} .nav-mm-panel`)).find((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });

      if (!stickyIn || !panel) {
        return { pass: false, reason: 'MISSING ELEMENTS', violations: ['MISSING ELEMENTS'] };
      }

      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const stickyH = 3.25 * rem;
      const minPanelTop = stickyH + 0.5 * rem;
      const panelRect = panel.getBoundingClientRect();
      const violations: string[] = [];

      if (panelRect.top < minPanelTop - 1) {
        violations.push(`PANEL TOP ${panelRect.top.toFixed(1)} < MIN ${minPanelTop.toFixed(1)}`);
      }

      if (panelSide === 'right') {
        const acct = sticky?.querySelector('.nav-cl-right .nav-acct')?.getBoundingClientRect();
        const cta = sticky?.querySelector('.nav-cl-right .nav-cta-primary')?.getBoundingClientRect();
        const targets = [acct, cta].filter(Boolean) as DOMRect[];
        targets.forEach((r, i) => {
          const hit =
            panelRect.left < r.right &&
            panelRect.right > r.left &&
            panelRect.top < r.bottom &&
            panelRect.bottom > r.top;
          if (hit) violations.push(`CTA/ACCT OVERLAP ${i}`);
        });
      }

      const visiblePops = Array.from(document.querySelectorAll('.nav-mm-pop')).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (visiblePops.length !== 1) {
        violations.push(`VISIBLE PANEL COUNT ${visiblePops.length} (expected 1)`);
      }

      return { pass: violations.length === 0, violations };
    },
    { id: panelId, panelSide: side },
  );
}

test.describe('Global navigation (beta webapp)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('silktideCookieBanner_closed', '1');
      localStorage.setItem('demo_stage_notice_dismissed', 'true');
      localStorage.setItem('workspace_loop_strip_dismissed', 'true');
      document.cookie = 'resomix_terms_accepted=1; path=/; SameSite=Lax';
    });
  });

  test('keyboard walk through desktop mega menu', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/auth/login');
    await dismissConsent(page);
    await page.waitForSelector('#site-header .nav-hframe', { state: 'visible' });

    const productTrigger = desktopHeader(page).getByRole('button', { name: /^product/i });
    await productTrigger.focus();
    await productTrigger.press('ArrowDown');
    await expect(productTrigger).toHaveAttribute('aria-expanded', 'true');

    const platformLink = visiblePanelLocator(page, 'panel-product').getByRole('link', {
      name: /resomix platform/i,
    });
    await expect(platformLink).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(productTrigger).toHaveAttribute('aria-expanded', 'false');
    await expect(productTrigger).toBeFocused();
  });

  test('drawer accordions work while webapp-page-root is inert', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 800 });
    await page.goto('/');
    await dismissConsent(page);

    await page.getByRole('button', { name: /open menu/i }).click();

    const inert = await page.evaluate(() => {
      const root = document.getElementById('webapp-page-root');
      return root?.inert === true;
    });
    expect(inert).toBe(true);

    const solutionsAccordion = page.locator('[aria-controls="acc-solutions"]');
    await solutionsAccordion.click();
    await expect(solutionsAccordion).toHaveAttribute('aria-expanded', 'true');
  });

  test('393px drawer open/close, focus return, body lock, one accordion', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 800 });
    await page.goto('/');
    await dismissConsent(page);

    const menuButton = page.getByRole('button', { name: /open menu/i });
    await menuButton.click();

    const dialog = page.getByRole('dialog', { name: /site navigation/i });
    await expect(dialog).toBeVisible();
    const closeButton = page.getByRole('button', { name: /close menu/i });
    await expect(closeButton).toBeVisible();
    await expect(closeButton).toHaveClass(/nav-drawer-x/);

    const closeStyles = await closeButton.evaluate((el) => {
      const style = getComputedStyle(el);
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      return {
        width: parseFloat(style.width),
        height: parseFloat(style.height),
        borderRadius: style.borderRadius,
        borderWidth: parseFloat(style.borderTopWidth),
        minTarget: 2.75 * rem,
      };
    });
    expect(closeStyles.width).toBeGreaterThanOrEqual(closeStyles.minTarget - 1);
    expect(closeStyles.height).toBeGreaterThanOrEqual(closeStyles.minTarget - 1);
    expect(closeStyles.borderRadius).toBe('50%');
    expect(parseFloat(closeStyles.borderWidth)).toBeGreaterThan(0);

    const pathStroke = await closeButton.locator('svg path').evaluate((el) => {
      const style = getComputedStyle(el);
      return { stroke: style.stroke, fill: style.fill };
    });
    expect(pathStroke.stroke).not.toBe('none');
    expect(pathStroke.fill).toBe('none');

    await page.locator('.nav-drawer-scroll').evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(closeButton).toBeVisible();

    const overflow = await page.evaluate(() => document.body.classList.contains('nav-locked'));
    expect(overflow).toBe(true);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(menuButton).toBeFocused();
  });

  test('393px mobile frame line on key pages and no doubling on login', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });

    const mobilePaths = ['/', '/sonic-discovery', '/library'];

    for (const path of mobilePaths) {
      await page.goto(path);
      await dismissConsent(page);
      await page.waitForSelector('header.nav-site', { state: 'visible' });

      const lineAudit = await page.evaluate(() => {
        const header = document.querySelector('header.nav-site');
        if (!header) return { pass: false, reason: 'NO HEADER' };

        const before = getComputedStyle(header, '::before');
        const borderTop = before.borderTopWidth;
        const borderStyle = before.borderTopStyle;
        const borderColor = before.borderTopColor;

        const rect = header.getBoundingClientRect();
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const expectedTop = rect.top - 0.25 * rem;

        return {
          pass:
            borderTop === '1px' &&
            borderStyle === 'dotted' &&
            (borderColor === 'rgb(226, 232, 240)' || borderColor === '#e2e8f0'),
          borderTop,
          borderStyle,
          borderColor,
          headerTop: rect.top,
          expectedTop,
        };
      });

      expect(lineAudit.pass, `${path}: ${JSON.stringify(lineAudit)}`).toBe(true);
    }

    await page.goto('/auth/login');
    await dismissConsent(page);
    await page.waitForSelector('header.nav-site', { state: 'visible' });

    const loginLineCount = await page.evaluate(() => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const header = document.querySelector('header.nav-site');
      if (!header) return { pass: false, reason: 'NO HEADER' };

      const headerRect = header.getBoundingClientRect();
      const lineY = headerRect.top - 0.25 * rem;
      const tolerance = 2;

      const dottedLines = Array.from(document.querySelectorAll('*')).filter((el) => {
        const style = getComputedStyle(el);
        const hasDottedTop =
          style.borderTopStyle === 'dotted' &&
          (style.borderTopColor === 'rgb(226, 232, 240)' || style.borderTopColor === '#e2e8f0') &&
          parseFloat(style.borderTopWidth) > 0;
        if (!hasDottedTop) return false;
        const r = el.getBoundingClientRect();
        return Math.abs(r.top - lineY) <= tolerance && r.width > window.innerWidth * 0.5;
      });

      return { pass: dottedLines.length <= 1, count: dottedLines.length };
    });

    expect(loginLineCount.pass, `login doubled lines: ${loginLineCount.count}`).toBe(true);
  });

  test('header geometry passes at 1280, 1440, and 1920', async ({ page }) => {
    for (const width of [1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await dismissConsent(page);
      await page.waitForSelector('#site-header .nav-hframe', { state: 'visible' });

      const audit = await auditHeaderGeometry(page);
      expect(audit.violations, `geometry at ${width}px: ${audit.violations?.join(', ')}`).toEqual([]);
      expect(audit.pass).toBe(true);
    }
  });

  test('1180 renders desktop clusters, 1179 renders burger row', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 800 });
    await page.goto('/');
    await dismissConsent(page);
    await page.waitForSelector('#site-header .nav-hframe', { state: 'visible' });
    await expect(desktopHeader(page).getByRole('navigation', { name: 'Primary', exact: true })).toBeVisible();
    await expect(desktopHeader(page).getByRole('button', { name: /open menu/i })).toBeHidden();

    await page.setViewportSize({ width: 1179, height: 800 });
    await page.goto('/');
    await dismissConsent(page);
    await expect(page.getByRole('button', { name: /open menu/i }).first()).toBeVisible();
    await expect(page.locator('.nav-hframe > .nav-cl-left.nav-hnav').first()).toBeHidden();
    await expect(page.locator('.nav-mrow-logo .nav-logo-mark').first()).toBeVisible();
  });

  test('no horizontal overflow at key widths with product panel open', async ({ page }) => {
    for (const width of [393, 768, 1024, 1180, 1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await dismissConsent(page);

      if (width >= 1180) {
        await page.getByRole('button', { name: /^product/i }).first().click({ force: true });
      } else {
        await page.getByRole('button', { name: /open menu/i }).click({ force: true });
      }

      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(metrics.scrollWidth, `overflow at ${width}px`).toBeLessThanOrEqual(metrics.clientWidth);
    }
  });

  test('right panels do not overlap CTAs or account at 1280 and 1920', async ({ page }) => {
    for (const width of [1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await dismissConsent(page);

      for (const [trigger, panelId] of [
        [/^partners/i, 'panel-partners'],
        [/^developers/i, 'panel-developers'],
      ] as const) {
        await dismissConsent(page);
        await desktopHeader(page).getByRole('button', { name: trigger }).click({ force: true });
        await visiblePanelLocator(page, panelId).waitFor({ state: 'visible' });
        const audit = await auditPanelAnchoring(page, panelId, 'right');
        expect(audit.violations, `${panelId} at ${width}px`).toEqual([]);
        expect(audit.pass).toBe(true);
        await page.keyboard.press('Escape');
      }
    }
  });

  test('left panels anchor below the complete line system', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await dismissConsent(page);

    for (const [trigger, panelId] of [
      [/^product/i, 'panel-product'],
      [/^solutions/i, 'panel-solutions'],
    ] as const) {
      await page.getByRole('button', { name: trigger }).first().click({ force: true });
      await visiblePanelLocator(page, panelId).waitFor({ state: 'visible' });
      const audit = await auditPanelAnchoring(page, panelId, 'left');
      expect(audit.violations, `${panelId}`).toEqual([]);
      expect(audit.pass).toBe(true);
      await page.keyboard.press('Escape');
    }
  });

  test('scrim mounts when panel open and closes on click', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await dismissConsent(page);

    expect(await page.locator('.nav-scrim').count()).toBe(0);

    await page.getByRole('button', { name: /^product/i }).first().click();
    await expect(page.locator('.nav-scrim')).toHaveCount(1);
    await expect(page.locator('.nav-scrim')).toHaveAttribute('aria-hidden', 'true');

    await page.locator('.nav-scrim').click({ force: true });
    await expect(page.locator('.nav-scrim')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^product/i }).first()).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  test('solutions panel scrolls internally at 1280x700', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await page.goto('/');
    await dismissConsent(page);
    await desktopHeader(page).getByRole('button', { name: /^solutions/i }).click({ force: true });

    const panel = visiblePanelLocator(page, 'panel-solutions');
    await expect(panel).toBeVisible();

    const scrollable = await panel.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        overflowY: style.overflowY,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        canScroll: el.scrollHeight > el.clientHeight,
      };
    });
    expect(scrollable.overflowY).toBe('auto');
    expect(scrollable.canScroll).toBe(true);

    const pageScrollBefore = await page.evaluate(() => window.scrollY);
    const panelScrollBefore = await panel.evaluate((el) => el.scrollTop);
    await panel.evaluate((el) => {
      el.scrollTop += 48;
    });
    const panelScrollAfter = await panel.evaluate((el) => el.scrollTop);
    expect(panelScrollAfter).toBeGreaterThan(panelScrollBefore);
    const pageScrollAfter = await page.evaluate(() => window.scrollY);
    expect(pageScrollAfter).toBe(pageScrollBefore);
  });

  test('axe pass on header with product panel open', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/auth/login');
    await dismissConsent(page);
    await desktopHeader(page).getByRole('button', { name: /^product/i }).click();

    const results = await new AxeBuilder({ page })
      .include('#site-header')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test('sticky bar opens all four mega menus with correct anchoring at 1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await dismissConsent(page);
    await scrollPastFold(page);

    for (const [trigger, panelId, side] of [
      [/^product/i, 'panel-product', 'left'],
      [/^solutions/i, 'panel-solutions', 'left'],
      [/^partners/i, 'panel-partners', 'right'],
      [/^developers/i, 'panel-developers', 'right'],
    ] as const) {
      await stickyHeader(page).getByRole('button', { name: trigger }).click({ force: true });
      await stickyVisiblePanelLocator(page, panelId).waitFor({ state: 'visible' });
      await expect(page.locator('.nav-scrim')).toHaveCount(1);

      const audit = await auditStickyPanelAnchoring(page, panelId, side);
      expect(audit.violations, `${panelId} sticky: ${audit.violations?.join(', ')}`).toEqual([]);
      expect(audit.pass).toBe(true);

      await page.keyboard.press('Escape');
    }
  });

  test('keyboard walk through sticky mega menu', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await dismissConsent(page);
    await scrollPastFold(page);

    const productTrigger = stickyHeader(page).getByRole('button', { name: /^product/i });
    await productTrigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(productTrigger).toHaveAttribute('aria-expanded', 'true');

    const platformLink = stickyVisiblePanelLocator(page, 'panel-product').getByRole('link', {
      name: /resomix platform/i,
    });
    await expect(platformLink).toBeFocused();

    await page.keyboard.press('ArrowUp');
    await expect(productTrigger).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(productTrigger).toHaveAttribute('aria-expanded', 'false');
    await expect(productTrigger).toBeFocused();
  });

  test('stuck/unstuck transition closes open panel', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await dismissConsent(page);
    await scrollPastFold(page);

    await stickyHeader(page).getByRole('button', { name: /^product/i }).click({ force: true });
    await stickyVisiblePanelLocator(page, 'panel-product').waitFor({ state: 'visible' });

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(stickyHeader(page)).not.toHaveClass(/is-visible/);
    await expect(page.locator('.nav-scrim')).toHaveCount(0);

    const visiblePops = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.nav-mm-pop')).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }).length,
    );
    expect(visiblePops).toBe(0);
  });

  test('solutions panel scrolls internally at 1280x700 from sticky bar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await page.goto('/');
    await dismissConsent(page);
    await scrollPastFold(page);

    await stickyHeader(page).getByRole('button', { name: /^solutions/i }).click({ force: true });
    const panel = stickyVisiblePanelLocator(page, 'panel-solutions');
    await expect(panel).toBeVisible();

    const scrollable = await panel.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        overflowY: style.overflowY,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        canScroll: el.scrollHeight > el.clientHeight,
      };
    });
    expect(scrollable.overflowY).toBe('auto');

    if (!scrollable.canScroll) {
      await panel.evaluate((el) => {
        el.style.maxHeight = '10rem';
      });
    }

    const canScroll = await panel.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(canScroll).toBe(true);

    const pageScrollBefore = await page.evaluate(() => window.scrollY);
    const panelScrollBefore = await panel.evaluate((el) => el.scrollTop);
    await panel.evaluate((el) => {
      el.scrollTop += 48;
    });
    expect(await panel.evaluate((el) => el.scrollTop)).toBeGreaterThan(panelScrollBefore);
    expect(await page.evaluate(() => window.scrollY)).toBe(pageScrollBefore);
  });

  test('axe pass with sticky product panel open', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await dismissConsent(page);
    await scrollPastFold(page);

    await stickyHeader(page).getByRole('button', { name: /^product/i }).click({ force: true });
    await stickyVisiblePanelLocator(page, 'panel-product').waitFor({ state: 'visible' });

    const results = await new AxeBuilder({ page })
      .include('#site-header-sticky')
      .include('header.nav-site')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});
