import React, { useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Navbar, MobileNavbar, StaticNoise, GlobalFooter, GlobalMobileFooter, SideLines } from "@resomix/ui";
import { LogoHeader } from "../icons/LogoHeader.tsx";
import { LogoRFooter } from "../icons/LogoRFooter.tsx";
import { MenuIcon } from "../icons/MenuIcon.tsx";
import UploadLoader from "../upload/UploadLoader.tsx";
import { useResponsive, useUploadStore } from "@resomix/hooks";
import { BASE_BETA_URL, BASE_LANDING_URL } from "@resomix/config";
import { MenuPage } from "@/pages/index.ts";

/**
 * WebLayout provides a persistent shell (Navbar, SideLines, Footer, StaticNoise)
 * that stays mounted during route transitions, preventing layout shifts.
 */
export function WebLayout() {
    const { isDesktop } = useResponsive();
    const { showOverlay } = useUploadStore();


    const location = useLocation();
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);


    // Internal navigation handler to avoid full page reloads
    const handleNavigate = React.useCallback((path: string) => {
        // Check if path belongs to the Beta/WebApp domain
        const isInternal = path.startsWith(BASE_BETA_URL) || path.startsWith('/') || path.includes('beta.resomix.com');

        if (isInternal) {
            let relativePath = path;
            if (path.startsWith(BASE_BETA_URL)) {
                relativePath = path.substring(BASE_BETA_URL.length);
            } else if (path.includes('beta.resomix.com')) {
                try {
                    const url = new URL(path);
                    relativePath = url.pathname + url.search + url.hash;
                } catch (e) {
                    // Fallback if URL parsing fails
                    relativePath = path.split('beta.resomix.com')[1] || '/';
                }
            }
            navigate(relativePath || '/');
        } else {
            window.location.href = path;
        }
    }, [navigate]);

    // Derive mode from current pathname for Navbar styling/logic
    const mode = useMemo(() => {
        const path = location.pathname;
        if (path === '/') return 'upload';
        if (path === '/playlist' || path === '/sonic-discovery') return 'playlist';
        if (path.startsWith('/profile') || path.startsWith('/sessions') || path.startsWith('/change-password')) return 'profile';
        if (path.startsWith('/auth/')) return 'auth';
        if (path === '/contact') return 'contact';
        if (path === '/error') return 'error';
        return '404';
    }, [location.pathname]);

    const desktopNavbar = (
        <Navbar
            logo={
                <a
                    href={BASE_LANDING_URL}
                    aria-label="Resomix home"
                    className="cursor-default"
                    onClick={(e) => {
                        e.preventDefault();
                        handleNavigate(BASE_LANDING_URL);
                    }}
                >
                    <LogoHeader className="w-[var(--px-110)] h-[var(--px-16)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />
                </a>
            }
            mode={mode}
            baseUrl={BASE_LANDING_URL}
            baseBetaUrl={BASE_BETA_URL}
            customClass="flex justify-between items-center align-center pt-[var(--px-28)] z-20 relative"
            onProfileClick={() => handleNavigate('/profile')}
            onNavigate={handleNavigate}
            currentPath={location.pathname}
        />
    );

    const mobileNavbar = (
        <MobileNavbar
            logo={
                <a
                    href={BASE_LANDING_URL}
                    aria-label="Resomix home"
                    className="cursor-default"
                    onClick={(e) => {
                        e.preventDefault();
                        handleNavigate(BASE_LANDING_URL);
                    }}
                >
                    <LogoHeader className="w-[var(--px-120)] h-[var(--px-17)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />
                </a>
            }
            menuIcon={
                <button onClick={() => setIsMenuOpen(true)} aria-label="Open menu" name="Open menu" type="button" className="cursor-default">
                    <MenuIcon className="w-[var(--px-25)] h-[var(--px-17)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />
                </button>
            }
            customClass="flex justify-between items-center align-center z-50 relative"
        />
    );

    const footerLogo = (
        <LogoRFooter className="w-[var(--px-27)] h-[var(--px-27)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />
    );

    // Scroll to top on every navigation
    React.useEffect(() => {
        window.scrollTo(0, 0);
    }, [location.pathname]);

    return (
        <div className="bg-[var(--color-secondary)] min-h-screen relative overflow-x-hidden">
            {/* Persistent Static Noise */}
            <StaticNoise />

            {/* Persistent Upload / Search Overlay */}
            {showOverlay && (
                <div className="fixed inset-0 z-[9999]" id="upload-loader-wrapper">
                    <UploadLoader />
                </div>
            )}

            {/* Persistent Layout Content */}
            <div
                className={`mx-auto text-[var(--color-text-secondary)] relative z-30 max-w-[var(--px-1023)] lg:max-w-[var(--px-2560)] ${showOverlay ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                style={{ overflowX: "hidden" }}
            >
                <SideLines
                    navbar={isDesktop ? undefined : mobileNavbar}
                    mode={mode}
                >
                    {isDesktop && <header>{desktopNavbar}</header>}

                    <main
                        key={location.pathname}
                        className="page-transition"
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

            {/* Menu Overlay for Mobile */}
            {isMenuOpen && (
                <div className="fixed inset-0 z-[100]">
                    <MenuPage onClose={() => setIsMenuOpen(false)} />
                </div>
            )}
        </div>
    );
}
