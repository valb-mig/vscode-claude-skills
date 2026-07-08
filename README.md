# Claude Skills Explorer

Browse your [Claude Code](https://claude.com/claude-code) skills — global, per-project, and from installed plugins — in a dedicated sidebar, without leaving VS Code.

## Features

- **Dedicated activity bar view** with a tree grouped into **Pinned**, **Global**, **Project**, and **Plugins**.
- **Global skills** — reads `~/.claude/skills/*/SKILL.md`.
- **Project skills** — reads `.claude/skills/*/SKILL.md` in each open workspace folder.
- **Plugin skills** — reads skills from every plugin listed in `~/.claude/plugins/installed_plugins.json` (only actually-installed plugins, not the full marketplace catalog).
- **Pin** any skill to keep it at the top of the tree (persisted across restarts).
- **Click a skill** to open its `SKILL.md`.
- **Right-click a skill** to:
  - Insert `/skill-name` into the active terminal
  - Copy the skill's slash-command name
  - Reveal the file in your OS file manager
- **Auto-refreshes** when skill files change or workspace folders are added/removed.
- Friendly empty-state messages when a group has no skills yet.

## Requirements

None — no dependencies on the Claude Code CLI or extension being installed. This extension just reads the same `~/.claude` directory structure Claude Code uses.

## Development

```bash
npm install
npm run compile   # or: npm run watch
```

Press `F5` in VS Code to launch an Extension Development Host with the extension loaded.

## License

[MIT](LICENSE)
