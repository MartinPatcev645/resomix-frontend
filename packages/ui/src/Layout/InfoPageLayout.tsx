import { StaticNoise, GlobalFooter, GlobalMobileFooter, SideLines } from "../index";

interface InfoPageLayoutProps {
    LogoRFooter: React.ReactNode;
    children: React.ReactNode;
    navbar?: React.ReactNode;
    hero?: React.ReactNode;
    mode: string;
}

export function InfoPageLayout({ LogoRFooter, children, mode, navbar, hero }: InfoPageLayoutProps) {
    return (
        <div className="bg-[var(--color-primary-background)] lg:bg-[var(--color-secondary)]">
            {/* Static noise background for Desktop only */}
            <div className="hidden lg:block">
                <StaticNoise color="#313132" opacity={0.7} zIndex={1} overscanVh={50} />
            </div>

            {/* Content layer */}
            <div
                style={{
                    margin: '0 auto',
                    color: 'var(--color-text-secondary)',
                    position: 'relative',
                    zIndex: 30,
                    overflowX: 'hidden',
                }}
                className="max-w-[var(--px-1023)] lg:max-w-[var(--px-2560)]"
            >
                {/* Desktop Frame */}
                <div className="hidden lg:block">
                    <SideLines>
                        {/* Navbar */}
                        {navbar}

                        {/* Top Frame Only */}
                        {(mode === "terms" || mode === "privacy" || mode === "contact" || mode === "error") && (
                            <svg
                                viewBox="0 0 1152 41"
                                preserveAspectRatio="none"
                                className="absolute left-0 top-[var(--px-65)] w-full h-[length:var(--px-41)] pointer-events-none z-10"
                            >
                                <path d="M0 1H278.889L347.407 40.5592H779.63L848.148 1L1151.48 1"
                                    stroke="white"
                                    strokeOpacity="1"
                                    strokeWidth="1"
                                    strokeDasharray="0.74 0.74"
                                    fill="none"
                                />
                            </svg>
                        )}

                        {/* Content */}
                        {children}
                        {/* Footer */}
                        <GlobalFooter logo={LogoRFooter} />
                    </SideLines>
                </div>

                {/* Mobile Frame */}
                <div className="block lg:hidden">
                    <SideLines
                        navbar={navbar}
                        hero={hero}
                        mode={mode}
                    >
                        {/* Content */}
                        {children}
                        {/* Footer */}
                        <GlobalMobileFooter logo={LogoRFooter} />
                    </SideLines>
                </div>
            </div>
        </div>
    );
}
