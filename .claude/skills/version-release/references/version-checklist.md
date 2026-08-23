# Version Checklist

- [ ] Classify the release as patch, minor, or major with one concrete reason.
- [ ] Preserve an explicit user-specified version and record it as an override.
- [ ] Root package and lockfile agree.
- [ ] Desktop package and lockfile agree.
- [ ] OpenAPI version/example and generated YAML agree.
- [ ] Compose image tags, Helm `version` + `appVersion`, every Kubernetes version label / image tag / kustomize `newTag`, and `deploy.sh` agree.
- [ ] `DEPLOYMENT.md`, `docs/DEPLOYMENT.md`, and `CITATION.cff` agree.
- [ ] Version-sensitive snapshots agree.
- [ ] Claude and Codex plugin manifests/catalogs were regenerated.
- [ ] Independently versioned subprojects were intentionally left unchanged or explicitly released.
- [ ] The exact open GitHub milestone `v<version>` was reused or created without duplicating an existing/closed release milestone.
- [ ] The current pull request containing the version bump is assigned to `v<version>`.
- [ ] Every issue in the PR's `closingIssuesReferences` is assigned to the same `v<version>` milestone.
- [ ] Fresh PR and issue reads verify all milestone assignments.
- [ ] `release-version-consistency` passes, and any newly added version-bearing file gained an assertion there.
- [ ] A repo-wide sweep for the previous version returns only lockfile history and deliberate historical references.
- [ ] Extension validation, relevant test suites, build, and CLI version check passed.
- [ ] No tag or release was created without explicit user approval.
