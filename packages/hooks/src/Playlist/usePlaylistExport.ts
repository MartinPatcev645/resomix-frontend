import { useCallback, useState } from 'react';
import { usePlaylistStore } from '@resomix/stores';

/**
 * Hook for exporting playlist data to a TXT file
 * Formats the playlist data according to the specified structure and triggers download
 */
export function usePlaylistExport() {
  const { playlistData } = usePlaylistStore();
  const [isExporting, setIsExporting] = useState(false);

  const formatPlaylistForExport = useCallback((data: typeof playlistData): string => {
    if (!data) return '';

    const { playlist, queried_track, similar_tracks } = data;
    
    // Format playlist name in uppercase
    const playlistName = playlist.name.toUpperCase();
    
    // Format input track
    const inputTrackLabel = queried_track.label ? ` [${queried_track.label}]` : '';
    const inputTrack = `INPUT TRACK: ${queried_track.artist} - ${queried_track.title}${inputTrackLabel}`;
    
    // Format similar tracks
    const similarTracksFormatted = similar_tracks
      .map(track => {
        const trackLabel = track.label ? ` [${track.label}]` : '';
        return `${track.rank}. ${track.artist} - ${track.title}${trackLabel}`;
      })
      .join('\n');
    
    // Combine all parts
    return `${playlistName}\n\n${inputTrack}\n\n${similarTracksFormatted}`;
  }, []);

  const generateFilename = useCallback((data: typeof playlistData): string => {
    if (!data) return '';

    const sanitizedPlaylistName = data.playlist.name
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

  return {
    exportPlaylist,
    downloadFile,
    canExport: !!playlistData,
    isExporting,
    playlistName: playlistData?.playlist.name || null
  };
}
