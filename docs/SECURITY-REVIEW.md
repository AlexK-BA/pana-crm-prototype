# Prototype security review

## Current automated baseline

- Tracked filenames are checked for environment files, private keys, certificates and common credential containers.
- Repository content is checked for common private-key, cloud-key, GitHub, OpenAI and Slack token patterns without printing possible values.
- Production dependencies are checked with `pnpm audit --prod`.
- `next` must remain on a patched release; the October 2026 review upgraded it from `16.3.3` to `16.3.8`.
- Patched transitive versions of `nanoid`, `browserslist` and `baseline-browser-mapping` are pinned through `pnpm.overrides` until the framework dependency graph includes them directly.
- The `shadcn` CLI is a development tool and belongs in `devDependencies`, not the production dependency graph.

## Prototype limitations that remain production blockers

- Authorization and clinic scope are enforced in the client prototype; production requires server-side enforcement for every query and command.
- State is session-only and cannot provide durable audit, idempotency or recovery guarantees.
- Demo role switching is not authentication. Production requires an identity provider, secure sessions, MFA policy and session revocation.
- Medical, telephony, messaging, AI/RAG and file-provider integrations require secrets in managed server-side storage; never expose provider credentials to the browser.
- Audit events require append-only durable storage, retention rules, restricted access and export controls.
- Patient/medical data require an approved GDPR basis, data minimization, retention/deletion policy, access logging and a completed DPIA where applicable.
- AI functionality requires published policy/version control, evidence traceability, human handoff, incident handling and legal review before live responses.
- Attachments require malware scanning, content-type/size restrictions, isolated object storage and time-limited authorization before the demo placeholder becomes upload functionality.

## Release rule

No prototype deployment containing real patient data is approved by this document. Repeat dependency, secret, authorization and privacy review when a backend or real provider is introduced.
