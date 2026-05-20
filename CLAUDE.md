# ClawStudio — AI Agent Guidelines

## Package Manager

Always use **pnpm**. Never use `npm install` or `yarn`.

```bash
pnpm add <package>       # add dependency
pnpm add -D <package>    # add dev dependency
pnpm install             # install all
```

## Pre-Push Checks

Before every `git push`, both must pass:

```bash
pnpm lint && pnpm typecheck
```

Do not push if either fails.

## Development Server

After every `pnpm dev` session, kill the process immediately. Do not leave it running.

---

## Git & GitHub Workflow

All changes follow a three-tier model based on severity.

### Tier 1 — Hotfix

**Applies to:** missing i18n keys, typo fixes, minor copy edits, `.gitkeep` additions.

1. Create a GitHub Issue describing the problem
2. Fix directly on `main`
3. Commit with a message referencing the Issue (`fixes #N`)
4. Push — triggers Firebase App Hosting rollout

### Tier 2 — Standard

**Applies to:** bug fixes, new tool pages, blog posts, i18n translations, component changes.

1. Create a GitHub Issue
2. Create a branch: `git checkout -b fix/issue-N-short-description`
3. Implement the fix or feature
4. Run `pnpm lint && pnpm typecheck`
5. User manually tests on local dev server (`pnpm dev`)
6. Once confirmed: open a PR, link to the Issue (`closes #N`)
7. Merge PR to `main` → triggers Firebase App Hosting rollout

### Tier 3 — Breaking

**Applies to:** architectural changes, new Cloud Run services, Nitro API proxy changes, routing changes, dependency major upgrades.

Same steps as Tier 2, plus:
- Local dev testing is **mandatory** before opening the PR (not optional)
- PR description must include a summary of what breaks if the change is reverted

---

## i18n Rules

- **Source locales:** `en.json` and `zh-TW.json` — maintained by hand
- **Other 7 locales** (`zh-CN`, `ja`, `ko`, `de`, `es`, `pt`, `ru`) — generated via `/i18n-translator`. Never edit them manually unless fixing a specific mistranslation.
- **No HTML tags in locale strings.** Values in `i18n/locales/*.json` must not contain `<tag>` syntax — this is blocked by `unplugin-vue-i18n` at build time and will fail CI.
- **No `@word` at the start of a value** — reserved by vue-i18n linked message syntax.
- **Interpolation variables** like `{count}` are fine; literal `{` not used as a variable is not.

## Blog Post Workflow

See [docs/blog-publishing-guide.md](docs/blog-publishing-guide.md) for the full publishing checklist.

Quick rules:
- English markdown (`content/en/blog/<slug>.md`) is required for every post
- `zh-TW` is maintained by hand alongside English
- Other 7 locales are translated via `/i18n-translator` Mode B
- All tool/API posts must include an AI-readable reference block (`## MCP Tool Reference (For AI Agents)` or `## API Reference (For AI Agents)`) before `## What's Next`
- `slug` must be lowercase kebab-case — `@nuxt/content` lowercases all paths

## Key Docs

| Topic | File |
|---|---|
| Adding a new tool | [docs/adding-a-new-tool.md](docs/adding-a-new-tool.md) |
| Blog publishing | [docs/blog-publishing-guide.md](docs/blog-publishing-guide.md) |
| Tool page architecture | [docs/tool-page-architecture.md](docs/tool-page-architecture.md) |
| i18n conventions | [docs/i18n-guide.md](docs/i18n-guide.md) |
| Reusable components | [docs/reusable-components.md](docs/reusable-components.md) |
