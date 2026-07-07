#!/usr/bin/env python3
"""
Launcher script to start both frontend and backend in separate terminals.

Usage:
    python launch.py

This will open two terminal windows:
1. Backend server running on http://localhost:8000
2. Frontend development server running on http://localhost:5173
"""

import os
import subprocess
import sys
from pathlib import Path

# Get the project root directory
PROJECT_ROOT = Path(__file__).parent.resolve()


def launch_backend():
    """Launch the backend server in a new terminal window."""
    venv_path = PROJECT_ROOT / ".venv"
    if venv_path.exists():
        activate_script = venv_path / "Scripts" / "activate.bat"
        backend_cmd = [
            "cmd.exe",
            "/c",
            "start",
            "cmd.exe",
            "/k",
            f"cd /d {PROJECT_ROOT} && {activate_script} && python -m uvicorn backend.api.app:create_app --host 0.0.0.0 --port 8000 --reload",
        ]
    else:
        backend_cmd = [
            "cmd.exe",
            "/c",
            "start",
            "cmd.exe",
            "/k",
            f"cd /d {PROJECT_ROOT} && python -m uvicorn backend.api.app:create_app --host 0.0.0.0 --port 8000 --reload",
        ]
    subprocess.Popen(backend_cmd, shell=True)
    print("Backend server launching in new terminal window...")


def launch_frontend():
    """Launch the frontend development server in a new terminal window."""
    frontend_cmd = [
        "cmd.exe",
        "/c",
        "start",
        "cmd.exe",
        "/k",
        f"cd /d {PROJECT_ROOT}\\frontend && npm run dev",
    ]
    subprocess.Popen(frontend_cmd, shell=True)
    print("Frontend development server launching in new terminal window...")


def main():
    """Main entry point."""
    print("=" * 60)
    print("FortiesR Application Launcher")
    print("=" * 60)
    print(f"Project root: {PROJECT_ROOT}")
    print()
    
    # Check if backend directory exists
    backend_dir = PROJECT_ROOT / "backend"
    if not backend_dir.exists():
        print(f"Error: Backend directory not found at {backend_dir}")
        sys.exit(1)
    
    # Check if frontend directory exists
    frontend_dir = PROJECT_ROOT / "frontend"
    if not frontend_dir.exists():
        print(f"Error: Frontend directory not found at {frontend_dir}")
        sys.exit(1)
    
    print("Launching backend and frontend servers...")
    print()
    
    # Launch backend
    launch_backend()
    
    # Wait a moment before launching frontend
    import time
    time.sleep(2)
    
    # Launch frontend
    launch_frontend()
    
    print()
    print("=" * 60)
    print("Servers are starting up...")
    print("Backend: http://localhost:8000")
    print("Frontend: http://localhost:5173")
    print("=" * 60)
    print()
    print("Press Ctrl+C in this terminal to exit (servers will continue running)")
    print("Close the individual terminal windows to stop each server")
    print()


if __name__ == "__main__":
    main()
