import sys
import os

# Add project root to sys.path
sys.path.append(os.getcwd())

try:
    print("Testing imports for Phase 1 files...")
    
    print("Importing app.models.user...")
    from app.models.user import User, Role, Permission, UserRole, RolePermission, UserToken, UserSession, UserAuthProvider
    
    print("Importing app.models.operation_limit...")
    from app.models.operation_limit import OperationType, UserOperationLimit
    
    print("Importing app.models.spotify_app...")
    from app.models.spotify_app import SpotifyApp, UserSpotifyApp
    
    print("Importing app.models.sftp_user...")
    from app.models.sftp_user import SftpUser
    
    print("Importing app.models.label...")
    from app.models.label import Label
    
    print("Importing app.models (Base and all models)...")
    from app.models import Base, User, SftpUser, SpotifyApp, UserOperationLimit
    
    print("Importing app.repositories.user_repository...")
    from app.repositories.user_repository import UserRepository, UserTokenRepository, UserSessionRepository
    
    print("\nAll imports successful!")
    
except Exception as e:
    print(f"\nImport failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
