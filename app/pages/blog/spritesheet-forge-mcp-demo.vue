<!-- app/pages/blog/spritesheet-forge-mcp-demo.vue -->
<script setup lang="ts">
const localePath = useLocalePath()
</script>

<template>
  <BlogPostLayout
    title-key="blog.posts.spritesheetForgeMcpDemo.title"
    description-key="blog.posts.spritesheetForgeMcpDemo.description"
    date="2026-05-05"
    :reading-time="6"
  >
    <template #content>
      <section class="space-y-3">
        <h2 class="text-xl font-semibold">The Problem with Traditional Spritesheet Tools</h2>
        <p class="text-muted leading-relaxed">
          Converting a GIF animation into a game-ready spritesheet has always been a multi-step process:
          open TexturePacker, configure column counts, decide whether to remove the background, export,
          check frame coordinates, adjust. Each time you iterate on an animation, you repeat the whole cycle.
        </p>
        <p class="text-muted leading-relaxed">
          What if you could just describe what you need and get the result?
        </p>
      </section>

      <section class="space-y-3">
        <h2 class="text-xl font-semibold">Spritesheet Forge: A Spritesheet Server for Claude</h2>
        <p class="text-muted leading-relaxed">
          <strong>Spritesheet Forge</strong> is a hosted MCP (Model Context Protocol) server that gives Claude
          direct access to spritesheet processing tools. Once connected, you can ask Claude to convert GIFs,
          pack PNGs into spritesheets, split existing spritesheets, generate Sprite Atlas JSON, and more —
          all through natural language.
        </p>
        <p class="text-muted leading-relaxed">
          There is no software to install. The server runs on Cloudflare Workers and processes your files in
          the cloud. Claude handles the file upload, parameter selection, and output — you just describe the
          result you want.
        </p>
      </section>

      <section class="space-y-4">
        <h2 class="text-xl font-semibold">Connect Claude in 2 Minutes</h2>
        <p class="text-muted leading-relaxed">
          You can connect via Claude Desktop or the Claude Code CLI. Both require adding the server endpoint
          to your configuration:
        </p>
        <div class="space-y-4">
          <div>
            <p class="text-sm font-medium mb-2">
              Claude Desktop — add to <code class="text-primary">claude_desktop_config.json</code>:
            </p>
            <pre class="bg-muted/30 rounded-lg p-4 text-sm overflow-x-auto"><code>{
  "mcpServers": {
    "spritesheet-forge": {
      "type": "http",
      "url": "https://mcp.clawstudiouo.com/mcp"
    }
  }
}</code></pre>
          </div>
          <div>
            <p class="text-sm font-medium mb-2">Claude Code CLI:</p>
            <pre class="bg-muted/30 rounded-lg p-4 text-sm overflow-x-auto"><code>claude mcp add spritesheet-forge --transport http https://mcp.clawstudiouo.com/mcp</code></pre>
          </div>
        </div>
        <p class="text-muted leading-relaxed">
          On first use, Claude opens a GitHub OAuth page to authenticate your session. The token is stored
          locally and valid for 30 days.
        </p>
      </section>

      <section class="space-y-4">
        <h2 class="text-xl font-semibold">Demo: GIF to Spritesheet</h2>
        <p class="text-muted leading-relaxed">
          Here is the input — a 9-frame banana cat animation at 75 × 165 px:
        </p>
        <div class="flex items-end gap-8">
          <div class="flex flex-col items-center gap-2">
            <img
              src="/blog/spritesheet-forge-mcp-demo/input.gif"
              alt="Input: banana cat GIF animation"
              class="rounded border border-muted"
              style="width: 150px; height: 330px; image-rendering: pixelated;"
            >
            <span class="text-xs text-muted">Input GIF (75 × 165 px)</span>
          </div>
        </div>
        <p class="text-muted leading-relaxed">
          Drop the file into Claude and describe what you need:
        </p>
        <img
          src="/blog/spritesheet-forge-mcp-demo/demo-1.png"
          alt="Claude conversation: user sends GIF and asks for spritesheet conversion"
          class="rounded-lg border border-muted w-full"
        >
        <p class="text-muted leading-relaxed">
          Claude uploads the file automatically and calls <code class="text-primary">gif_to_spritesheet</code>
          with background removal enabled:
        </p>
        <img
          src="/blog/spritesheet-forge-mcp-demo/demo-2.png"
          alt="Claude calling gif_to_spritesheet MCP tool"
          class="rounded-lg border border-muted w-full"
        >
        <p class="text-muted leading-relaxed">
          The result comes back with the exact pixel dimensions and Unity setup steps included:
        </p>
        <img
          src="/blog/spritesheet-forge-mcp-demo/demo-3.png"
          alt="Claude returning spritesheet result with frame dimensions table"
          class="rounded-lg border border-muted w-full"
        >
        <div class="flex flex-col gap-2 mt-2">
          <div class="overflow-x-auto rounded border border-muted p-3 bg-muted/10">
            <img
              src="/blog/spritesheet-forge-mcp-demo/spritesheet.png"
              alt="Output: banana cat spritesheet, 9 frames in a single row"
              style="height: 165px; width: auto; image-rendering: pixelated;"
            >
          </div>
          <span class="text-xs text-muted">
            Output spritesheet — 675 × 165 px, 9 frames in a single row, transparent background
          </span>
        </div>
      </section>

      <section class="space-y-4">
        <h2 class="text-xl font-semibold">Demo: Sprite Atlas JSON</h2>
        <p class="text-muted leading-relaxed">
          A single follow-up is all it takes to get a TexturePacker-compatible atlas:
        </p>
        <img
          src="/blog/spritesheet-forge-mcp-demo/demo-4.png"
          alt="Claude calling split_spritesheet to generate Sprite Atlas JSON"
          class="rounded-lg border border-muted w-full"
        >
        <img
          src="/blog/spritesheet-forge-mcp-demo/demo-5.png"
          alt="Claude returning corrected Sprite Atlas with frame coordinates table"
          class="rounded-lg border border-muted w-full"
        >
        <p class="text-muted leading-relaxed">
          You can ask Claude to validate the output against the TexturePacker JSON Hash spec — it will
          check every required field and report back:
        </p>
        <img
          src="/blog/spritesheet-forge-mcp-demo/demo-6.png"
          alt="Claude validating the Sprite Atlas JSON format — all checks passed"
          class="rounded-lg border border-muted w-full"
        >
        <p class="text-muted leading-relaxed">
          The final atlas — all 9 frames at 75 × 165 px, ready to load in Unity, Godot
          (<code class="text-primary">AtlasTexture</code>), or any TexturePacker-compatible engine:
        </p>
        <pre class="bg-muted/30 rounded-lg p-4 text-xs overflow-x-auto leading-relaxed"><code>{
  "frames": {
    "frame_0.png": { "frame": { "x": 0,   "y": 0, "w": 75, "h": 165 }, "rotated": false, "trimmed": false, "spriteSourceSize": { "x": 0, "y": 0, "w": 75, "h": 165 }, "sourceSize": { "w": 75, "h": 165 } },
    "frame_1.png": { "frame": { "x": 75,  "y": 0, "w": 75, "h": 165 }, "rotated": false, "trimmed": false, "spriteSourceSize": { "x": 0, "y": 0, "w": 75, "h": 165 }, "sourceSize": { "w": 75, "h": 165 } },
    "frame_2.png": { "frame": { "x": 150, "y": 0, "w": 75, "h": 165 }, "rotated": false, "trimmed": false, "spriteSourceSize": { "x": 0, "y": 0, "w": 75, "h": 165 }, "sourceSize": { "w": 75, "h": 165 } },
    "frame_3.png": { "frame": { "x": 225, "y": 0, "w": 75, "h": 165 }, "rotated": false, "trimmed": false, "spriteSourceSize": { "x": 0, "y": 0, "w": 75, "h": 165 }, "sourceSize": { "w": 75, "h": 165 } },
    "frame_4.png": { "frame": { "x": 300, "y": 0, "w": 75, "h": 165 }, "rotated": false, "trimmed": false, "spriteSourceSize": { "x": 0, "y": 0, "w": 75, "h": 165 }, "sourceSize": { "w": 75, "h": 165 } },
    "frame_5.png": { "frame": { "x": 375, "y": 0, "w": 75, "h": 165 }, "rotated": false, "trimmed": false, "spriteSourceSize": { "x": 0, "y": 0, "w": 75, "h": 165 }, "sourceSize": { "w": 75, "h": 165 } },
    "frame_6.png": { "frame": { "x": 450, "y": 0, "w": 75, "h": 165 }, "rotated": false, "trimmed": false, "spriteSourceSize": { "x": 0, "y": 0, "w": 75, "h": 165 }, "sourceSize": { "w": 75, "h": 165 } },
    "frame_7.png": { "frame": { "x": 525, "y": 0, "w": 75, "h": 165 }, "rotated": false, "trimmed": false, "spriteSourceSize": { "x": 0, "y": 0, "w": 75, "h": 165 }, "sourceSize": { "w": 75, "h": 165 } },
    "frame_8.png": { "frame": { "x": 600, "y": 0, "w": 75, "h": 165 }, "rotated": false, "trimmed": false, "spriteSourceSize": { "x": 0, "y": 0, "w": 75, "h": 165 }, "sourceSize": { "w": 75, "h": 165 } }
  },
  "meta": {
    "app": "PNG2Spritesheet",
    "version": "1.0",
    "image": "file.png",
    "format": "RGBA8888",
    "size": { "w": 675, "h": 165 },
    "scale": "1"
  }
}</code></pre>
      </section>

      <section class="space-y-3">
        <h2 class="text-xl font-semibold">Try It Yourself</h2>
        <p class="text-muted leading-relaxed">
          Spritesheet Forge is open source and free to use (100 operations/month on the free tier):
        </p>
        <ul class="space-y-2 text-sm text-muted">
          <li class="flex items-start gap-2">
            <UIcon name="i-lucide-cpu" class="text-primary shrink-0 mt-0.5" />
            <span>
              <strong>MCP setup guide</strong> —
              <NuxtLink :to="localePath('/mcp')" class="text-primary underline underline-offset-2">
                clawstudiouo.com/mcp
              </NuxtLink>
            </span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-lucide-package" class="text-primary shrink-0 mt-0.5" />
            <span>
              <strong>One-click install on Smithery</strong> —
              <a
                href="https://smithery.ai/servers/lxya98874322688423/spritesheet-forge"
                target="_blank"
                rel="noopener"
                class="text-primary underline underline-offset-2"
              >smithery.ai</a>
            </span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-lucide-github" class="text-primary shrink-0 mt-0.5" />
            <span>
              <strong>GitHub repository</strong> —
              <a
                href="https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge"
                target="_blank"
                rel="noopener"
                class="text-primary underline underline-offset-2"
              >LAXY9887/Game-Dev.-Spritesheet-Forge</a>
            </span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-lucide-book-open" class="text-primary shrink-0 mt-0.5" />
            <span>
              <strong>Full API documentation</strong> —
              <a
                href="https://laxy9887.github.io/Game-Dev.-Spritesheet-Forge"
                target="_blank"
                rel="noopener"
                class="text-primary underline underline-offset-2"
              >GitHub Pages</a>
            </span>
          </li>
        </ul>
      </section>
    </template>
  </BlogPostLayout>
</template>
