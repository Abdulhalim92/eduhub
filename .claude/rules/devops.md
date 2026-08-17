---
description: Базовые правила DevOps (Docker/CI/наблюдаемость)
---

## Docker
- Multi-stage build для Go (distroless предпочтительно) и для Next.js (`next build` → standalone output).
- Никаких секретов в образе.

## CI/CD
- Пайплайн: lint → test → build → security scan → deploy
- `govulncheck` (Go) / `npm audit` (Next.js) обязателен

## Kubernetes
- **Пост-MVP, не реализовывать без явного запроса** (см. скоуп-правило CLAUDE.md — Docker для MVP, K8s по мере нагрузки).
- Когда актуально: liveness + readiness + startup probes, requests/limits, graceful shutdown (SIGTERM).

## Наблюдаемость
- Метрики: RED (rate/errors/duration), отслеживать API p95 ≤ 300мс (NFR)
- Трейсинг: OpenTelemetry где возможно
- Логи: structured (slog на Go-стороне), request_id, без PII
