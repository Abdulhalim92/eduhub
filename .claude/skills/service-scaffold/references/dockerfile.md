# Production-grade Dockerfile

```dockerfile
# syntax=docker/dockerfile:1.7
FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS builder

WORKDIR /build

# Зависимости (кешируется отдельно от кода)
COPY go.mod go.sum ./
RUN go mod download

COPY . .

ARG VERSION=dev
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build \
    -trimpath \
    -ldflags="-s -w -X main.version=${VERSION}" \
    -o /bin/service \
    ./cmd/{{SERVICE}}

# Финальный образ: distroless nonroot
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /bin/service /service

# Не root (uid 65532 — distroless nonroot)
USER nonroot:nonroot

EXPOSE 8080

ENTRYPOINT ["/service"]
```

## .dockerignore

```
.git
.github
.env*
bin/
*.md
docs/
deploy/
coverage.*
**/*_test.go
```

## k8s Deployment (фрагмент, только если решим деплоить в k8s)

```yaml
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 30
      containers:
        - name: {{SERVICE}}
          image: {{SERVICE}}:latest
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /readyz
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
          startupProbe:
            httpGet:
              path: /healthz
              port: 8080
            failureThreshold: 30
            periodSeconds: 2
```
