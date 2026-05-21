# Backend Ledger V1 Specification

## Goal

Build a portfolio-ready ledger backend that prioritizes correctness over breadth.
The system should demonstrate:

- atomic money movement
- idempotent write endpoints
- session-based auth with short-lived access tokens
- ledger-backed auditability
- practical operational safety

## Product Scope

V1 supports:

- user registration
- login, refresh, logout, change password
- one primary account per user
- account lookup by account number
- deposit by `SYSTEM` role only
- withdraw by account owner
- transfer by account owner
- transaction history and transaction detail
- bootstrap and demo seed workflows

V1 does not support:

- multi-account per user
- public account creation
- cross-currency transfers
- public freeze/close/suspend APIs
- password reset / forgot password
- fees
- reversal execution
- public ledger endpoints

## Core Product Decisions

- This is a portfolio-ready backend, not a production-complete banking system.
- V1 uses one system currency configured via environment.
- Currency uses ISO 4217 codes.
- Amounts are always stored and exchanged as integer minor units.
- `amountMinor` must be a positive integer greater than zero.
- One user has exactly one primary account in V1.
- Primary account is created automatically during registration.
- Registration is atomic: create user, create primary account, create session.
- User-facing account identity is `accountNumber` for transfer and lookup.
- Public API resource identity is ULID-based `publicUserId`, `publicAccountId`, and `publicTransactionId`.
- `accountNumber` is a 10-digit immutable numeric identifier with a Luhn check digit.

## Ledger and Balance Model

- Ledger is the source of truth for financial history and read-side balance calculation.
- Each successful transaction creates exactly two ledger entries:
  - one `DEBIT`
  - one `CREDIT`
- For V1, both ledger amounts are equal.
- Transactions that fail must roll back completely.
- Only successful financial events are stored in the `transactions` collection.
- `transactions` has no `status` field in V1.
- `balanceAfterMinor` is snapshotted onto each successful transaction.
- `availableBalanceMinor` exists on accounts only for atomic debit / concurrency control.
- Read endpoints use ledger-derived balances.
- Write endpoints must stop if `availableBalanceMinor` and ledger-derived balance do not match.
- Read endpoints may still answer using ledger-derived balance and must log a critical incident on mismatch.
- A maintenance script will reconcile `availableBalanceMinor` from ledger when needed.

## Account Rules

- Account statuses: `ACTIVE`, `FROZEN`, `CLOSED`
- User accounts must never go negative.
- System account may go negative.
- `FROZEN` and `CLOSED` accounts cannot withdraw or transfer.
- `FROZEN` and `CLOSED` accounts may still receive system deposits.
- Closing an account is internal/manual only in V1.
- Freeze is internal/manual only in V1.
- Public account creation endpoint is removed in V1.

## Transaction Types

Transaction types:

- `DEPOSIT`
- `WITHDRAW`
- `TRANSFER`

Rules:

- `DEPOSIT` is modeled as `system account -> user account`
- `WITHDRAW` is modeled as `user account -> system account`
- `TRANSFER` is modeled as `user account -> other account`
- self-transfer is not allowed
- transfer and withdraw derive source account from the authenticated user's primary account
- transfer target is identified by `toAccountNumber`
- deposit target is identified by `toAccountNumber`
- withdraw requires destination bank metadata

Metadata rules:

- `deposit.metadata.reason` is required
- `transfer.metadata.note` is optional
- `withdraw.metadata.bankName` is required
- `withdraw.metadata.bankAccountName` is required
- `withdraw.metadata.bankAccountNumber` is required

Metadata display rules:

- transaction detail exposes metadata by type
- sensitive withdraw metadata is masked in API responses
- full sensitive values may be stored internally when needed for audit

## Account Lookup

Lookup endpoint:

- `GET /api/v1/accounts/lookup?accountNumber=...`

Lookup behavior:

- authenticated only
- strict rate limit
- exact-match only
- invalid format returns `422`
- missing but well-formed account returns `200`
- lookup is for product confirmation, not resource discovery
- system account must not be discoverable through user lookup

Lookup response includes:

- `accountNumber`
- `maskedAccountName`
- `isOwnAccount`
- `canTransfer`
- `reason.code`
- `reason.message`

Example reason codes:

- `OK`
- `OWN_ACCOUNT`
- `ACCOUNT_NOT_ACTIVE`
- `NOT_FOUND`

If the account belongs to the caller:

- return `200`
- `isOwnAccount = true`
- `canTransfer = false`

## Auth and Session Model

Auth identity:

- login by email only
- user has `role` and `status`
- roles: `USER`, `SYSTEM`
- statuses: `ACTIVE`, `SUSPENDED`

Suspended user behavior:

- cannot login
- cannot refresh
- cannot use protected endpoints
- all active sessions are revoked when suspension happens
- suspension management is internal/manual only in V1

Token model:

- access token: 15 minutes
- refresh token: 7 days
- access token is returned in response body only
- refresh token is stored in an `httpOnly` cookie
- refresh cookie path: `/api/v1/auth`
- refresh cookie `SameSite=Strict`
- refresh cookie `secure=true` in production and `false` in local development
- refresh sessions are stored in a separate collection
- refresh token hashes are stored, never raw tokens
- login creates a new session and revokes the previous one in V1
- refresh token rotation happens on every refresh
- refresh token reuse revokes the user's session set
- logout revokes the refresh session and lets the access token expire naturally

CSRF model:

- cookie-backed auth endpoints require `X-CSRF-Token`
- CSRF token is returned in `register`, `login`, and `refresh` responses

Session collection fields:

- `userId`
- `refreshTokenHash`
- `expiresAt`
- `rotatedAt`
- `revokedAt`
- `createdAt`
- `updatedAt`

