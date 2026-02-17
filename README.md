# Unitify (MVP)

![Preview Image](https://github.com/ItsAnurag27/College-project-Management-System/demo)

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

## Email OTP (auth-service)

The auth service supports email-based OTP flows with:

- Expiration (default 10 minutes)
- Attempt limits (default 5 tries per code)
- Rate limiting (per email and per IP)

Endpoints (through the gateway):

- `POST /auth/otp/request` body: `{ "purpose": "VERIFY_EMAIL" | "LOGIN", "email": "user@site.com" }`
- `POST /auth/otp/verify` body: `{ "purpose": "VERIFY_EMAIL" | "LOGIN", "email": "user@site.com", "code": "123456" }`

SMTP config:

- Set `MAIL_HOST` (and optionally `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM`) in `.env`.
- If `MAIL_HOST` is empty, OTP codes are printed in the auth-service logs (dev fallback).

## Deploy to EC2 (GitHub Actions)

This repo includes a GitHub Actions workflow that builds/pushes Docker images to GHCR and then deploys to an EC2 host over SSH.

- Workflow: .github/workflows/deploy-ec2.yml
- Compose file on server: docker-compose.ec2.yml (pulled into `/opt/unitify` by default)

Required GitHub repo secrets:

- `EC2_HOST`: public IP or DNS of the instance
- `EC2_USER`: e.g. `ubuntu`
- `EC2_SSH_KEY`: private key (PEM) for SSH

Optional secrets:

- `EC2_PORT`: SSH port (default `22`)
- `EC2_APP_DIR`: remote deploy directory (default `/opt/unitify`)
- `GHCR_USERNAME` / `GHCR_TOKEN`: needed if the EC2 machine must `docker login` to pull from a private GHCR repo

Server prerequisites (EC2):

- Docker + Docker Compose installed
- Security Group allows inbound `GATEWAY_PORT` (default `8090`)

After the first deploy, edit `/opt/unitify/.env` on the server to set real values (JWT secret, postgres password, etc.).
