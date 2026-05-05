<!-- app/pages/blog/gif-to-spritesheet-unity-godot.vue -->
<script setup lang="ts">
const localePath = useLocalePath()
</script>

<template>
  <BlogPostLayout
    title-key="blog.posts.gifToSpritesheetUnityGodot.title"
    description-key="blog.posts.gifToSpritesheetUnityGodot.description"
    date="2026-05-05"
    :reading-time="8"
  >
    <template #content>
      <section class="space-y-3">
        <h2 class="text-xl font-semibold">What Is a Spritesheet?</h2>
        <p class="text-muted leading-relaxed">
          A spritesheet packs multiple animation frames into a single image file. Instead of loading
          dozens of individual PNGs at runtime, your game engine reads one image and slices it into
          frames on demand. This reduces draw calls, cuts asset load time, and simplifies animation
          state management — especially as your character roster grows.
        </p>
        <p class="text-muted leading-relaxed">
          Both Unity and Godot have first-class support for spritesheets. Unity's <strong>Sprite Editor</strong>
          handles slicing, while Godot's <strong>SpriteFrames</strong> resource imports them directly.
          The catch: neither engine accepts animated GIFs as input. You need the spritesheet first.
        </p>
      </section>

      <section class="space-y-3">
        <h2 class="text-xl font-semibold">Step 1: Prepare Your GIF</h2>
        <p class="text-muted leading-relaxed">
          Before converting, a few things to check:
        </p>
        <ul class="space-y-2 text-sm text-muted">
          <li class="flex items-start gap-2">
            <UIcon name="i-lucide-check" class="text-primary shrink-0 mt-0.5" />
            <span><strong>Consistent canvas size</strong> — all frames should be the same dimensions. If your GIF
            was exported from Aseprite or Pyxel Edit, this is already guaranteed.</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-lucide-check" class="text-primary shrink-0 mt-0.5" />
            <span><strong>Transparent background</strong> — game engines composite sprites over a game background.
            A solid white or black GIF background will create a visible box around your character.</span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-lucide-check" class="text-primary shrink-0 mt-0.5" />
            <span><strong>File size under 20 MB</strong> — the converter handles files up to 20 MB. Most pixel-art
            animations are well under 1 MB.</span>
          </li>
        </ul>
      </section>

      <section class="space-y-3">
        <h2 class="text-xl font-semibold">Step 2: Convert Using the Web Tool</h2>
        <p class="text-muted leading-relaxed">
          The fastest path is the
          <NuxtLink :to="localePath('/tools/gif-to-sprite')" class="text-primary hover:underline">
            GIF to Spritesheet
          </NuxtLink>
          tool — no account needed, no installation, processes entirely in the browser.
        </p>
        <ol class="space-y-3 text-sm text-muted">
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">1.</span>
            <span>Upload your GIF. A preview of the first frame appears immediately.</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">2.</span>
            <span>
              Choose the <strong>output mode</strong>: <em>Spritesheet</em> for a grid image (recommended for Unity/Godot),
              or <em>Frames</em> if you need each frame as a separate file.
            </span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">3.</span>
            <span>
              Set <strong>columns</strong>. A 12-frame walk cycle works well as 4 columns × 3 rows or 6 × 2.
              Unity and Godot both slice by rows and columns, so any layout works — just note the values.
            </span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">4.</span>
            <span>
              Enable <strong>Trim transparent borders</strong> if your frames have large empty margins.
              This reduces the spritesheet size and matches what TexturePacker does automatically.
            </span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">5.</span>
            <span>Click <strong>Convert</strong> and download the PNG.</span>
          </li>
        </ol>
      </section>

      <section class="space-y-3">
        <h2 class="text-xl font-semibold">Step 3: Convert Using the MCP Server (Claude Users)</h2>
        <p class="text-muted leading-relaxed">
          If you work with Claude Desktop or Claude Code, the
          <NuxtLink :to="localePath('/mcp')" class="text-primary hover:underline">Spritesheet Forge MCP server</NuxtLink>
          lets you run the same conversion through a natural language prompt — no browser needed.
        </p>
        <p class="text-muted leading-relaxed">
          Once connected, you can tell Claude:
        </p>
        <pre class="bg-muted/20 rounded-lg p-4 text-sm overflow-x-auto"><code>Convert character_walk.gif into a spritesheet with 4 columns.
