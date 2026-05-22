import json
import os
import sys

# Add current dir to path to import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from fastapi.openapi.utils import get_openapi

# Read README for description
readme_path = os.path.join("api_docs", "README.md")
description = "API documentation for Resomix B2B Partner Integration"
if os.path.exists(readme_path):
    with open(readme_path, "r") as f:
        description = f.read()

openapi_schema = get_openapi(
    title="Resomix B2B Partner API",
    version="1.0.0",
    description=description,
    routes=app.routes,
)

# Add servers array so "Try It Out" works out of the box
openapi_schema["servers"] = [
    {"url": "http://localhost:8001", "description": "Local Development Server"},
]

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

# Define Tags for better organization
openapi_schema["tags"] = [
    {
        "name": "similarity",
        "description": "Core engine endpoints to calculate audio similarities using track IDs or real-time audio uploads."
    },
    {
        "name": "metadata",
        "description": "Endpoints to extract and validate standard audio properties."
    },
    {
        "name": "B2B Partner",
        "description": "Partner-specific endpoints to monitor quotas and account health."
    },
    {
        "name": "health",
        "description": "System availability checks."
    }
]

# Filter unused schemas
def extract_refs(data, refs_set):
    if isinstance(data, dict):
        for k, v in data.items():
            if k == "$ref" and isinstance(v, str) and v.startswith("#/components/schemas/"):
                refs_set.add(v.split("/")[-1])
            else:
                extract_refs(v, refs_set)
    elif isinstance(data, list):
        for item in data:
            extract_refs(item, refs_set)

used_schemas = set()
extract_refs(openapi_schema["paths"], used_schemas)

schemas = openapi_schema.get("components", {}).get("schemas", {})
checked_schemas = set()

while True:
    new_schemas = used_schemas - checked_schemas
    if not new_schemas:
        break
    
    for schema_name in new_schemas:
        if schema_name in schemas:
            extract_refs(schemas[schema_name], used_schemas)
        checked_schemas.add(schema_name)

filtered_schemas = {k: v for k, v in schemas.items() if k in used_schemas}
if "components" in openapi_schema:
    openapi_schema["components"]["schemas"] = filtered_schemas


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

# Generate Self-Contained Scalar HTML
html_content = f"""<!DOCTYPE html>
<html>
  <head>
    <title>Resomix B2B Partner API</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {{
        margin: 0;
        padding: 0;
      }}
    </style>
  </head>
  <body>
    <!-- Inline the OpenAPI spec to avoid CORS and local file loading issues -->
    <script 
      id="api-reference" 
      type="application/json"
      data-theme="moon">{json.dumps(openapi_schema, indent=2)}</script>
    <!-- Include Scalar CDN -->
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>
"""

with open("api_docs/index.html", "w") as f:
    f.write(html_content)

# Clean up old openapi.json if it exists
if os.path.exists("api_docs/openapi.json"):
    os.remove("api_docs/openapi.json")

print("Generated complete api_docs/index.html successfully.")
