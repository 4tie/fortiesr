#!/usr/bin/env python3
"""
Port Killer CLI - Force kill processes on specified ports.
Usage: python kill_port.py [ports...]
Example: python kill_port.py 8000 5000 5173
"""

import argparse
import subprocess
import sys
from typing import List, Tuple


def find_process_on_port(port: int) -> List[Tuple[str, str]]:
    """
    Find processes using the specified port on Windows.
    Returns list of (pid, process_name) tuples.
    """
    try:
        # Use netstat to find processes on the port
        result = subprocess.run(
            ['netstat', '-ano'],
            capture_output=True,
            text=True,
            check=True
        )
        
        processes = []
        lines = result.stdout.split('\n')
        
        for line in lines:
            # Look for lines with the port in LISTENING state
            if f':{port}' in line and 'LISTENING' in line:
                parts = line.split()
                if len(parts) >= 5:
                    pid = parts[-1].strip()
                    # Get process name from PID
                    try:
                        tasklist_result = subprocess.run(
                            ['tasklist', '/FI', f'PID eq {pid}', '/FO', 'CSV', '/NH'],
                            capture_output=True,
                            text=True,
                            check=True
                        )
                        if tasklist_result.stdout:
                            process_name = tasklist_result.stdout.split(',')[0].strip('"')
                            processes.append((pid, process_name))
                    except subprocess.CalledProcessError:
                        processes.append((pid, 'Unknown'))
        
        return processes
    except subprocess.CalledProcessError as e:
        print(f"Error finding process on port {port}: {e}")
        return []


def kill_process(pid: str, force: bool = True) -> bool:
    """
    Kill a process by PID on Windows.
    Returns True if successful, False otherwise.
    """
    try:
        cmd = ['taskkill', '/PID', pid]
        if force:
            cmd.append('/F')
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True
        )
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error killing process {pid}: {e}")
        return False


def kill_port(port: int, force: bool = True) -> bool:
    """
    Kill all processes using the specified port.
    Returns True if any process was killed, False otherwise.
    """
    print(f"\nChecking port {port}...")
    processes = find_process_on_port(port)
    
    if not processes:
        print(f"  No processes found on port {port}")
        return False
    
    print(f"  Found {len(processes)} process(es) on port {port}:")
    for pid, name in processes:
        print(f"    - PID: {pid}, Process: {name}")
    
    killed = False
    for pid, name in processes:
        print(f"  Killing process {pid} ({name})...", end=' ')
        if kill_process(pid, force):
            print("✓ Killed")
            killed = True
        else:
            print("✗ Failed")
    
    return killed


def main():
    parser = argparse.ArgumentParser(
        description='Force kill processes on specified ports',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python kill_port.py 8000 5000 5173
  python kill_port.py --ports 8000,5000,5173
  python kill_port.py --no-force 8000
        """
    )
    
    parser.add_argument(
        'ports',
        nargs='*',
        type=int,
        help='Port numbers to kill (e.g., 8000 5000 5173)'
    )
    
    parser.add_argument(
        '--ports',
        type=str,
        help='Comma-separated list of ports (e.g., 8000,5000,5173)'
    )
    
    parser.add_argument(
        '--no-force',
        action='store_true',
        help='Do not force kill (try graceful shutdown first)'
    )
    
    args = parser.parse_args()
    
    # Collect all ports
    ports = set(args.ports)
    
    if args.ports:
        try:
            comma_ports = [int(p.strip()) for p in args.ports.split(',')]
            ports.update(comma_ports)
        except (ValueError, AttributeError):
            # args.ports is a list from positional args, not a string
            pass
    
    if not ports:
        # Default ports if none specified
        ports = {8000, 5000, 5173}
        print("No ports specified. Using default ports: 8000, 5000, 5173")
    
    force = not args.no_force
    force_str = "force " if force else ""
    
    print(f"{'Force ' if force else ''}Killing processes on ports: {', '.join(map(str, sorted(ports)))}")
    print("=" * 60)
    
    killed_any = False
    for port in sorted(ports):
        if kill_port(port, force):
            killed_any = True
    
    print("=" * 60)
    if killed_any:
        print("✓ Port cleanup complete")
    else:
        print("No processes were killed")
    
    sys.exit(0)


if __name__ == '__main__':
    main()
