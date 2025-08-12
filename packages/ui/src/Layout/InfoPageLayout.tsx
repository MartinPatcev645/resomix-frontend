import { Navbar, StaticNoise, GlobalFooter, GlobalMobileFooter } from "../index";

interface InfoPageLayoutProps {
    LogoHeader: React.ReactNode;
    LogoRFooter: React.ReactNode;
    children: React.ReactNode;
    mode: string;
}

export function InfoPageLayout({ LogoHeader, LogoRFooter, children, mode }: InfoPageLayoutProps) {
    return (
        <div className="bg-[var(--color-secondary)]">
            {/* Static noise background */}
            <StaticNoise color="#313132" opacity={0.7} zIndex={1} overscanVh={50} />

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
                {/* Content Layer */}
                <div className="mx-[var(--px-20)] md:mx-[var(--px-63)] relative">
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[60]">
                        <div className="absolute left-0 top-0 bottom-0 border-l border-dotted border-slate-200" />
                        <div className="absolute right-0 top-0 bottom-0 border-r border-dotted border-slate-200" />
                    </div>

                    {/* Navbar */}
                    <div className="hidden md:block">
                        <Navbar
                            logo={LogoHeader}
                            mode={mode}
                            customClass="flex justify-between items-center align-center pt-[var(--px-28)] z-20 relative"
                        />
                    </div>
                    <div className="block md:hidden">
                        <Navbar
                            logo={LogoHeader}
                            mode={mode}
                            customClass="flex justify-between items-center align-center pt-[var(--px-28)] z-20 relative"
                        />
                        {/* <div className="border-t border-b border-dotted border-slate-200">
                            <MobileNavbar
                                logo={LogoHeader}
                                menuIcon={<button onClick={() => setIsMenuOpen(true)} className="cursor-default"><MenuIcon className="w-[var(--px-25)] h-[var(--px-17)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></button>}
                                customClass="flex justify-between items-center align-center z-50 relative"
                            />
                        </div> */}
                    </div>

                    {/* Content is Injected here */}
                    {children}


                    {/* Display footer based on device */}
                    <div className="hidden md:block">
                        <GlobalFooter logo={LogoRFooter} />
                    </div>
                    <div className="block md:hidden">
                        <GlobalMobileFooter logo={LogoRFooter} />
                    </div>

                </div>
            </div>
        </div>
    );
}
