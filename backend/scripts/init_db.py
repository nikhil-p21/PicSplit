from pathlib import Path
import sys

try:
    from backend.persistence.database import init_db
except ModuleNotFoundError:
    project_root = Path(__file__).resolve().parents[2]
    sys.path.insert(0, str(project_root))
    from backend.persistence.database import init_db


if __name__ == "__main__":
    init_db()
    print("Database initialized.")
