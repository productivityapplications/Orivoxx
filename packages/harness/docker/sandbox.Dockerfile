FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    git \
    python3 \
    python3-pip \
    python3-venv \
  && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 10001 runner \
  && useradd --uid 10001 --gid 10001 --create-home --home-dir /home/runner --shell /usr/sbin/nologin runner

ENV HOME=/tmp \
    TMPDIR=/tmp \
    NODE_ENV=production \
    PYTHONUNBUFFERED=1

WORKDIR /workspace

USER 10001:10001

CMD ["/bin/sh"]
