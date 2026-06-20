"""Research log helper for Strategy Research Agent."""
import json, os, sys
from datetime import datetime, timezone

LOG_FILE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "research_run_log.jsonl"
)

def append_run_log(entry: dict):
    entry["timestamp"] = datetime.now(timezone.utc).isoformat()
    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(entry) + "\n")
    print(f"[LOG] {entry.get('api_call', '?')} | {entry.get('failure_reason', 'ok')}")

if __name__ == "__main__":
    # Test: show existing log
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE) as f:
            lines = [l for l in f if l.strip()]
        print(f"Research log has {len(lines)} entries")
    else:
        print("Research log empty (new session)")
        open(LOG_FILE, "a").close()
