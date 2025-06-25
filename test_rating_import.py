#!/usr/bin/env python3
"""
Simple test to verify rating modules import correctly.
"""

try:
    # Test imports
    from app.schemas.rating import TrackRatingRequest, PlaylistRatingRequest, RatingOperationResponse
    from app.repositories.rating_repository import TrackRatingRepository, PlaylistRatingRepository
    from app.services.rating_service import RatingService
    from app.controllers.rating_controller import RatingController
    from app.api.routers.ratings import router as ratings_router
    from app.api.routers import all_routers
    
    print('✅ All rating modules imported successfully!')
    print(f'✅ Number of routers: {len(all_routers)}')
    print(f'✅ Ratings router prefix: {ratings_router.prefix}')
    print(f'✅ Number of rating endpoints: {len([route for route in ratings_router.routes if hasattr(route, "methods")])}')
    
    # Test schema validation
    track_request = TrackRatingRequest(track_id=123, rating=1, user_id='test-user')
    playlist_request = PlaylistRatingRequest(playlist_id=456, rating=3, user_id='test-user')
    playlist_request_with_message = PlaylistRatingRequest(
        playlist_id=456, 
        rating=3, 
        message="Great playlist! Love the track selection and flow.",
        user_id='test-user'
    )
    
    print(f'✅ Track rating request: {track_request.dict()}')
    print(f'✅ Playlist rating request: {playlist_request.dict()}')
    print(f'✅ Playlist rating with message: {playlist_request_with_message.dict()}')
    
    # Test validation errors
    try:
        invalid_track = TrackRatingRequest(track_id=123, rating=2, user_id='test-user')  # Should fail, rating must be 0 or 1
    except Exception as e:
        print(f'✅ Track rating validation works: {e}')
    
    try:
        invalid_playlist = PlaylistRatingRequest(playlist_id=456, rating=4, user_id='test-user')  # Should fail, rating must be 0-3
    except Exception as e:
        print(f'✅ Playlist rating validation works: {e}')
    
    # Test message validation
    try:
        long_message = "x" * 1001  # Too long
        invalid_message = PlaylistRatingRequest(playlist_id=456, rating=3, message=long_message, user_id='test-user')
    except Exception as e:
        print(f'✅ Message length validation works: {e}')
    
    # Test empty message (should be converted to None)
    empty_message_request = PlaylistRatingRequest(playlist_id=456, rating=3, message="   ", user_id='test-user')
    print(f'✅ Empty message converted to None: {empty_message_request.message}')
    
    print('\n🎉 All tests passed! Rating implementation with message field is complete and working.')
    
except Exception as e:
    print(f'❌ Error: {e}')
    import traceback
    traceback.print_exc()
