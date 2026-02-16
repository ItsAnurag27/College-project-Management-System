# Unitify (MVP)

This repo scaffolds a **Spring Boot microservices** MVP with:

- API Gateway (Spring Cloud Gateway)
- Auth Service (register/login, JWT)
- Project Service (orgs/teams + projects)
- Task Service (tasks + comments + deadlines + status)
- Notification Service (in-app notifications)
- PostgreSQL (separate DB per service)
- React (Vite) + Tailwind frontend

## Quick start (local)

1) Create a local `.env` (optional):

```bash
copy .env.example .env
```

2) Start everything:

```bash
docker compose up --build
```

- Gateway: http://localhost:8090
- Frontend (if you run it separately): http://localhost:5173

If `5173` is busy, Vite will auto-pick another port.

## Root admin (read-only)

- Set `ROOT_ADMIN_KEY` in `.env` (copy from `.env.example`).
- Register the first root admin via the Register screen (root option + key).
- Root admin is read-only across services and can access the Analytics dashboard.

## Frontend dev

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

Frontend talks to the gateway at `http://localhost:8090` by default.

## Services & ports

- `gateway` (container) : 8080
- `gateway` (host) : 8090 (default)
- `auth-service` : 8081
- `project-service` : 8082
- `notification-service` : 8083
- `task-service` : 8084

## Notes

- MVP security is enforced at the gateway (JWT validation). Services trust `X-User-Id` forwarded by the gateway.
- Phase 2 (Kubernetes, RBAC, realtime, kanban/calendar) can be layered on this structure.
