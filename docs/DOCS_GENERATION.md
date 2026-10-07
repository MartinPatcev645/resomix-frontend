# Resomix API Documentation Generator

This guide explains how the B2B Partner API documentation is generated, updated, and configured. The documentation is entirely static and powered by Scalar, using a custom Python script that natively filters the FastAPI schema.

## Core Files

1. **`scripts/generate_openapi_of_endpoints.py`**: The main generator script. It extracts the raw OpenAPI schema from the running FastAPI app, strips out internal models/endpoints, and outputs a self-contained `index.html`.
2. **`api_docs/README.md`**: The markdown file containing the introductory text. The generator script reads this file and injects it into the top of the Scalar UI.
3. **`api_docs/index.html`**: The final output file. This file contains the complete UI and the inlined JSON schema.

## How to Regenerate Documentation

Whenever you modify an endpoint, update the `api_docs/README.md` file, or want to publish new changes, simply run the generator script from the root of the project:

```bash
# Make sure your virtual environment is activated
source .venv/bin/activate

# Run the generator
python scripts/generate_openapi_of_endpoints.py
```

This will instantly overwrite `api_docs/index.html` with the latest changes. You can then distribute this HTML file or host it statically (e.g. GitHub Pages, S3, or NGINX).

## How to Configure the Generator

You can modify `scripts/generate_openapi_of_endpoints.py` to change how the documentation behaves.

### 1. Changing the "Try It Out" Server URLs
To make the "Try It Out" buttons work in different environments (like Staging or Production), look for the `openapi_schema["servers"]` block in the script (around line 25):

```python
openapi_schema["servers"] = [
    {"url": "http://localhost:8001", "description": "Local Development Server"},
    {"url": "https://api.resomix.com", "description": "Production Server"}
]
```
Add, remove, or modify the URLs in this array. The first URL in the list will be the default selected server in the Scalar UI.

### 2. Adding or Removing Endpoints
To expose a new endpoint to B2B Partners, or remove an existing one, update the `allowed_paths` array (around line 30):

```python
allowed_paths = [
    "/api/v1/similarity/search",
    "/api/v1/similarity/upload",
    "/api/v1/metadata/track",
    "/api/v1/partner/me",
    "/api/v1/health",
    "/api/v1/new-partner-endpoint" # <-- Simply add your new route here
]
```
The script will automatically detect the new route, fetch its models, and include it in the generated HTML.

### 3. Updating Tag Categories (The Sidebar)
If your new endpoint belongs to a new tag category, or you want to change the description shown in the sidebar, update the `openapi_schema["tags"]` array (around line 50):

```python
openapi_schema["tags"] = [
    {
        "name": "B2B Partner", # <-- Must EXACTLY match the tags=["..."] parameter in FastAPI router
        "description": "Partner-specific endpoints to monitor quotas and account health."
    }
]
```
*Note: The `name` attribute must perfectly match the tag name defined in your `APIRouter(tags=["..."])` or the endpoint won't group correctly.*
