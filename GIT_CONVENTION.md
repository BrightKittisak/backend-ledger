# Git Convention

## Workflow

This repository uses a lightweight trunk-based workflow.

- `main` is the only long-lived branch.
- Every change starts from a short-lived branch created from `main`.
- `main` should remain runnable at all times.
- Merge back only when code, tests, and relevant docs are ready.

## Branch Naming

Use lowercase names and hyphen-separated words.

Pattern:

- `<type>/<short-description>`

Allowed branch types:

- `feat`
- `fix`
- `refactor`
- `test`
- `docs`
- `chore`

Examples:

- `feat/slice-1-foundation-auth`
- `feat/slice-2-lookup-transfer`
- `fix/refresh-session-revoke`
- `refactor/feature-folder-structure`
- `test/concurrency-transfer`
- `docs/readme-v1`
- `chore/add-eslint-prettier`

## Commit Messages

Use conventional-style commit messages:

- `<type>(<scope>): <summary>`

Allowed commit types:

- `feat`
- `fix`
- `refactor`
- `test`
- `docs`
- `chore`
- `ci`

Examples:

- `feat(auth): add register and login flow`
- `feat(accounts): add primary account summary endpoint`
- `feat(transfers): implement idempotent transfer flow`
- `fix(auth): revoke previous refresh session on login`
- `refactor(shared): add global error handler`
- `test(transfers): cover concurrent overspend scenario`
- `docs(spec): add v1 spec and roadmap`
- `chore(ci): run lint and tests on push`

Commit rules:

- One commit should represent one clear intent.
- Use present tense.
- Avoid vague messages such as `update code` or `fix stuff`.
- Split unrelated changes into separate commits.

## Pull Requests

Open a pull request for every feature branch before merging into `main`.

Recommended PR title format:

- `<type>(<scope>): <summary>`

Recommended PR description sections:

- `Summary`
- `Scope`
- `Testing`
- `Risks`
- `Follow-ups`

## Merge Policy

- Do not merge broken work into `main`.
- Prefer clean branch history.
- Use fast-forward merge when the branch history is already clean.
- Use squash merge when the branch contains many noisy intermediate commits.

For this project:

- large slice branches may use squash merge
- focused bugfix or docs branches may use fast-forward merge

## Release Tags

Use milestone tags to mark vertical slice completion.

Recommended tags:

- `v0.1.0-slice-1`
- `v0.2.0-slice-2`
- `v0.3.0-slice-3`
- `v0.4.0-slice-4`
- `v1.0.0`

## Protected Main Rules

If the repository is hosted remotely, protect `main` with these defaults:

- require pull requests before merge
- require CI to pass before merge
- prevent direct pushes to `main`

## Planned Slice Branches

The first milestone branches should follow the roadmap:

- `feat/slice-1-foundation-auth`
- `feat/slice-2-lookup-transfer`
- `feat/slice-3-deposit-withdraw`
- `feat/slice-4-history-detail`

## Baseline Initialization

Recommended initial commit order:

1. `chore: snapshot pre-v1 refactor baseline`
2. `docs(spec): add v1 spec and roadmap`
3. start `feat/slice-1-foundation-auth`
