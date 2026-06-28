# SynDEX Full Transformation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking.

**Goal:** Transform the forked xDEX-UI Electron app into SynDEX by applying branding, a runtime PanelManager, battery-aware smart performance throttling, and a new AgentWatch panel tracking live token usage across Claude Code, Antigravity CLI, OpenCode, and Codex CLI.

**Architecture:** Branding touches only package.json, ui.html, _boot.js, _renderer.js; PanelManager is a new class registered at startup; ThrottleController hooks into module setInterval calls; AgentWatch is a new module class + CSS + IPC channel.

**Tech Stack:** Electron 41, Node.js 24, Vanilla JS, existing Smoothie charts, CSS transitions, fs.watch() for log tailing, electron.powerMonitor for battery events.

## Global Constraints

- All JS uses ES5-style class pattern loaded via script tags in ui.html. No ES modules, no bundler.
- CSS files in src/assets/css/, named mod_<name>.css
- Module classes in src/classes/<name>.class.js
- All DOM uses createElement + appendChild - never innerHTML +=
- Element references cached at construction from own container element
- Settings in settings.json (Electron userData); new keys added with defaults in _boot.js
- Panel toggle state persists in settings.json
- No new npm dependencies
- Windows primary target
- Conventional Commits format
- Workspace: C:/Users/found/Developer/xdex-ui

---

## Task 1: Branding

**Files:**
- Modify: package.json
- Modify: src/ui.html (line 7)
- Modify: src/_boot.js
- Modify: src/_renderer.js (line 650)

Update productName to SynDEX, version to 3.1.0, appId to com.syndex.ui, artifact names to SynDEX-*, description to "A developer cockpit for the agentic AI era.", window title to SynDEX, boot greeting to SynDEX.

## Task 2: PanelManager

**Files:**
- Create: src/classes/panelManager.class.js
- Create: src/assets/css/mod_panelManager.css
- Modify: src/ui.html
- Modify: src/_renderer.js
- Modify: src/_boot.js

Keyboard shortcuts: Ctrl+Alt+K (keyboard), Ctrl+Alt+S (left column), Ctrl+Alt+N (right column), Ctrl+Alt+F (filesystem). State persists in settings.json panelToggles key.

## Task 3: ThrottleController

**Files:**
- Create: src/classes/throttleController.class.js
- Modify: src/_boot.js (powerMonitor IPC)
- Modify: src/_renderer.js
- Modify: src/classes/conninfo.class.js (pause/resume)
- Modify: src/classes/cpuinfo.class.js (pause/resume)
- Modify: src/classes/netstat.class.js (pause/resume)
- Modify: src/classes/toplist.class.js (pause/resume)
- Modify: src/classes/locationGlobe.class.js (frame skip on battery)

## Task 4: AgentWatch Main Process

**Files:**
- Modify: src/_boot.js (fs.watch log parsers, IPC broadcaster)

Agents: Claude Code (~/.claude/projects), Antigravity (~/.gemini/antigravity-cli/brain), OpenCode (~/.config/opencode), Codex (~/.codex).

## Task 5: AgentWatch Renderer UI

**Files:**
- Create: src/classes/agentwatch.class.js
- Create: src/assets/css/mod_agentwatch.css
- Modify: src/ui.html
- Modify: src/_renderer.js

## Task 6: Build and Push

Run npm run build-windows, verify SynDEX-Windows-x64.exe, git push origin master.
