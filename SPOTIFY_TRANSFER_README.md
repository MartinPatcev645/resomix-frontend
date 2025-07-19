# Spotify Playlist Transfer Feature

## Overview

The Spotify Transfer feature allows users to transfer their ResomiX playlists to their personal Spotify accounts. This feature integrates with the Spotify Web API to search for tracks and create playlists in the user's Spotify library.

## Features

- **OAuth Authentication**: Secure user authentication through Spotify OAuth 2.0
- **Intelligent Track Matching**: Advanced track search algorithm with fallback strategies
- **Batch Processing**: Efficient handling of large playlists with Spotify's API limits
- **Comprehensive Reporting**: Detailed transfer statistics including success/failure counts
- **Custom Playlist Names**: Option to specify custom names for transferred playlists

## API Endpoint

### POST `/playlists/transfer-to-spotify/`

Transfer a ResomiX playlist to user's Spotify account.

#### Request Body

```json
{
  "playlist_id": "550e8400-e29b-41d4-a716-446655440000",
  "access_token": "BQC4YqJ...",
  "playlist_name": "My ResomiX Playlist"
}
```

#### Parameters

- **playlist_id** (required): UUID of the ResomiX playlist to transfer
- **access_token** (required): Valid Spotify OAuth access token
- **playlist_name** (optional): Custom name for the Spotify playlist

#### Response

**Success (200):**
```json
{
  "success": true,
  "data": {
    "spotify_playlist_id": "37i9dQZF1DX0XUsuxWHRQd",
    "spotify_playlist_url": "https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd",
    "spotify_playlist_name": "My ResomiX Playlist",
    "total_tracks": 25,
    "tracks_added": 22,
    "tracks_not_found": 3,
    "not_found_tracks": [
      "Artist Name - Track Title",
      "Another Artist - Another Track"
    ]
  },
  "message": "Successfully transferred playlist to Spotify. 22 tracks added, 3 tracks not found."
}
```

**Error (401):**
```json
{
  "success": false,
  "error": "Invalid or expired Spotify access token",
  "details": {
    "spotify_error": "The access token expired"
  }
}
```

## Configuration

### Environment Variables

Add the following environment variables to your `.env` file:

```env
# Spotify Configuration
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
```

### Spotify App Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new application
3. Note down the Client ID and Client Secret
4. Set the redirect URI in your app settings (for frontend OAuth flow)

## Frontend Integration

### OAuth Flow

The frontend should handle the Spotify OAuth flow and provide the access token to the API:

1. **Authorization Request**: Redirect user to Spotify authorization URL
2. **User Consent**: User grants permissions to your application
3. **Authorization Code**: Spotify redirects back with authorization code
4. **Token Exchange**: Exchange code for access token
5. **API Call**: Use access token to call the transfer endpoint

### Required Scopes

Your frontend OAuth flow should request the following scopes:

- `playlist-modify-public`: Create public playlists
- `playlist-modify-private`: Create private playlists (optional)

### Example Frontend Code

```javascript
// Example using Spotify Web API SDK
const scopes = ['playlist-modify-public'];
const authUrl = `https://accounts.spotify.com/authorize?` +
  `client_id=${clientId}&` +
  `response_type=code&` +
  `redirect_uri=${encodeURIComponent(redirectUri)}&` +
  `scope=${encodeURIComponent(scopes.join(' '))}`;

// After getting the access token, call the API
const response = await fetch('/playlists/transfer-to-spotify/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    playlist_id: playlistId,
    access_token: spotifyAccessToken,
    playlist_name: customPlaylistName
  })
});
```

## Track Matching Algorithm

The service uses an intelligent track matching algorithm:

1. **Primary Search**: Searches using cleaned track title and artist name
2. **Fallback Search**: If no results, searches using title only
3. **Scoring System**: Ranks matches based on title and artist similarity
4. **Best Match Selection**: Selects the highest scoring match

### Track Cleaning

The algorithm cleans track metadata before searching:

- Removes common strings like "(Original Mix)"
- Handles stopper strings that indicate URLs or unwanted content
- Normalizes special characters and spacing
- Limits search query length to 100 characters

## Error Handling

The API handles various error scenarios:

- **404**: Playlist not found
- **401**: Invalid or expired Spotify access token
- **422**: Invalid request data or playlist has no tracks
- **500**: Internal server errors

## Rate Limiting

The service respects Spotify's API rate limits:

- Tracks are added to playlists in batches of 100
- Searches are performed with appropriate delays
- Failed requests are logged for debugging

## Security Considerations

- Access tokens are never stored by the API
- All Spotify API calls are made server-side
- User authentication is handled through existing API key system
- Spotify credentials are stored securely in environment variables

## Dependencies

The feature requires the following Python package:

```
spotipy==2.24.0
```

This is already included in the updated `requirements.txt` file.

## Testing

To test the feature:

1. Set up a Spotify Developer account and app
2. Configure environment variables
3. Use a tool like Postman or curl to test the endpoint
4. Verify playlists are created correctly in Spotify

## Troubleshooting

### Common Issues

1. **Invalid Access Token**: Ensure the frontend OAuth flow is working correctly
2. **Track Not Found**: Some tracks may not be available on Spotify
3. **Rate Limiting**: Large playlists may take time to process
4. **Permission Errors**: Ensure correct scopes are requested in OAuth flow

### Logs

The service logs detailed information about:
- Track search results
- Failed track matches
- Spotify API errors
- Transfer statistics

Check the application logs for detailed error information.

## Future Enhancements

Potential improvements for future versions:

- **Batch Transfer**: Transfer multiple playlists at once
- **Sync Feature**: Keep ResomiX and Spotify playlists synchronized
- **Advanced Matching**: Use audio features for better track matching
- **User Preferences**: Allow users to configure matching preferences
- **Transfer History**: Track previous transfers and prevent duplicates 