# ClawStudio

A personal portal and free online tool hub built with Nuxt 4, powered by custom GCP Cloud Run APIs.

## Branding Note

The public-facing brand name is **ClawStudiouo** (domain: `clawstudiouo.com`). The project ID, repo name, and `package.json` name remain `ClawStudio` for simplicity. All user-visible text uses "ClawStudiouo" and is managed via i18n locale files.

## About

ClawStudio is a collection of free, browser-based developer tools. Each tool is backed by a dedicated microservice running on GCP Cloud Run, with Nuxt acting as a server-side proxy to handle authentication and hide internal endpoints.

The architecture follows a consistent pattern for every tool:

```
Browser  ->  Nuxt Nitro API  ->  GCP Cloud Run Service
              (proxy + auth)       (processing engine)
```

### Current Tools

| Tool | Description | Backend |
|------|-------------|---------|
| **GIF to PNG Spritesheet** | Convert GIF animations into sprite sheets or extract individual frames as PNGs | [Easy GIF2Sprite API](https://rapidapi.com/lxya98874322688423/api/easy-gif-to-sprites) |

More tools will be added over time, each following the same proxy pattern.

## Tech Stack

- **Frontend**: Nuxt 4 + Nuxt UI v4 + Tailwind CSS 4
- **Backend Proxy**: Nitro (Nuxt built-in server)
- **Deployment**: GCP Cloud Run
- **i18n**: @nuxtjs/i18n (English + Traditional Chinese)
- **Monetization**: AdSense with cookie-based usage limiter

## Setup

```bash
pnpm install
```

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:

| Variable | Description |
|----------|-------------|
| `NUXT_GIF_SERVICE_URL` | GCP Cloud Run URL for the GIF service |
| `NUXT_INTERNAL_KEY` | Internal API key to bypass RapidAPI gateway |

## Development

```bash
pnpm dev
```

## Production

```bash
pnpm build
pnpm preview
```

## Adding a New Tool

1. Create the Cloud Run service with an internal key check
2. Add a proxy endpoint in `server/api/`
3. Add the tool page in `app/pages/tools/`
4. Add i18n keys in `i18n/locales/`
5. Add a card entry on the homepage

## License

[MIT](LICENSE)
