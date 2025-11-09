import { useState } from 'react';
import { forkPlaylist } from '@resomix/api-client';
import { mapPlaylistErrorMessage } from './errorMessages';

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

  const getErrorMessage = (rawError: string): string => {
    const overrides: Record<string, string> = {
      'you already own this playlist. no need to fork it.': 'You already own this playlist',
      'cannot fork private playlists. only public playlists can be forked.': 'This playlist is private and cannot be forked',
      'playlist not found': 'Playlist not found',
      'authentication required': 'Please log in to fork playlists',
      'playlist_id cannot be empty': 'Invalid playlist ID',
    };

    const normalizedKey = rawError.replace(/\s+/g, ' ').trim().toLowerCase();

    if (overrides[normalizedKey]) {
      return overrides[normalizedKey];
    }

    return mapPlaylistErrorMessage(rawError, 'Failed to fork playlist');
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
