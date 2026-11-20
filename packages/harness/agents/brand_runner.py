#!/usr/bin/env python3
"""Runs a brand-name headless agent inside the Orivoxx sandbox and emits trace events."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

WORKSPACE = Path(os.environ.get("ORIVOXX_WORKSPACE", "/workspace")).resolve()
TRACE_FILE = Path(os.environ.get("ORIVOXX_TRACE_FILE", f"{WORKSPACE}/.orivoxx/trace.jsonl"))
ACTION_FILE = Path(os.environ.get("ORIVOXX_ACTION_FILE", f"{WORKSPACE}/.orivoxx/actions.jsonl"))
ISSUE_PATH = Path(os.environ.get("ISSUE_PATH", f"{WORKSPACE}/.orivoxx/issue.md"))
AGENT = os.environ.get("BRAND_AGENT", "claude")
MODEL = os.environ.get("MODEL_NAME", "")
PROXY = os.environ.get("MODEL_PROXY_URL", "http://model-proxy:8080/v1").rstrip("/")
MAX_STEPS = max(1, min(int(os.environ.get("MAX_STEPS", "40")), 120))


def now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()) + ".000Z"


def emit(event: dict) -> None:
    try:
        TRACE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with TRACE_FILE.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(event, separators=(",", ":")) + "\n")
    except OSError:
        pass


def issue_text() -> str:
    if ISSUE_PATH.is_file():
        body = ISSUE_PATH.read_text(encoding="utf-8", errors="replace")[:8_000]
    else:
        spec = WORKSPACE / "PROJECT_SPEC.md"
        body = spec.read_text(encoding="utf-8", errors="replace")[:8_000] if spec.is_file() else "Implement the requested change in the repository."
    return (
        "The repository is already checked out in /workspace at the base commit. "
        "Do not clone it, do not install dependencies, and do not run network commands. "
        "Make the smallest source change that satisfies the issue, then stop.\n\n"
        + body
    )


def sanitize(value: str, limit: int = 240) -> str:
    return re.sub(r"\s+", " ", value).strip()[:limit]


def tool_event(step: int, name: str, args: str, status: str, detail: str, error: str | None = None) -> None:
    emit(
        {
            "type": "tool_call_started",
            "at": now(),
            "stepIndex": step,
            "toolName": name,
            "argsRedacted": sanitize(args),
            "redacted": True,
        }
    )
    emit(
        {
            "type": "tool_call_finished",
            "at": now(),
            "stepIndex": step,
            "toolName": name,
            "durationMs": 0,
            "status": status,
            "resultRedacted": sanitize(detail),
            "errorClass": error,
            "redacted": True,
        }
    )
    emit({"type": "step_completed", "at": now(), "stepIndex": step, "durationMs": 0})


def stream_events(process: subprocess.Popen[str], parser) -> None:
    step = 0
    assert process.stdout is not None
    for line in process.stdout:
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        step = parser(event, step + 1)
    process.wait()


def parse_claude(event: dict, step: int) -> int:
    message = event.get("message") if isinstance(event, dict) else None
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, list):
        return step

    used = False
    for block in content:
        if not isinstance(block, dict):
            continue
        if block.get("type") == "tool_use":
            tool_event(
                step,
                str(block.get("name", "tool"))[:64],
                json.dumps(block.get("input", {}))[:240],
                "ok",
                "tool_use recorded",
            )
            used = True
    return step + 1 if used else step


def parse_codex(event: dict, step: int) -> int:
    item = event.get("item") if isinstance(event, dict) else None
    if not isinstance(item, dict):
        return step
    item_type = item.get("type")
    if item_type in {"command_execution", "file_change", "mcp_tool_call"}:
        outer = str(event.get("type", ""))
        status = "error" if outer == "item.failed" else "ok"
        detail = item.get("command") or item.get("path") or item.get("changes") or item_type
        tool_event(
            step,
            str(item_type),
            json.dumps(detail)[:240],
            status,
            f"event={outer or 'item'}",
        )
        return step + 1
    return step


def snapshot() -> dict[str, str]:
    files: dict[str, str] = {}
    for path in WORKSPACE.rglob("*"):
        if not path.is_file() or ".orivoxx" in path.parts or ".git" in path.parts:
            continue
        if path.stat().st_size > 307_200:
            continue
        try:
            files[path.relative_to(WORKSPACE).as_posix()] = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
    return files


def main() -> int:
    if not MODEL:
        raise SystemExit("MODEL_NAME is not set")

    prompt = issue_text()
    before = snapshot()

    if AGENT == "claude":
        command = [
            "claude",
            "-p",
            prompt,
            "--dangerously-skip-permissions",
            "--output-format",
            "stream-json",
            "--verbose",
            "--max-turns",
            "40",
            "--model",
            MODEL,
        ]
        parser = parse_claude
    elif AGENT == "codex":
        home = Path(os.environ.get("CODEX_HOME", "/tmp/.codex"))
        home.mkdir(parents=True, exist_ok=True)
        (home / "config.toml").write_text(
            "\n".join(
                [
                    f'model = "{MODEL}"',
                    'model_provider = "openrouter"',
                    "",
                    "[model_providers.openrouter]",
                    'name = "OpenRouter"',
                    f'base_url = "{PROXY}"',
                    'env_key = "OPENAI_API_KEY"',
                    'wire_api = "responses"',
                    "",
                ]
            ),
            encoding="utf-8",
        )
        command = [
            "codex",
            "exec",
            "--json",
            "--skip-git-repo-check",
            "--dangerously-bypass-approvals-and-sandbox",
            prompt,
        ]
        parser = parse_codex
    elif AGENT == "copilot":
        command = [
            "copilot",
            "-p",
            prompt,
            "--allow-all-tools",
            "--allow-all-paths",
            "--model",
            MODEL,
        ]
        parser = parse_codex
    else:
        raise SystemExit(f"unsupported brand agent {AGENT}")

    process = subprocess.Popen(
        command,
        cwd=str(WORKSPACE),
        env=os.environ.copy(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
    )
    timed_out = False
    try:
        stdout, stderr = process.communicate(timeout=840)
    except subprocess.TimeoutExpired:
        timed_out = True
        process.kill()
        stdout, stderr = process.communicate()
    step = 1
    for line in stdout.splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        step = parser(event, step)
    if timed_out:
        print("agent hit its 300s wall clock; evaluating the workspace", file=sys.stderr)
    if process.returncode not in (0, None):
        print(stderr[-1_000:], file=sys.stderr)

    after = snapshot()
    changed = [path for path, content in after.items() if before.get(path) != content]
    for index, path in enumerate(changed[:MAX_STEPS], start=1):
        content = after[path]
        if len(content) > 307_200:
            continue
        try:
            with ACTION_FILE.open("a", encoding="utf-8") as handle:
                handle.write(
                    json.dumps(
                        {
                            "stepIndex": index,
                            "toolName": "write_file",
                            "path": path,
                            "content": content,
                        },
                        separators=(",", ":"),
                    )
                    + "\n"
                )
        except OSError:
            break

    print(f"{AGENT}: {process.returncode} · {len(changed)} files changed")
    return 0 if process.returncode == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
