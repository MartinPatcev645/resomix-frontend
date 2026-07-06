import { useCallback, useState } from 'react';
import { usePlaylistStore } from '@resomix/stores';
import { DEMO_MODE } from '@resomix/config';
import { FEATURE_KEYS } from '@resomix/api-client';
import { useEntitlements } from '../Entitlements/useEntitlements';

/**
 * Hook for exporting playlist data to a TXT file.
 * Entitlement-aware: `canExport` respects the plan's `can_export`, and the exported track count is
 * capped by `export_track_limit` (free = first N, paid = full). The server remains the guard.
 */
export function usePlaylistExport() {
  const { playlistData } = usePlaylistStore();
  const [isExporting, setIsExporting] = useState(false);
  const { can, getInt } = useEntitlements();
  const canExportEntitlement = can(FEATURE_KEYS.CAN_EXPORT);
  const exportTrackLimit = getInt(FEATURE_KEYS.EXPORT_TRACK_LIMIT, 0); // 0 = full/unlimited

  const formatPlaylistForExport = useCallback((data: typeof playlistData): string => {
    if (!data) return '';

    const { playlist, queried_track, similar_tracks } = data;

    // Format playlist name in uppercase
    const playlistName = playlist?.name ? playlist.name.toUpperCase() : '';

    // Format input track
    const inputTrackLabel = queried_track.label ? ` [${queried_track.label}]` : '';
    const inputTrack = `INPUT TRACK: ${queried_track.artist} - ${queried_track.title}${inputTrackLabel}`;

    // Cap the exported tracks by the plan's export_track_limit (and the demo cap, if active).
    const entLimit = exportTrackLimit > 0 ? exportTrackLimit : Infinity;
    const demoLimit = DEMO_MODE ? 10 : Infinity;
    const effLimit = Math.min(entLimit, demoLimit);
    const tracksToExport = Number.isFinite(effLimit) ? similar_tracks.slice(0, effLimit) : similar_tracks;

    const similarTracksFormatted = tracksToExport
      .map(track => {
         const trackLabel = track.label ? ` [${track.label}]` : '';
         return `${track.rank}. ${track.artist} - ${track.title}${trackLabel}`;
      })
      .join('\n');

    // Combine all parts
    const footer = tracksToExport.length < similar_tracks.length
      ? `\n\nShowing the first ${tracksToExport.length} tracks. Upgrade your plan to export the full list.\nSonic matches provided by Resomix https://resomix.com`
      : `\n\nSonic matches provided by Resomix https://resomix.com`;

    return `${playlistName}\n\n${inputTrack}\n\n${similarTracksFormatted}${footer}`;
  }, [exportTrackLimit]);

  const generateFilename = useCallback((data: typeof playlistData): string => {
    if (!data) return '';

    const playlistName = data.playlist?.name || 'playlist';
    const sanitizedPlaylistName = playlistName
      .replace(/[^a-zA-Z0-9\s-_]/g, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .toLowerCase();
    
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    return `${sanitizedPlaylistName}_${timestamp}.txt`;
  }, []);

  const exportPlaylist = useCallback(async () => {
    if (!playlistData) {
      throw new Error('No playlist data available to export');
    }

    setIsExporting(true);

    try {
      // Add a small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Format the playlist content
      const content = formatPlaylistForExport(playlistData);
      
      // Generate filename
      const filename = generateFilename(playlistData);
      
      return { 
        success: true, 
        filename,
        content
      };
    } catch (error) {
      console.error('Export failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    } finally {
      setIsExporting(false);
    }
  }, [playlistData, formatPlaylistForExport, generateFilename]);

  const downloadFile = useCallback((content: string, filename: string) => {
    try {
      // Create blob with UTF-8 encoding
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      
      // Create object URL
      const url = URL.createObjectURL(blob);
      
      // Create temporary anchor element for download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      
      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up object URL
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download file:', error);
      throw new Error('Failed to download playlist file');
    }
  }, []);

  const exportAndDownloadPlaylist = useCallback(async () => {
    if (!playlistData) {
      throw new Error('No playlist data available to export');
    }

    setIsExporting(true);

    try {
      // Add a small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Format the playlist content
      const content = formatPlaylistForExport(playlistData);
      
      // Generate filename
      const filename = generateFilename(playlistData);
      
      // Download the file immediately
      downloadFile(content, filename);
      
      return { 
        success: true, 
        filename,
        content
      };
    } catch (error) {
      console.error('Export and download failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    } finally {
      setIsExporting(false);
    }
  }, [playlistData, formatPlaylistForExport, generateFilename, downloadFile]);

  return {
    exportPlaylist,
    exportAndDownloadPlaylist,
    downloadFile,
    canExport: !!playlistData && canExportEntitlement,
    isExporting,
    playlistName: playlistData?.playlist?.name || null
  };
}
