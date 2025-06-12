# Application entry point 
import uvicorn
from app.main import app

if __name__ == "__main__":
    # It's good practice to make host and port configurable
    uvicorn.run(app, host="0.0.0.0", port=8005)
