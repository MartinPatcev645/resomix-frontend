# Resomix B2B Partner API

Welcome to the **Resomix B2B Partner API** documentation!

This API allows partners to seamlessly integrate audio similarity and metadata extraction capabilities directly into their supply-chain pipelines. 

## Authentication

All endpoints (except `/health`) require authentication using a **B2B Bearer API Key** (`rmx_<tier>_...`). Pass this key in the `Authorization` header of your HTTP requests:
```
Authorization: Bearer rmx_starter_1234567890
```

## Features

- **Catalog Similarity Search**: Query the sandboxed FAISS index by your internal track ID.
- **Realtime Similarity**: Upload audio files to check similarity on the fly.
- **Metadata Extraction**: Parse and validate audio properties before heavy ingestion.
