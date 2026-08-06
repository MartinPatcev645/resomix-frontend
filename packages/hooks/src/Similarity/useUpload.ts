import { useCallback, useMemo, useRef } from "react";
import { emitUsageChanged, getSimilarTracks, API_CONFIG } from "@resomix/api-client";
// import { waitForSegmentation } from "@resomix/api-client"; // Commented out - segmentation polling no longer needed
import { usePlaylistStore, usePlayerStore, useAuthStore } from "@resomix/stores";
import { create } from "zustand";
import { extractCoverArt } from "../meta/useMetatags";
import { useTermsAcceptance } from "../useTermsAcceptance";
import { mapPlaylistErrorMessage } from "../Playlist/errorMessages";

export interface UploadResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    details?: unknown;
}

export interface UploadAnalysisStats {
    resultCount: number;
    topMatchScore: number;
    analysisSeconds: number;
}

export interface UseUploadOptions {
    onAnalysis?: (playlistId: string, stats: UploadAnalysisStats) => void;
}

interface UploadStoreState {
    isUploading: boolean;
    progress: number;
    error: string | null;
    file: File | null;
    showOverlay: boolean;
    response: UploadResult | null;
    isFileUpload: boolean;
    /** Soft entitlement-gate reason ("login_required" | "upgrade_required") when a create is
     *  blocked by a plan limit — drives a login/subscribe CTA instead of a generic error. */
    gateReason: string | null;
    /** Optional message overrides for the gate modal (e.g. the login-only upload prompt vs the
     *  monthly-limit prompt — same reason, different copy). Null → the modal's defaults. */
    gateTitle: string | null;
    gateBody: string | null;
    setUploading: (isUploading: boolean) => void;
    setProgress: (progress: number) => void;
    setError: (error: string | null) => void;
    setFile: (file: File | null) => void;
    setOverlay: (visible: boolean) => void;
    setResponse: (response: UploadResult | null) => void;
    setIsFileUpload: (isFileUpload: boolean) => void;
    setGateReason: (reason: string | null) => void;
    /** Set the gate reason plus custom copy in one call. */
    setGate: (reason: string | null, title?: string | null, body?: string | null) => void;
    reset: () => void;
}

export const useUploadStore = create<UploadStoreState>((set) => ({
    isUploading: false,
    progress: 0,
    error: null,
    file: null,
    showOverlay: false,
    response: null,
    isFileUpload: false,
    gateReason: null,
    gateTitle: null,
    gateBody: null,
    setUploading: (isUploading) => set({ isUploading }),
    setProgress: (progress) => set({ progress }),
    setError: (error) => set({ error }),
    setFile: (file) => set({ file }),
    setOverlay: (visible) => set({ showOverlay: visible }),
    setResponse: (response) => set({ response }),
    setIsFileUpload: (isFileUpload) => set({ isFileUpload }),
    setGateReason: (reason) => set({ gateReason: reason, gateTitle: null, gateBody: null }),
    setGate: (reason, title = null, body = null) => set({ gateReason: reason, gateTitle: title, gateBody: body }),
    reset: () => set({ isUploading: false, progress: 0, error: null, file: null, showOverlay: false, response: null, isFileUpload: false, gateReason: null, gateTitle: null, gateBody: null })
}));

/**
 * Hook for handling audio uploads on web, Android and iOS mobile browsers.
 * - Provides a hidden input ref and an opener to trigger native pickers
 * - Validates against API_CONFIG.ALLOWED_AUDIO_TYPES and MAX_FILE_SIZE
 * - Uploads with progress via getSimilarTracks
 */
