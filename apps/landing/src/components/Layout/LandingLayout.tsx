import React, { useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { GlobalFooter, GlobalMobileFooter, SideLines } from "@resomix/ui";
import { AppBackground } from "./AppBackground.tsx";
import { LogoRFooter } from "../LogoRFooter.tsx";
import { OptionalAuthRoute } from "../OptionalAuthRoute.tsx";
import { SiteHeader } from "../Navigation/SiteHeader.tsx";
import { MobileDrawer } from "../Navigation/MobileDrawer.tsx";
import { useResponsive } from "@resomix/hooks";
import { BASE_BETA_URL, BASE_LANDING_URL } from "@resomix/config";

/**
 * LandingLayout provides a persistent shell (Navbar, SideLines, Footer, AppBackground)
 * for the landing application.
 */
export function LandingLayout() {
    /* ssrSafe: this app's pages are prerendered to HTML at build time, where there is no window.
       The build assumes desktop and the first client render has to agree with it, or React discards
       the prerendered markup. The real viewport is measured in a layout effect, before paint. */
    const { isDesktop } = useResponsive({ ssrSafe: true });
    const location = useLocation();
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const menuButtonRef = React.useRef<HTMLButtonElement>(null);

    /**
     * Route changes run as a transition.
     *
     * Pages are code-split, so a plain navigate() suspends immediately and React swaps the whole
     * screen for the Suspense fallback until the chunk lands — on a slow connection that is a blank
     * document for seconds. Inside a transition React keeps the CURRENT page rendered until the new
     * one is ready, and `isNavPending` gives us something honest to show meanwhile.
     *
     * It also makes fast successive clicks safe: React discards the superseded transition instead of
     * committing an interleaved half-navigation.
     */
    const [isNavPending, startNavTransition] = React.useTransition();

    // Internal navigation handler to avoid full page reloads
    const handleNavigate = React.useCallback((path: string) => {
        // Check if path belongs to the Landing domain
        const isInternal = path.startsWith(BASE_LANDING_URL) || path.startsWith('/') || path.includes('resomix.com');
        const isBeta = path.startsWith(BASE_BETA_URL) || path.includes('beta.resomix.com');

        if (isInternal && !isBeta) {
            let relativePath = path;
            if (path.startsWith(BASE_LANDING_URL)) {
                relativePath = path.substring(BASE_LANDING_URL.length);
            } else if (path.includes('resomix.com') && !path.includes('beta.resomix.com')) {
                try {
                    const url = new URL(path);
                    relativePath = url.pathname + url.search + url.hash;
                } catch {
                    relativePath = path.split('resomix.com')[1] || '/';
                }
            }
            const target = relativePath || '/';
            startNavTransition(() => navigate(target));
        } else {
            // External or Beta URL
            window.location.href = path;
        }
    }, [navigate]);

    // Derive mode from current pathname
    const mode = useMemo(() => {
        const path = location.pathname;
        if (path === '/') return 'home';
        if (path === '/about') return 'about';
        if (path.startsWith('/auth/')) {
            return path.split('/auth/')[1] || 'auth';
        }
        if (['/contact', '/waitlist', '/error', '/partners', '/partners/pilot', '/trust', '/subscribe', '/product', '/product/sonic-discovery', '/product/track-intelligence', '/product/catalog-intelligence', '/developers', '/solutions/record-labels', '/solutions/music-publishers', '/solutions/sync-agencies', '/solutions/music-libraries-sample-providers', '/solutions/djs', '/solutions/music-curators', '/solutions/producers'].includes(path)) {
            return path.substring(1);
        }
        return '404';
    }, [location.pathname]);

    const headerProps = {
        onNavigate: handleNavigate,
        onProfileClick: () => handleNavigate(`${BASE_BETA_URL}/profile`),
    };

    const desktopNavbar = (
        <SiteHeader
            variant="desktop"
            {...headerProps}
            menuButtonRef={menuButtonRef}
            onMenuOpen={() => setIsMenuOpen(true)}
        />
    );

    const mobileNavbar = (
        <SiteHeader
            variant="mobile"
            {...headerProps}
            menuButtonRef={menuButtonRef}
            onMenuOpen={() => setIsMenuOpen(true)}
        />
    );

    const footerLogo = (
        <LogoRFooter className="w-[var(--px-27)] h-[var(--px-27)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />
    );

    // Scroll on navigation: top for plain routes, the anchor target when a hash is present.
    // Pages are lazy-loaded — poll briefly (bounded) until the target exists, then scroll once.
    // Kept tolerant of multiple matches: SideLines renders the page once now, but the nav still
    // emits a few repeated ids, so prefer whichever match is actually visible.
    React.useEffect(() => {
        const id = location.hash ? decodeURIComponent(location.hash.slice(1)) : '';
        if (!id) {
            window.scrollTo(0, 0);
            return;
        }
        let raf = 0;
        const deadline = performance.now() + 1500;
        const attempt = () => {
            const matches = document.querySelectorAll(`[id="${CSS.escape(id)}"]`);
            const el =
                Array.from(matches).find((node) => node.getClientRects().length > 0) ??
                matches[0] ??
                null;
            if (el) {
                const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
                return;
            }
            if (performance.now() < deadline) {
                raf = window.requestAnimationFrame(attempt);
            } else {
                window.scrollTo(0, 0);
            }
        };
        raf = window.requestAnimationFrame(attempt);
        return () => window.cancelAnimationFrame(raf);
    }, [location.pathname, location.hash]);

    return (
        <OptionalAuthRoute>
            {/* Navigation progress. The previous page stays on screen during a transition, so
                without this a click on a slow connection looks like it did nothing at all. Above
                the page shell (z-30) for the same stacking reason the beta banner is. */}
            <div
                className={`fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-[var(--color-primary)] transition-opacity duration-200 ${isNavPending ? 'nav-progress-active opacity-100' : 'opacity-0'}`}
                role="progressbar"
                aria-hidden={!isNavPending}
                aria-label="Loading page"
            />
            <div id="landing-page-root" className={`${isDesktop ? 'bg-[var(--color-secondary)]' : 'bg-[var(--color-primary-background)]'} min-h-screen relative`}>
                {/* Shared void-field backdrop for pages that don't render their own (the marketing
                    pages in the list below already ship their page-scoped void-field). Keeps every
                    page on the same home-style background. */}
                {!['home', 'product', 'product/sonic-discovery', 'product/track-intelligence', 'product/catalog-intelligence', 'developers', 'partners', 'partners/pilot', 'trust', 'solutions/record-labels', 'solutions/music-publishers', 'solutions/sync-agencies', 'solutions/music-libraries-sample-providers', 'solutions/djs', 'solutions/music-curators', 'solutions/producers'].includes(mode) && (
                    <AppBackground />
                )}
                <div className="mx-auto text-[var(--color-text-secondary)] relative z-30 max-w-[var(--px-1023)] lg:max-w-[var(--px-2560)]">
                    <SideLines
                        navbar={isDesktop ? undefined : mobileNavbar}
                        mode={mode}
                    >
                        {isDesktop && desktopNavbar}

                        <main
                            key={location.pathname}
                            className="page-transition lg:pt-[calc(var(--nav-hdr-h,4.25rem)-3px)]"
                        >
                            <Outlet />
                        </main>

                        {isDesktop ? (
                            <GlobalFooter logo={footerLogo} baseUrl={BASE_LANDING_URL} onNavigate={handleNavigate} />
                        ) : (
                            <div className="mt-[var(--px-60)]">
                                <GlobalMobileFooter logo={footerLogo} baseUrl={BASE_LANDING_URL} onNavigate={handleNavigate} />
                            </div>
                        )}
                    </SideLines>
                </div>

                {isMenuOpen && (
                    <MobileDrawer
                        isOpen={isMenuOpen}
                        onClose={() => {
                            setIsMenuOpen(false);
                            requestAnimationFrame(() => menuButtonRef.current?.focus());
                        }}
                        onNavigate={handleNavigate}
                        onProfileClick={() => handleNavigate(`${BASE_BETA_URL}/profile`)}
                    />
                )}
            </div>
        </OptionalAuthRoute>
    );
}