## Idempotency Model

All money write endpoints require:

- `Idempotency-Key` header

Rules:

- key is unique per `userId`
- TTL is 24 hours
- after TTL expires, the same key may be reused as a new request
- request payload is normalized and hashed
- same key with different payload returns `409`
- same key after success returns `200` replay with the original result
- missing key returns `422`
- stale `PROCESSING` lock expires after 60 seconds
- stale lock may be taken over atomically using the same key

Idempotency collection fields:

- `userId`
- `key`
- `requestHash`
- `status`
- `transactionId`
- `attemptCount`
- `lastAttemptAt`
- `expiresAt`
- `error.code`
- `error.message`
- `error.lastFailedAt`

Idempotency statuses:

- `PROCESSING`
- `COMPLETED`
- `FAILED`

If a request fails and the client wants to retry:

- client must send a new key
- except for stale lock takeover of the same in-flight request

## API Design

Base path:

- `/api/v1`

Public auth endpoints:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `PATCH /api/v1/auth/password`

Public account endpoints:

- `GET /api/v1/accounts/me`
- `GET /api/v1/accounts/:publicAccountId`
- `GET /api/v1/accounts/lookup?accountNumber=...`
- `GET /api/v1/accounts/:publicAccountId/transactions`

Public money endpoints:

- `POST /api/v1/deposits`
- `POST /api/v1/withdrawals`
- `POST /api/v1/transfers`

Public transaction endpoint:

- `GET /api/v1/transactions/:publicTransactionId`

Health endpoints:

- `GET /health`
- `GET /ready`

## Request and Response Contracts

Success envelope:

- `success`
- `data`
- `meta`

Rules:

- `data` is always present
- endpoints without a payload return `data: null`
- money endpoint replay state is returned in `meta.idempotency.replayed`

Error envelope:

- `success: false`
- `error.code`
- `error.message`
- `error.details`
- `requestId`

Headers:

- response always includes `X-Request-Id`

Status code rules:

- use semantically correct HTTP statuses
- `422` for validation / contract errors
- `403` for forbidden actions
- `404` when a resource should be hidden or treated as not found
- `409` for idempotency or state conflicts

Time and pagination:

- timestamps are returned in UTC
- date filters use ISO 8601
- history default sort is newest first
- history supports type filter and date range filter
- history uses `page` and `limit`
- default `limit = 20`
- maximum `limit = 100`
- pagination response includes:
  - `items`
  - `page`
  - `limit`
  - `totalItems`
  - `totalPages`

## Account and Transaction Read Models

`GET /api/v1/accounts/me` returns:

- primary account summary only

`GET /api/v1/accounts/:publicAccountId` returns:

- the same account summary shape as `/accounts/me`

`GET /api/v1/auth/me` returns:

- user profile
- primary account summary

Account summary includes:

- `publicAccountId`
- `accountNumber`
- `currency`
- `status`
- `currentBalanceMinor`

User profile includes:

- `publicUserId`
- `name`
- `email`
- `role`

Money write success returns:

- the same transaction detail shape as `GET /api/v1/transactions/:publicTransactionId`

Transaction history items include:

- `publicTransactionId`
- `type`
- `direction`
- `amountMinor`
- `currency`
- `counterparty`
- `balanceAfterMinor`
- `createdAt`
- type-specific summary fields as needed

Transaction detail includes:

- the business-facing transaction view
- `initiatedBy.role` only
- masked metadata where appropriate
- no raw ledger entries

History and detail are returned from the user's perspective using the primary account context in V1.

## Concurrency and Atomicity

- register flow is atomic
- all money writes run inside one MongoDB transaction/session
- account debit/credit changes, transaction creation, and ledger creation commit together
- overspend protection must use atomic debit against `availableBalanceMinor`
- concurrency tests must prove that parallel writes cannot create negative user balances

## Bootstrap, Seed, and Runtime

Bootstrap:

- idempotent
- provisions `SYSTEM` user and system account
- reads system credentials from environment/config
- application startup must validate that bootstrap data exists
- app should fail if required system bootstrap data is missing

Seed:

- separate from bootstrap
- idempotent
- creates 2-3 demo users with fixed credentials
- uses real business flows for demo funding
- may include fixed dev/demo credentials documented in README

Runtime config:

- validate with fail-fast startup checks
- email is optional
- if email config is missing, the app still runs
- `/ready` should report that email is disabled while the system remains ready
- CORS should allow only configured origins
- rate limits should be config-driven

## Email

V1 email behavior:

- welcome email on registration
- success email on deposit, withdraw, and transfer
- email is a post-commit side effect
- transaction success must not depend on email success
- if email sending fails, log it and continue

## Logging and Observability

- structured logging via Pino
- every request gets a request id
- if the client sends one, reuse it; otherwise generate one
- request id is logged and returned in `X-Request-Id`
- do not log full request/response bodies for money endpoints
- log only selected operational fields
- redact:
  - passwords
  - cookies
  - tokens
  - sensitive banking metadata

## Testing and Tooling

Required testing stack:

- Jest
- Supertest
- `mongodb-memory-server` replica set

Required coverage:

- unit tests for core business rules
- integration tests for auth/session flows
- integration tests for deposit, withdraw, transfer
- integration tests for idempotency replay and conflict
- integration tests for ownership rules
- integration tests for insufficient funds
- integration tests for concurrency / overspend prevention

Tooling expectations:

- ESLint
- Prettier
- CI from slice 1 onward
- OpenAPI spec stored separately and served via Swagger UI
- public V1 endpoints only in Swagger
- local run and Docker Compose both supported
