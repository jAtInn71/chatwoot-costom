# Repository Autonomy Rules — chatwoot-custom-master

Short index of rules. Detailed rules live in `.antigravity/details/rules/`.

---

## Code change rules

- **Stay inside `custom/`.** This is a Chatwoot fork — never edit upstream files unless absolutely necessary. All customizations belong in `custom/widget/`, `custom/backend/`, `custom/dashboard/`. Editing upstream files makes future Chatwoot upgrades painful.
- **Widget changes need a rebuild.** Anything under `custom/widget/` is bundled by Vite at Docker build time. After editing, run `./build.sh` and redeploy. There is no hot-reload in the Docker setup.
- **Don't commit build output.** `custom/widget/assets/vite/` is gitignored. Rebuild it; don't ship it.
- **Don't commit secrets.** `.env` is gitignored. ElevenLabs keys, DB passwords, etc. go there.

## Build / deploy rules

- Use `build.sh` for image builds — pass agent ID/voice ID as args, don't hardcode in source.
- The default agent ID `agent_6601kc1fqeecfc88s7d52jde0syq` is a **fallback only**. Production builds should pass the real ID via build args.
- After a rebuild: `docker compose down && docker compose up -d` to pick up the new image.

## Git rules

- Branch off `main`.
- Commit messages: imperative, lowercase prefix when applicable (`fix:`, `feat:`, etc.) — see git history for style.
- Don't force-push `main`.
- `.harness/` is gitignored (machine-specific). `.antigravity/` IS committed (team-shared SSOT).

## File hygiene

- `*.bak`, `*.bak2`, `*.map` are not allowed in commits (gitignored).
- `logs/` is gitignored.
- Do not introduce new top-level directories without updating `.antigravity/memory.md`.

## Working with the harness

- `.antigravity/RULES.md` (this file), `PLAN.md`, `TASKS.md`, `memory.md` — keep short, link to details under `.antigravity/details/`.
- `agents/state/tasks.json` is the canonical machine-readable task state. `TASKS.md` is the human view.
- After meaningful changes, run `harness validate /d/chatwoot-custom-master` and `dev-rag index`.

## TODO — to be filled by team

- Coding style / linting rules (ESLint, Rubocop config — to be documented)
- Test policy (when are tests required, what's the minimum coverage expectation)
- PR review policy (who approves what)
- Release / tagging strategy
