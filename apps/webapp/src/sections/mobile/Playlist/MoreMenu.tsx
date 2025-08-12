import React from "react";
import { ButtonSleek } from "@resomix/ui";
import MenuSeparator from "@/assets/icons/menu_separator.svg";
import { ThumbIcon } from "@/components/index.ts";

interface MoreMenuProps {
    onClose?: () => void;
    trackId?: string;
}

const MoreMenu: React.FC<MoreMenuProps> = ({ onClose, trackId }) => {
    // Preserve scroll position when opening menu
    React.useEffect(() => {
        const scrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
        
        return () => {
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            window.scrollTo(0, scrollY);
        };
    }, []);

    return (
        <div className="w-screen h-full min-h-screen relative overflow-hidden bg-[var(--color-primary-background)]">
            <div className="flex flex-col justify-between h-full min-h-screen relative z-15 text-[var(--color-primary)] py-[var(--px-60)] px-[var(--px-40)] overflow-y-auto">
                <div className="flex flex-col gap-[var(--px-30)] items-center">
                    <div className="text-[length:var(--px-22)] font-light font-helvetica uppercase text-center w-[var(--px-270)]">
                        Up The Line (Loz Goddard Remix)
                    </div>
                    <div className="">
                        <img src={MenuSeparator} alt="MenuSeparator" className="w-[var(--px-4)] h-[var(--px-49)]" />
                    </div>
                    <div className="flex flex-col gap-[var(--px-10)] w-full">
                        <div className="flex w-full justify-between">
                            <div className="text-left text-[length:var(--px-14)] font-light font-fira">
                                Label:
                            </div>
                            <div className="text-right text-[length:var(--px-14)] font-light font-fira truncate max-w-[var(--px-220)]">
                                Break New Soil Recordings
                            </div>
                        </div>
                        <div className="flex w-full justify-between">
                            <div className="text-left text-[length:var(--px-14)] font-light font-fira">
                                Duration:
                            </div>
                            <div className="text-right text-[length:var(--px-14)] font-light font-fira truncate max-w-[var(--px-220)]">
                                4:31
                            </div>
                        </div>
                        <div className="flex w-full justify-between">
                            <div className="text-left text-[length:var(--px-14)] font-light font-fira">
                                Score:
                            </div>
                            <div className="text-right text-[length:var(--px-14)] font-light font-fira truncate max-w-[var(--px-220)]">
                                99.9
                            </div>
                        </div>
                        <div className="flex w-full justify-between my-[var(--px-20)]">
                            <div className="text-left text-[length:var(--px-14)] font-light font-fira">
                                Similar:
                            </div>
                            <div className="flex items-center justify-end w-[var(--px-80)] gap-[var(--px-30)]">
                                <ThumbIcon onClick={() => { }} className="w-[var(--px-26)] h-[var(--px-26)] text-[var(--color-primary-hover)] hover:text-[var(--color-primary)] hover:cursor-pointer" />
                                <ThumbIcon onClick={() => { }} className="w-[var(--px-26)] h-[var(--px-26)] text-[var(--color-primary-hover)] transform rotate-180 hover:text-[var(--color-primary)] hover:cursor-pointer" />
                            </div>
                        </div>
                        <div className="flex w-full justify-between">
                            <div className="text-left text-[length:var(--px-14)] font-light font-fira">
                                Status:
                            </div>
                            <div className="text-right text-[length:var(--px-14)] font-light font-fira truncate max-w-[var(--px-220)]">
                                Active
                            </div>
                        </div>
                        <div className="flex w-full justify-between">
                            <div className="text-left text-[length:var(--px-14)] font-light font-fira">
                                Mode:
                            </div>
                            <div className="text-right text-[length:var(--px-14)] font-light font-fira truncate max-w-[var(--px-220)]">
                                Universal
                            </div>
                        </div>
                        <div className="flex w-full justify-between">
                            <div className="text-left text-[length:var(--px-14)] font-light font-fira">
                                Peaks:
                            </div>
                            <div className="text-right text-[length:var(--px-14)] font-light font-fira truncate max-w-[var(--px-220)]">
                                Loaded
                            </div>
                        </div>
                        <div className="flex w-full justify-between">
                            <div className="text-left text-[length:var(--px-14)] font-light font-fira">
                                ID:
                            </div>
                            <div className="text-right text-[length:var(--px-14)] font-light font-fira truncate max-w-[var(--px-220)]">
                                {trackId}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-[var(--px-10)] w-full px-[var(--px-3)]">
                        <div className="w-full">
                            {/* Add condition to not display this if the track id is of reference track */}
                            <ButtonSleek transparent={true} className="w-[var(--px-276)] text-[length:var(--px-14)]" text="Start Sonic Discovery on this Track" customWidth="w-full" onClick={() => { }} />
                        </div>
                        <div className="w-full">
                            <ButtonSleek transparent={true} className="w-[var(--px-276)] text-[length:var(--px-14)]" text="Close" customWidth="w-full" onClick={onClose || (() => {})} />
                        </div>
                    </div>
                </div>
                
            </div>
        </div >
    );
};

export default MoreMenu;
