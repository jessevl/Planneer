# Security

This file describes the current security model and the minimum production posture expected for a self-hosted deployment.

## Core Model

- Authentication is handled by PocketBase.
- Authorization is workspace-scoped.
- The frontend depends on same-origin production access in the default deployment.
- Offline data is cached locally and should be treated as device-accessible data.

## What To Protect

- PocketBase admin credentials
- uploaded files and backups
- the `pb_data` directory
- any reverse-proxy access to `/_/`

## Production Basics

- Run behind HTTPS.
- Keep the container non-root and the data directory locked down.
- Restrict or disable public access to the PocketBase admin UI.
- Back up data regularly and treat backups as sensitive artifacts.
- Keep deployment configuration and secrets out of the repo.

## Current Limits

- There is no end-to-end encryption.
- Browser-cached offline data is not protected by application-level encryption.
- Anyone with host or browser profile access may be able to inspect local cached content.

## High-Value Hardening Work

- Secure authenticated file delivery for uploaded assets
- Continued CSP tightening where editor dependencies allow it
- Ongoing review of custom backend endpoints and workspace checks

## Reporting

Use the repository security process described in the root [SECURITY.md](../../SECURITY.md) for disclosure workflow.