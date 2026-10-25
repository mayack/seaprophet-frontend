# Notes for Claude

## Versioning

Every commit that changes what ships bumps the version in the same commit.
`main` deploys on push, so a version is a deploy. Each repo (frontend,
polvo, sargo) has its own version, bumped independently.

Where: `package.json` → `version`. It is the single source: `CONFIG.version` reads it, and it shows in the user menu ("Version x.y.z").

Semantic versioning, read for this project:

- **MAJOR**: breaks a contract something else depends on. That means
  removing or renaming an API endpoint or response field another repo reads,
  or a Sargo schema or data change that needs a migration. **Never bump MAJOR
  without asking the user first.**
- **MINOR**: something new a user or another repo can use. A new feature or
  setting, a new webcam provider or stream source, a new endpoint or an
  additive response field, or a noticeable change in behaviour.
- **PATCH**: everything else that ships. Bug fixes, performance work,
  internal refactors, copy tweaks, dev-mode tools, dependency updates.
- **No bump**: changes that ship nothing. Docs, comments, this file, scripts
  that never run in production, CI config, a lockfile on its own.

Rules of thumb:

- One bump per commit, at the highest level any part of the commit
  reaches. A commit with a fix and a feature is MINOR.
- Bumping MINOR resets PATCH to 0. Bumping MAJOR resets both.
- If a change spans repos, bump each repo that changed, each by its own
  level. For example, a new polvo endpoint is MINOR in polvo, and the
  frontend fix that uses it may be a PATCH.
- End the commit message with a line such as "Bump version to 1.3.0."
