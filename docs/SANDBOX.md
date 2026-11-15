# Orivoxx — Sandbox

The sandbox is the only place Orivoxx executes an agent. Everything else — scoring, the leaderboard, the web app — treats the produced repository as text.

Status: **shipped** in `packages/harness` (P4). It runs real agent runs on the organizer machine, in Docker.

## 1. Why a sandbox at all

Orivoxx benchmarks an agent configuration, so the agent has to actually run: write files, install nothing, call a model, and stop. That is untrusted execution. Two rules follow.

1. Only `packages/harness` may execute an agent process, and only through `DockerExecutor`. There is no `child_process` call on produced files anywhere else in the platform.
2. The scoring engine never receives an execution handle. It receives normalized text files and parses them statically.

## 2. Components

| File | Responsibility |
|---|---|
| `src/sandbox/docker.ts` | `DockerExecutor`: image preflight, workspace ownership, network setup, proxy lifecycle, container run, timeout kill, cleanup. |
| `src/sandbox/proxy.ts` | Allowlisted model proxy. Listens on `:8080` inside the sandbox network and forwards only `/v1/*` to the configured provider. |
| `src/sandbox/proxy-server.ts` | Entry point that runs the proxy as a sidecar container. |
| `docker/sandbox.Dockerfile` | Agent image: Node 24, Python 3, git, non-root uid 10001. |
| `scripts/build-sandbox.mjs` | Builds the image. |

The proxy is compiled into `dist/sandbox/` with a `{"type":"module"}` marker so the sidecar can run the ESM build directly from a read-only mount.

## 3. Container profile

Both the agent container and the proxy sidecar run with:

| Setting | Agent | Proxy | Effect |
|---|---|---|---|
| `--user 10001:10001` | yes | yes | Non-root. The image has no writable home; `HOME=/tmp`. |
| `--read-only` | yes | yes | The root filesystem cannot be modified. |
| `--tmpfs /tmp` | `32m`, `noexec`, `nosuid` | `8m` | Scratch space only, never executable. |
| `--cap-drop ALL` | yes | yes | No Linux capabilities. |
| `--security-opt no-new-privileges` | yes | yes | Setuid binaries cannot gain privilege. |
| `--pids-limit` | 128 | 64 | Fork-bomb ceiling. |
| `--memory` / `--memory-swap` | 512 MB | 256 MB | No swap beyond the limit. |
| `--cpus` | 1 | — | CPU ceiling. |
| `--ulimit nofile=256:256` | yes | — | File-descriptor ceiling. |
| `--shm-size 64m` | yes | — | Bounded `/dev/shm`. |
| volumes | `workspace:/workspace:rw` | proxy build:`/app:ro` | The only host mount is the run workspace. |

The image contains no platform secrets, no Docker socket, and no host filesystem mount beyond the workspace. Docker's default bridge is not used for agent containers.

## 4. Network topology

```text
           ┌──────────────────────────────┐
           │  orivoxx-sandbox (internal)  │
           │                              │
  ┌────────┴────────┐          ┌──────────┴─────────┐
  │  agent container│  ──────► │  proxy sidecar     │
  │  network: none  │  :8080   │  alias model-proxy │
  └─────────────────┘          └──────────┬─────────┘
                                          │ orivoxx-egress
                                          ▼
                                  MODEL_BASE_URL (provider)
```

- The agent container joins **only** the internal `orivoxx-sandbox` network. It has no route to the internet. In the integration test, a raw fetch to `1.1.1.1` and a direct fetch to a sibling provider container both fail.
- The proxy sidecar joins the internal network **and** `orivoxx-egress`. It is the only container with egress.
- The proxy maps container `/v1/<suffix>` to `${MODEL_BASE_URL}/<suffix>`, so a harness that expects the standard OpenAI base URL works unchanged:

  ```text
  MODEL_PROXY_URL=http://model-proxy:8080/v1
  MODEL_BASE_URL=https://openrouter.ai/api/v1
  container /v1/chat/completions  ->  https://openrouter.ai/api/v1/chat/completions
  ```

- The proxy strips every inbound credential and injects `Authorization: Bearer <provider key>` host-side. The agent may only hold the literal sentinel `orivoxx-sandbox-proxy` in `OPENAI_API_KEY` / `AIDER_OPENAI_API_KEY`; `AgentCommandSchema` rejects anything else. The real key never enters the agent container.

### Proxy request policy

