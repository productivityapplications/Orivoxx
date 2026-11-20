#!/usr/bin/env python3
"""Aider baseline for real repository tasks: edits existing source files in place."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

WORKSPACE = Path(os.environ.get("ORIVOXX_WORKSPACE", "/workspace")).resolve()
PROXY_URL = os.environ.get("MODEL_PROXY_URL", "http://model-proxy:8080/v1").rstrip("/")
MODEL = os.environ.get("MODEL_NAME", "")
ISSUE = WORKSPACE / ".orivoxx" / "issue.md"
MAX_FILES = 12
SUFFIXES = {".js", ".mjs", ".cjs", ".ts", ".tsx", ".py"}


def main() -> int:
    if not MODEL:
        raise SystemExit("MODEL_NAME is not set")

    issue = ISSUE.read_text(encoding="utf-8", errors="replace")[:8_000] if ISSUE.is_file() else "Fix the repository issue."
    files = []
    for path in sorted(WORKSPACE.rglob("*")):
        relative = path.relative_to(WORKSPACE)
        if any(part in {".git", "node_modules", ".orivoxx"} for part in relative.parts):
            continue
        if path.is_file() and path.suffix in SUFFIXES and path.stat().st_size < 100_000:
            files.append(str(relative))
        if len(files) >= MAX_FILES:
            break

    if not files:
        print("no editable files", file=sys.stderr)
        return 1

    command = [
        "aider",
        "--model",
        f"openai/{MODEL}",
        "--openai-api-base",
        PROXY_URL,
        "--openai-api-key",
        os.environ.get("AIDER_OPENAI_API_KEY", "orivoxx-sandbox-proxy"),
        "--yes-always",
        "--no-auto-commits",
        "--no-git",
        "--no-gitignore",
        "--analytics-disable",
        "--no-check-update",
        "--no-show-model-warnings",
        "--no-stream",
        "--no-pretty",
        "--no-suggest-shell-commands",
        "--edit-format",
        "whole",
        "--map-tokens",
        "0",
        "--message",
        "Fix this repository issue with the smallest correct edit. Do not install packages or run commands.\n\n" + issue,
        *files,
    ]
    completed = subprocess.run(
        command,
        cwd=str(WORKSPACE),
        env={key: value for key, value in os.environ.items() if key in {"PATH", "HOME", "TMPDIR", "MODEL_NAME", "MODEL_PROXY_URL", "AIDER_OPENAI_API_KEY", "PYTHONUNBUFFERED"}},
        stdin=subprocess.DEVNULL,
        timeout=780,
    )
    print(f"aider exit {completed.returncode}")
    return completed.returncode


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:  # noqa: BLE001
        print(f"agent error: {error}", file=sys.stderr)
        sys.exit(1)
