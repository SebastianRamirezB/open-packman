# AGENTS.md

## Project

Vanilla JS Pac-Man MVP. No build, no bundler, no dependencies. Open `src/index.html` in a browser to run; there is no dev server or test suite.

## Architecture

- Entry point: `src/index.html`, which loads scripts in a fixed order via plain `<script>` tags (no modules).
- Load order matters: `maze.js` -> `game.js` -> `render.js` -> `main.js`. Scripts share state through browser globals (`window.MAZE`, `window.TUNNEL_ROW`, `window.PACMAN_START`, `window.GHOST_STARTS`) declared in `maze.js`. Do not convert to ES modules without rewiring the globals.
- `src/js/`
  - `maze.js`: parses the 28x31 ASCII maze into `MAZE` (numeric grid) and exposes start positions. Source of truth for level geometry.
  - `game.js`: state + rules (`createGame`, `update`). Depends on maze.js globals. `game.grid` is a per-game copy of `MAZE` so dots can be eaten without mutating the original.
  - `render.js`: `draw(ctx, game, frame)` — canvas arcade rendering. Reads `game.grid`, never `MAZE`, so consumed dots reflect on screen.
  - `main.js`: rAF loop, keyboard input, overlay screens. Owns `createGame`/`update`/`draw` calls.
- Maze cell encoding (`parseTile`): `#`=1 wall, `.`=2 dot, ` `=0 empty, `-`=3 pen door. `TUNNEL_ROW=14` wraps horizontally outside the grid.
- Movement is sub-cell float positions aligned to grid via `PACMAN_SPEED`/`GHOST_SPEED` (1/8 and 1/10 cell/frame). Changing those speeds also changes alignment timing.

## Conventions

- Code comments and UI strings are in Spanish; keep that when editing.
- Comments at the top of each JS file document its role and global dependencies — preserve them.
- Code style: single quotes, `const`-first, spaces inside args (`f( x )`). Match it.

## Workflow: Spec Driven Development

This repo exists to practice the spec-driven approach shipped as OpenCode skills (`spec`, `spec-impl`, pinned in `skills-lock.json`, sourced from `klerith/fernando-skills`). New work should go through:
1. `spec` skill — design the spec, get it to "Approved".
2. `spec-impl` skill — creates a branch named after the spec and implements step by step with diff review pauses.

Don't write features directly without a spec unless the change is trivial.

## Gotchas

- Only one commit ("first commit") so far; expect to establish history as specs are implemented.
- Editing the maze strings in `maze.js` is the way to change level layout — keep the vertical symmetry around the axis between columns 13 and 14 (noted in the file header).