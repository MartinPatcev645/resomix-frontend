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
    const { isDesktop } = useResponsive();
    const location = useLocation();
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const menuButtonRef = React.useRef<HTMLButtonElement>(null);

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
            navigate(relativePath || '/');
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
        if (['/contact', '/waitlist', '/error', '/partners', '/partners/pilot', '/trust', '/pricing', '/product', '/product/sonic-discovery', '/product/track-intelligence', '/product/catalog-intelligence', '/developers', '/solutions/record-labels', '/solutions/sync-agencies', '/solutions/music-libraries-sample-providers', '/solutions/djs', '/solutions/music-curators', '/solutions/producers'].includes(path)) {
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
    // SideLines mounts desktop + mobile trees; prefer a visible id match so mobile isn't a no-op.
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
            <div id="landing-page-root" className={`${isDesktop ? 'bg-[var(--color-secondary)]' : 'bg-[var(--color-primary-background)]'} min-h-screen relative`}>
                {/* Shared void-field backdrop for pages that don't render their own (the marketing
                    pages in the list below already ship their page-scoped void-field). Keeps every
                    page on the same home-style background. */}
                {!['home', 'product', 'product/sonic-discovery', 'product/track-intelligence', 'product/catalog-intelligence', 'developers', 'partners', 'partners/pilot', 'trust', 'solutions/record-labels', 'solutions/sync-agencies', 'solutions/music-libraries-sample-providers', 'solutions/djs', 'solutions/music-curators', 'solutions/producers'].includes(mode) && (
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
                            className="page-transition pt-[calc(var(--nav-hdr-h,4.25rem)-3px)]"
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
