# Publishing Chromancer to npm

## Pre-publish Checklist

- [ ] Update version in package.json
- [ ] Update author name in package.json
- [ ] Update repository URLs in package.json
- [ ] Update author name in LICENSE file
- [ ] Run tests: `npm test`
- [ ] Build the project: `npm run build`
- [ ] Test locally: `npm link` then `chromancer --help`

## First-time Setup

1. Create an npm account at https://www.npmjs.com/signup
2. Login to npm:
   ```bash
   npm login
   ```

## Publishing

1. Clean and build:
   ```bash
   npm run clean
   npm run build
   ```

2. Test the package:
   ```bash
   npm pack --dry-run
   ```

3. Publish to npm:
   ```bash
   npm publish
   ```

   For the first publish, you might need:
   ```bash
   npm publish --access public
   ```

## Post-publish

1. Verify on npm: https://www.npmjs.com/package/chromancer
2. Test installation:
   ```bash
   npm install -g chromancer
   chromancer --version
   ```

## Version Updates

For subsequent releases:

1. Update version:
   ```bash
   npm version patch  # for bug fixes
   npm version minor  # for new features
   npm version major  # for breaking changes
   ```

2. Push tags:
   ```bash
   git push --tags
   ```

3. Publish:
   ```bash
   npm publish
   ```