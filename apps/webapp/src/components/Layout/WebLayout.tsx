import React, { useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { GlobalFooter, GlobalMobileFooter } from "@resomix/ui";
import { AppBackground } from "./AppBackground.tsx";
import { LogoRFooter } from "../icons/LogoRFooter.tsx";
import { OptionalAuthRoute } from "../OptionalAuthRoute.tsx";
import UploadLoader from "../upload/UploadLoader.tsx";
import { WebSideLines } from "./WebSideLines.tsx";
import { SiteHeader, MobileDrawer } from "../Navigation/index.ts";
import { useResponsive, useUploadStore } from "@resomix/hooks";
import { useStopPlaybackOnNavigate } from "@/hooks/useStopPlaybackOnNavigate.ts";
import { BASE_BETA_URL, BASE_LANDING_URL } from "@resomix/config";

/**
 * WebLayout provides a persistent shell (Navigation, SideLines, Footer, AppBackground)
 * that stays mounted during route transitions, preventing layout shifts.
 */
export function WebLayout() {
    const { isDesktop } = useResponsive();
    const { showOverlay } = useUploadStore();

    const location = useLocation();
    const navigate = useNavigate();

    // The shell outlives every route, so this is the one place that sees all navigation —
    // including a jump straight from one playlist to another. Tab switches are untouched.
    useStopPlaybackOnNavigate();

    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const menuButtonRef = React.useRef<HTMLButtonElement>(null);

    const handleNavigate = React.useCallback((path: string) => {
        const isInternal = path.startsWith(BASE_BETA_URL) || path.startsWith('/') || path.includes('beta.resomix.com');

        if (isInternal) {
            let relativePath = path;
            if (path.startsWith(BASE_BETA_URL)) {
                relativePath = path.substring(BASE_BETA_URL.length);
            } else if (path.includes('beta.resomix.com')) {
                try {
                    const url = new URL(path);
                    relativePath = url.pathname + url.search + url.hash;
                } catch {
                    relativePath = path.split('beta.resomix.com')[1] || '/';
                }
            }
            navigate(relativePath || '/');
        } else {
            window.location.href = path;
        }
    }, [navigate]);

    const mode = useMemo(() => {
        const path = location.pathname;
        if (path === '/') return 'upload';
        if (path === '/playlist' || path === '/sonic-discovery') return 'playlist';
        if (path.startsWith('/profile') || path.startsWith('/sessions') || path.startsWith('/change-password') || path.startsWith('/library') || path.startsWith('/analysis')) return 'profile';
        if (path.startsWith('/auth/')) return 'auth';
        if (path === '/contact') return 'contact';
        if (path === '/error') return 'error';
        return '404';
    }, [location.pathname]);

    const headerProps = {
        onNavigate: handleNavigate,
        onProfileClick: () => handleNavigate('/profile'),
        menuButtonRef,
        onMenuOpen: () => setIsMenuOpen(true),
    };

    const desktopNavbar = (
        <SiteHeader variant="desktop" {...headerProps} />
    );

    const mobileNavbar = (
        <SiteHeader variant="mobile" {...headerProps} />
    );

    const footerLogo = (
        <LogoRFooter className="w-[var(--px-27)] h-[var(--px-27)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />
    );

    React.useEffect(() => {
        window.scrollTo(0, 0);
    }, [location.pathname]);

    return (
        <OptionalAuthRoute>
            <div
                id="webapp-page-root"
                className={`${isDesktop ? 'bg-[var(--color-secondary)]' : 'bg-[var(--color-primary-background)]'} min-h-screen flex flex-col relative overflow-x-hidden`}
            >
                <AppBackground />

                {showOverlay && (
                    <div className="fixed inset-0 z-[9999]" id="upload-loader-wrapper">
                        <UploadLoader />
                    </div>
                )}

                <div
                    className={`mx-auto w-full flex-1 flex flex-col text-[var(--color-text-secondary)] relative z-30 max-w-[var(--px-1023)] lg:max-w-[var(--px-2560)] ${showOverlay ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                    style={{ overflowX: "hidden" }}
                >
                    <WebSideLines
                        isDesktop={isDesktop}
                        navbar={isDesktop ? undefined : mobileNavbar}
                        mode={mode}
                    >
                        {isDesktop && desktopNavbar}

                        <main
                            key={location.pathname}
                            className="page-transition flex-1 min-h-[50vh] lg:pt-[var(--header-height)]"
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
                    </WebSideLines>
                </div>

                {isMenuOpen && (
                    <MobileDrawer
                        isOpen={isMenuOpen}
                        onClose={() => {
                            setIsMenuOpen(false);
                            requestAnimationFrame(() => menuButtonRef.current?.focus());
                        }}
                        onNavigate={handleNavigate}
                        onProfileClick={() => handleNavigate('/profile')}
                    />
                )}
            </div>
        </OptionalAuthRoute>
    );
}
