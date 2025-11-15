import { useCallback, useMemo, useRef } from "react";
import { getSimilarTracks, API_CONFIG, waitForSegmentation } from "@resomix/api-client";
import { usePlaylistStore, usePlayerStore } from "@resomix/stores";
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

interface UploadStoreState {
    isUploading: boolean;
    progress: number;
    error: string | null;
    file: File | null;
    showOverlay: boolean;
    response: UploadResult | null;
    isFileUpload: boolean;
    setUploading: (isUploading: boolean) => void;
    setProgress: (progress: number) => void;
    setError: (error: string | null) => void;
    setFile: (file: File | null) => void;
    setOverlay: (visible: boolean) => void;
    setResponse: (response: UploadResult | null) => void;
    setIsFileUpload: (isFileUpload: boolean) => void;
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
    setUploading: (isUploading) => set({ isUploading }),
    setProgress: (progress) => set({ progress }),
    setError: (error) => set({ error }),
    setFile: (file) => set({ file }),
    setOverlay: (visible) => set({ showOverlay: visible }),
    setResponse: (response) => set({ response }),
    setIsFileUpload: (isFileUpload) => set({ isFileUpload }),
    reset: () => set({ isUploading: false, progress: 0, error: null, file: null, showOverlay: false, response: null, isFileUpload: false })
}));

/**
 * Hook for handling audio uploads on web, Android and iOS mobile browsers.
 * - Provides a hidden input ref and an opener to trigger native pickers
 * - Validates against API_CONFIG.ALLOWED_AUDIO_TYPES and MAX_FILE_SIZE
 * - Uploads with progress via getSimilarTracks
 */
export function useUpload() {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const { setUploading, setProgress, setError, setFile, setOverlay, setResponse, setIsFileUpload, reset } = useUploadStore();
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

    const handleUpload = useCallback(async (file: File | null | undefined) => {
        if (!file) return;
        const isValid = validateFile(file);
        if (!isValid.valid) {
            setError(isValid.error || "Invalid file.");
            return;
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
            const objectUrl = URL.createObjectURL(file);
            const { setUploadedUrl } = usePlayerStore.getState();
            setUploadedUrl(objectUrl);
        } catch {/* no-op */}
        
        setProgress(0);
        setError(null);
        setResponse(null);
        setUploading(true);
        setOverlay(true);
        // Mark this as a file upload (not search selection)
        setIsFileUpload(true);

        try {
            const result = await getSimilarTracks(file, topSk, (p) => {
                // Ensure progress is properly bounded and rounded
                const boundedProgress = Math.min(100, Math.max(0, p));
                setProgress(Math.round(boundedProgress));
            });
            if (result && result.success) {
                // Wait for segments to be generated before proceeding
                const playlistId = (result as any).data?.playlist?.id as string | undefined;
                let segmentationOk = true;
                if (playlistId) {
                    segmentationOk = await waitForSegmentation(playlistId, 300_000, 4_000);
                }

                if (!segmentationOk) {
                    throw new Error("Timed out while waiting for playlist segments to be generated.");
                }

                setResponse(result as UploadResult);
                setPlaylistResponse(result as any);
                // Keep overlay visible; UploadPage effect will hide after navigation
                setUploading(false);
                setProgress(100);
            } else {
                // API indicated failure
                setError(mapPlaylistErrorMessage(result?.error, "Upload failed."));
                setUploading(false);
                setOverlay(false);
            }
        } catch (err: any) {
            // Reset file upload flag on error
            setIsFileUpload(false);
            const mappedError = mapPlaylistErrorMessage(err?.error || err?.message, "Upload failed.");
            setError(mappedError);
            setUploading(false);
            setOverlay(false);
        }
    }, [setError, setFile, setOverlay, setProgress, setResponse, setUploading, validateFile, setPlaylistResponse, setIsFileUpload, topSk, setUploadedCoverArt]);

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
