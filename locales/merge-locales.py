#!/usr/bin/env python3
"""merge-locales.py

Usage: merge-locales.py target.json source.json

For each property in `source.json`, if the property is not defined in
`target.json` it will be added. Finally `target.json` is written back with
its properties sorted alphabetically.

Optional flag: --backup will write a backup of the original target file
with an additional `.bak` suffix (e.g., `target.json.bak`).
"""
from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path


def load_json(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: dict):
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Merge keys from source JSON into target JSON and sort target keys "
            "alphabetically."
        )
    )
    parser.add_argument("target", help="Target JSON file to update")
    parser.add_argument("source", help="Source JSON file providing keys")
    parser.add_argument(
        "--backup",
        action="store_true",
        help="Create a backup of the target file as target.json.bak",
    )
    args = parser.parse_args()

    tpath = Path(args.target)
    spath = Path(args.source)

    if not tpath.exists():
        print(f"Error: target file {tpath} does not exist", file=sys.stderr)
        return 2
    if not spath.exists():
        print(f"Error: source file {spath} does not exist", file=sys.stderr)
        return 2

    try:
        target = load_json(tpath)
        source = load_json(spath)
    except Exception as exc:  # pragma: no cover - safe to report parsing errors
        print(f"Error reading JSON: {exc}", file=sys.stderr)
        return 2

    if not isinstance(target, dict) or not isinstance(source, dict):
        print("Error: both JSON files must contain an object at top level", file=sys.stderr)
        return 2

    # Keep original target for backup, record added and overwritten keys
    original_target = dict(target)
    added = []
    overwritten = []
    for k, v in source.items():
        if k in target:
            if target[k] != v:
                overwritten.append(k)
        else:
            added.append(k)
        # Always overwrite or add from source
        target[k] = v

    # Create sorted dict by key
    merged = {k: target[k] for k in sorted(target.keys())}

    if args.backup:
        bak = tpath.with_suffix(tpath.suffix + ".bak")
        try:
            # Backup the original target file, not the already-merged one
            write_json(bak, original_target)
        except Exception as exc:
            print(f"Warning: could not write backup {bak}: {exc}", file=sys.stderr)

    try:
        write_json(tpath, merged)
    except Exception as exc:
        print(f"Error writing merged JSON: {exc}", file=sys.stderr)
        return 2

    if added:
        print(f"Added {len(added)} keys to {tpath}")
        for k in added:
            print(k)
    if overwritten:
        print(f"Overwritten {len(overwritten)} keys in {tpath}")
        for k in overwritten:
            print(k)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
