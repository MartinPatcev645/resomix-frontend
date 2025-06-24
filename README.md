# ResomiX Audio Similarity API

A comprehensive FastAPI-based application for audio similarity analysis, track management, and music discovery. This API provides advanced audio processing capabilities, metadata extraction, similarity matching, and playlist management with MariaDB database integration.

## 🎵 Overview

ResomiX is a production-ready audio similarity API that enables:
- **Audio Similarity Matching**: Upload audio files or query by path to find similar tracks
- **Metadata Processing**: Extract and filter audio metadata with advanced cleaning algorithms  
- **Track Management**: Complete track database with artists, albums, labels, and genres
- **Playlist System**: Create and manage playlists with similarity-based track suggestions
- **Search & Discovery**: Advanced search capabilities across the music catalog
- **Contact & Feedback**: User engagement system with Google Sheets integration

## 🏗️ Architecture

The application follows a **clean layered architecture** with clear separation of concerns:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   API Layer    │ ←→ │ Controller Layer │ ←→ │ Service Layer   │
│   (FastAPI)    │    │ (HTTP Handlers)  │    │ (Business Logic)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        ↕
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Schema Layer    │    │ Repository Layer │    │  Model Layer    │
│ (Pydantic)     │    │ (Data Access)    │    │ (SQLAlchemy)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## ✨ Core Features

### 🎧 Audio Similarity
- **Upload Similarity**: Analyze uploaded audio files against 2.2M+ track database
- **Path-based Similarity**: Query similarity for existing server-side tracks
- **Deduplication**: Advanced algorithms to remove duplicate results
- **Playlist Generation**: Automatic playlist creation from similarity results

### 🔍 Metadata & Search
- **Metadata Extraction**: Multi-format support using FFmpeg and Mutagen
- **Smart Filtering**: Remove URLs, domains, and unwanted strings from metadata
- **Advanced Search**: Search by title, artist, album, label, genre, BPM, key
- **Audio Validation**: Deep content analysis for security and format verification

### 📊 Data Management
- **Track Database**: 2.2M+ tracks with comprehensive metadata
- **Artist Management**: Artist catalog with collaboration support
- **Label & Genre**: Organized label and genre taxonomies
- **Preview System**: Secure preview URL generation with expiration

### 🎼 Playlist System
- **Custom Playlists**: User-created playlists with track management
- **Similarity Playlists**: Auto-generated playlists from similarity results
- **Public/Private**: Visibility control for playlist sharing
- **Track Scoring**: Similarity scores for playlist track ordering

## 🛠️ Technology Stack

- **Framework**: FastAPI 0.109.0 with async/await support
- **Database**: MariaDB with SQLAlchemy ORM and connection pooling
- **Audio Processing**: FFmpeg + Mutagen for metadata extraction and validation
- **External Services**: Similarity microservice integration via HTTP
- **Security**: API key authentication, URL signing, input validation
- **Integration**: Google Sheets API for feedback/contact management

## 🚀 Quick Start

### Prerequisites

1. **Python 3.8+** installed
2. **MariaDB** server running
3. **FFmpeg** installed and in PATH
4. **Similarity Server** (optional, for similarity features)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd basic_fastapi_server_resomix

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# or
.venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Configuration

Key environment variables in `.env`:

```env
# API Security
RESOMIX_API_KEY=your_secure_api_key_here

# Database
MONGODB_URI=mysql+aiomysql://user:password@localhost/resomix

# External Services  
SIMILARITY_SERVER_URL=http://localhost:8001
RESOMIX_SERVER_URL=http://localhost:8000

# Google Sheets (optional)
SERVICE_ACCOUNT_FILE=path/to/service-account.json
GOOGLE_SHEET_ID=your_sheet_id

# Security
PREVIEW_FERNET_SECRET=32-byte-secret-key
PREVIEW_HMAC_SECRET=hmac-secret-key
```

### Running

```bash
# Development
python run.py

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8005
```

