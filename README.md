# Backend Ledger

A portfolio-ready backend ledger project built with Node.js, Express, and MongoDB.

## Current milestone

This repo is currently on **Slice 2** of the V1 roadmap:

- foundation and shared architecture
- auth/session lifecycle
- primary account creation on registration
- account summary endpoints
- account lookup by account number
- idempotent transfer flow
- bootstrap and demo seed scripts
- health and readiness checks
- lint, test, CI, and initial Swagger support

## Stack

- Node.js + Express
- MongoDB + Mongoose
- Zod validation
- Pino structured logging
- Jest + Supertest + `mongodb-memory-server`

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Create your env file from [.env.example](C:/Users/kitti/Documents/Learning/Backend/backend-ledger/.env.example).

3. Bootstrap the system user and system account:

```bash
npm run bootstrap
```

4. Seed demo users:

```bash
npm run seed:demo
```

5. Start the API:

```bash
npm run dev
```

## Demo credentials

System user:

- email: `system.demo@backend-ledger.local`
- password: `SystemPass123`

Demo users:

- `alice.demo@backend-ledger.local` / `DemoPass123`
- `bob.demo@backend-ledger.local` / `DemoPass123`
- `charlie.demo@backend-ledger.local` / `DemoPass123`

## Available endpoints in Slice 1

- `GET /health`
- `GET /ready`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `PATCH /api/v1/auth/password`
- `GET /api/v1/accounts/me`
- `GET /api/v1/accounts/:publicAccountId`
- `GET /api/v1/accounts/lookup?accountNumber=...`
- `POST /api/v1/transfers`

Swagger UI is available at `/api-docs`.

## Architecture notes

- Public API lives under `/api/v1`.
- Shared cross-cutting code lives under `src/shared`.
- Business features live under `src/features`.
- User registration is atomic: user, primary account, and refresh session are created in one MongoDB transaction.
- Transfers are idempotent per user through the `Idempotency-Key` header.
- Transfer recipient confirmation happens through account lookup before submit, but the transfer endpoint still re-validates all business rules.
- User balances are protected with atomic debit against `availableBalanceMinor`, while ledger entries remain the read-side source of truth.
- Access tokens are short-lived bearer tokens.
- Refresh tokens are stored as hashed session records and delivered in `httpOnly` cookies.
- Email is optional at runtime; if email config is incomplete, the app still runs and `/ready` reports email as disabled.

## Quality commands

```bash
npm run lint
npm test
```

## References

- Product spec: [docs/v1-spec.md](C:/Users/kitti/Documents/Learning/Backend/backend-ledger/docs/v1-spec.md)
- Delivery roadmap: [docs/v1-roadmap.md](C:/Users/kitti/Documents/Learning/Backend/backend-ledger/docs/v1-roadmap.md)
