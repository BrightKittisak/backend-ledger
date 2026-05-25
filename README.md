# Backend Ledger

A portfolio-ready backend ledger project built with Node.js, Express, and MongoDB.

## Current milestone

This repo is currently on **Slice 4** of the V1 roadmap:

- foundation and shared architecture
- auth/session lifecycle
- primary account creation on registration
- account summary endpoints
- account lookup by account number
- idempotent transfer flow
- system-only deposit flow
- owner-only withdraw flow
- account-scoped transaction history
- transaction detail by public transaction id
- bootstrap and demo seed scripts
- health and readiness checks
- lint, test, CI, and initial Swagger support

This repository now contains the full planned V1 vertical slices:

- Slice 1: foundation, auth/session, bootstrap, readiness
- Slice 2: account lookup + transfer
- Slice 3: deposit + withdraw
- Slice 4: transaction history + transaction detail

## Stack

- Node.js + Express
- MongoDB + Mongoose
- Zod validation
- Pino structured logging
- Jest + Supertest + `mongodb-memory-server`

## Quick start

### Option A: local Node + local Mongo

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

6. Open Swagger UI:

- [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

### Option B: Docker Compose demo

This is the fastest way to let someone else run the project without installing Node.js or MongoDB locally.

```bash
docker compose up --build
```

What this does:

- starts MongoDB in a container
- starts the API in a container
- runs `bootstrap` automatically
- runs `seed:demo` automatically
- exposes the API on `http://localhost:3000`

Swagger UI:

- [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

To stop:

```bash
docker compose down
```

To remove the demo database volume too:

```bash
docker compose down -v
```

## Demo credentials

System user:

- email: `system.demo@backend-ledger.local`
- password: `SystemPass123`

Demo users:

- `alice.demo@backend-ledger.local` / `DemoPass123`
- `bob.demo@backend-ledger.local` / `DemoPass123`
- `charlie.demo@backend-ledger.local` / `DemoPass123`

## Swagger Walkthrough

This project is easiest to demo from Swagger UI.

Open:

- [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

Then walk through the flow in this order:

1. `POST /api/v1/auth/login`
Use `alice.demo@backend-ledger.local` / `DemoPass123`

2. Copy the returned `accessToken`
Click the `Authorize` button in Swagger UI and paste:

```text
Bearer <accessToken>
```

3. `GET /api/v1/auth/me`
Confirm the current user and primary account summary

4. `GET /api/v1/accounts/me`
Confirm Alice's current balance and account number

5. `GET /api/v1/accounts/lookup?accountNumber=...`
Use Bob's account number to verify recipient lookup before transfer

6. `POST /api/v1/transfers`
Example body:

```json
{
  "toAccountNumber": "BOB_ACCOUNT_NUMBER",
  "amountMinor": 1200,
  "metadata": {
    "note": "Lunch share"
  }
}
```

Headers:

```text
Idempotency-Key: demo-transfer-1
```

7. `POST /api/v1/withdrawals`
Example body:

```json
{
  "amountMinor": 700,
  "metadata": {
    "bankName": "KBank",
    "bankAccountName": "Alice Demo",
    "bankAccountNumber": "1234567890",
    "note": "Cash out"
  }
}
```

Headers:

```text
Idempotency-Key: demo-withdraw-1
```

8. `GET /api/v1/accounts/{publicAccountId}/transactions`
View Alice's history with pagination, type filters, and date filters

9. `GET /api/v1/transactions/{publicTransactionId}`
Open one transaction in detail view from Alice's perspective

## SYSTEM Deposit Walkthrough

To demonstrate `deposit`, log in as the system user:

- `system.demo@backend-ledger.local` / `SystemPass123`

Then call `POST /api/v1/deposits`

Example body:

```json
{
  "toAccountNumber": "ALICE_ACCOUNT_NUMBER",
  "amountMinor": 5000,
  "metadata": {
    "reason": "Initial funding"
  }
}
```

Headers:

```text
Idempotency-Key: demo-deposit-1
```

This is useful for funding a demo account before testing transfer and withdrawal flows.

## Available endpoints in Slice 4

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
- `GET /api/v1/accounts/:publicAccountId/transactions`
- `GET /api/v1/accounts/lookup?accountNumber=...`
- `POST /api/v1/deposits`
- `POST /api/v1/transfers`
- `GET /api/v1/transactions/:publicTransactionId`
- `POST /api/v1/withdrawals`

Swagger UI is available at `/api-docs`.

## Docker notes

- The Compose setup uses `mongodb://mongo:27017/backend-ledger` inside the container network.
- The API container runs `bootstrap` and `seed:demo` on startup, so the demo credentials are always ready.
- If you prefer Atlas in local development, keep using your local `.env`; Docker Compose is intentionally self-contained for easier demos.

## Deployment note

For simple portfolio hosting:

- run MongoDB separately (Atlas or managed MongoDB)
- provide the app with a production `MONGO_URI`
- set strong production values for:
  - `ACCESS_TOKEN_SECRET`
  - `REFRESH_TOKEN_SECRET`
  - `SYSTEM_USER_PASSWORD`
- keep `NODE_ENV=production`
- make sure CORS and cookie `secure` settings match your deployed frontend/API domains
- run `npm run bootstrap` once before first traffic

## Architecture notes

- Public API lives under `/api/v1`.
- Shared cross-cutting code lives under `src/shared`.
- Business features live under `src/features`.
- User registration is atomic: user, primary account, and refresh session are created in one MongoDB transaction.
- Transfers are idempotent per user through the `Idempotency-Key` header.
- Deposits and withdrawals use the same idempotency contract as transfers.
- Transfer recipient confirmation happens through account lookup before submit, but the transfer endpoint still re-validates all business rules.
- Deposits are restricted to the `SYSTEM` role and can fund inactive user accounts for internal/demo use cases.
- Withdrawals debit the authenticated user's primary account and credit the internal system account.
- Transaction history is account-scoped, paginated, newest-first, and supports date/type filters.
- Transaction detail is returned from the current viewer's perspective and hidden with `404` if the user is unrelated to the transaction.
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
