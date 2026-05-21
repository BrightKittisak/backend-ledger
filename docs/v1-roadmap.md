# Backend Ledger V1 Roadmap

## Delivery Strategy

Build V1 as vertical slices. Each slice should end in a runnable, testable state.

Every slice should include:

- implementation
- tests
- linting/formatting compliance
- CI coverage updates
- Swagger updates where relevant
- README updates where relevant

## Slice 1: Foundation, Auth, Accounts, Bootstrap

Goal:

- establish the base architecture and a stable developer workflow

Scope:

- feature/domain folder structure
- shared layer for config, logger, middleware, errors, validation, and HTTP helpers
- fail-fast config validation
- structured logging with request id
- global error handling
- response envelope helpers
- auth/session model
- register
- login
- refresh
- logout
- `GET /api/v1/auth/me`
- `PATCH /api/v1/auth/password`
- user model with role/status/public id
- session collection
- primary account creation during registration
- `GET /api/v1/accounts/me`
- `GET /api/v1/accounts/:publicAccountId`
- `/health`
- `/ready`
- bootstrap workflow
- demo seed workflow
- CI baseline
- initial Swagger
- initial README

Exit criteria:

- app starts cleanly
- system user/system account bootstrap is idempotent
- demo seed is idempotent
- auth/session flow works end to end
- account summary works end to end
- tests run in CI

## Slice 2: Account Lookup and Transfer

Goal:

- deliver the first real money movement flow plus recipient confirmation

Scope:

- account number generation and validation
- Luhn support
- `GET /api/v1/accounts/lookup`
- transfer request validation
- transfer service
- idempotency collection and middleware/service support
- request hashing
- stale `PROCESSING` timeout handling
- transfer transaction + ledger posting
- atomic debit using `availableBalanceMinor`
- replay semantics
- transfer email notification
- Swagger and README updates

Exit criteria:

- transfer works end to end
- lookup works with masked recipient display
- self-transfer is blocked
- inactive destination handling works
- idempotency replay and conflict behavior is covered by tests
- concurrent transfer overspend tests pass

## Slice 3: Deposit and Withdraw

Goal:

- complete the core money movement set

Scope:

- `POST /api/v1/deposits`
- `POST /api/v1/withdrawals`
- `SYSTEM`-only deposit authorization
- withdraw destination bank metadata validation
- system account rules
- deposit and withdraw ledger posting
- masked withdraw metadata in responses
- email success notifications
- Swagger and README updates

Exit criteria:

- deposit works for `SYSTEM` role only
- withdraw works for account owner only
- user account negative balances remain impossible
- system account negative balance is allowed
- tests cover ownership, role checks, and insufficient funds

## Slice 4: Transaction History and Detail

Goal:

- complete the user-facing read side of the ledger product

Scope:

- `GET /api/v1/accounts/:publicAccountId/transactions`
- `GET /api/v1/transactions/:publicTransactionId`
- pagination
- type filtering
- date range filtering
- newest-first ordering
- transaction projection/view mappers
- `balanceAfterMinor` in history
- detail response with `initiatedBy.role`
- masked metadata display rules
- Swagger and README updates

Exit criteria:

- account history works with pagination and filters
- transaction detail works from user perspective
- non-owned transaction access returns `404`
- read models are consistent across transfer, deposit, and withdraw

## Hardening Tasks Across Slices

- keep CommonJS for V1
- keep Mongoose models directly in services, no repository layer yet
- maintain English repo docs for portfolio readability
- keep email optional at runtime
- keep public API limited to V1 product surface
- keep internal/manual operations outside Swagger

## Definition of Done for V1

V1 is done when all four slices are complete and the repo has:

- code that runs locally
- Docker Compose support
- idempotent bootstrap and seed flows
- test suite with Mongo replica set support
- CI running tests and lint
- Swagger for public V1 APIs
- README with setup, architecture overview, API overview, and demo flows
