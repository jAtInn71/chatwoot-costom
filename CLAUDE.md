# Claude Context — chatwoot-custom-master

## Project context (read these first)

For everything you need to know about this project, read these in order:

- **`.antigravity/memory.md`** — what this project is, repo layout, key configuration, build/deploy flow, recent work patterns, open TODOs
- **`.antigravity/RULES.md`** — coding rules (stay in `custom/`), build rules (Vite rebuild required), git rules, file hygiene
- **`.antigravity/PLAN.md`** — current work outline (may be empty)
- **`.antigravity/TASKS.md`** — task board (human view; machine state is `agents/state/tasks.json`)

## How to keep memory fresh — IMPORTANT for Claude

**After any meaningful change or new learning, update `.antigravity/memory.md` and/or `.antigravity/RULES.md` proactively.**

Trigger conditions — update memory if you discovered:
- A non-obvious project fact (where something lives, why it's structured a certain way)
- A new constraint or gotcha (e.g., "X requires rebuild", "Y is hardcoded at build time")
- A working pattern that should not be re-discovered next session
- A path/file/function that's important and easy to miss

Trigger conditions — update rules if you established:
- A new coding/build/git convention
- A "don't do X" lesson learned from a mistake
- A team/project policy

**How to update:**
- Add a small section under the relevant heading (don't restructure)
- Be conservative — write only what you can verify from code/files/git
- Do NOT add speculation or general programming advice
- Keep entries short — 1-3 lines per fact, link to file paths with line numbers

**When NOT to update:**
- Trivial things (formatting fixes, typo corrections)
- Things already documented in `memory.md` / `RULES.md`
- Personal preferences (those go elsewhere)

## How to find things

- **Cross-repo text search:** `dev-rag query "<text>"` — searches all configured repos' markdown/yaml/json files
- **Code search:** use the `Grep` tool — `dev-rag` skips `.rb`, `.vue`, `.js` files
- **File location:** use `Glob` for known patterns, `Grep` for symbols

## Project shortcuts

| Want to | Look at |
|---|---|
| Change ElevenLabs agent ID | `custom/widget/store/modules/appConfig.js:36` (build arg `VITE_ELEVENLABS_AGENT_ID`) |
| Edit voice button UI | `custom/widget/components/ElevenLabsVoiceButton.vue` |
| Edit chat input wrapper | `custom/widget/components/ChatInputWrap.vue` |
| Backend customizations | `custom/backend/{controllers,models,migrations,views}/` |
| Build new image | `./build.sh [agent_id] [voice_id] [agent_name] [tag]` |
| Local stack | `docker compose up -d` (dashboard at http://localhost:3000) |

## Critical "don't" list

- **Don't edit upstream Chatwoot files** — only work in `custom/`. Upstream edits break future Chatwoot upgrades.
- **Don't commit** `custom/widget/assets/vite/` (build output, gitignored).
- **Don't commit** `.env` (secrets).
- **Don't expect** runtime config changes for ElevenLabs agent ID — Vite inlines env at build time. Rebuild required.
