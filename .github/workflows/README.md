# GitHub Actions Workflows

This project uses GitHub Actions for automated releases and npm publishing based on conventional commits.

## Automated Release and Publish

### Release and Publish (`release.yml`)

**Trigger**: Every push to the `main` branch

**Purpose**: Automatically determines version, creates release, and publishes to npm

**What it does**:
1. Analyzes commit messages to determine version bump
2. Updates package.json version (in memory only, no commit)
3. Creates a git tag
4. Creates a GitHub release with release notes
5. Publishes to npm

## Commit Message Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature → Minor version bump (1.0.0 → 1.1.0)
- `fix:` Bug fix → Patch version bump (1.0.0 → 1.0.1)
- `perf:` Performance improvement → Patch version bump
- `BREAKING CHANGE:` or `feat!:` → Major version bump (1.0.0 → 2.0.0)
- `docs:`, `style:`, `refactor:`, `test:`, `chore:` → No release

### Examples:
```bash
# Minor release (1.0.0 → 1.1.0)
git commit -m "feat: add new command for listing sessions"

# Patch release (1.0.0 → 1.0.1)
git commit -m "fix: correct port detection on Windows"

# Major release (1.0.0 → 2.0.0)
git commit -m "feat!: change CLI argument structure"
# or
git commit -m "feat: new API

BREAKING CHANGE: removed support for Node 16"

# No release
git commit -m "docs: update README"
git commit -m "chore: update dependencies"
```

## Setup Required

✅ **NPM_TOKEN** is already configured in repository secrets

## How It Works

1. Push commits to main with conventional commit messages
2. GitHub Actions automatically:
   - Determines the next version based on commits
   - Creates a tag (e.g., v1.0.1)
   - Generates release notes from commit messages
   - Creates a GitHub release
   - Publishes to npm

**No commits are created** - the version is only updated in the published npm package, not in the repository.