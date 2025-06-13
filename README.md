# ResomiX Audio Similarity API

A comprehensive FastAPI-based application for audio similarity analysis, track management, and music discovery. This API provides advanced audio processing capabilities, metadata extraction, search functionality, and a complete music management system with user authentication and content management.

## Architecture Overview

This application follows a **layered architecture** pattern with clean separation of concerns:

- **API Layer**: FastAPI routers, middleware, and dependencies
- **Controller Layer**: HTTP request/response handling and validation
- **Service Layer**: Business logic and external service integration
- **Repository Layer**: Data access abstraction and database operations
- **Model Layer**: SQLAlchemy ORM models and database schema
- **Schema Layer**: Pydantic models for API validation and serialization

## Features

### Core Audio Features
- **Audio Similarity Analysis**: Upload audio files and receive similarity metrics with existing tracks
- **Metadata Extraction**: Comprehensive metadata extraction using multiple methods (FFmpeg, Mutagen)
- **Audio Validation**: Deep content analysis using FFmpeg for security and format validation
- **Search Engine**: Advanced track search with multiple criteria and algorithms

### Management Features
- **Track Management**: Complete CRUD operations for tracks, artists, albums, and labels
- **Playlist Management**: Create and manage playlists with track relationships
- **User Management**: Full RBAC system with users, roles, and permissions
- **Rating System**: Track and playlist rating capabilities
- **Purchase/Subscription System**: Complete billing and subscription management
- **Feedback System**: Integrated feedback collection and contact management

### Technical Features
- **MariaDB Integration**: Robust relational database with optimized schemas
- **Async Support**: Full async/await support for high-performance operations
- **API Key Authentication**: Secure API access with key-based authentication
- **CORS Support**: Frontend-compatible with configurable CORS policies
- **Error Handling**: Comprehensive error handling with custom exceptions
- **Logging**: Structured logging for monitoring and debugging

## Requirements

### System Dependencies

#### FFmpeg (Required)
This application requires FFmpeg for audio file validation and processing:

