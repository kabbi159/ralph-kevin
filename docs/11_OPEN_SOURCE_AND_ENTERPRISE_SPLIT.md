# Open Source and Enterprise Split

## Strategy

Use open source for developer adoption. Use hosted and enterprise features for monetization.

## Open source

Should include:

- core schemas
- persona source abstraction
- Hugging Face / local persona connector
- local runner
- Playwright artifacts
- friction detection
- finding generation
- local HTML report
- CLI
- MCP server
- basic Claude Code / Codex handoff docs
- example apps

Should not require:

- cloud account
- hosted API
- paid database
- enterprise auth

## Team SaaS

Paid hosted product:

- web dashboard
- team projects
- run history
- hosted replay storage
- hosted persona vector search
- persona packs
- GitHub integration
- Linear/Jira integration
- before/after comparison
- comments and collaboration

## Enterprise

Paid enterprise product:

- private runner
- self-hosted deployment
- custom persona libraries
- custom persona packs
- SSO/SAML
- RBAC
- audit logs
- retention policies
- VPC/private networking
- regional storage
- compliance support
- procurement package

## Feature boundary

| Feature | OSS | Team | Enterprise |
|---|---:|---:|---:|
| CLI | yes | yes | yes |
| Local runner | yes | yes | yes |
| Hugging Face direct connector | yes | yes | yes |
| Local report | yes | yes | yes |
| Hosted dashboard | no | yes | yes |
| Hosted replay storage | no | yes | yes |
| Persona vector search | no | yes | yes |
| Persona packs | basic local | yes | custom |
| GitHub/Linear/Jira | basic | yes | yes |
| SSO/RBAC | no | no/basic | yes |
| Private runner | no | optional | yes |
| Self-hosted control plane | no | no | yes |
| Custom datasets | local only | limited | yes |

## Licensing note

Add clear attribution and provenance for Nemotron-Personas dataset records.

The code license can be Apache-2.0 or MIT. Prefer Apache-2.0 if enterprise adoption and patent grant matter.

Dataset licenses are separate from code license. Do not imply the code license covers the dataset.
