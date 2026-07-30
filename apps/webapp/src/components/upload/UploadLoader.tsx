import React, { useState, useEffect } from "react";
import { useUploadStore } from "@resomix/hooks";
import { SineWaves, CodeTyping } from "@resomix/ui";
import { AppBackground } from "@/components/Layout/AppBackground.tsx";
import LoadingBubblesSvg from "@/assets/icons/loading_bubbles.svg";
import ScaleSvg from "@/assets/icons/scale.svg";
import ScaleMobileSvg from "@/assets/icons/scale_mobile.svg";

const UploadLoader: React.FC = () => {
    const { progress, isFileUpload } = useUploadStore();
    const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
    const [usedMessages, setUsedMessages] = useState<Set<number>>(new Set([0])); // Start with first message used
    const [hideProgressBar, setHideProgressBar] = useState(false);


    const messages = [
        "The system is reading the shape, structure, and spectral flow...",
        "Processing audio architecture…",
        "Discovering hidden connections…",
        "Indexing beats per minute…",
        "Crunching timbral vectors…",
        "Aligning melodic contours…",
        "Weighing groove signatures…",
        "Quantizing dynamic ranges…",
        "Comparing spectral fingerprints…",
        "Calculating audio embeddings…",
        "Syncing harmonic grids…",
        "Clustering tonal neighbors…",
        "Sampling micro-transients…",
        "Correlating rhythm kernels…",
        "Evaluating pitch matrices…",
        "Balancing mixed energies…",
        "Updating similarity graph…",
        "Resolving chord progressions…",
        "Ranking contextual matches…",
        "Refining genre heuristics…",
        "Verifying acoustic features…"
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentMessageIndex(prevIndex => {
                // If we've used all messages, reset the used set and start over
                if (usedMessages.size >= messages.length) {
                    setUsedMessages(new Set([0]));
                    return 0;
                }

                // Find next available message (not used yet)
                let nextIndex = prevIndex;
                do {
                    nextIndex = Math.floor(Math.random() * messages.length);
                } while (usedMessages.has(nextIndex));

                // Mark this message as used
                setUsedMessages(prev => new Set([...prev, nextIndex]));
                return nextIndex;
            });
        }, 4000); // Change every 4 seconds

        return () => clearInterval(interval);
    }, [usedMessages, messages.length]);

    // Timer to hide progress bar after upload completion
    useEffect(() => {
        if (isFileUpload && progress >= 99) {
            const timer = setTimeout(() => {
                setHideProgressBar(true);
            }, 3000); // Hide after 3 seconds

            return () => clearTimeout(timer);
        } else {
            // Reset hide state if we're not at 100% or not a file upload
            setHideProgressBar(false);
        }
    }, [isFileUpload, progress]);

    // Use real upload progress from store
    const loaderProgress = progress;

    return (
        <div
            className="w-screen h-screen relative overflow-hidden bg-[var(--color-primary-background)] lg:bg-[var(--color-secondary)] similarity-playlist-loader"
            id="similarity-playlist-loader"
            role="status"
            aria-live="polite"
            aria-label="Loading playlist"
        >
            {/* The app backdrop, not the old NebulaField aurora — this overlay covers the whole
                viewport, so a different background here read as the product changing skin. */}
            <AppBackground />
            <div className="absolute inset-0 w-full h-full">
                <SineWaves />
            </div>
            <div className="flex flex-col w-full h-full justify-center items-center text-[var(--color-primary)] gap-[var(--px-30)] max-w-[var(--px-900)] mx-auto relative z-15">
                {/* Desktop */}
                <div className="hidden lg:flex w-full items-start justify-between min-h-[var(--px-36)]">
                    <div className="text-[length:var(--px-6)] font-light font-fira tracking-[var(--px-1)]">
                        <CodeTyping
                            text="[SCAN_01] → Analyzing rhythm and tone<|>.<|><br />[SCAN_02] → Tracing harmonic intent<|>.<|><br />[SCAN_03] → Reading the spectral flow<|>.<|><br />[SCAN_04] → Listening … Matching in progress<|>.<|>"
                            // Speed = 100 delay = 1000
                            speed={130}
                            delay={1000}
                            multiline={true}
                            loadingEffect={true}
                            loadingEffectDelay={4}
                        />
                    </div>
                    <div className="text-right text-[length:var(--px-6)] font-light font-fira tracking-[var(--px-1)]">
                        <CodeTyping
                            text=">> WAVE: Parsed<br />>>"
                            // Speed = 100
                            speed={60}
                            multiline={true}
                        />
                    </div>
                </div>
                {/* Mobile */}
                <div className="flex lg:hidden w-full items-start justify-between min-h-[var(--px-36)] px-[var(--px-30)]">
                    <div className="text-[length:var(--px-6)] font-light font-fira tracking-[var(--px-1)]">
                        <CodeTyping
                            text=">> CLSTR_ID: #e24x7"
                            // Speed = 100 delay = 800
                            speed={60}
                            delay={1200}
                        />
                    </div>
                    <div className="text-right text-[length:var(--px-6)] font-light font-fira tracking-[var(--px-1)]">
                        <CodeTyping
                            text=">> WAVE: Parsed<br />>>"
                            // Speed = 100
                            speed={60}
                            multiline={true}
                        />
                    </div>
                </div>
                <div className="flex w-full justify-between mt-[var(--px-260)] lg:mt-[var(--px-230)] min-h-[var(--px-40)]">
                    <div className="hidden lg:flex text-[length:var(--px-6)] font-light font-fira tracking-[var(--px-1)] min-w-[var(--px-203)] flex-col gap-[var(--px-10)] items-start">
                        <img src={LoadingBubblesSvg} draggable={false} alt="" aria-hidden="true" className="w-[var(--px-90)] h-[var(--px-9)]" />
                        <CodeTyping
                            text="[SCAN_05] → Mapping sonic DNA<|>.<|><br />[SCAN_06] → Decoding musical patterns<|>.<|><br />[SCAN_07] → Scanning frequency fingerprints<|>.<|><br />[FINAL] → Finalizing playlist blueprint<|>.<|>"
                            // Speed = 100 delay = 5000
                            speed={130}
                            delay={33000}
                            multiline={true}
                            loadingEffect={true}
                            loadingEffectDelay={3}
                        />
                    </div>
                    <div className="text-center mx-auto lg:mx-0 max-w-[var(--px-280)] lg:max-w-none min-h-[14px] и max-h-[14px] text-[length:var(--px-9)] font-light font-fira tracking-[var(--px-1)] mt-[var(--px-40)]">
                        <CodeTyping
                            text={messages[currentMessageIndex]}
                            speed={100}
                            key={currentMessageIndex}
                        />
                    </div>
                    <div className="hidden lg:block text-right text-[length:var(--px-6)] font-light font-fira tracking-[var(--px-1)] min-w-[var(--px-88)] mt-[var(--px-40)]">
                        <CodeTyping
                            text=">> CLSTR_ID: #e24x7"
                            // Speed = 100 delay = 800
                            speed={60}
                            delay={1200}
                        />
                    </div>
                </div>
                {/* Desktop Loader - Only show for file uploads */}
                {isFileUpload && !hideProgressBar && (
                    <div className="hidden lg:flex flex-col w-full justify-center min-h-[var(--px-40)] gap-[var(--px-10)] relative w-[var(--px-900)]">
                        <div className="text-[length:var(--px-11)] font-light font-fira tracking-[var(--px-2)] w-[var(--px-900)] relative">
                            <div
                                className="absolute -top-[var(--px-10)]"
                                style={{ left: `min(calc((var(--px-830) * ${loaderProgress}) / 100), calc(var(--px-830)))` }}
                            >
                                [ {Math.round(loaderProgress)}% ]
                            </div>
                        </div>
                        <img src={ScaleSvg} draggable={false} alt="" aria-hidden="true" className="w-[var(--px-900)] h-[var(--px-21)]" />
                        {/* Only show progress bar for actual file uploads */}
                        {(loaderProgress < 99) && (
                            <div className="text-right text-[var(--px-11)] font-light font-fira tracking-[var(--px-2)] -mr-[var(--px-3)]">
                                Uploading...
                            </div>
                        )}
                        {(loaderProgress >= 99) && (
                            <div className="text-right text-[var(--px-11)] font-light font-fira tracking-[var(--px-2)] -mr-[var(--px-3)]">
                                Uploaded!
                            </div>
                        )}
                    </div>
                )}
                {/* Mobile Loader - Only show for file uploads */}
                {isFileUpload && !hideProgressBar && (
                    <div className="flex lg:hidden flex-col w-full justify-center min-h-[var(--px-40)] gap-[var(--px-10)] relative w-[var(--px-393)]">
                        <div className="text-[length:var(--px-12)] font-light font-fira tracking-[var(--px-2-2)] w-[var(--px-393)] relative">
                            <div
                                className="absolute -top-[var(--px-10)]"
                                style={{ left: `min(calc((var(--px-315) * ${loaderProgress}) / 100), calc(var(--px-315)))` }}
                            >
                                [ {Math.round(loaderProgress)}% ]
                            </div>
                        </div>
                        <img src={ScaleMobileSvg} draggable={false} alt="" aria-hidden="true" className="w-[var(--px-393)] h-[var(--px-23)]" />
                        {/* Only show progress bar for actual file uploads */}
                        {(loaderProgress < 99) && (
                            <div className="text-right text-[var(--px-11)] font-light font-fira tracking-[var(--px-2)] -mr-[var(--px-3)]">
                                Uploading...
                            </div>
                        )}
                        {(loaderProgress >= 99) && (
                            <div className="text-right text-[var(--px-11)] font-light font-fira tracking-[var(--px-2)] -mr-[var(--px-3)]">
                                Uploaded!
                            </div>
                        )}
                    </div>
                )}

                {/* Error banner removed – status handled globally */}
            </div>
        </div>
    );
};

export default UploadLoader;
