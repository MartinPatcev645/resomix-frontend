import sys
import os

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from app.schemas.partner import PartnerCreateRequest, ApiKeyIssueRequest
    from app.repositories.partner_repository import PartnerRepository, PartnerApiKeyRepository
    from app.services.partner_service import PartnerService
    from app.controllers.partner_controller import PartnerController
    from app.api.routers.admin.partners import router as admin_partners_router
    
    print("SUCCESS: All Partner W1-2 imports resolved successfully.")
except ImportError as e:
    print(f"ERROR: Import failed: {e}")
    sys.exit(1)
except Exception as e:
    print(f"ERROR: Unexpected error during import check: {e}")
    sys.exit(1)