| Rule | Behavior |
|---|---|
| Path allowlist | Only `/v1` and `/v1/*`. `/healthz` answers the readiness probe. Everything else is `404 not_allowed`. |
| Traversal | `..`, `\`, NUL, and percent-encoded `%2e`/`%2f`/`%5c` are rejected before the URL is built. |
| Methods | `GET` and `POST` only; others are `405`. |
| Headers | Only `content-type` and `accept` are forwarded. Cookies, `x-forwarded-*`, `x-api-key`, and client `host` are dropped. |
| Request budget | 1 MiB, enforced on declared length and on the streamed body (chunked uploads included) → `413`. |
| Response budget | 2 MiB → `502 response_too_large`. |
| Upstream timeout | 60 s → `504 upstream_timeout`. |
| Upstream failure | `502 upstream_error`, never a stack trace or the provider key. |
| Target origin | Pinned at startup; a request cannot change scheme, host, or port. |
| Caching | Every response is `cache-control: no-store`. |

`MODEL_BASE_URL` is validated at startup: http(s) only, no credentials, no query, no fragment.

## 5. Workspace lifecycle

```text
createRunWorkspace()              /tmp/orivoxx-run-XXXXXX, asserted empty
writeProjectFiles(startingFiles)  path-validated, O_EXCL, inside the workspace only
chown -R 10001:10001              container can write; capture still runs as the host user
docker run ... /workspace         agent runs with cwd=/workspace
container exits or is killed      workspace is captured by the host
captureWorkspace()                path validation, exclusion, redaction, size ceilings
removeRunWorkspace()              recursive delete, refuses anything not an orivoxx-run-* dir
```

The workspace is an **ephemeral host bind mount**, not a tmpfs. Docker's `--mount type=tmpfs,bind-propagation=rshared` is unreliable across Docker versions, and a tmpfs mount disappears with the container, which would make post-exit capture impossible. The deviation from the plan's "tmpfs workspace" wording is recorded in `BUILD_LOG.md`; isolation is preserved because the mount is a fresh `mkdtemp` directory, chowned to 10001, deleted after the run, and never outside `/tmp/orivoxx-run-*`.

The container filesystem itself is still read-only with a bounded tmpfs `/tmp`, which is what the read-only invariant protects.

## 6. Timeouts and cleanup

`DockerExecutor.execute()`:

1. Validates the command against `AgentCommandSchema` (no shell, argv only, allowlisted env, no provider-shaped secrets).
2. Verifies the image exists, otherwise `sandbox_image_missing` with the build command.
3. Prepares the workspace.
4. Starts the proxy sidecar if `network: "model-proxy"`, waits for `/healthz`, and removes it on any failure.
5. Runs the container with a `spawn` + `Promise.race` timeout. On timeout the container is `docker rm -f`'d, then the exit promise is awaited so no zombie remains.
6. Bounds stdout and stderr to `maxOutputBytes` (max 8 MiB) while streaming, so a noisy agent cannot exhaust harness memory.
7. In `finally`, removes the proxy and the agent container.

Container names are `orivoxx-run-<timestamp>-<rand>` and `orivoxx-proxy-<timestamp>-<rand>`. The integration suite asserts that no `orivoxx-run-*` or `orivoxx-proxy-*` container survives a run.

## 7. What the sandbox does not do

- It does not install dependencies from the network. An adapter that needs packages must have them in the image, which is versioned.
- It does not expose the leaderboard, the database, or the web app.
- It does not score. Scoring happens after capture, on the host, from text only.
- It does not retry a timed-out or failed run into a passing one. Status is `timeout` / `failed` and the captured workspace still gets scored for evidence.

## 8. Operations

```bash
# Build the agent image (requires Docker)
pnpm --filter @orivoxx/harness build
pnpm --filter @orivoxx/harness sandbox:build

# Unit tests (no Docker)
pnpm --filter @orivoxx/harness test

# Docker integration tests (builds nothing; requires the image)
ORIVOXX_DOCKER_TESTS=1 pnpm --filter @orivoxx/harness test

# Inspect leftovers
docker ps -a --filter name=orivoxx-
docker network ls --filter name=orivoxx-
```

The image is tagged `orivoxx/sandbox:1.0.0`; override with `ORIVOXX_SANDBOX_IMAGE`. Networks `orivoxx-sandbox` (internal) and `orivoxx-egress` are created on demand and left in place for reuse.

## 9. Test evidence (P4)

`src/sandbox/proxy.test.ts` — 18 tests, no Docker:

- base-URL validation (scheme, credentials, query/fragment), empty key refusal
- `/healthz` answered without touching the provider
- `/v1` mapping including a provider base path and query string
- rejection of everything outside `/v1`, traversal (literal and encoded), and non-GET/POST methods
- authorization stripped and provider key injected; cookies/forwarded headers/host not forwarded
- declared and streamed request budgets, response budget
- refused upstream, upstream timeout, provider error passthrough, `no-store`

`src/sandbox/docker.integration.test.ts` — gated by `ORIVOXX_DOCKER_TESTS=1`:

- image exists, runs as uid 10001, carries no platform secrets, has no Docker socket
- full loop: agent writes the TaskBoard fixture inside Docker → capture → deterministic score > 95 with no cap
- time-limit kill returns `timedOut` with no exit code and no surviving container
- stdout is bounded to the requested byte budget
- PID quota produces `EAGAIN`
- writes to `/etc/passwd`, `/escape-root.txt`, and `/workspace/../escape.txt` fail with `EROFS`/`EACCES`/`EPERM`; nothing appears on the host outside the workspace
- the container sees uid 10001, `cwd=/workspace`, the proxy sentinel, and none of the host secrets
- with `network: "model-proxy"`: health is 200, the proxied call reaches a sibling provider container with the provider key injected, and direct provider access plus raw internet access are both blocked
- a missing proxy key fails closed before any container starts
- a non-harness workspace is rejected
- no sandbox containers are left behind
