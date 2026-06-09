<div align="center">

# Secret Surface

**Map environment variables and CI secrets across code, docs, examples, and workflows.**

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Secrets](https://img.shields.io/badge/secrets-surface%20map-blue)]()

[简体中文](README.zh-CN.md)

</div>

Secret scanners tell you when a value leaked. That is important, but it is often too late.

`secret-surface` answers the earlier maintenance question:

> Which secrets and environment variables does this repo expect, where are they used, and are they documented?

It scans local files and builds a small map across:

- runtime code such as `process.env.OPENAI_API_KEY`
- frontend code such as `import.meta.env.VITE_API_URL`
- `.env.example`
- GitHub Actions references like `${{ secrets.NPM_TOKEN }}`
- Markdown docs that mention variable names

No API keys. No model calls. No network. No telemetry.

## Documentation

| English | 简体中文 |
| --- | --- |
| [README](README.md) | [README.zh-CN](README.zh-CN.md) |
| [Changelog](CHANGELOG.md) | [更新日志](CHANGELOG.zh-CN.md) |
| [Contributing](CONTRIBUTING.md) | [贡献指南](CONTRIBUTING.zh-CN.md) |
| [Security](SECURITY.md) | [安全说明](SECURITY.zh-CN.md) |

## 30 Second Demo

```bash
npx github:maxi-maxima/secret-surface demo
```

Example output:

```text
Secret Surface
Root: /path/to/reports/demo-workspace
Variables: 4
Findings: 3

NPM_TOKEN [docs, workflow]
  - .github/workflows/release.yml:7 (workflow)
  - README.md:1 (docs)
```

The demo writes:

- `reports/demo/secret-surface.json`
- `reports/demo/secret-surface.md`

## Scan A Repo

```bash
npx github:maxi-maxima/secret-surface scan .
```

Useful variants:

```bash
# Write JSON and Markdown reports
npx github:maxi-maxima/secret-surface scan . --out reports/secret-surface

# Print machine-readable JSON
npx github:maxi-maxima/secret-surface scan . --json
```

## Findings

| Finding | Severity | Meaning |
| --- | --- | --- |
| `missing-env-example` | warning | Code or CI references a variable that is absent from `.env.example`. |
| `unused-env-example` | info | `.env.example` documents a variable that is not referenced elsewhere. |
| `undocumented-ci-secret` | warning | GitHub Actions uses a secret that Markdown docs never mention. |

## What It Detects

| Surface | Examples |
| --- | --- |
| JavaScript and TypeScript | `process.env.NAME`, `process.env["NAME"]`, `import.meta.env.NAME` |
| Python | `os.environ["NAME"]`, `os.environ.get("NAME")` |
| GitHub Actions | `secrets.NAME`, `env.NAME` |
| Env examples | `NAME=` in `.env.example` |
| Markdown docs | Uppercase variable names such as `OPENAI_API_KEY` |

## Why This Exists

AI-generated apps grow configuration faster than people document it. A project can pass tests while the next maintainer still cannot run it because nobody knows:

- which variables are local-only
- which variables must be configured as GitHub Actions secrets
- which `.env.example` entries are stale
- which runtime variables are missing from onboarding docs

`secret-surface` is a small handoff check. It does not replace secret scanning. It makes the expected secret surface visible.

## How This Differs From Secret Scanners

Secret scanners look for sensitive values committed to the repo.

`secret-surface` looks for variable names and references. It does not decide whether a value is leaked; it shows the contract your repo expects.

Use both: scanners for leaks, `secret-surface` for configuration drift.

## GitHub Action

```yaml
name: Secret Surface

on:
  pull_request:

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Map secret surface
        run: npx github:maxi-maxima/secret-surface scan . --out reports/secret-surface
```

## Development

```bash
npm install
npm run check
node dist/cli.js demo
npm pack --dry-run --ignore-scripts
```

## Research Links

- [GitHub Actions encrypted secrets](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)
- [GitHub Actions variables](https://docs.github.com/en/actions/learn-github-actions/variables)
- [GitGuardian State of Secrets Sprawl](https://www.gitguardian.com/state-of-secrets-sprawl-report)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

## License

MIT
