import { StaticNoise, GlobalFooter, GlobalMobileFooter, SideLines } from "../index";

interface InfoPageLayoutProps {
    LogoRFooter: React.ReactNode;
    children: React.ReactNode;
    navbar?: React.ReactNode;
    hero?: React.ReactNode;
    mode: string;
    baseUrl?: string;
}

export function InfoPageLayout({ LogoRFooter, children, mode, navbar, hero, baseUrl = "https://resomix.com" }: InfoPageLayoutProps) {
    return (
        <div className="bg-[var(--color-primary-background)] lg:bg-[var(--color-secondary)] min-h-screen">
            {/* Static noise background for Desktop only */}
            <div className="hidden lg:block">
                {/* <StaticNoise color="#313132" opacity={0.5} zIndex={1} overscanVh={50} /> */}
                <StaticNoise />
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
                    <SideLines mode={mode}>
                        {/* Navbar */}
                        {navbar}

                        {/* Content */}
                        {children}
                        {/* Footer */}
                        <GlobalFooter logo={LogoRFooter} baseUrl={baseUrl} />
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
                        <GlobalMobileFooter logo={LogoRFooter} baseUrl={baseUrl} />
                    </SideLines>
                </div>
            </div>
        </div>
    );
}
