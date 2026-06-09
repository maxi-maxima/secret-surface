<div align="center">

# Secret Surface

**映射代码、文档、示例配置和 CI 工作流里的环境变量与 Secrets 使用面。**

[English](README.md)

</div>

Secret scanner 会告诉你某个密钥值是否已经泄露。这很重要，但通常已经太晚。

`secret-surface` 回答更早一步的维护问题：

> 这个仓库期待哪些 secrets 和环境变量？它们在哪里被使用？有没有被文档化？

它会本地扫描文件，并生成一张小地图，覆盖：

- `process.env.OPENAI_API_KEY` 这类运行时代码
- `import.meta.env.VITE_API_URL` 这类前端代码
- `.env.example`
- `${{ secrets.NPM_TOKEN }}` 这类 GitHub Actions 引用
- Markdown 文档中提到的变量名

不需要 API key。不调用模型。不联网。没有遥测。

## 文档

| English | 简体中文 |
| --- | --- |
| [README](README.md) | [README.zh-CN](README.zh-CN.md) |
| [Changelog](CHANGELOG.md) | [更新日志](CHANGELOG.zh-CN.md) |
| [Contributing](CONTRIBUTING.md) | [贡献指南](CONTRIBUTING.zh-CN.md) |
| [Security](SECURITY.md) | [安全说明](SECURITY.zh-CN.md) |

## 30 秒演示

```bash
npx github:maxi-maxima/secret-surface demo
```

示例输出：

```text
Secret Surface
Root: /path/to/reports/demo-workspace
Variables: 4
Findings: 3

NPM_TOKEN [docs, workflow]
  - .github/workflows/release.yml:7 (workflow)
  - README.md:1 (docs)
```

演示会写入：

- `reports/demo/secret-surface.json`
- `reports/demo/secret-surface.md`

## 扫描仓库

```bash
npx github:maxi-maxima/secret-surface scan .
```

常用变体：

```bash
# 写入 JSON 和 Markdown 报告
npx github:maxi-maxima/secret-surface scan . --out reports/secret-surface

# 输出机器可读 JSON
npx github:maxi-maxima/secret-surface scan . --json
```

## 发现项

| 发现项 | 严重度 | 含义 |
| --- | --- | --- |
| `missing-env-example` | warning | 代码或 CI 引用了某个变量，但 `.env.example` 没有记录。 |
| `unused-env-example` | info | `.env.example` 记录了某个变量，但其他地方没有引用。 |
| `undocumented-ci-secret` | warning | GitHub Actions 使用了某个 secret，但 Markdown 文档没有提到。 |

## 能识别什么

| 使用面 | 示例 |
| --- | --- |
| JavaScript / TypeScript | `process.env.NAME`, `process.env["NAME"]`, `import.meta.env.NAME` |
| Python | `os.environ["NAME"]`, `os.environ.get("NAME")` |
| GitHub Actions | `secrets.NAME`, `env.NAME` |
| Env 示例 | `.env.example` 里的 `NAME=` |
| Markdown 文档 | `OPENAI_API_KEY` 这类大写变量名 |

## 为什么做这个

AI 生成应用会让配置增长得比文档快。一个项目可能测试全绿，但下一个维护者仍然跑不起来，因为没人知道：

- 哪些变量只在本地需要
- 哪些变量必须配置成 GitHub Actions secrets
- 哪些 `.env.example` 条目已经过时
- 哪些运行时变量缺少上手文档

`secret-surface` 是一个轻量交接检查。它不替代 secret scanner，而是把仓库期待的配置契约显示出来。

## 与 Secret Scanner 的区别

Secret scanner 查找提交到仓库里的敏感值。

`secret-surface` 查找变量名和引用位置。它不判断某个值是否泄露，只显示仓库期待的配置契约。

两者可以一起用：scanner 查泄露，`secret-surface` 查配置漂移。

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

## 开发

```bash
npm install
npm run check
node dist/cli.js demo
npm pack --dry-run --ignore-scripts
```

## 调研链接

- [GitHub Actions encrypted secrets](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)
- [GitHub Actions variables](https://docs.github.com/en/actions/learn-github-actions/variables)
- [GitGuardian State of Secrets Sprawl](https://www.gitguardian.com/state-of-secrets-sprawl-report)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

## 许可证

MIT
