# GitHub Actions Workflows

This project uses GitHub Actions for automated releases and npm publishing.

## Workflows

### 1. Create Release (`release.yml`)

**Trigger**: Manual workflow dispatch from GitHub Actions tab

**Purpose**: Creates a new version tag and GitHub release without creating any commits

**How to use**:
1. Go to Actions tab in GitHub
2. Select "Create Release" workflow
3. Click "Run workflow"
4. Choose version type: patch, minor, or major
5. The workflow will:
   - Calculate the new version
   - Create a git tag
   - Create a GitHub release

### 2. Publish to npm (`publish.yml`)

**Trigger**: Automatically when a new version tag is pushed (v*.*.*)

**Purpose**: Publishes the package to npm when a release is created

**What it does**:
1. Checks out the code at the tagged version
2. Updates package.json with the version from the tag
3. Builds the project
4. Runs tests
5. Publishes to npm

## Setup Required

Before using these workflows, you need to:

1. **Set up NPM_TOKEN secret**:
   - Go to https://www.npmjs.com/settings/[your-username]/tokens
   - Create a new "Automation" token
   - In GitHub repo settings, go to Secrets and variables > Actions
   - Add a new secret named `NPM_TOKEN` with the token value

## Release Process

1. Make your changes and push to main
2. Go to Actions > Create Release > Run workflow
3. Select version type (patch/minor/major)
4. The release workflow creates a tag
5. The publish workflow automatically runs and publishes to npm

## Version Strategy

- **patch**: Bug fixes and minor changes (1.0.0 → 1.0.1)
- **minor**: New features, backwards compatible (1.0.0 → 1.1.0)
- **major**: Breaking changes (1.0.0 → 2.0.0)

No commits are created by the workflows - only tags and releases.