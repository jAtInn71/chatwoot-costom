# Dev Harness Core — Complete Guide (Hinglish)

> **For:** Windows (Git Bash) + macOS users
> **Goal:** Zero se le ke "AI ko full project context milta rehta hai" tak ka complete journey
> **Last updated:** 2026-05-06

---

## Table of Contents

1. [Dev Harness kya hai aur kyun chahiye](#1-dev-harness-kya-hai)
2. [Prerequisites](#2-prerequisites)
3. [Step 1 — Repository clone/setup karna](#3-step-1--repository-clone)
4. [Step 2 — Install (Windows + Mac)](#4-step-2--install)
5. [Step 3 — Project me initialize karna](#5-step-3--project-init)
6. [Step 4 — Validate karna](#6-step-4--validate)
7. [Step 5 — RAG indexing setup](#7-step-5--rag-indexing)
8. [Step 6 — `.antigravity/` files fill karna](#8-step-6--files-fill-karna)
9. [Step 7 — AI ke saath use karna](#9-step-7--ai-ke-saath-use-karna)
10. [Daily workflow](#10-daily-workflow)
11. [Troubleshooting](#11-troubleshooting)
12. [Command cheat sheet](#12-command-cheat-sheet)

---

## 1. Dev Harness kya hai

### Ek line me

Ek **scaffolding tool** jo har project me ek standard folder structure laga deta hai, taaki AI agents (Claude Code, Codex, Gemini, Antigravity) ko **fixed jagah par "rules + memory + plan + tasks"** milein — yaani **AI ko full project context har baar milta rahe**.

### Yeh khud AI nahi hai

Yeh sirf **discipline layer** hai AI ke around. 500 lines ke aaspaas bash + python code hai. Magic koi nahi — bas convention force karta hai:
- "Har repo me yahan rules likh"
- "Yahan memory rakh"
- "Yahan tasks track kar"

### 3 main components

| Component | Kaam |
|---|---|
| **`harness` CLI** | Project me overlay banata hai (`.antigravity/`, `agents/state/`, `docs/engineering/`) |
| **`dev-rag`** | Local SQLite FTS5 search — saare configured repos me se text dhundhta hai |
| **File templates** | `RULES.md`, `memory.md`, `PLAN.md`, `TASKS.md` etc. — AI-readable SSOT |

### Kab milega fayda?

- Roz Claude Code / Codex use karte ho — har baar AI ko "project kya hai" batane se thak gaye
- Multi-repo workflow hai — ek query me sab repos search karna chahte ho
- Team me kaam karte ho — sab AI agents ko same context milna chahiye

---

## 2. Prerequisites

### Common (dono OS pe)

- **Git** — installed
- **Bash** — Mac me built-in, Windows me **Git Bash** (Git ke saath aata hai)
- **Python 3** — `python --version` se check karo
- Optional but recommended: **`jq`** (JSON validator), **`sqlite3`**

### Windows-specific

- **Git for Windows** install kiya hua ho — yeh Git Bash bhi deta hai
- **Python from python.org** (Microsoft Store wala stub problem karta hai — proper python.org wala chahiye)
- During Python install: "Add Python to PATH" tick zaroor karna

### Mac-specific

```bash
# Homebrew se sab install ho jaata hai
brew install git python3 jq sqlite
```

### Verify karo

```bash
git --version
bash --version
python --version    # Windows
python3 --version   # Mac
```

---

## 3. Step 1 — Repository clone

### Option A — Git se clone karo (recommended)

Apni team ka repo URL ho to:

```bash
# Windows: kahin bhi (e.g., D:\)
cd /d
git clone <YOUR_TEAM_DEV_HARNESS_REPO_URL> dev-harness-core

# Mac: ghar pe rakho
cd ~
git clone <YOUR_TEAM_DEV_HARNESS_REPO_URL> dev-harness-core
```

### Option B — Existing local copy use karo

Agar pehle se download hai (jaise `D:\dev-harness-core-main`), to bas us location ko **CORE_DIR** maan lo. Naam koi bhi ho — `dev-harness-core` ya `dev-harness-core-main` — fark nahi padta.

### Folder structure verify karo

```bash
# Windows
ls /d/dev-harness-core-main

# Mac
ls ~/dev-harness-core
```

Yeh dikhna chahiye:

```
README.md  VERSION  agents  bin  docs  scripts  tools
```

---

## 4. Step 2 — Install

> ⚠️ **Yahan Windows aur Mac alag hain.** Ek-ek karke padho.

### 4A. Mac install (easy path)

```bash
cd ~/dev-harness-core
bash scripts/install.sh
```

Yeh kaam karega:
- `~/.local/bin/harness` symlink banayega
- `~/.local/bin/dev-rag` symlink banayega
- `~/.zshrc` me PATH add karega

Verify:

```bash
source ~/.zshrc
harness version    # 0.1.0 print hona chahiye
```

### 4B. Windows install (Git Bash)

#### Pehle install.sh chala

```bash
cd /d/dev-harness-core-main
bash scripts/install.sh
```

#### Phir PATH .bashrc me add karo

`install.sh` `.zshrc` me line add karta hai but Git Bash `.bashrc` use karta hai:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

#### **IMPORTANT — Windows pe symlinks toot jaate hain**

Git Bash bina dev mode/admin ke `ln -sf` real symlink **nahi banata** — file copy kar deta hai. Isse `harness` script apna `CORE_DIR` galat resolve karta hai (`~/.local` ko core samajhne lagta hai) aur `harness version` chalane pe error aata hai:

```
cat: /c/Users/Jatin/.local/VERSION: No such file or directory
```

#### Fix — wrapper scripts banao

Symlinks ki jagah **wrapper scripts** lagao:

```bash
cat > ~/.local/bin/harness <<'EOF'
#!/usr/bin/env bash
exec /d/dev-harness-core-main/bin/harness "$@"
EOF
chmod +x ~/.local/bin/harness

cat > ~/.local/bin/dev-rag <<'EOF'
#!/usr/bin/env bash
exec python /d/dev-harness-core-main/tools/dev-rag.py "$@"
EOF
chmod +x ~/.local/bin/dev-rag
```

> **Path adjust kar lo** — `/d/dev-harness-core-main` ki jagah jahan tumne repo rakha hai woh path daalo.

#### Verify

```bash
harness version    # 0.1.0 aana chahiye
```

### 4C. Doctor chala (dono OS)

```bash
harness doctor
```

Kuch warnings aayengi (jq, codex, claude, gemini missing) — **error nahi hai**, sirf information. Harness chalega.

---

## 5. Step 3 — Project init

Ab apne project me harness daalo.

### Windows

```bash
harness init /d/chatwoot-custom-master
```

### Mac

```bash
harness init ~/projects/chatwoot-custom-master
```

> **Absolute path do**, relative path nahi.

Last line aani chahiye:
```
initialized project: /d/chatwoot-custom-master
```

### Kya banaya?

Tumhare project me yeh structure aayega ([init-project.sh:24-71](D:/dev-harness-core-main/scripts/init-project.sh)):

```
your-project/
├── .harness/config.json              ← machine-specific (gitignore karo)
├── .antigravity/                     ← AI ka SSOT (commit karo)
│   ├── RULES.md
│   ├── PLAN.md
│   ├── TASKS.md
│   ├── memory.md
│   ├── SKILLS.md
│   ├── STATE.md
│   ├── PARALLELISM_RULES.md
│   ├── VALIDATION_MATRIX.md
│   └── details/{rules,memory,skills,plans,tasks,consensus}/
├── agents/state/tasks.json           ← machine-readable tasks
└── docs/engineering/
    ├── SSOT_POLICY.md
    ├── FILESYSTEM_STRUCTURE_POLICY.md
    └── GIT_POLICIES.md
```

### `.gitignore` update karo

Apne project ke `.gitignore` me add karo:

```
.harness/
```

`.antigravity/` aur `agents/state/tasks.json` ko **commit karna** — yeh team ka shared SSOT hai.

### Safe hai? Kuch toot toh nahi gaya?

**Nahi.** `init-project.sh` me `seed_file()` function check karta hai — agar file pehle se hai to overwrite **nahi** karta. Tumhara existing code safe hai.

---

## 6. Step 4 — Validate

```bash
# Windows
harness validate /d/chatwoot-custom-master

# Mac
harness validate ~/projects/chatwoot-custom-master
```

Saari lines `[ok]` aani chahiye, end me:

```
summary: 0 error(s)
```

Yeh kya check karta hai? ([validate-project.sh:13-37](D:/dev-harness-core-main/scripts/validate-project.sh))

- Required files exist hain ya nahi
- `agents/state/tasks.json` valid JSON hai ya nahi (agar `jq` installed hai)

> Validate sirf "files exist" check karta hai — content quality nahi.

---

## 7. Step 5 — RAG indexing

Ab tumhe ek **local search engine** chahiye jo saare repos me se text dhundh sake. Yeh kaam **`dev-rag`** karta hai (SQLite FTS5 backend, koi external service nahi).

### Saare repos add karo

```bash
# Windows
dev-rag add-root /d/chatwoot-custom-master
dev-rag add-root /d/dev-harness-core-main

# Mac
dev-rag add-root ~/projects/chatwoot-custom-master
dev-rag add-root ~/dev-harness-core
```

### Roots verify karo

```bash
dev-rag list-roots
```

### Index banao

```bash
dev-rag index
```

Output kuch aisa aayega:

```
D:\chatwoot-custom-master: indexed=19 updated=0 skipped=0 removed=0
D:\dev-harness-core-main: indexed=15 updated=0 skipped=0 removed=0
TOTAL: indexed=34 updated=0 skipped=0 removed=0
```

### Numbers ka matlab

| Field | Matlab |
|---|---|
| `indexed` | DB me daala (new + updated) |
| `updated` | Pehle se tha, ab refresh hua (mtime change) |
| `skipped` | Bilkul nahi badla, skip kiya |
| `removed` | Disk se delete ho gaya, DB se bhi hata diya |

### Database kahan rehta hai?

```
~/.local/share/dev-harness/rag/index.db
```

### Test query

```bash
dev-rag query "widget"
dev-rag query "elevenlabs"
dev-rag query "auth middleware"
```

### Konsi files index hoti hain?

`.md`, `.mdx`, `.txt`, `.rst`, `.adoc`, `.json`, `.yaml`, `.yml`, `.toml`

**Code files (`.py`, `.js`, `.vue`) skip ho jaati hain.** Yeh deliberate hai — code ke liye `grep` hai.

### Konsi folders skip hoti hain?

`node_modules`, `dist`, `build`, `.git`, `.cache`, `coverage`, `.next`, etc.

### ⚠️ Windows-only gotcha — `harness rag-index` mat use karna

`harness rag-index` directly `.py` file ko shebang se exec karta hai (`#!/usr/bin/env python3`) — Windows pe yeh fail hota hai:

```
Python was not found; run without arguments to install from the Microsoft Store...
```

**Workaround:** Direct `dev-rag` command use karo (jo wrapper se `python` call karta hai):

```bash
dev-rag index      # ✅ works
dev-rag query "x"  # ✅ works

# yeh windows pe fail hote hain:
harness rag-index  # ❌
harness rag-query  # ❌
```

---

## 8. Step 6 — `.antigravity/` files fill karna

> **Yahan hi asli value hai.** Sirf `init` chalane se files **khali stubs** banti hain — content tumhe (ya AI ko) likhna hota hai.

### Priority order (kaunsi pehle)

1. **`memory.md`** — sabse important. Project ke long-term facts.
2. **`RULES.md`** — coding/build/git rules.
3. **`PLAN.md`** — current work ka outline.
4. **`TASKS.md`** — task board.

### memory.md — project bible

Yeh template follow karo:

```markdown
# Project Memory — <project-name>

## What this project is
<2-3 lines me project ka purpose>

## Repository layout
| Path | What's here |
|---|---|
| `src/...` | <description> |

## Key configuration
<env vars, hardcoded fallbacks, build args>

## How to build / deploy
<commands>

## Recent work patterns
<git log se kya pattern dikhta hai>

## Things to verify / TODO
- <unknowns>
```

### RULES.md — coding/build/git rules

```markdown
# Repository Autonomy Rules

## Code change rules
- Stay inside `<custom dir>` (if it's a fork)
- Don't commit build output
- Don't commit secrets

## Build / deploy rules
- Use `<build script>` for image builds
- After rebuild: <restart commands>

## Git rules
- Branch off `main`
- Commit message style: <example>
- Don't force-push main

## File hygiene
- Don't introduce new top-level dirs without updating memory.md
```

### Pro tip — AI ko bolo fill karne ko

Claude Code ya Codex ke saath:

```
"Mere project ko explore karke .antigravity/memory.md aur RULES.md fill karo.
Sirf jo verify ho sakta hai (file/code se confirm kar sako) woh likho.
Jo nahi pata woh TODO chhod do — guess mat karo."
```

AI tumhare codebase ko padh ke meaningful initial content likh dega.

### Index refresh karo files fill karne ke baad

```bash
dev-rag index
```

(Sirf modified files reindex hongi — fast hai.)

---

## 9. Step 7 — AI ke saath use karna

### Claude Code

Claude Code automatically project root ke files dekhta hai. Jab tum chatwoot project me Claude Code chalate ho:

```bash
cd /d/chatwoot-custom-master
claude
```

Ya VS Code me `Cmd+Esc`/`Ctrl+Esc`. Claude `.antigravity/memory.md` aur `RULES.md` ko read kar sakta hai jab relevant ho.

**Better — `CLAUDE.md` me pointer daalo:**

`D:\chatwoot-custom-master\CLAUDE.md` (root me) banao agar nahi hai:

```markdown
# Claude Context

For project context, rules, and current work see:
- `.antigravity/memory.md` — what this project is, layout, config
- `.antigravity/RULES.md` — coding/build/git rules
- `.antigravity/PLAN.md` — current work
- `.antigravity/TASKS.md` — task board

For cross-repo search use `dev-rag query "<text>"`.
```

Claude Code automatically `CLAUDE.md` load karta hai har session me.

### Codex / Gemini / Antigravity

Same pattern. Har AI tool ka apna config file hota hai (`AGENTS.md`, `GEMINI.md`, etc.) — usme bhi `.antigravity/` folder ka pointer daal do.

### dev-rag with AI

Jab AI ko cross-repo search chahiye:

```bash
dev-rag query "elevenlabs voice button"
```

Output me file paths + relevant chunks aate hain — AI un files ko `Read` se khol ke detail dekh leta hai. **Yeh tokens bachata hai** (full repo crawl nahi karna padta).

---

## 10. Daily workflow

### Morning — kaam shuru karte time

```bash
cd /d/chatwoot-custom-master
git pull                                  # latest changes
dev-rag index                             # index refresh (fast — only changed files)
cat .antigravity/PLAN.md                  # aaj kya karna hai
cat .antigravity/TASKS.md                 # task board check
```

### Naya task shuru karte time

1. `.antigravity/TASKS.md` me task ko **In Progress** me move karo
2. `agents/state/tasks.json` me bhi mirror karo
3. Kaam karo
4. Done hone par dono jagah update + brief summary

### Kuch naya seekha (project ke baare me)

`.antigravity/memory.md` me **immediately** add karo. Kal tum ya AI bhool jaaoge.

Format:
```markdown
## <Topic>

<Fact / lesson>

**Why it matters:** <one line>
```

### Files fill karne ke baad

```bash
dev-rag index    # naya content searchable banane ke liye
```

### PR banate time

```bash
harness validate /d/chatwoot-custom-master    # structure intact hai?
git status                                     # .antigravity/ commit me hai?
git status                                     # .harness/ commit me NAHI hona chahiye
```

---

## 11. Troubleshooting

### `harness: command not found`

PATH me `~/.local/bin` nahi hai.

```bash
echo $PATH | grep .local/bin
```

Nahi mil raha to:

```bash
# Mac
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Windows (Git Bash)
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### `cat: ~/.local/VERSION: No such file or directory`

**Windows-only.** Symlinks tooti hain. [Section 4B](#4b-windows-install-git-bash) ka wrapper fix laga.

### `Python was not found; run without arguments...`

**Windows-only.** `harness rag-index` direct `.py` exec karta hai jo Windows pe tootta hai. **Direct `dev-rag index` use karo**, `harness rag-index` nahi.

### `dev-rag: command not found`

Wrapper script create nahi hua ya executable nahi hai.

```bash
ls -la ~/.local/bin/dev-rag
chmod +x ~/.local/bin/dev-rag
```

### `validate` me errors aa rahe hain

```bash
harness validate /path/to/repo
```

Missing files dikhayega — `harness init <path>` dobara chala (existing files overwrite nahi karega).

### `dev-rag query` me kuch nahi mil raha

Index empty hai ya stale hai:

```bash
dev-rag list-roots    # roots configured hain?
dev-rag index         # index refresh karo
```

### `agents/state/tasks.json` corrupt ho gaya

Backup se restore karo:

```bash
git checkout HEAD -- agents/state/tasks.json
```

### `harness update` chala diya, kuch toot gaya

```bash
harness backup       # backup banao pehle
harness restore <backup.tgz>
```

---

## 12. Command cheat sheet

### Setup commands (one-time)

```bash
bash scripts/install.sh                              # install harness CLI
echo 'export PATH=...' >> ~/.bashrc                  # PATH (Git Bash only)
# Windows: wrapper scripts banao (Section 4B)
```

### Project lifecycle

```bash
harness init <repo>                                  # overlay banao
harness validate <repo>                              # structure check
harness update                                       # latest harness pull
harness backup [out_dir]                             # backup
harness restore <backup.tgz>                         # restore
harness version                                      # version
harness doctor                                       # prereq check
```

### RAG (search) commands

```bash
dev-rag add-root <path>                              # repo add karo
dev-rag list-roots                                   # configured roots dekho
dev-rag index                                        # ✅ Windows + Mac dono
dev-rag query "<text>"                               # ✅ Windows + Mac dono
dev-rag query "<text>" --root <path> -k 20           # restrict + top-K

# Windows pe yeh AVOID karo:
# harness rag-index   ❌ (python3 shebang fail)
# harness rag-query   ❌
```

### File paths cheat

| Path | Kya hai |
|---|---|
| `~/.local/bin/harness` | CLI wrapper |
| `~/.local/bin/dev-rag` | RAG wrapper |
| `~/.config/dev-harness/config.json` | Global harness config (project list) |
| `~/.local/share/dev-harness/rag/config.json` | RAG roots list |
| `~/.local/share/dev-harness/rag/index.db` | RAG SQLite database |
| `<repo>/.harness/config.json` | Per-repo harness config (gitignored) |
| `<repo>/.antigravity/` | AI SSOT (committed) |
| `<repo>/agents/state/tasks.json` | Machine-readable task state (committed) |

---

## 13. Mental model — yeh sab kyun?

### Problem yeh tha

AI agents (Claude/Codex/Gemini) har session me **scratch se** project samajhna chahte hain:
- "Yeh repo kya hai?"
- "Conventions kya hain?"
- "Pichli baar kya kiya?"

Tumhe baar-baar paste karna padta tha. Boring + token-wasting.

### Solution

**Files banao jo persistent hain.** Har session ke baad save rahein. AI un files ko padhta hai → instant context.

Dev Harness yahi enforce karta hai:
- **Where** — fixed paths (`.antigravity/memory.md` etc.)
- **What** — fixed file names (RULES, PLAN, TASKS, memory)
- **How** — har repo me same structure

Plus `dev-rag` se **multi-repo search** — AI ek query me 10 repos me se relevant chunks nikal leta hai.

### Trade-off

- **Cost:** Tumhe initial setup karna padta hai + files maintain karni padti hain
- **Benefit:** AI sessions productive hote hain, context lost nahi hota

### Yeh tool bana hi nahi sakta tha

Bana sakte the. Yeh literally bash scripts + python search hai. But **convention zaroor chahiye** — sab ek hi structure follow karein, alag-alag nahi. Yahi value hai.

---

## 14. Aage kya — production hardening

Jab tumhari team is workflow ko serious leti hai:

1. **Dev Harness Core ko private GitHub me rakho** team-wide access ke liye
2. **`harness update` ko CI me chalao** — saare projects me harness version sync rahe
3. **Pre-commit hook** banao jo `harness validate` chalata hai
4. **PR template** me checkbox: "Did you update `.antigravity/memory.md` if learning was non-obvious?"
5. **Onboarding doc** me yeh guide link karo — naye dev ko 30 minute me setup mil jaata hai

---

**End of guide.** Sawal ho to puchho — guide yahi update kar dunga.
