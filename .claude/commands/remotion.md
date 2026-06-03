---
name: remotion
description: Create programmatic videos with Remotion and React. Use when building video content, animations, data visualizations as video, explainer videos, or any programmatic video generation task.
metadata:
  trigger: Video creation, animations, programmatic video, Remotion, motion graphics, video export
  author: Based on jhartquist/claude-remotion-kickstart and Remotion docs
  source: https://github.com/jhartquist/claude-remotion-kickstart
---

# Remotion Skill

Create videos programmatically using React and TypeScript with Remotion.

## Core Concepts

**Remotion** renders React components to video. Each frame is a React render at a specific time.

```tsx
import { useCurrentFrame, interpolate, spring, Sequence, Composition } from "remotion";
```

### Key Hooks

**`useCurrentFrame()`** — Returns current frame number (0-based). Use to drive all animations.

**`interpolate(frame, [from, to], [outputFrom, outputTo], options?)`** — Maps frame range to value range.
```tsx
const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
```

**`spring({ frame, fps, config? })`** — Physics-based spring animation.
```tsx
const scale = spring({ frame, fps, config: { damping: 200 } });
```

### Key Components

**`<Sequence from={startFrame} durationInFrames={duration}>`** — Renders children only during specified frame range.

**`<Composition id="MyVideo" component={MyVideo} durationInFrames={150} fps={30} width={1920} height={1080} />`** — Registers a video composition.

**`<AbsoluteFill>`** — Fills the entire composition viewport (position: absolute, inset: 0).

## Common Patterns

### Fade in
```tsx
const frame = useCurrentFrame();
const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
return <div style={{ opacity }}>...</div>;
```

### Slide in from bottom
```tsx
const frame = useCurrentFrame();
const translateY = interpolate(frame, [0, 30], [100, 0], { extrapolateRight: "clamp" });
return <div style={{ transform: `translateY(${translateY}px)` }}>...</div>;
```

### Spring scale in
```tsx
const frame = useCurrentFrame();
const { fps } = useVideoConfig();
const scale = spring({ frame, fps, config: { mass: 0.5, damping: 20 } });
return <div style={{ transform: `scale(${scale})` }}>...</div>;
```

### Type-on text
```tsx
const frame = useCurrentFrame();
const text = "Hello World";
const charsToShow = Math.floor(interpolate(frame, [0, 60], [0, text.length], { extrapolateRight: "clamp" }));
return <div>{text.slice(0, charsToShow)}</div>;
```

## Project Structure

```
src/
  Root.tsx              # Register all <Composition>s here
  compositions/
    MyVideo.tsx         # Individual video compositions
    components/         # Reusable video components
  assets/               # Images, fonts, audio
public/
  images/
  fonts/
remotion.config.ts      # Remotion configuration
```

## Setup

```bash
# New project
npx create-video@latest

# Install in existing React project
npm install remotion @remotion/cli

# Preview
npx remotion studio

# Render to file
npx remotion render src/Root.tsx MyComposition out/video.mp4

# With specific codec
npx remotion render --codec=h264 src/Root.tsx MyComposition out/video.mp4
```

## Frame Math

```
fps = 30 (standard)
duration_seconds = durationInFrames / fps

1 second  = 30 frames
2 seconds = 60 frames
5 seconds = 150 frames
10 seconds = 300 frames
```

## Audio / Video Assets

```tsx
import { Audio, Video, staticFile } from "remotion";

// Audio
<Audio src={staticFile("audio/bg.mp3")} volume={0.5} />

// Video overlay
<Video src={staticFile("video/clip.mp4")} />
```

## useVideoConfig

```tsx
const { width, height, fps, durationInFrames } = useVideoConfig();
```

## Tailwind CSS Support

```bash
npm install @remotion/tailwind
# Add to remotion.config.ts:
# enableTailwind()
```

## Export Formats

- **MP4 (h264)**: Universal, web-compatible — `--codec=h264`
- **WebM**: Smaller, browser-native — `--codec=vp8`
- **GIF**: Animated, no audio — `--codec=gif`
- **PNG sequence**: Lossless frames — `--codec=png`
- **ProRes**: High quality for editing — `--codec=prores`

## HumbleTrust Video Use Cases

- Trading demo videos (show the trade flow)
- Token score animations (HexScore spinning up)
- Marketing explainer clips
- Pitch deck screen recordings with overlays
- Onboarding tutorial videos

## How to Invoke

When user says `/remotion [description]` or wants to create a video:

1. Identify: what frames/scenes are needed?
2. Define composition: duration, fps, dimensions
3. Build scene-by-scene with `<Sequence>` blocks
4. Add transitions using `interpolate` / `spring`
5. Export with the right codec for the use case
6. Preview with `npx remotion studio` before final render
