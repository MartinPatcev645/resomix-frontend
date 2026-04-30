
import asyncio
import sys
import os

# Add the project root to sys.path
sys.path.append(os.getcwd())

async def check_imports():
    print("Checking imports...")
    try:
        from app.repositories.user_repository import UserRepository, UserTokenRepository
        from app.repositories.track_repository import TrackRepository
        from app.repositories.artist_repository import ArtistRepository
        from app.repositories.label_repository import LabelRepository
        from app.repositories.playlist_repository import PlaylistRepository
        from app.services.auth_service import AuthService
        from app.services.cart_service import CartService
        from app.services.telemetry_service import TelemetryService
        from app.services.search_service import SearchService
        from app.controllers.cart_controller import CartController
        
        print("✅ All core repositories, services, and controllers imported successfully.")
        
        # Instantiate some to check __init__
        repo = UserRepository()
        token_repo = UserTokenRepository()
        auth_service = AuthService()
        print("✅ Core instances created successfully.")
        
    except Exception as e:
        print(f"❌ Import or instantiation failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(check_imports())
