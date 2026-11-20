FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    git \
    python3 \
    python3-pip \
    python3-venv \
    ripgrep \
  && rm -rf /var/lib/apt/lists/*

# Aider is pinned: a benchmark run must be reproducible from the image tag.
RUN python3 -m venv /opt/aider \
  && /opt/aider/bin/pip install --no-cache-dir --disable-pip-version-check aider-chat==0.86.2

# Brand CLIs are pinned. All model traffic goes through the allowlisted proxy.
RUN npm install -g --no-audit --no-fund \
    @anthropic-ai/claude-code@2.1.329 \
    @openai/codex@0.171.0

RUN groupadd --gid 10001 runner \
  && useradd --uid 10001 --gid 10001 --create-home --home-dir /home/runner --shell /usr/sbin/nologin runner

# Agent entry points are read-only inside the container. Only /workspace is
# writable, and only /tmp backs the scratch files Aider writes.
COPY agents /opt/orivoxx/agents

ENV HOME=/tmp \
    TMPDIR=/tmp \
    NODE_ENV=production \
    PYTHONUNBUFFERED=1 \
    PATH=/opt/aider/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

WORKDIR /workspace

USER 10001:10001

CMD ["/bin/sh"]
