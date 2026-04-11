# Security Policy

## Reporting a Vulnerability

The Planneer team takes security vulnerabilities seriously. We appreciate your efforts to responsibly disclose your findings.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them by email to: security@planneer.appß

Include the following information (as much as you can provide):
- Type of vulnerability
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability and how an attacker might exploit it

### What to Expect

- **Acknowledgment**: We will acknowledge your email within 48 hours
- **Updates**: We will keep you informed about our progress
- **Timeline**: We aim to address critical vulnerabilities within 7 days
- **Credit**: We will credit you in our security advisories (unless you prefer to remain anonymous)

### Supported Versions

We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |
| < 1.0   | :x:                |

### Security Best Practices

When deploying Planneer in production:

1. **HTTPS Only**: Always use HTTPS in production
2. **Environment Variables**: Never commit secrets to git
3. **Admin UI**: Restrict PocketBase admin UI access (set `PLANNEER_ALLOW_ADMIN_UI=false`)
4. **Updates**: Keep all dependencies up to date
5. **Backups**: Implement regular automated backups
6. **Rate Limiting**: Ensure rate limiting is enabled
7. **Demo User**: Demo user only exists in development mode (`PB_DEV=true`)

### Known Security Considerations

- **Offline Storage**: Data stored in browser IndexedDB is not encrypted at rest
- **Demo User**: In development mode, a demo user exists with a known password (see `.env.example`)
- **Admin UI**: The PocketBase admin UI at `/_/` should be restricted in production

## Security Audit

Planneer has undergone internal security audits.

## Disclosure Policy

When we receive a security bug report, we will:

1. Confirm the problem and determine affected versions
2. Audit code to find any similar problems
3. Prepare fixes for all supported versions
4. Release new versions as soon as possible
5. Publish a security advisory

## Comments on This Policy

If you have suggestions on how this process could be improved, please submit a pull request.