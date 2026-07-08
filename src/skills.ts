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

export function parseFrontmatter(filePath: string, fallbackName: string): { name: string; description: string } {
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

export function loadSkillsFrom(root: string, scope: 'global' | 'project'): Skill[] {
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

export interface InstalledPluginEntry {
  installPath: string;
}

export interface InstalledPluginsFile {
  plugins?: Record<string, InstalledPluginEntry[]>;
}

export function loadPluginSkills(installedPluginsPath: string): Skill[] {
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
