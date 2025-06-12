# Route Tests Documentation

This directory contains comprehensive unit tests for all API routes in the Resomix application.

## Structure

```
tests/unit/test_routes/
├── __init__.py                   # Package initialization
├── README.md                     # This documentation
├── run_all_tests.py             # Master test runner
├── test_health_routes.py        # Health and status endpoints
├── test_search_routes.py        # Search functionality tests
├── test_feedback_routes.py      # Feedback and contact form tests
├── test_metadata_routes.py      # Metadata extraction tests
└── test_similarity_routes.py    # Similarity calculation tests
```

## Available Test Suites

| Suite | Description | Endpoints Tested |
|-------|-------------|------------------|
| 🏥 **health** | Health and status endpoints | `GET /`, `GET /health` |
| 🔍 **search** | Search functionality | `GET /search_tracks/` |
| 💬 **feedback** | Feedback and contact forms | `POST /feedback`, `POST /contact` |
| 🎵 **metadata** | Metadata extraction | `POST /metadata/` |
| 🎛️ **similarity** | Similarity calculation | `POST /get_similarity/`, `POST /get_selection_similarity/` |

## Usage

### Run Individual Test Suites

```bash
# Run health tests
python tests/unit/test_routes/test_health_routes.py

# Run search tests  
python tests/unit/test_routes/test_search_routes.py

# Run feedback tests
python tests/unit/test_routes/test_feedback_routes.py

# Run metadata tests
python tests/unit/test_routes/test_metadata_routes.py

# Run similarity tests
python tests/unit/test_routes/test_similarity_routes.py
```

### Run Multiple Test Suites

```bash
# Run all tests
python tests/unit/test_routes/run_all_tests.py

# Run specific test suites
python tests/unit/test_routes/run_all_tests.py health search

# List available test suites
python tests/unit/test_routes/run_all_tests.py --list

# Show help
python tests/unit/test_routes/run_all_tests.py --help
```

## Test Features

### ✅ **Comprehensive Coverage**
- Valid request scenarios
- Invalid input validation
- API key authentication
- Missing parameter handling
- Edge cases and error conditions

### ✅ **Proper Authentication**
- Valid API key testing
- Invalid API key rejection
- Missing API key handling

### ✅ **File Upload Testing**
- Valid audio file uploads
- Invalid file format rejection
- Empty file handling
- Large file processing
- Missing file validation

### ✅ **Response Validation**
- Status code verification
- JSON structure validation
- Success/error field checking
- Data format verification

### ✅ **Performance Tracking**
- Request timing measurement
- Response time reporting
- Server connectivity checks

## Configuration

Each test file has configurable settings at the top:

```python
# Configuration
BASE_URL = "http://localhost:8001"  # Update to match your server
API_KEY = "bearer-resomix-api-V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ"
TIMEOUT = 30
```

## Expected Responses

The tests handle various expected response scenarios:

- **200 OK**: Successful operations
- **403 Forbidden**: Invalid/missing API key
- **404 Not Found**: Resource not found
- **415 Unsupported Media Type**: Invalid file format
- **422 Unprocessable Entity**: Validation errors
- **503 Service Unavailable**: External service issues

## Test Output

Each test provides detailed output including:

```
🧪 Testing Search Tracks - Valid Request
✅ PASS Search Tracks Valid (0.15s)
     Found 25 tracks
```

## Adding New Tests

To add tests for new routes:

1. Create a new test file: `test_newroute_routes.py`
2. Follow the existing pattern with proper imports and configuration
3. Implement test functions for each scenario
4. Add a main runner function
5. Update `run_all_tests.py` to include the new suite

## Notes

- Tests create minimal test files for audio upload scenarios
- Tests attempt to find real audio files before creating synthetic ones
- All tests include proper error handling and timeout management
- Server connectivity is checked before running tests 