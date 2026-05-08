# ClawStudio

A free online tool hub built with Nuxt 4 — a mix of pure client-side tools and proxied microservices on GCP Cloud Run.

## Branding Note

The public-facing brand name is **ClawStudiouo** (domain: `clawstudiouo.com`). The project ID, repo name, and `package.json` name remain `ClawStudio`. All user-visible text uses "ClawStudiouo" and is managed via i18n locale files.

## About

ClawStudio is a collection of free, browser-based image / sprite / dev tools. Two architectural patterns coexist:

**Server-side tools** (most format conversions, sprite operations, EXIF removal) route through a Nitro API proxy that calls a dedicated Cloud Run microservice. Internal endpoints stay hidden from the browser:

```
Browser  →  Nuxt Nitro API  →  GCP Cloud Run Service
              (proxy + auth)       (processing engine)
```

**Pure client-side tools** (Image Editor, Spritesheet Animator preview) run entirely in the browser using Canvas / Web APIs. No upload, no backend, no usage limits.

### Current Tools (~27)

| Category                 | Tools                                                                                                            | Backend                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **Sprite & Frame** | GIF → Spritesheet, PNG → GIF, PNG → Spritesheet, PNG Trim, Spritesheet Splitter (with live animation preview) | `gifService`, `png2ssService` |
| **Image Format**   | HEIC ↔ JPG/PNG/WebP, PNG ↔ JPG/WebP, JPG ↔ WebP                                                               | `uniimgcService`                |
| **AVIF**           | PNG/JPG/WebP ↔ AVIF                                                                                             | `uniimgcService`                |
| **Vector & Icon**  | SVG → PNG, Favicon Generator                                                                                    | `uniimgcService`                |
| **Privacy**        | EXIF Remover & Privacy Scanner                                                                                   | `exifrmService`                 |
| **Image Editing**  | Image Editor (crop / resize / compress / rotate / flip)                                                          | _client-side only_              |

Each tool also exposes its corresponding RapidAPI endpoint for programmatic access (linked from the tool page).

## Tech Stack

- **Frontend**: Nuxt 4 + Nuxt UI v4 + Tailwind CSS 4
- **Backend Proxy**: Nitro (Nuxt built-in server) — `server/api/`
- **Backends**: 4 GCP Cloud Run microservices (GIF, PNG2SS, UniIMGC, EXIFRm)
- **Blog**: `@nuxt/content` v3 — Markdown files in `content/{locale}/blog/`, dynamic routing via `app/pages/blog/[slug].vue`
- **Deployment**: Firebase App Hosting (`pnpm firebase:redeploy`)
- **i18n**: `@nuxtjs/i18n` — 9 locales (en, zh-TW, zh-CN, ja, ko, de, es, pt, ru)
- **SEO**: `@nuxtjs/sitemap`, JSON-LD per tool page
- **Analytics**: `nuxt-gtag` (Google Analytics 4)
- **Monetization**: Cookie-based usage limiter (3 free uses/day → waiting room); Google AdSense infrastructure in place (`adsenseEnabled: false`, pending approval)
- **Package manager**: pnpm (frozen lockfile in CI)

## Setup

```bash
pnpm install
cp .env.example .env
```

Required environment variables (see `.env.example`):

| Variable                     | Description                                                |
| ---------------------------- | ---------------------------------------------------------- |
| `NUXT_GIF_SERVICE_URL`     | Cloud Run URL for the GIF service                          |
| `NUXT_PNG2SS_SERVICE_URL`  | Cloud Run URL for the PNG → Spritesheet service           |
| `NUXT_UNIIMGC_SERVICE_URL` | Cloud Run URL for the universal image converter            |
| `NUXT_EXIFRM_SERVICE_URL`  | Cloud Run URL for the EXIF remover                         |
| `NUXT_INTERNAL_KEY`        | Shared `X-Internal-Key` header used by all four services |

Pure client-side tools (Image Editor, Spritesheet Animator) work without any of these — useful for local development without backend services running.

## Development

```bash
pnpm dev          # local dev server
pnpm lint         # ESLint
pnpm typecheck    # TS / Vue typecheck
pnpm build        # production build (high RAM — see note below)
pnpm preview      # serve built output
```

> **Note on `pnpm build`**: the build runs with `--max-old-space-size=4096` and is memory-intensive. Run it serially (one at a time, no parallel agents) to avoid OOM crashes. For day-to-day verification, `pnpm lint && pnpm typecheck` is sufficient — CI runs the full build.

## Deployment

```bash
pnpm firebase:redeploy   # trigger Firebase App Hosting rollout
pnpm firebase:rollouts   # list recent rollouts
pnpm firebase:secrets    # set App Hosting secrets
```

`pnpm deploy` is wired to `git push origin main`, which triggers the App Hosting rollout via the connected GitHub source.

## Adding a New Tool

See [docs/adding-a-new-tool.md](docs/adding-a-new-tool.md) for the full checklist. Quick summary:

1. (Server-side tools) Stand up the Cloud Run service with `X-Internal-Key` validation
2. Add a proxy endpoint in `server/api/`
3. Add the tool page in `app/pages/tools/<slug>.vue` using `<ToolPageLayout>`
4. Add i18n keys in `i18n/locales/{en,zh-TW}.json` (other 7 locales can follow later)
5. Register the tool in `app/composables/useTools.ts` and add the homepage card
6. Add a tip block in `download.vue` if the tool uses the post-download waiting room

For pure client-side tools, skip steps 1–2.

## Documentation

In-repo documentation lives under [docs/](docs/):

- [tool-page-architecture.md](docs/tool-page-architecture.md) — page layout pattern and shared components
- [adding-a-new-tool.md](docs/adding-a-new-tool.md) — checklist for new tools
- [blog-publishing-guide.md](docs/blog-publishing-guide.md) — blog system architecture, publishing workflow, and AIO optimization (AI-readable reference blocks)
- [reusable-components.md](docs/reusable-components.md) — `ToolPageLayout`, `SeoSections`, `RelatedTools`, etc.
- [i18n-guide.md](docs/i18n-guide.md) — locale file structure and conventions
- [ad-integration.md](docs/ad-integration.md) — AdSense slot map and compliance rules
- [seo-ops.md](docs/seo-ops.md) — sitemap submission, robots.txt, and SEO operations
- API references: [gif2ss](docs/gif2ss-api-reference.md) · [png2ss](docs/png2ss-api-reference.md) · [uniimgc](docs/uniimgc-api-reference.md) · [exifrm](docs/exifrm-api-reference.md)
- Feature plans: [docs/superpowers/plans/](docs/superpowers/plans/)

## AI Agent Setup

This project uses an AI agent plugin system (Superpowers) that installs skills into `skills/` and `.agents/skills/`. Both directories are **gitignored** — they are managed by the plugin installer, not version-controlled.

If you clone this repo and use an AI coding agent, reinstall the plugins to restore the skill directories:

```bash
# Claude Code
claude plugins install <plugin-name>

# Or follow the plugin provider's installation instructions
```

Local Claude Code slash commands (e.g. `/new-blog-post`, `/i18n-translator`) live in `.claude/commands/` which is also gitignored. These are developer-local and need to be set up individually per machine.
