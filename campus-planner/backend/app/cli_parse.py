"""Try the parser on a real PDF without starting the server:

    python -m app.cli_parse routine.pdf            # readable table + warnings + clashes
    python -m app.cli_parse routine.pdf --json     # raw rows
"""
import json
import sys

from .services.conflicts import find_conflicts
from .services.pdf_parser import parse_pdf


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        print(__doc__)
        return 2
    res = parse_pdf(args[0])
    rows = res.entry_dicts()
    if "--json" in sys.argv:
        print(json.dumps({"entries": rows, "warnings": res.warnings}, indent=2))
        return 0
    print("\n".join(res.log))
    print(f"\n{'dept':<22}{'batch':<7}{'sec':<5}{'day':<5}{'time':<13}{'code':<10}{'room':<7}{'type':<9}teacher / title")
    for r in rows:
        print(f"{r['department'][:20]:<22}{r['batch']:<7}{r['section']:<5}{r['day']:<5}"
              f"{r['start'] + '-' + r['end']:<13}{r['code']:<10}{r['room']:<7}{r['kind']:<9}"
              f"{r['teacher']} | {r['title']}")
    print(f"\n{len(rows)} entries")
    for w in res.warnings:
        print("WARN", w)
    for c in find_conflicts(rows):
        print("CLASH", c["type"], c["when"], "-", c["message"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
