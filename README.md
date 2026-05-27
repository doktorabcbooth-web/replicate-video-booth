# Replicate Video Booth

iPad-first Next.js + TypeScript scaffold for capturing a selfie, sending to Replicate, composing a result video with FFmpeg overlay, and emailing the final video.

Setup (macOS zsh):

1. Copy env example:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Run dev server:

```bash
npm run dev
```

Files of interest:

- `app/` - Next.js app router UI and pages
- `pages/api/` - Serverless API route handlers
- `lib/` - Replicate, ffmpeg, storage, and email helpers
- `uploads/` - Local upload storage (created at runtime)

Environment variables: see `.env.example`.

This scaffold includes TODOs where you need to wire real API keys and tune Replicate model parameters.

API endpoints (placeholders):

- `POST /api/upload` - multipart upload for selfie, reference video, and logo.
- `POST /api/create-job` - kick off Replicate job using uploaded selfie and reference video.
- `POST /api/process-video` - run FFmpeg overlay to add logo to returned video.
- `POST /api/email` - send final video via SendGrid or SMTP.

Next steps: install deps and run `npm run dev`. Fill `.env` with your keys and implement Replicate model details in `lib/replicate.ts`.
