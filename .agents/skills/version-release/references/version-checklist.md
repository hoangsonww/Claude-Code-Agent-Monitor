# Version Checklist

- [ ] State why the change is patch, minor, or major.
- [ ] Any explicit user-specified version was preserved and recorded as an override.
- [ ] Root and desktop package/lockfile versions agree.
- [ ] OpenAPI source/example and generated YAML agree.
- [ ] Compose, Helm (`version` + `appVersion`), Kubernetes labels/images/kustomize tags, and `deploy.sh` agree.
- [ ] `DEPLOYMENT.md`, `docs/DEPLOYMENT.md`, and `CITATION.cff` agree.
- [ ] Version-sensitive snapshots agree.
- [ ] Claude/Codex plugin metadata and marketplaces were regenerated.
- [ ] Independently shipped subprojects were intentionally left unchanged or explicitly released.
- [ ] The exact open GitHub milestone `v<version>` was reused or created without duplicating an existing/closed release milestone.
- [ ] The current pull request containing the version bump is assigned to `v<version>`.
- [ ] Every issue in the PR's `closingIssuesReferences` is assigned to the same `v<version>` milestone.
- [ ] Fresh PR and issue reads verify all milestone assignments.
- [ ] `release-version-consistency` passes, and any new version-bearing file gained an assertion there.
- [ ] A sweep for the previous version returns only lockfile history and deliberate historical references.
- [ ] Extension validation, relevant tests/builds, and CLI version check passed.
- [ ] No tag or release was created without explicit approval.