Trim the transparent borders before packing.</code></pre>
        <p class="text-muted leading-relaxed">
          Claude calls <code class="bg-muted/20 px-1.5 py-0.5 rounded text-sm">gif_to_spritesheet</code> (and
          optionally <code class="bg-muted/20 px-1.5 py-0.5 rounded text-sm">trim_png</code> first), then
          returns a download URL. The result is identical to the web tool.
        </p>
        <p class="text-muted leading-relaxed">
          This is particularly useful inside a game-dev session where you're already asking Claude to
          help write animation controller code — you can convert assets and write the importer logic
          in the same conversation.
        </p>
      </section>

      <section class="space-y-3">
        <h2 class="text-xl font-semibold">Step 4: Import into Unity</h2>
        <p class="text-muted leading-relaxed">
          Drop the PNG into your Unity <strong>Assets</strong> folder. Then:
        </p>
        <ol class="space-y-2 text-sm text-muted">
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">1.</span>
            <span>Select the PNG in the Project window.</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">2.</span>
            <span>
              In the <strong>Inspector</strong>, set <em>Texture Type</em> to <strong>Sprite (2D and UI)</strong>
              and <em>Sprite Mode</em> to <strong>Multiple</strong>.
            </span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">3.</span>
            <span>Click <strong>Sprite Editor</strong> → <strong>Slice</strong> → choose <em>Grid By Cell Count</em>.
            Enter the column and row counts you used during conversion.</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">4.</span>
            <span>Click <strong>Apply</strong>. Unity generates the individual sprite slices.</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">5.</span>
            <span>
              Select all slices in the Project window, drag them into the <strong>Hierarchy</strong>,
              and Unity will prompt you to create an <strong>Animation Clip</strong> automatically.
            </span>
          </li>
        </ol>
        <p class="text-muted leading-relaxed">
          Set the clip's <strong>Sample Rate</strong> to match your original GIF frame rate. GIFs store
          delay in centiseconds — a 100ms delay per frame equals 10 fps.
        </p>
      </section>

      <section class="space-y-3">
        <h2 class="text-xl font-semibold">Step 5: Import into Godot</h2>
        <p class="text-muted leading-relaxed">
          Godot's <strong>AnimatedSprite2D</strong> node uses a <strong>SpriteFrames</strong> resource,
          which reads spritesheets natively.
        </p>
        <ol class="space-y-2 text-sm text-muted">
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">1.</span>
            <span>Add an <strong>AnimatedSprite2D</strong> node to your scene.</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">2.</span>
            <span>
              In the Inspector, create a new <strong>SpriteFrames</strong> resource and open the
              <strong>SpriteFrames</strong> panel at the bottom of the editor.
            </span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">3.</span>
            <span>
              In the panel, click <strong>Add frames from sprite sheet</strong> (grid icon).
              Select your PNG, then set the grid dimensions (columns × rows) to match your spritesheet layout.
            </span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">4.</span>
            <span>
              Select all frames (or a subset for a specific action), click <strong>Add N frame(s)</strong>.
            </span>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-primary font-semibold shrink-0">5.</span>
            <span>
              Set the <strong>FPS</strong> in the SpriteFrames panel. Use
              <code class="bg-muted/20 px-1 rounded">1000 ÷ frame_delay_ms</code> — for a 100ms GIF, that's 10 FPS.
            </span>
          </li>
        </ol>
        <p class="text-muted leading-relaxed">
          Call <code class="bg-muted/20 px-1.5 py-0.5 rounded text-sm">$AnimatedSprite2D.play("animation_name")</code>
          from GDScript to start the animation.
        </p>
      </section>

      <section class="space-y-3">
        <h2 class="text-xl font-semibold">Tips &amp; Common Pitfalls</h2>
        <ul class="space-y-3 text-sm text-muted">
          <li class="flex items-start gap-2">
            <UIcon name="i-lucide-lightbulb" class="text-primary shrink-0 mt-0.5" />
            <span>
              <strong>Power-of-2 dimensions</strong> — some older mobile GPUs require textures with dimensions
              that are powers of 2 (64, 128, 256, 512…). If you're targeting mobile, enable the
              <em>Power of 2</em> option in the PNG to Spritesheet tool to auto-pad the canvas.
            </span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-lucide-lightbulb" class="text-primary shrink-0 mt-0.5" />
            <span>
              <strong>Pre-trim for tight atlases</strong> — if your source art has large transparent margins,
              trim them before packing. The
              <NuxtLink :to="localePath('/tools/png-trim')" class="text-primary hover:underline">PNG Trim</NuxtLink>
              tool strips transparent edges individually; then
              <NuxtLink :to="localePath('/tools/png-to-spritesheet')" class="text-primary hover:underline">PNG to Spritesheet</NuxtLink>
              packs the tight frames into the atlas.
            </span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-lucide-lightbulb" class="text-primary shrink-0 mt-0.5" />
            <span>
              <strong>Multiple animations in one sheet</strong> — arrange different actions as rows
              (idle = row 0, walk = row 1, attack = row 2). Both Unity and Godot let you specify
              row ranges when slicing, so you can map each row to a named animation clip.
            </span>
          </li>
          <li class="flex items-start gap-2">
            <UIcon name="i-lucide-lightbulb" class="text-primary shrink-0 mt-0.5" />
            <span>
              <strong>GIF frame delays are not uniform</strong> — if your GIF uses variable frame delays,
              the converter uses the delay of the first frame as the uniform interval. Check the
              resulting animation speed and adjust the FPS setting in your engine if needed.
            </span>
          </li>
        </ul>
      </section>

      <section class="space-y-4">
        <h2 class="text-xl font-semibold">Related Tools</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NuxtLink :to="localePath('/tools/gif-to-sprite')" class="group block">
            <UCard class="transition-shadow group-hover:shadow-md">
              <div class="flex items-center gap-3">
                <UIcon name="i-lucide-grid-3x3" class="text-xl text-primary shrink-0" />
                <div>
                  <p class="font-medium text-sm">GIF to Spritesheet</p>
                  <p class="text-xs text-muted">Web tool used in this guide</p>
                </div>
              </div>
            </UCard>
          </NuxtLink>
          <NuxtLink :to="localePath('/tools/png-trim')" class="group block">
            <UCard class="transition-shadow group-hover:shadow-md">
              <div class="flex items-center gap-3">
                <UIcon name="i-lucide-scissors" class="text-xl text-primary shrink-0" />
                <div>
                  <p class="font-medium text-sm">PNG Trim</p>
                  <p class="text-xs text-muted">Remove transparent borders before packing</p>
                </div>
              </div>
            </UCard>
          </NuxtLink>
          <NuxtLink :to="localePath('/tools/png-to-spritesheet')" class="group block">
            <UCard class="transition-shadow group-hover:shadow-md">
              <div class="flex items-center gap-3">
                <UIcon name="i-lucide-layout-grid" class="text-xl text-primary shrink-0" />
                <div>
                  <p class="font-medium text-sm">PNG to Spritesheet</p>
                  <p class="text-xs text-muted">Pack individual frames into an atlas</p>
                </div>
              </div>
            </UCard>
          </NuxtLink>
          <NuxtLink :to="localePath('/mcp')" class="group block">
            <UCard class="transition-shadow group-hover:shadow-md">
              <div class="flex items-center gap-3">
                <UIcon name="i-lucide-cpu" class="text-xl text-primary shrink-0" />
                <div>
                  <p class="font-medium text-sm">Spritesheet Forge MCP</p>
                  <p class="text-xs text-muted">Do all of this from Claude</p>
                </div>
              </div>
            </UCard>
          </NuxtLink>
        </div>
      </section>
    </template>
  </BlogPostLayout>
</template>
