"""Top-level ASGI entry point for the Strategy Lab backend API.

Development
-----------
    uvicorn server:app --host 0.0.0.0 --port 8000 --reload

Production (direct)
-------------------
    python server.py
"""

from __future__ import annotations

import os
from dotenv import load_dotenv
import uvicorn

from backend.api.app import create_app

load_dotenv()

app = create_app()


if __name__ == "__main__":
    uvicorn.run(
        "server:app",
        host=os.getenv("BACKEND_HOST", "0.0.0.0"),
        port=int(os.getenv("BACKEND_PORT", "8000")),
        reload=False,
    )
