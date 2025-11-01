import { useState } from 'react';
import { forkPlaylist } from '@resomix/api-client';

export interface ForkPlaylistResponse {
  success: boolean;
  data?: {
    queried_track?: any;
    similar_tracks?: any[];
    playlist: {
      id: string;
      name: string;
      is_public: boolean;
      fork_id?: string;
    };
  };
  error?: string;
}

interface UsePlaylistForkOptions {
  onError?: (title: string, message: string) => void;
  onSuccess?: (title: string, message: string, response: ForkPlaylistResponse) => void;
}

export const usePlaylistFork = (options?: UsePlaylistForkOptions) => {
  const { onError, onSuccess } = options || {};
  const [forking, setForking] = useState(false);

  const getErrorMessage = (error: string): string => {
    const errorMap: Record<string, string> = {
      'You already own this playlist. No need to fork it.': 'You already own this playlist',
      'Cannot fork private playlists. Only public playlists can be forked.': 'This playlist is private and cannot be forked',
      'Playlist not found': 'Playlist not found',
      'Authentication required': 'Please log in to fork playlists',
      'playlist_id cannot be empty': 'Invalid playlist ID',
    };
    return errorMap[error] || error || 'Failed to fork playlist';
  };

  const fork = async (playlistId: string): Promise<ForkPlaylistResponse> => {
    if (!playlistId || !playlistId.trim()) {
      if (onError) {
        onError('Fork Failed', 'Invalid playlist ID');
      }
      return {
        success: false,
        error: 'Invalid playlist ID',
      };
    }

    setForking(true);
    try {
      const response = await forkPlaylist(playlistId.trim());
      
      if (response.success && response.data) {
        // Success - call success callback if provided
        if (onSuccess) {
          onSuccess(
            'Playlist Forked!',
            `Successfully forked "${response.data.playlist?.name || 'the playlist'}". You now have your own copy.`,
            response as ForkPlaylistResponse
          );
        }
        return response as ForkPlaylistResponse;
      } else {
        // Error from API
        const errorMessage = getErrorMessage(response.error || 'Failed to fork playlist');
        if (onError) {
          onError('Fork Failed', errorMessage);
        }
        return {
          success: false,
          error: response.error || 'Failed to fork playlist',
        };
      }
    } catch (error) {
      console.error('Fork playlist error:', error);
      if (onError) {
        onError('Network Error', 'Network error. Please try again.');
      }
      return {
        success: false,
        error: 'Network error occurred',
      };
    } finally {
      setForking(false);
    }
  };

  return {
    fork,
    forking,
  };
};
