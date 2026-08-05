import { useCallback, useState } from 'react';
import { usePlaylistStore } from '@resomix/stores';
import { DEMO_MODE } from '@resomix/config';
import { FEATURE_KEYS, exportPlaylistFile } from '@resomix/api-client';
import { useEntitlements } from '../Entitlements/useEntitlements';

/**
 * Export a playlist to a TXT file.
 *
 * The file is built by the SERVER (`POST /playlists/{uuid}/export`), not here. It used to be
 * assembled in this hook and handed to a Blob, which meant two of the plan's rules could not be
 * enforced at all: `exports_per_day` had no request to count, and `export_track_limit` was applied
 * by code the user can edit. The formatting moved to where the limits live.
 *
 * `canExport` still reflects `can_export` locally so the button can be disabled without a
 * round-trip, but it is a hint — the server is the guard, and it answers a denial with a 402
 * carrying `code` (`login_required` | `plan_required` | `export_limit_reached`) and `quota`
 * (used / limit / resets_at) for the upgrade modal.
 */
/** Demo builds show 10 real tracks; the export matched that before it moved server-side. */
const DEMO_TRACK_CAP = 10;

export function usePlaylistExport() {
  const { playlistData } = usePlaylistStore();
  const [isExporting, setIsExporting] = useState(false);
  const { can } = useEntitlements();
  const canExportEntitlement = can(FEATURE_KEYS.CAN_EXPORT);

  const playlistId = playlistData?.playlist?.id ?? null;

  const requestExport = useCallback(async () => {
    if (!playlistId) {
      throw new Error('No playlist data available to export');
    }

    // The demo build caps exports below the plan limit. It is a frontend flag, so the server cannot
    // know about it — hence asking for a smaller file. The server takes the MINIMUM of this and the
    // plan's own cap, so this can only ever shrink the export, never widen it.
    return exportPlaylistFile(playlistId, 'txt', DEMO_MODE ? DEMO_TRACK_CAP : undefined);
  }, [playlistId]);

  const downloadFile = useCallback((content: string, filename: string) => {
    try {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download file:', error);
      throw new Error('Failed to download playlist file');
    }
  }, []);

  /**
   * Fetch the export without downloading it (the modal previews the filename, then downloads on
   * confirm). Shape is unchanged from the client-side version so callers did not have to move.
   */
  const exportPlaylist = useCallback(async () => {
    if (!playlistData) {
      throw new Error('No playlist data available to export');
    }

    setIsExporting(true);

    try {
      const response = await requestExport();

      if (!response.success) {
        return {
          success: false as const,
          error: response.error || 'Failed to export playlist',
          // Present only on a 402 — lets the caller open the right modal instead of showing prose.
          code: (response as { code?: string | null }).code ?? null,
          quota: (response as { quota?: unknown }).quota ?? null,
        };
      }

      const result = response.data;
      return {
        success: true as const,
        filename: result.filename,
        content: result.content,
        trackCount: result.track_count,
        totalTracks: result.total_tracks,
        truncated: result.truncated,
      };
    } catch (error) {
      console.error('Export failed:', error);
      return {
        success: false as const,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    } finally {
      setIsExporting(false);
    }
  }, [playlistData, requestExport]);

  const exportAndDownloadPlaylist = useCallback(async () => {
    const result = await exportPlaylist();
    if (result.success) {
      downloadFile(result.content, result.filename);
    }
    return result;
  }, [exportPlaylist, downloadFile]);

  return {
    exportPlaylist,
    exportAndDownloadPlaylist,
    downloadFile,
    canExport: !!playlistData && canExportEntitlement,
    isExporting,
    playlistName: playlistData?.playlist?.name || null
  };
}