Server runs at: `http://localhost:8005`

## 📖 API Documentation

### Interactive Docs
- **Swagger UI**: `http://localhost:8005/docs`
- **ReDoc**: `http://localhost:8005/redoc`

### Key Endpoints

#### Audio Similarity
```http
POST /api/similarity/upload/          # Upload audio for similarity
POST /api/similarity/path/{path}      # Get similarity by file path
```

#### Search & Browse
```http
GET  /api/search/                     # Advanced track search
GET  /api/metadata/extract/           # Extract audio metadata
```

#### Playlists
```http
GET  /api/playlists/similarity/{id}   # Get playlist with similarity data
POST /api/playlists/rename/           # Rename playlist
POST /api/playlists/visibility/       # Change playlist visibility
```

#### Preview & Content
```http
GET  /api/preview/audio/{uuid}        # Get secure preview URL
GET  /api/health/                     # Health check
```

#### Feedback & Contact
```http
POST /api/feedback/                   # Submit feedback
POST /api/feedback/contact/           # Contact form submission
```

### Authentication

All endpoints require API key authentication:

```bash
curl -X GET "http://localhost:8005/api/health/?api_key=YOUR_API_KEY"
```

### Response Format

```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

## 📁 Project Structure

```
app/
├── api/
│   ├── routers/           # API endpoints
│   │   ├── similarity.py  # Audio similarity endpoints
│   │   ├── playlists.py   # Playlist management
│   │   ├── search.py      # Search functionality
│   │   ├── metadata.py    # Metadata extraction
│   │   ├── preview.py     # Preview URL generation
│   │   ├── feedback.py    # Feedback system
│   │   ├── contact.py     # Contact form
│   │   └── health.py      # Health checks
│   └── middlewares/       # CORS and other middleware
├── controllers/           # HTTP request handlers
├── services/              # Business logic
│   ├── similarity_service.py      # Audio similarity algorithms
│   ├── metadata_service.py        # Metadata extraction & filtering
│   ├── search_service.py          # Search implementation
│   ├── audio_service.py           # FFmpeg integration
│   ├── playlist_service.py        # Playlist management
│   ├── track_upload_service.py    # Track upload processing
│   └── monthly_pipeline_service.py # Monthly pipeline processing
├── repositories/          # Data access layer
├── models/               # SQLAlchemy ORM models
├── schemas/              # Pydantic validation models
├── core/                 # Configuration and utilities
└── utils/                # Helper functions
```

## 🔧 Advanced Features

### Metadata Filtering
Automatic cleaning of metadata fields:
- **URL/Domain Detection**: Removes URLs and domain names from metadata
- **Title Filtering**: Removes common unwanted strings like "(Original Mix)"
- **Stopper Strings**: Truncates metadata at specified markers

### Similarity Pipeline
- **Multi-format Support**: Handles various audio formats via FFmpeg
- **Deduplication**: Advanced algorithms prevent duplicate results
- **Scoring System**: Similarity scores for result ranking
- **Playlist Integration**: Automatic playlist generation from results

### Security & Performance
- **API Key Authentication**: Secure access control
- **Preview URL Signing**: Time-limited, signed preview URLs
- **Async Processing**: Full async/await for high performance
- **Connection Pooling**: Optimized database connections
- **Input Validation**: Comprehensive request validation

## 🚀 Deployment

### Docker
```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8005
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8005"]
```

### Production Considerations
- Use strong API keys and secrets
- Configure CORS for your domain
- Set up database backups
- Monitor logs and health endpoints
- Use HTTPS/TLS in production

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the existing code patterns and architecture
4. Add appropriate tests
5. Submit a pull request

## 📞 Support

- **Health Check**: `GET /api/health/`
- **Feedback API**: `POST /api/feedback/`
- **Contact Form**: `POST /api/feedback/contact/`
- **Documentation**: Available at `/docs` endpoint

---

**ResomiX Audio Similarity API** - Powering music discovery through advanced audio analysis.
