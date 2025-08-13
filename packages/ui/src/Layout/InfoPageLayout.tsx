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
        <div className="bg-[var(--color-primary-background)]">
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
