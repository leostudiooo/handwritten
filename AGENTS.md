# Repository Guidelines

## Project Structure & Module Organization

This is a Vite + React + TypeScript app for handwriting image standardization. Main application flow lives in `src/App.tsx`; the browser entry point is `src/main.tsx`; global styles are in `src/index.css`. Reusable UI belongs in `src/components/`, image-processing logic in `src/utils/`, shared interfaces in `src/types/`, and worker-side processing in `src/workers/cvWorker.ts`. Static/reference files belong in `assets/`. Root config files include `vite.config.ts`, `tsconfig.json`, `package.json`, and `.env.example`.

## Build, Test, and Development Commands

Prefer Bun because this repo includes `bun.lock`.

- `bun install`: install dependencies.
- `bun run dev`: start the Vite dev server on port 3000 and host `0.0.0.0`.
- `bun run build`: create a production build in `dist/`.
- `bun run preview`: preview the production build locally.
- `bun run lint`: run TypeScript checking with `tsc --noEmit`.
- `bun run clean`: remove generated `dist/` and `server.js` outputs.

## Coding Style & Naming Conventions

Use TypeScript and React function components. Follow the existing style: two-space indentation, single quotes, semicolons, PascalCase component files such as `SettingsModal.tsx`, and camelCase functions/variables such as `runStandardizationPipeline`. Keep shared types in `src/types/index.ts` and avoid duplicating shape definitions in components. Use Tailwind utility classes in JSX for layout and styling. Keep CV/image-processing code isolated in `src/utils/` or `src/workers/` so UI components stay focused on interaction state.

## Testing Guidelines

There is no automated test script yet. For every change, run `bun run lint` and `bun run build` before opening a PR. When adding tests, prefer colocated `*.test.ts` or `*.test.tsx` files near the module under test, or a dedicated `src/__tests__/` directory for integration flows. Use deterministic fixtures for image-processing behavior and mock browser APIs such as Canvas, ImageData, and Web Workers where needed.

## Commit & Pull Request Guidelines

Recent history uses concise Conventional Commit-style subjects, for example `feat: upgrade processing engine and pipeline config` and `refactor: standardize binarization to manual thresholding`. Use imperative, scoped summaries with prefixes like `feat:`, `fix:`, `refactor:`, or `docs:`.

PRs should describe the user-visible change, list validation commands run, link related issues, and include screenshots or sample output images for UI or CV pipeline changes. Call out any configuration or environment changes explicitly.

## Security & Configuration Tips

Copy `.env.example` when local secrets are needed, and never commit real API keys. `GEMINI_API_KEY` and `APP_URL` are environment-specific. Preserve the `DISABLE_HMR` handling in `vite.config.ts`; it is used to control file watching in AI Studio-style environments.
