import React, { useRef, useCallback, useState } from "react";
import searchIcon from "@/assets/icons/search.svg";
import uploadIcon from "@/assets/icons/arrow_upload.svg";
import ReferenceSvg from "@/assets/icons/reference.svg";
import { ButtonSleek } from "@resomix/ui";
import { useUpload, type UseUploadOptions } from "@resomix/hooks";
import {
    UPLOAD_BROWSE_ACTION,
    UPLOAD_DROP_HEADING,
    UPLOAD_FORMAT_LINE,
    UPLOAD_RETENTION_SHORT,
} from "@/sections/desktop/Workspace/workspaceCopy.ts";

interface UploadComponentProps {
    onSearchClick?: () => void;
    onAnalysis?: UseUploadOptions["onAnalysis"];
    hideSourceTabs?: boolean;
    deferSubmit?: boolean;
    onFileSelected?: (file: File) => void;
    variant?: "legacy" | "workspace";
}

/**
 * Simple structural mock-up of the desktop search section.
 * All copy / visuals are placeholders – tweak freely.
 */
export const UploadComponentMobile: React.FC<UploadComponentProps> = ({
    onSearchClick,
    onAnalysis,
    hideSourceTabs = false,
    deferSubmit = false,
    onFileSelected,
    variant = "legacy",
}) => {
    const sectionRef = useRef<HTMLDivElement | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const { inputRef, inputAccept, onInputChange, openFilePicker, onDrop, onDragOver, handleUpload } = useUpload({ onAnalysis });

    const pickFile = useCallback(
        async (file: File | null | undefined) => {
            if (!file) return;
            if (deferSubmit && onFileSelected) {
                onFileSelected(file);
                return;
            }
            await handleUpload(file);
        },
        [deferSubmit, onFileSelected, handleUpload],
    );

    const onDeferredInputChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
        (e) => {
            const file = e.target.files && e.target.files[0];
            void pickFile(file || null);
            if (inputRef.current) inputRef.current.value = "";
        },
        [pickFile, inputRef],
    );

    const onDeferredDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer?.files?.[0];
            void pickFile(file || null);
        },
        [pickFile],
    );

    const dropHandler = deferSubmit ? onDeferredDrop : onDrop;
    const inputHandler = deferSubmit ? onDeferredInputChange : onInputChange;

    if (variant === "workspace") {
        return (
            <div ref={sectionRef}>
                <input ref={inputRef} type="file" accept={inputAccept} onChange={inputHandler} className="hidden" />
                <div
                    role="region"
                    aria-label={UPLOAD_DROP_HEADING}
                    className={[
                        "flex flex-col items-center gap-[var(--px-10)] border-2 border-dashed px-[var(--px-16)] py-[var(--px-28)] text-center transition-colors",
                        dragOver
                            ? "border-[rgba(238,74,38,.7)] bg-[rgba(238,74,38,.04)]"
                            : "border-[rgba(255,255,255,.25)] bg-[rgba(255,255,255,.012)]",
                    ].join(" ")}
                    onDrop={dropHandler}
                    onDragOver={(e) => {
                        onDragOver?.(e);
                        setDragOver(true);
                    }}
                    onDragEnter={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                    }}
                    onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                            setDragOver(false);
                        }
                    }}
                >
                    <span
                        aria-hidden="true"
                        className={[
                            "h-[var(--px-32)] w-[var(--px-32)]",
                            dragOver ? "text-[var(--color-accent,#EE4A26)]" : "text-[rgba(255,255,255,.55)]",
                        ].join(" ")}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
                            <path d="M12 16 V5 M8 9 l4-4 4 4" />
                            <path d="M4 15 v4 h16 v-4" />
                        </svg>
                    </span>
                    <p
                        className={[
                            "font-helvetica text-[length:var(--px-17)] font-bold uppercase tracking-[0.03em]",
                            dragOver ? "text-[var(--color-accent,#EE4A26)]" : "text-[var(--color-primary)]",
                        ].join(" ")}
                    >
                        {UPLOAD_DROP_HEADING}
                    </p>
                    <p className="font-fira text-[length:var(--px-12)] uppercase tracking-[var(--px-1)] text-[rgba(255,255,255,.7)]">
                        {UPLOAD_FORMAT_LINE}
                    </p>
                    <button
                        type="button"
                        id="upload-component-upload-button"
                        className="upload-button mt-[var(--px-6)] inline-flex min-h-[var(--px-44)] items-center gap-[var(--px-8)] rounded-full border border-[rgba(255,255,255,.3)] px-[var(--px-22)] py-[var(--px-13)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)] text-[var(--color-primary)] before:block before:w-[var(--px-6)] before:border-t before:border-[var(--color-accent,#EE4A26)] before:content-[''] hover:border-[rgba(255,255,255,.7)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent,#EE4A26)]"
                        onClick={openFilePicker}
                    >
                        {UPLOAD_BROWSE_ACTION}
                    </button>
                    <p className="mt-[var(--px-4)] text-[length:var(--px-13)] font-helvetica font-light text-[rgba(255,255,255,.55)]">
                        {UPLOAD_RETENTION_SHORT}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div ref={sectionRef} className="relative">
            {/* Hidden SVG defs for clip-path */}
            <svg viewBox="0 0 315 383" preserveAspectRatio="none" className="absolute inset-0 w-[length:var(--px-355)] h-[length:var(--px-384)] pointer-events-none z-10" aria-hidden="true">
                <defs>
                    <clipPath id="container" clipPathUnits="objectBoundingBox">
                        <path transform="scale(0.0021097046,0.0026109660)" d="M314 382.481V0.629395H181.014L136.651 67.2961H1.00195V382.481H314Z" />
                    </clipPath>
                </defs>
                <defs>
                    <clipPath id="containerTwo" clipPathUnits="objectBoundingBox">
                        <path transform="scale(0.0021097046,0.0026109660)" d="M1.24744 53.9628V0.629395H169.275L133.217 53.9628H1.24744Z" />
                    </clipPath>
                </defs>

                {/* stroke outline */}
                <path d="M314 382.481V0.629395H181.014L136.651 67.2961H1.00195V382.481H314Z" stroke="white" strokeWidth="1" strokeDasharray="0.74 0.74" fill="none" />
                <path d="M1.24744 53.9628V0.629395H169.275L133.217 53.9628H1.24744Z" stroke="white" strokeWidth="1" strokeDasharray="0.74 0.74" fill="none" />
                <path d="M167.066 54.7035H298.79" stroke="white" strokeWidth="1" strokeDasharray="0.74 0.74" />
            </svg>

            {/* Hidden file input for mobile (Android/iOS) */}
            <input ref={inputRef} type="file" accept={inputAccept} onChange={inputHandler} className="hidden" />

            {/* Tab container - positioned above the main content */}
            <div className="relative w-[var(--px-355)] h-[var(--px-384)] mx-auto z-30">
                {/* Tabs positioned to align with the tab shapes */}
                <div className="flex flex-col justify-start w-full h-full select-none py-auto">
                    {!hideSourceTabs && (
                        <div className="flex" role="tablist" aria-label="Search and upload tabs">
                            <button
                                id="tab-search-mobile"
                                role="tab"
                                aria-selected="false"
                                aria-controls="panel-search-mobile"
                                type="button"
                                className="flex-1/2 h-[var(--px-60)] p-3 flex items-center justify-center gap-2 hover:cursor-pointer hover:underline"
                                onClick={onSearchClick}
                            >
                                <span className="text-[var(--color-primary)] text-[length:var(--px-16)] font-helvetica uppercase font-light">SEARCH</span>
                                <img src={searchIcon} draggable={false} alt="" aria-hidden="true" className="w-[var(--px-16)] h-[var(--px-16)]" />
                            </button>
                            <button
                                id="tab-upload-mobile"
                                role="tab"
                                aria-selected="true"
                                aria-controls="panel-upload-mobile"
                                type="button"
                                className="flex-1/2 h-[var(--px-60)] p-3 flex items-center justify-center gap-2"
                            >
                                <span className="text-[var(--color-primary)] text-[length:var(--px-16)] font-helvetica uppercase font-light">UPLOAD</span>
                                <img src={uploadIcon} draggable={false} alt="" aria-hidden="true" className="w-[var(--px-16)] h-[var(--px-16)]" />
                            </button>
                        </div>
                    )}
                    <div id="panel-upload-mobile" role="tabpanel" aria-labelledby="tab-upload-mobile" className="m-[var(--px-20)]">
                        <div className="w-full h-[var(--px-300)] border border-dotted border-slate-200 my-[var(--px-20)]" onDrop={dropHandler} onDragOver={onDragOver}>
                            <div className="flex flex-col w-full h-full justify-center items-center">
                                <h3 className="mt-[var(--px-10)] text-[length:var(--px-18)] font-helvetica font-light text-center leading-[var(--px-24)] uppercase">
                                    DROP A REFERENCE TRACK
                                </h3>
                                <div className="flex items-center justify-center gap-[var(--px-10)] mt-[var(--px-10)] ml-[var(--px-16)]">
                                    <img src={ReferenceSvg} aria-hidden="true" loading="lazy" draggable={false} alt="" className="w-[var(--px-37)] h-[var(--px-37)] my-[var(--px-10)]" />
                                    <div className="text-[length:var(--px-12)] font-fira font-light text-left leading-[var(--px-15)] opacity-70">
                                        Released or unreleased. A full track, a rough sketch, or a short clip from your archive. PYXIS-1 extracts the sonic profile and finds the closest matches in the catalog.
                                    </div>
                                </div>
                                <div className="text-[length:var(--px-12)] opacity-70 font-fira font-light my-[var(--px-20)] text-center">
                                    {/* or */}
                                </div>
                                <ButtonSleek className="w-[var(--px-250)] upload-button" text="Upload Your Track" onClick={openFilePicker} id="upload-component-upload-button" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
