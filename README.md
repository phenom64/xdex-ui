# SynDEX

SynDEX is a fullscreen, cross-platform developer cockpit for the agentic AI era. It keeps the cinematic terminal-and-system-monitor experience of the eDEX family, while adding practical controls for modern AI-assisted development, better runtime resilience, Windows-first fixes, and battery-aware performance behavior.

SynDEX is forked from [xDEX-UI](https://github.com/andreas-hartmann/xdex-ui), which itself is a maintained fork of the brilliant original [eDEX-UI](https://github.com/GitSquared/edex-ui). We forked from xDEX-UI specifically to inherit its critical security, dependency, compatibility, and vulnerability patches instead of restarting from the abandoned upstream baseline.

The goal is not to erase that lineage. SynDEX builds on it: eDEX-UI proved the sci-fi cockpit could be real software, xDEX-UI kept it viable, and SynDEX turns it toward agent-heavy development workflows.

---

<a href="https://youtu.be/BGeY1rK19zA">
  <img align="right" width="400" alt="Demo on YouTube" src="media/youtube-demo-teaser.gif">
</a>

## What Is New

- SynDEX branding across the app shell, boot sequence, terminal greeting, package metadata, installer artifacts, and runtime environment.
- AgentWatch, a live agent activity panel for Claude Code, Antigravity CLI, OpenCode, and Codex CLI logs.
- Collapsible panel system with persisted visibility state for the keyboard, filesystem, system column, and network/AgentWatch column.
- Keyboard panel controls: `Ctrl+Alt+K` for keyboard, `Ctrl+Alt+S` for system panels, `Ctrl+Alt+N` for network panels, and `Ctrl+Alt+F` for filesystem.
- Settings editor support for panel startup visibility through `panelToggles`.
- Battery-aware throttling hooks for polling-heavy panels and rendering work.
- More resilient module startup so one optional panel cannot prevent the terminal and core UI from opening.
- Windows-focused launch fixes, shell resolution improvements, and safer startup behavior.
- Continued support for themes, keyboard layouts, terminal tabs, filesystem following, system monitoring, network status, and the ENCOM globe.

## Features

- Fully featured terminal emulator with tabs, colors, mouse events, and support for `curses` and `curses`-like applications.
- Real-time CPU, RAM, swap, process, battery, network, GeoIP, active connection, and transfer-rate monitoring.
- On-screen keyboard with touch support and shortcut integration.
- Directory viewer that follows the terminal's current working directory where supported.
- AgentWatch dashboard for token usage, estimated cost, context pressure, recent activity, and session state.
- Persisted collapsible panels for building a denser or calmer workspace.
- Themeable sci-fi interface with audio feedback, custom fonts, and CSS injection support.

## Screenshots

![Default screenshot](media/screenshot_default.png)

![Blade screenshot](media/screenshot_blade.png)

![Disrupted screenshot](media/screenshot_disrupted.png)

![Horizon screenshot](media/screenshot_horizon.png)

## Configuration

After launching SynDEX for the first time, default configuration files are created in the app user-data directory. On Windows this is typically:

```text
%APPDATA%\SynDEX
```

Key files:

- `settings.json`: general settings, theme, terminal behavior, and `panelToggles`.
- `shortcuts.json`: terminal and app shortcuts.
- `themes/`: local theme files.
- `keyboards/`: keyboard layouts.

Panel startup visibility lives under:

```json
{
  "panelToggles": {
    "keyboard": true,
    "leftColumn": true,
    "rightColumn": true,
    "filesystem": true
  }
}
```

You can also edit these from the in-app settings editor.

## Running From Source

Install dependencies:

```powershell
npm install
cd src
npm install
cd ..
```

Start SynDEX:

```powershell
npm run start
```

Useful launch flags:

```powershell
npm run start -- --nointro
npm run start -- --windowed
npm run start -- --devtools
```

## Building

Due to native modules, build targets should be produced on the host OS they target.

Windows:

```powershell
npm run build-windows
```

Linux:

```bash
npm run build-linux
```

macOS:

```bash
npm run build-darwin
```

Windows builds produce installer artifacts in `dist/`, including `SynDEX-Windows-x64.exe`.

## Lineage And Credits

SynDEX is based on xDEX-UI, maintained by [Andreas Hartmann](https://github.com/andreas-hartmann), and xDEX-UI is based on the original eDEX-UI by [Squared](https://github.com/GitSquared).

The original eDEX-UI concept was inspired by the [TRON Legacy movie effects](https://web.archive.org/web/20170511000410/http://jtnimoy.com/blogs/projects/14881671), especially the Board Room sequence, and by [DEX-UI](https://github.com/seenaburns/dex-ui).

Thanks to the original contributors, maintainers, dependency authors, theme authors, and everyone who kept the project usable long enough for this fork to exist. SynDEX also continues to use major pieces from the original ecosystem, including xterm.js, systeminformation, SmoothieCharts, and the ENCOM Globe by Rob "Arscan" Scanlon.

## License

Licensed under the [GPLv3.0](LICENSE).
