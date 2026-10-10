<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Branch and deployment workflow

- Do all development on the `dev` branch. `dev` started as an exact copy of `main` (`3884c40`).
- Do not use the `local` branch; it is retired and kept only as a backup.
- Merge `dev` into `main` only after the changes are tested and the user explicitly approves.
- Never push, merge or deploy to `main` without explicit user approval. Vercel deploys production from `main`.
- Do not stage `demo-assets/`, `reviewflow-demo/`, `.local/` or `.env*` unless explicitly asked.