export function useUpload(options?: UseUploadOptions) {
    const onAnalysis = options?.onAnalysis;
    const inputRef = useRef<HTMLInputElement | null>(null);
    const { setUploading, setProgress, setError, setFile, setOverlay, setResponse, setIsFileUpload, setGateReason, setGate, reset } = useUploadStore();
    const { setPlaylistResponse } = usePlaylistStore();
    const { topSk, setUploadedCoverArt } = usePlayerStore();
    const { checkTermsAcceptance } = useTermsAcceptance();

    const inputAccept = useMemo(() => {
        // Include explicit mime types, wildcard for broader mobile support, and common extensions as fallback
        const mimes = API_CONFIG.ALLOWED_AUDIO_TYPES;
        const extensions = [".mp3", ".wav", ".ogg", ".aac", ".flac"];
        return ["audio/*", ...mimes, ...extensions].join(",");
    }, []);

    const openFilePicker = useCallback(async () => {
        // Check terms acceptance before allowing file picker
        const termsAccepted = await checkTermsAcceptance();
        if (!termsAccepted) {
            return; // User dismissed terms without accepting
        }

        if (inputRef.current) {
            inputRef.current.click();
        }
    }, [checkTermsAcceptance]);

    const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
        if (!file) return { valid: false, error: "No file selected." };
        if (file.size > API_CONFIG.MAX_FILE_SIZE) {
            return { valid: false, error: `File too large. Maximum size is ${API_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB.` };
        }
        // Some mobile browsers may not populate file.type; fallback to extension-based check
        const typeOk = !!file.type && API_CONFIG.ALLOWED_AUDIO_TYPES.includes(file.type);
        if (typeOk) return { valid: true };
        const name = file.name?.toLowerCase() || "";
        const extOk = [".mp3", ".wav", ".ogg", ".aac", ".flac"].some((ext) => name.endsWith(ext));
        if (!extOk) return { valid: false, error: "Invalid file type. Please upload an audio file." };
        return { valid: true };
    }, []);

    /**
     * Upload a track and run similarity on it.
     *
     * Returns **true only when a playlist was produced** — see the note on `handleSelectTrack`.
     * A 402 quota denial (monthly upload allowance spent) writes nothing to the store because the
     * global QuotaDenialModal owns that copy, so a caller watching `error || gateReason` would
     * never learn the upload failed and would leave its progress steps running behind the modal.
     */
    const handleUpload = useCallback(async (file: File | null | undefined): Promise<boolean> => {
        if (!file) return false;

        // Similarity-by-upload is login-only. Intercept guests BEFORE any file work / network call
        // so they never upload the file just to hit a server rejection — show the login gate instead,
        // with copy about the feature (not a "limit reached" message).
        if (!useAuthStore.getState().isAuthenticated) {
            setGate(
                "login_required",
                "Log in to upload your own track",
                "Uploading your own audio to find matches needs an account. Log in or create a free account to use it.",
            );
            return false;
        }

        const isValid = validateFile(file);
        if (!isValid.valid) {
            setError(isValid.error || "Invalid file.");
            return false;
        }

        setFile(file);

        // Extract cover art from uploaded file
        try {
            const coverArt = await extractCoverArt(file, { debug: false });
            setUploadedCoverArt(coverArt);
        } catch (error) {
            console.warn('Failed to extract cover art:', error);
            setUploadedCoverArt(null);
        }

        // Save uploaded file URL globally for playback previews
        try {
            // Revoke previous URL to free the old File blob from memory
            const prevUrl = usePlayerStore.getState().uploadedUrl;
            if (prevUrl) URL.revokeObjectURL(prevUrl);
            const objectUrl = URL.createObjectURL(file);
            const { setUploadedUrl } = usePlayerStore.getState();
            setUploadedUrl(objectUrl);
        } catch {/* no-op */ }

        setProgress(0);
        setError(null);
        setGateReason(null);
        setResponse(null);
        setUploading(true);
        setOverlay(true);
        // Mark this as a file upload (not search selection)
        setIsFileUpload(true);

        try {
            const uploadStart = Date.now();
            const result = await getSimilarTracks(file, topSk, (p) => {
                // Ensure progress is properly bounded and rounded
                const boundedProgress = Math.min(100, Math.max(0, p));
                setProgress(Math.round(boundedProgress));
            });
            if (result && result.success) {
                // Segmentation polling removed - no longer waiting for segments to be generated
                // const playlistId = (result as any).data?.playlist?.id as string | undefined;
                // let segmentationOk = true;
                // if (playlistId) {
                //     segmentationOk = await waitForSegmentation(playlistId, 300_000, 4_000);
                // }
                // if (!segmentationOk) {
                //     throw new Error("Timed out while waiting for playlist segments to be generated.");
                // }

                setResponse(result as UploadResult);
                // A search/upload spends an allowance. Tell the usage chip so it corrects itself now,
                // instead of showing a stale count until the next page load.
                emitUsageChanged();
                setPlaylistResponse(result as any);
                // Keep overlay visible; UploadPage effect will hide after navigation
                setUploading(false);
                setProgress(100);

                // Fire analysis callback if provided (upload flow: 60% of actual time, no cap)
                if (onAnalysis) {
                    const playlistId: string = (result as any).data?.playlist?.id ?? '';
                    const similarTracks: Array<{ score: number }> = (result as any).data?.similar_tracks ?? [];
                    const elapsedSeconds = (Date.now() - uploadStart) / 1000;
                    const analysisSeconds = parseFloat((elapsedSeconds * 0.6).toFixed(1));
                    const topMatchScore = similarTracks.length > 0
                        ? Math.max(...similarTracks.map((t) => t.score))
                        : 0;
                    if (playlistId) {
                        onAnalysis(playlistId, {
                            resultCount: similarTracks.length,
                            topMatchScore,
                            analysisSeconds,
                        });
                    }
                }
                return true;
            } else {
                // API indicated failure. A soft entitlement gate drives a login/subscribe CTA.
                // A quota denial (402) is already handled globally by QuotaDenialModal, with copy
                // built from the server's `code`. Setting gateReason here too would stack a second,
                // vaguer modal on top of it — which is what users saw.
                const reason = (result as { reason?: string } | null)?.reason;
                const denialCode = (result as { code?: string | null } | null)?.code;
                if (denialCode) {
                    /* handled globally */
                } else if (reason === "login_required" || reason === "upgrade_required") {
                    setGateReason(reason);
                } else {
                    setError(mapPlaylistErrorMessage(result?.error, "Upload failed."));
                }
                setUploading(false);
                setOverlay(false);
                return false;
            }
        } catch (err: any) {
            // Reset file upload flag on error
            setIsFileUpload(false);
            // Same as above: a 402 already opened the global modal.
            if (err?.code) {
                /* handled globally */
            } else if (err?.reason === "login_required" || err?.reason === "upgrade_required") {
                setGateReason(err.reason);
            } else {
                setError(mapPlaylistErrorMessage(err?.error || err?.message, "Upload failed."));
            }
            setUploading(false);
            setOverlay(false);
            return false;
        }
    }, [setError, setGateReason, setGate, setFile, setOverlay, setProgress, setResponse, setUploading, validateFile, setPlaylistResponse, setIsFileUpload, topSk, setUploadedCoverArt, onAnalysis]);

    const onInputChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>((e) => {
        const file = e.target.files && e.target.files[0];
        void handleUpload(file || null);
        // Reset the value so selecting the same file again retriggers onChange
        if (inputRef.current) inputRef.current.value = "";
    }, [handleUpload]);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer?.files?.[0];
        void handleUpload(file || null);
    }, [handleUpload]);

    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
    }, []);

    const hideOverlay = useCallback(() => setOverlay(false), [setOverlay]);

    return {
        inputRef,
        inputAccept,
        openFilePicker,
        onInputChange,
        onDrop,
        onDragOver,
        handleUpload,
        hideOverlay,
        reset,
    };
}
