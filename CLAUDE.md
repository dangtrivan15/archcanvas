# CLAUDE.md

## Commands

All build, test, and lint commands are centralized in `package.json` scripts. Always use `npm run <script>` rather than invoking tools directly — scripts encode the correct flags, configs, and sequencing.

There is no default `playwright.config.ts`. E2E configs are explicitly named (`playwright.config.no-bridge.ts`, `playwright.config.bridge.ts`) to make the test environment clear. Always use the npm scripts to run them.

## Debugging

For UI issues, use the `playwright-cli` skill to interact with the running app in a real browser — navigate, inspect elements, take screenshots. This is a web app, so visual verification is often the fastest way to diagnose problems.

## Architecture

- Design doc: [docs/archcanvas-v2-design.md](docs/archcanvas-v2-design.md)
- Progress history: [docs/progress/](docs/progress)
