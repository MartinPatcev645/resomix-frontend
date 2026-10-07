# Resomix B2B Partner API Endpoints & Access Rationale

This document serves as the master specification for partner integrations, detailing which API endpoints and supply-chain pipelines are exposed to **B2B Partners**, along with the architectural, security, and billing reasons for their access. It also defines the restricted categories of the API that are barred from partner integration.

---

## 1. Exposed B2B Partner Endpoints

These are the only endpoints B2B partners are authorized to call using their scoped B2B Bearer API keys (`rmx_<tier>_...`):

| HTTP Method | API Path | Endpoint Name & Function | Technical Reasoning (Why Partners Need Access) |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/similarity/search` | **Catalog Similarity Search** <br> Queries the FAISS sandbox index by track ID. | **Primary B2B Value Proposition**: Allows the partner's server to query music similarity recommendations using an existing track ID in their catalog. The similarity engine returns matching neighboring tracks strictly from *their own sandboxed FAISS index*. |
| `POST` | `/api/v1/similarity/upload` | **Realtime Similarity by Upload** <br> Accepts raw audio uploads to extract features and search FAISS in real time. | **Dynamic Music Discovery**: Allows partners to check similarity matches for tracks that are not yet ingested in their catalog (e.g. fresh creations or external tracks). The system processes the audio wave on the fly and returns matches. |
| `POST` | `/api/v1/metadata/track` | **Audio Metadata Extraction** <br> Parses uploaded track files to extract audio properties. | **Ingestion Preparation**: Allows partners to validate and normalize metadata parameters (duration, format, channels, and ID3 tags) of their audio files before uploading them via SFTP or ingesting them into their primary systems. |
| `GET` | `/api/v1/partner/me` | **Partner Account & Quota Status** <br> Retrieves partner-specific account limits and analytics. | **Billing & System Transparency**: Allows partners to programmatically monitor their system usage (current calls made, quota limits, starter/growth tier caps, and active/suspension status) to prevent automated request failures or unexpected lockouts. |
| `GET` | `/api/v1/health` | **Public Health Check** <br> Returns API node status and uptime metrics. | **Service Level Agreement (SLA)**: Exposes a lightweight, unauthenticated health status checking route so partners can build automated ping monitors to ensure the Resomix service is online before making high-frequency API calls. |
| **SFTP** | `HNgx / SFTPGo Port` <br> *(Hosted strictly on **Hetzner**)* | **Secure File Ingestion** <br> Direct SFTP uploads to partner chroot directories. | **Supply-Chain Data Transfer (resomix-similarity-open)**: To prevent HTTP body timeouts and optimize network load, partners ingest large catalogs via SFTP. Partners connect to the isolated SFTP server hosted strictly on the **Hetzner server** using the **credentials delivered to their registered email address**. From there, they can upload their audio files and manifest CSVs. |
