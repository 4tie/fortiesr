#!/usr/bin/env python3
"""
Launcher script to start the Aero app.

Usage:
    python launch_aero.py

This will open a terminal window with the Aero FastAPI server running on http://localhost:5173
and automatically open the browser to the app.
"""

import os
import subprocess
import sys
from pathlib import Path

# Get the project root directory
PROJECT_ROOT = Path(__file__).parent.resolve()
AERO_DIR = PROJECT_ROOT / "aero"


def launch_aero():
    """Launch the Aero FastAPI app in a new terminal window."""
    venv_path = PROJECT_ROOT / ".venv"
    
    if venv_path.exists():
        activate_script = venv_path / "Scripts" / "activate.bat"
        aero_cmd = [
            "cmd.exe",
            "/c",
            "start",
            "cmd.exe",
            "/k",
            f"cd /d {PROJECT_ROOT} && {activate_script} && set AERO_PORT=5173 && python -m aero.app",
        ]
    else:
        aero_cmd = [
            "cmd.exe",
            "/c",
            "start",
            "cmd.exe",
            "/k",
            f"cd /d {PROJECT_ROOT} && set AERO_PORT=5173 && python -m aero.app",
        ]
    
    subprocess.Popen(aero_cmd, shell=True)
    print("Aero app launching in new terminal window...")


def main():
    """Main entry point."""
    print("=" * 60)
    print("Aero App Launcher")
    print("=" * 60)
    print(f"Project root: {PROJECT_ROOT}")
    print()
    
    # Check if aero directory exists
    if not AERO_DIR.exists():
        print(f"Error: Aero directory not found at {AERO_DIR}")
        sys.exit(1)
    
    # Check if app.py exists
    app_py = AERO_DIR / "app.py"
    if not app_py.exists():
        print(f"Error: Aero app.py not found at {app_py}")
        sys.exit(1)
    
    print("Launching Aero app...")
    print()
    
    # Launch aero
    launch_aero()
    
    print()
    print("=" * 60)
    print("Aero app is starting up...")
    print("URL: http://localhost:5173")
    print("=" * 60)
    print()
    print("The browser will open automatically.")
    print("Press Ctrl+C in this terminal to exit (the app will continue running)")
    print("Close the terminal window to stop the Aero app")
    print()


if __name__ == "__main__":
    main()
