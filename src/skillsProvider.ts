import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type SkillScope = 'global' | 'project' | 'plugin';

export interface Skill {
  name: string;
  description: string;
  filePath: string;
  scope: SkillScope;
}

function parseFrontmatter(filePath: string, fallbackName: string): { name: string; description: string } {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  let name = fallbackName;
  let description = '';

  if (match) {
    const frontmatter = match[1];
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    if (nameMatch) {
      name = nameMatch[1].trim();
    }

    const descIdx = frontmatter.search(/^description:/m);
    if (descIdx !== -1) {
      let rest = frontmatter.slice(descIdx).replace(/^description:\s*/, '');
      rest = rest.replace(/^[>|][-+]?\s*\r?\n?/, '');
      description = rest
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .join(' ')
        .trim();
    }
  }

  return { name, description };
}

function loadSkillsFrom(root: string, scope: 'global' | 'project'): Skill[] {
  if (!fs.existsSync(root)) {
    return [];
  }

  const skills: Skill[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const filePath = path.join(root, entry.name, 'SKILL.md');
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const { name, description } = parseFrontmatter(filePath, entry.name);
    skills.push({ name, description, filePath, scope });
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

interface InstalledPluginEntry {
  installPath: string;
}

interface InstalledPluginsFile {
  plugins?: Record<string, InstalledPluginEntry[]>;
}

function loadPluginSkills(installedPluginsPath: string): Skill[] {
  if (!fs.existsSync(installedPluginsPath)) {
    return [];
  }

  let data: InstalledPluginsFile;
  try {
    data = JSON.parse(fs.readFileSync(installedPluginsPath, 'utf8'));
  } catch {
    return [];
  }

  const skills: Skill[] = [];
  for (const pluginId of Object.keys(data.plugins ?? {})) {
    // pluginId is "<plugin>@<marketplace>"
    const [pluginName] = pluginId.split('@');
    for (const entry of data.plugins![pluginId]) {
      const skillsRoot = path.join(entry.installPath, 'skills');
      if (!fs.existsSync(skillsRoot)) {
        continue;
      }
      for (const dir of fs.readdirSync(skillsRoot, { withFileTypes: true })) {
        if (!dir.isDirectory()) {
          continue;
        }
        const filePath = path.join(skillsRoot, dir.name, 'SKILL.md');
        if (!fs.existsSync(filePath)) {
          continue;
        }
        const { description } = parseFrontmatter(filePath, dir.name);
        skills.push({
          name: `${pluginName}:${dir.name}`,
          description,
          filePath,
          scope: 'plugin',
        });
      }
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export function globalSkillsRoot(): string {
  return path.join(os.homedir(), '.claude', 'skills');
}

export function installedPluginsPath(): string {
  return path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');
}

export function projectSkillsRoots(): string[] {
  const folders = vscode.workspace.workspaceFolders ?? [];
  return folders.map((f) => path.join(f.uri.fsPath, '.claude', 'skills'));
}

const GROUP_ICON: Record<string, string> = {
  Pinned: 'pin',
  Global: 'globe',
  Project: 'root-folder',
  Plugins: 'extensions',
};

const EMPTY_MESSAGE: Record<string, string> = {
  Global: `Nenhuma skill global — crie em ${globalSkillsRoot()}`,
  Project: 'Nenhuma skill de projeto — crie .claude/skills/<nome>/SKILL.md',
  Plugins: 'Nenhum plugin com skills instalado',
};

export class SkillGroup extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly skills: Skill[]
  ) {
    super(label, skills.length ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon(GROUP_ICON[label] ?? 'folder');
    this.contextValue = 'claudeSkillsGroup';
    this.description = `${skills.length}`;
  }
}

export class SkillItem extends vscode.TreeItem {
  constructor(
    public readonly skill: Skill,
    public readonly pinned: boolean
  ) {
    super(skill.name, vscode.TreeItemCollapsibleState.None);
    this.description = skill.description;
    this.tooltip = new vscode.MarkdownString(`**${skill.name}**\n\n${skill.description}\n\n\`${skill.filePath}\``);
    this.iconPath = new vscode.ThemeIcon(pinned ? 'pinned' : 'symbol-event');
    this.contextValue = pinned ? 'claudeSkillsSkillPinned' : 'claudeSkillsSkill';
    this.command = {
      command: 'claudeSkills.activate',
      title: 'Open Skill File',
      arguments: [skill],
    };
  }
}

export class PlaceholderItem extends vscode.TreeItem {
  constructor(groupLabel: string) {
    super(EMPTY_MESSAGE[groupLabel] ?? 'Nenhuma skill encontrada', vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('info');
    this.contextValue = 'claudeSkillsPlaceholder';
  }
}

type Node = SkillGroup | SkillItem | PlaceholderItem;

const PINNED_KEY = 'claudeSkills.pinnedFilePaths';

export class SkillsProvider implements vscode.TreeDataProvider<Node> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private pinned: Set<string>;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.pinned = new Set(context.globalState.get<string[]>(PINNED_KEY, []));
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  isPinned(filePath: string): boolean {
    return this.pinned.has(filePath);
  }

  togglePin(filePath: string): void {
    if (this.pinned.has(filePath)) {
      this.pinned.delete(filePath);
    } else {
      this.pinned.add(filePath);
    }
    this.context.globalState.update(PINNED_KEY, Array.from(this.pinned));
    this.refresh();
  }

  getTreeItem(element: Node): vscode.TreeItem {
    return element;
  }

  getChildren(element?: Node): Node[] {
    if (!element) {
      const global = loadSkillsFrom(globalSkillsRoot(), 'global');
      const project = projectSkillsRoots().flatMap((root) => loadSkillsFrom(root, 'project'));
      const plugins = loadPluginSkills(installedPluginsPath());
      const all = [...global, ...project, ...plugins];
      const pinnedSkills = all.filter((s) => this.pinned.has(s.filePath));

      const groups: SkillGroup[] = [];
      if (pinnedSkills.length) {
        groups.push(new SkillGroup('Pinned', pinnedSkills));
      }
      groups.push(new SkillGroup('Global', global), new SkillGroup('Project', project), new SkillGroup('Plugins', plugins));
      return groups;
    }

    if (element instanceof SkillGroup) {
      if (!element.skills.length) {
        return [new PlaceholderItem(element.label)];
      }
      return element.skills.map((s) => new SkillItem(s, this.isPinned(s.filePath)));
    }

    return [];
  }
}