- **Windows:** Download from [FFmpeg.org](https://ffmpeg.org/download.html) or install via Chocolatey:
  ```bash
  choco install ffmpeg
  ```

- **macOS:** Install using Homebrew:
  ```bash
  brew install ffmpeg
  ```

- **Linux (Debian/Ubuntu):**
  ```bash
  sudo apt update
  sudo apt install ffmpeg
  ```

#### MariaDB (Required)
The application uses MariaDB as its primary database:

- **Installation**: Follow the [MariaDB installation guide](https://mariadb.org/download/)
- **Configuration**: Update database connection settings in `.env` file

### Python Dependencies
- Python 3.8 or higher
- FastAPI, Uvicorn, SQLAlchemy, MariaDB drivers
- See `requirements.txt` for complete list

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd resomix-api
   ```

2. **Create and activate virtual environment:**
   ```bash
   python -m venv venv
   # Windows
   venv\Scripts\activate
   # macOS/Linux
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Initialize database:**
   ```bash
   # Run database migrations
   python -m scripts.migrate_data
   ```

## Configuration

### Environment Variables
Key configuration options in `.env`:

```env
# API Configuration
API_KEY=your_secure_api_key_here
MAX_FILE_SIZE=52428800  # 50MB in bytes
TEMP_DIR=temp_audio
```

### Security Settings
- **API Key**: Set a strong API key for production deployment
- **CORS Origins**: Configure allowed origins in `app/api/middlewares/cors.py`
- **Database Security**: Use strong database credentials and proper network configuration

## Running the Application

### Development
```bash
python run.py
```

### Production
```bash
# Using Uvicorn directly
uvicorn app.main:app --host 0.0.0.0 --port 8005

# Using Gunicorn (recommended for production)
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8005
```

The server will be available at `http://localhost:8005`

## API Documentation

### Interactive Documentation
- **Swagger UI**: `http://localhost:8005/docs`
- **ReDoc**: `http://localhost:8005/redoc`

### Core Endpoints

#### Audio Similarity
- `POST /api/similarity/get_similarity/` - Upload audio file for similarity analysis
- `POST /api/similarity/get_selection_similarity/` - Get similarity for selected tracks

#### Search & Discovery
- `GET /api/search/tracks/` - Search tracks with various criteria
- `GET /api/tracks/` - List and filter tracks
- `GET /api/artists/` - Browse artists
- `GET /api/albums/` - Browse albums

#### Metadata & Processing
- `POST /api/metadata/extract/` - Extract metadata from audio files
- `POST /api/audio/validate/` - Validate audio file formats

#### User Management
- `POST /api/users/` - Create user accounts
- `GET /api/users/profile/` - Get user profile
- `PUT /api/users/profile/` - Update user profile

#### Content Management
- `POST /api/playlists/` - Create playlists
- `POST /api/ratings/` - Rate tracks and playlists
- `GET /api/purchases/` - View purchase history

#### Feedback & Support
- `POST /api/feedback/` - Submit feedback
- `POST /api/feedback/contact/` - Contact form submission

### Authentication
All endpoints require API key authentication via query parameter:
```
?api_key=YOUR_API_KEY
```

### Response Format
All API responses follow a consistent format:

**Success Response:**
```json
{
  "success": true,
  "data": {
    // Response data here
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message description",
  "details": {
    // Additional error details if available
  }
}
```

## Project Structure

```
├── 📁app/                                    # Main application directory
│   ├── 📁api/                                # API layer
│   │   ├── 📁dependencies/                   # Dependency injection
│   │   │   ├── auth.py                      # API key validation and security
│   │   │   └── database.py                  # Database session management
│   │   ├── 📁middlewares/                   # Custom middlewares
│   │   │   └── cors.py                      # CORS configuration
│   │   └── 📁routers/                       # API route definitions
│   │       ├── similarity.py                # Audio similarity endpoints
│   │       ├── tracks.py                    # Track management endpoints
│   │       ├── artists.py                   # Artist management endpoints
│   │       ├── albums.py                    # Album management endpoints
│   │       ├── playlists.py                 # Playlist management endpoints
│   │       ├── search.py                    # Search functionality endpoints
│   │       ├── ratings.py                   # Rating system endpoints
│   │       ├── purchases.py                 # Purchase/billing endpoints
│   │       ├── metadata.py                  # Metadata extraction endpoints
│   │       ├── feedback.py                  # Feedback system endpoints
│   │       ├── users.py                     # User management endpoints
│   │       └── health.py                    # Health check endpoints
│   ├── 📁controllers/                        # Request/response handling
│   │   ├── similarity_controller.py         # Similarity business logic
│   │   ├── track_controller.py              # Track operations logic
│   │   ├── search_controller.py             # Search algorithm logic
│   │   ├── metadata_controller.py           # Metadata processing logic
│   │   ├── feedback_controller.py           # Feedback processing logic
│   │   └── [other controllers...]           # Additional controllers
│   ├── 📁services/                          # Business logic layer
│   │   ├── similarity_service.py            # Audio similarity algorithms
│   │   ├── metadata_service.py              # Metadata extraction service
│   │   ├── search_service.py                # Search engine implementation
│   │   ├── audio_service.py                 # Audio processing with FFmpeg
│   │   ├── feedback_service.py              # Feedback processing service
│   │   └── [other services...]              # Additional business services
│   ├── 📁repositories/                      # Data access layer
│   │   ├── base_repository.py               # Base repository with common operations
│   │   ├── track_repository.py              # Track data access
│   │   ├── artist_repository.py             # Artist data access
│   │   ├── user_repository.py               # User data access
│   │   └── [other repositories...]          # Additional data repositories
│   ├── 📁schemas/                           # Pydantic validation models
│   │   ├── similarity.py                    # Similarity request/response schemas
│   │   ├── track.py                         # Track schemas
│   │   ├── user.py                          # User schemas
│   │   ├── common.py                        # Common response schemas
│   │   └── [other schemas...]               # Additional validation schemas
│   ├── 📁models/                            # SQLAlchemy ORM models
│   │   ├── track.py                         # Track and TrackArtist models
│   │   ├── artist.py                        # Artist model
│   │   ├── album.py                         # Album model
│   │   ├── user.py                          # User, Role, Permission models
│   │   ├── playlist.py                      # Playlist models
│   │   └── [other models...]                # Additional database models
│   ├── 📁core/                              # Core application configuration
│   │   ├── config.py                        # Application settings and environment variables
│   │   ├── security.py                      # Security utilities and RBAC
│   │   └── exceptions.py                    # Custom exception classes
│   ├── 📁utils/                             # Utility functions
│   │   ├── file_utils.py                    # File handling utilities
│   │   ├── validation.py                    # Validation helpers
│   │   ├── response.py                      # Response formatting utilities
│   │   └── stripe_utils.py                  # Payment processing utilities
│   └── main.py                              # FastAPI application factory
├── 📁database/                              # Database related files
│   ├── connection.py                        # Database connection setup
│   ├── 📁migrations/                        # Database migration scripts
│   └── schema.sql                          # Database schema definition
├── 📁scripts/                              # Utility and migration scripts
│   ├── migrate_data.py                     # Data migration utilities
│   └── seed_data.py                        # Database seeding scripts
├── 📁tests/                                # Test suites
│   ├── 📁unit/                             # Unit tests
│   ├── 📁integration/                      # Integration tests
│   └── conftest.py                         # Test configuration
├── 📁temp_audio/                           # Temporary audio file storage
├── 📁logs/                                 # Application logs
├── .env                                    # Environment variables
├── requirements.txt                        # Python dependencies
├── run.py                                  # Application entry point
└── README.md                               # This file
```

## Development

### Adding New Features

#### 1. Adding New Endpoints
1. Create schemas in `app/schemas/`
2. Create/update models in `app/models/`
3. Create repository methods in `app/repositories/`
4. Implement business logic in `app/services/`
5. Create controller methods in `app/controllers/`
6. Add router endpoints in `app/api/routers/`

#### 2. Database Changes
1. Update models in `app/models/`
2. Create migration scripts in `database/migrations/`
3. Update repository methods as needed
4. Test with `python -m scripts.migrate_data`

#### 3. Testing
```bash
# Run all tests
pytest

# Run specific test types
pytest tests/unit/
pytest tests/integration/

# Run with coverage
pytest --cov=app tests/
```

### Code Quality
- **Linting**: Use `flake8` and `black` for code formatting
- **Type Hints**: Use type hints throughout the codebase
- **Documentation**: Document all public methods and classes
- **Error Handling**: Use custom exceptions from `app/core/exceptions.py`

## Deployment

### Docker (Recommended)
```dockerfile
# Example Dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8005

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8005"]
```

### Environment-Specific Configuration
- **Development**: Use `.env` file with debug settings
- **Staging**: Use environment variables with staging database
- **Production**: Use secure environment variables and production database

### Monitoring and Logging
- **Logs**: Stored in `logs/` directory with rotation
- **Health Checks**: Available at `/health` endpoint
- **Metrics**: Database connection status, request metrics
- **Error Tracking**: Comprehensive error logging with stack traces

## Security Considerations

1. **API Security**:
   - Strong API key authentication
   - Rate limiting (implement as needed)
   - Input validation via Pydantic schemas

2. **File Security**:
   - FFmpeg validation for uploaded audio files
   - Temporary file cleanup
   - File size restrictions

3. **Database Security**:
   - Parameterized queries via SQLAlchemy
   - Connection pooling and timeout settings
   - Regular database backups

4. **Production Setup**:
   - HTTPS/TLS encryption
   - Secure environment variable management
   - Regular security updates

## Performance Optimization

- **Database**: Connection pooling, query optimization, indexing
- **Async Operations**: Full async/await support for I/O operations
- **Caching**: Implement Redis caching for frequently accessed data
- **File Processing**: Efficient temporary file handling and cleanup
- **API Response**: Optimized JSON serialization with Pydantic

## Migration from Legacy System

This application has been migrated from a MongoDB-based monolithic structure to a MariaDB-based layered architecture. Key improvements include:

- **Better Data Consistency**: Relational database with foreign key constraints
- **Improved Performance**: Optimized queries and proper indexing
- **Enhanced Security**: Better authentication and authorization
- **Scalability**: Modular architecture supporting horizontal scaling
- **Maintainability**: Clear separation of concerns and testable components

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the established patterns
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

[Specify your license here]

## Support

For support and questions:
- Use the feedback endpoint: `POST /api/feedback/contact/`
- Check the API documentation at `/docs`
- Review logs in the `logs/` directory for troubleshooting
