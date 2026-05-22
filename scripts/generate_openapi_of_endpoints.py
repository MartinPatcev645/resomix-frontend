import json
import os
import sys

# Add current dir to path to import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from fastapi.openapi.utils import get_openapi

openapi_schema = get_openapi(
    title="Resomix B2B Partner API",
    version="1.0.0",
    description="API documentation for Resomix B2B Partner Integration",
    routes=app.routes,
)

allowed_paths = [
    "/api/v1/similarity/search",
    "/api/v1/similarity/upload",
    "/api/v1/metadata/track",
    "/api/v1/partner/me",
    "/api/v1/health"
]

# Filter paths
filtered_paths = {}
for path, path_item in openapi_schema.get("paths", {}).items():
    if path in allowed_paths:
        filtered_paths[path] = path_item

openapi_schema["paths"] = filtered_paths

# Add security schemes manually
if "components" not in openapi_schema:
    openapi_schema["components"] = {}

if "securitySchemes" not in openapi_schema["components"]:
    openapi_schema["components"]["securitySchemes"] = {}

openapi_schema["components"]["securitySchemes"]["BearerAuth"] = {
    "type": "http",
    "scheme": "bearer",
    "description": "B2B Bearer API keys (rmx_<tier>_...)"
}

# Apply security to all filtered paths except health
for path, path_item in openapi_schema["paths"].items():
    if path != "/api/v1/health":
        for method in path_item:
            path_item[method]["security"] = [{"BearerAuth": []}]

os.makedirs("api_docs", exist_ok=True)

with open("api_docs/openapi.json", "w") as f:
    json.dump(openapi_schema, f, indent=2)

print("Generated api_docs/openapi.json successfully.")
