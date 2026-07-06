"""
Rate Limiting Middleware
========================

Rate limiting setup for authentication endpoints to prevent brute force attacks
and abuse using SlowAPI.

Version: 3.2.0
Author: Muhammad Usman Naeem
Date: October 23, 2025
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request, Response
from fastapi.responses import JSONResponse
import logging

from app.core.config import settings

# Initialize logger
logger = logging.getLogger(__name__)


# ============================================================================
# Rate Limiter Configuration
# ============================================================================

def get_identifier(request: Request) -> str:
    """
    Get identifier for rate limiting.
    Uses IP address by default, but can be extended to use user ID for authenticated requests.
    
    Args:
        request: FastAPI request object
        
    Returns:
        Identifier string for rate limiting
    """
    # Get IP address
    ip_address = get_remote_address(request)
    
    # You can extend this to use user ID for authenticated requests
    # For example, check if user is authenticated and use user.id instead
    # This would require parsing the JWT token from the Authorization header
    
    return ip_address


# Initialize limiter with configuration
limiter = Limiter(
    key_func=get_identifier,
    default_limits=[],  # No default limits, we'll set per-endpoint
    storage_uri="memory://",  # Use in-memory storage (use Redis in production)
    strategy="fixed-window",  # Fixed window strategy
    headers_enabled=True,  # Include rate limit headers in response
)


# ============================================================================
# Rate Limit Exception Handler
# ============================================================================

async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> Response:
    """
    Custom handler for rate limit exceeded errors.
    Returns consistent JSON error response.
    
    Args:
        request: FastAPI request object
        exc: RateLimitExceeded exception
        
    Returns:
        JSON response with rate limit error
    """
    logger.warning(
        f"Rate limit exceeded for {get_identifier(request)} on {request.url.path}"
    )
    
    return JSONResponse(
        status_code=429,
        content={
            "success": False,
            "error": "Rate limit exceeded. Please try again later.",
            "detail": str(exc.detail) if hasattr(exc, 'detail') else "Too many requests"
        },
        headers=exc.headers if hasattr(exc, 'headers') else {}
    )


# ============================================================================
# Rate Limit Decorators
# ============================================================================

def auth_rate_limit(endpoint_type: str = "default"):
    """
    Get rate limit decorator for authentication endpoints.
    
    Args:
        endpoint_type: Type of endpoint (login, register, password_reset, etc.)
        
    Returns:
        Rate limit string for the endpoint
    """
    if not settings.rate_limit_enabled:
        return "1000/minute"  # Effectively no limit
    
    limits = {
        "login": settings.login_rate_limit,
        "register": settings.register_rate_limit,
        "password_reset": settings.password_reset_rate_limit,
        "default": "10/minute"
    }

    return limits.get(endpoint_type, limits["default"])


# ============================================================================
# Usage Instructions
# ============================================================================

"""
To use rate limiting in your routes:

1. Import the limiter in your router file:
   from app.api.middlewares.rate_limit import limiter, auth_rate_limit

2. Add rate limit decorator to your endpoint:
   @router.post("/login")
   @limiter.limit(auth_rate_limit("login"))
   async def login(request: Request, ...):
       ...

3. Add exception handler to your FastAPI app (in main.py):
   from slowapi.errors import RateLimitExceeded
   from app.api.middlewares.rate_limit import rate_limit_exceeded_handler
   
   app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

4. Add limiter state to FastAPI app (in main.py):
   from app.api.middlewares.rate_limit import limiter
   
   app.state.limiter = limiter

Available rate limit types:
- auth_rate_limit("login") - For login endpoints (5/minute by default)
- auth_rate_limit("register") - For registration (3/hour by default)
- auth_rate_limit("password_reset") - For password reset (3/hour by default)

Production Notes:
- Change storage_uri to use Redis for distributed rate limiting:
  storage_uri="redis://localhost:6379"
- Consider using user ID instead of IP for authenticated endpoints
- Adjust limits based on your application's needs
- Monitor rate limit hits in production
"""

