# Security

`secret-surface` maps variable names and reference locations. It should not collect, print, or upload secret values.

## Reporting

Please report security issues through a private GitHub advisory when available, or contact the maintainer directly.

## Scope

Security-relevant issues include:

- printing secret values instead of names
- reading files outside the requested repository root
- executing untrusted workspace content
- sending repository data over the network

Missed variable-name patterns are normal bugs, not security vulnerabilities unless they cause secret values to be exposed.
