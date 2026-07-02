#!/usr/bin/env python3
"""
Line Limit Checker Script

Checks source files for compliance with line count limits:
- Target: 500-700 lines
- Hard limit: 800 lines
- Temporary exception: 1000 lines for legacy files
"""

import os
import sys
from pathlib import Path
from typing import List, Tuple

# Configuration
TARGET_MIN = 500
TARGET_MAX = 700
HARD_LIMIT = 800
LEGACY_LIMIT = 1000

# Directories to check
BACKEND_DIR = Path("backend")
FRONTEND_SRC_DIR = Path("frontend/src")

# File extensions to check
PYTHON_EXTENSIONS = {".py"}
JS_EXTENSIONS = {".js", ".jsx"}

# Directories to exclude
EXCLUDE_DIRS = {
    "__pycache__",
    "node_modules",
    ".venv",
    "venv",
    "dist",
    "build",
    ".git",
}


def count_lines(file_path: Path) -> int:
    """Count the number of lines in a file."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return sum(1 for _ in f)
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return 0


def should_check_file(file_path: Path) -> bool:
    """Determine if a file should be checked."""
    # Check extension
    if file_path.suffix not in PYTHON_EXTENSIONS | JS_EXTENSIONS:
        return False
    
    # Check if in excluded directory
    for part in file_path.parts:
        if part in EXCLUDE_DIRS:
            return False
    
    return True


def check_directory(directory: Path) -> List[Tuple[Path, int]]:
    """Check all files in a directory and return violations."""
    violations = []
    
    if not directory.exists():
        return violations
    
    for file_path in directory.rglob("*"):
        if file_path.is_file() and should_check_file(file_path):
            line_count = count_lines(file_path)
            if line_count > HARD_LIMIT:
                violations.append((file_path, line_count))
    
    return violations


def format_violations(violations: List[Tuple[Path, int]]) -> str:
    """Format violations for display."""
    if not violations:
        return "No violations found!"
    
    output = []
    output.append(f"Found {len(violations)} files exceeding the hard limit of {HARD_LIMIT} lines:\n")
    
    # Sort by line count descending
    violations.sort(key=lambda x: x[1], reverse=True)
    
    for file_path, line_count in violations:
        status = "LEGACY" if line_count > HARD_LIMIT and line_count <= LEGACY_LIMIT else "VIOLATION"
        output.append(f"  [{status}] {file_path} ({line_count} lines)")
    
    return "\n".join(output)


def main():
    """Main entry point."""
    print("Checking line limits...")
    print(f"Target: {TARGET_MIN}-{TARGET_MAX} lines")
    print(f"Hard limit: {HARD_LIMIT} lines")
    print(f"Legacy exception: {LEGACY_LIMIT} lines\n")
    
    all_violations = []
    
    # Check backend
    print("Checking backend...")
    backend_violations = check_directory(BACKEND_DIR)
    all_violations.extend(backend_violations)
    print(f"  Found {len(backend_violations)} violations")
    
    # Check frontend
    print("Checking frontend...")
    frontend_violations = check_directory(FRONTEND_SRC_DIR)
    all_violations.extend(frontend_violations)
    print(f"  Found {len(frontend_violations)} violations")
    
    # Display results
    print("\n" + "=" * 80)
    print(format_violations(all_violations))
    print("=" * 80)
    
    # Exit with error code if violations found
    if all_violations:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
