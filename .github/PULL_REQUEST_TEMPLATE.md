## Summary

<!-- What does this PR do? Keep it to 1-3 sentences. -->

## Changes

<!-- Bullet list of what changed and why. -->

-

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Refactor (no functional changes)
- [ ] Documentation update
- [ ] Infrastructure / CI / DevOps
- [ ] Dependency update

<!--
The box above maps onto the release bump: a fix / refactor / docs / dependency
change is a patch, a new feature is a minor, and a breaking change is a major.
If this PR carries a version bump, apply the `version-release` skill — the
release version lives in far more places than package.json (desktop, OpenAPI,
Compose, Helm, the Kubernetes manifests, deploy.sh, the deployment guides,
CITATION.cff, and the generated plugin manifests), and
`server/__tests__/release-version-consistency.test.js` is what actually proves
they all agree.
-->

## How to Test

<!-- Steps a reviewer can follow to verify the change. -->

1.

## Checklist

- [ ] I have read the [contributing guidelines](https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/.github/CONTRIBUTING.md)
- [ ] I have signed the [CLA](https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/CLA.md) (the `🖋️ CLA Assistant` bot will prompt me on my first PR)
- [ ] My code follows the project's coding standards
- [ ] I have added/updated tests that prove my fix or feature works
- [ ] The full local gate passes (`npm run verify` — headers, formatting, client typecheck, server tests, client tests)
- [ ] Every source file I added or changed carries the authorship header (`npm run check:headers`)
- [ ] Snapshot changes were reviewed rather than blindly regenerated
- [ ] I have updated documentation where necessary
- [ ] If this PR bumps the version, every release surface is synchronized and the milestone is assigned

## Screenshots

<!-- If UI changes, include before/after screenshots. Delete this section otherwise. -->
