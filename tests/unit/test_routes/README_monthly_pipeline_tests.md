# Monthly Pipeline Tests

## Overview

This directory contains comprehensive tests for the Monthly Pipeline functionality in the Resomix API. The monthly pipeline endpoint processes audio files by:

1. **Extracting metadata** and generating a UUID
2. **Sending to similarity server** for embedding preview generation  
3. **Storing in database** only if similarity server succeeds

## Test File

`test_monthly_pipeline_routes.py` - Comprehensive test suite covering valid and invalid scenarios.

## Prerequisites

1. **Server Running**: Make sure your FastAPI server is running on `http://localhost:8001`
2. **Dependencies**: Ensure you have the similarity server running and configured
3. **Audio File**: The test uses `tests/unit/test_routes/audio1.mp3` for testing
4. **API Key**: Update the API key in the test file if needed

## New Features Tested

### FFmpeg Validation
- **Audio Format Validation**: Uses FFmpeg to verify uploaded files contain valid audio streams
- **Duration Extraction**: Extracts track duration using FFprobe for mix filter validation
- **Fallback Mode**: Basic content-type validation when FFmpeg is unavailable

### Mix Filter
The monthly pipeline includes intelligent filtering to prevent DJ mixes and long-form content:

- **Large MP3 Filter**: Rejects MP3 files larger than 50MB (typical indicator of mixes)
- **Duration Filter**: Rejects tracks longer than 30 minutes (1800 seconds)
- **Smart Detection**: Helps maintain track quality by filtering out extended mixes

## Running the Tests

### Quick Run
```bash
python tests/unit/test_routes/test_monthly_pipeline_routes.py
```

### From Project Root
```bash
cd /path/to/your/project
python -m tests.unit.test_routes.test_monthly_pipeline_routes
```

## Test Coverage

### ✅ Valid Cases
1. **Valid Upload** - Tests successful processing with real audio file
2. **Special Characters in Path** - Tests path with special characters

### ❌ Invalid Cases  
3. **Missing File** - Tests validation when no file is uploaded
4. **Missing Path** - Tests validation when path field is missing
5. **Empty Path** - Tests validation when path field is empty
6. **Invalid File Type** - Tests rejection of non-audio files
7. **Empty File** - Tests rejection of empty files
8. **Large File** - Tests file size limit validation
9. **Large MP3 Mix Filter** - Tests mix filter rejection of large MP3 files (>50MB)
10. **Unauthorized Access** - Tests API key authentication
11. **Very Long Path** - Tests path length validation (max 1000 chars)

## Expected Results

- **11 total tests**
- **Valid cases should return 200** with success response containing `track_uuid` and `path`
- **Invalid cases should return appropriate HTTP status codes**:
  - `422` - Validation errors (missing/empty fields, file size, path length, mix filter rejection)
  - `415` - Unsupported media type (invalid audio files)
  - `403` - Unauthorized (missing API key)

## Test Output

The test provides detailed output including:
- ✅/❌ Status for each test
- Execution time for each test
- Detailed error messages for failures
- Full API responses for debugging
- Summary statistics with pass rate

## Configuration

Update these values in the test file if needed:

```python
BASE_URL = "http://localhost:8001"  # Your server URL
API_KEY = "your-api-key-here"       # Your API key
```

## Troubleshooting

### Common Issues

1. **Connection refused**: Server not running
2. **403 Unauthorized**: Wrong/missing API key
3. **503 Service Unavailable**: Similarity server not running
4. **File not found**: `audio1.mp3` missing from test directory

### Debug Mode

For more detailed output, check the server logs while running tests. The monthly pipeline controller logs each step of the process.

## Integration with CI/CD

This test can be integrated into CI/CD pipelines:

```bash
# Exit code 0 = all tests passed
# Exit code 1 = one or more tests failed
python tests/unit/test_routes/test_monthly_pipeline_routes.py
echo $?  # Check exit code
``` 