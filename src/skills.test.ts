import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseFrontmatter, loadSkillsFrom, loadPluginSkills } from './skills';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeSkill(content: string): string {
  const filePath = path.join(tmpDir, 'SKILL.md');
  fs.writeFileSync(filePath, content);
  return filePath;
}

describe('parseFrontmatter', () => {
  it('parses single-line name and description', () => {
    const filePath = writeSkill('---\nname: foo\ndescription: does a thing\n---\nbody');
    expect(parseFrontmatter(filePath, 'fallback')).toEqual({ name: 'foo', description: 'does a thing' });
  });

  it('falls back to fallbackName when name is missing', () => {
    const filePath = writeSkill('---\ndescription: does a thing\n---\nbody');
    expect(parseFrontmatter(filePath, 'fallback')).toEqual({ name: 'fallback', description: 'does a thing' });
  });

  it('returns empty description when there is no frontmatter', () => {
    const filePath = writeSkill('no frontmatter here');
    expect(parseFrontmatter(filePath, 'fallback')).toEqual({ name: 'fallback', description: '' });
  });

  it('joins folded block scalar (>) description lines with spaces', () => {
    const filePath = writeSkill('---\nname: foo\ndescription: >\n  line one\n  line two\n---\nbody');
    expect(parseFrontmatter(filePath, 'fallback')).toEqual({ name: 'foo', description: 'line one line two' });
  });

  it('joins literal block scalar (|) description lines with spaces', () => {
    const filePath = writeSkill('---\nname: foo\ndescription: |\n  line one\n  line two\n---\nbody');
    expect(parseFrontmatter(filePath, 'fallback')).toEqual({ name: 'foo', description: 'line one line two' });
  });

  it('stops description at the next frontmatter key on the same indent', () => {
    const filePath = writeSkill('---\nname: foo\ndescription: short\nversion: 1\n---\nbody');
    expect(parseFrontmatter(filePath, 'fallback').description).toBe('short version: 1');
  });
});

describe('loadSkillsFrom', () => {
  it('returns empty array when root does not exist', () => {
    expect(loadSkillsFrom(path.join(tmpDir, 'missing'), 'global')).toEqual([]);
  });

  it('skips directories without a SKILL.md', () => {
    fs.mkdirSync(path.join(tmpDir, 'empty-skill'));
    expect(loadSkillsFrom(tmpDir, 'global')).toEqual([]);
  });

  it('loads and sorts skills by name', () => {
    fs.mkdirSync(path.join(tmpDir, 'zeta'));
    fs.writeFileSync(path.join(tmpDir, 'zeta', 'SKILL.md'), '---\nname: zeta\ndescription: z\n---\n');
    fs.mkdirSync(path.join(tmpDir, 'alpha'));
    fs.writeFileSync(path.join(tmpDir, 'alpha', 'SKILL.md'), '---\nname: alpha\ndescription: a\n---\n');

    const skills = loadSkillsFrom(tmpDir, 'global');
    expect(skills.map((s) => s.name)).toEqual(['alpha', 'zeta']);
    expect(skills[0].scope).toBe('global');
  });
});

describe('loadPluginSkills', () => {
  it('returns empty array when installed_plugins.json does not exist', () => {
    expect(loadPluginSkills(path.join(tmpDir, 'missing.json'))).toEqual([]);
  });

  it('returns empty array on malformed JSON', () => {
    const filePath = path.join(tmpDir, 'installed_plugins.json');
    fs.writeFileSync(filePath, '{ not json');
    expect(loadPluginSkills(filePath)).toEqual([]);
  });

  it('resolves skills from multiple installed plugins with name prefix', () => {
    const pluginARoot = path.join(tmpDir, 'plugin-a');
    fs.mkdirSync(path.join(pluginARoot, 'skills', 'do-thing'), { recursive: true });
    fs.writeFileSync(path.join(pluginARoot, 'skills', 'do-thing', 'SKILL.md'), '---\ndescription: does a thing\n---\n');

    const pluginBRoot = path.join(tmpDir, 'plugin-b');
    fs.mkdirSync(path.join(pluginBRoot, 'skills', 'other-thing'), { recursive: true });
    fs.writeFileSync(path.join(pluginBRoot, 'skills', 'other-thing', 'SKILL.md'), '---\ndescription: does another thing\n---\n');

    const manifestPath = path.join(tmpDir, 'installed_plugins.json');
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        plugins: {
          'plugin-a@marketplace': [{ installPath: pluginARoot }],
          'plugin-b@marketplace': [{ installPath: pluginBRoot }],
        },
      })
    );

    const skills = loadPluginSkills(manifestPath);
    expect(skills.map((s) => s.name)).toEqual(['plugin-a:do-thing', 'plugin-b:other-thing']);
    expect(skills.every((s) => s.scope === 'plugin')).toBe(true);
  });

  it('skips plugin entries with no skills directory', () => {
    const pluginRoot = path.join(tmpDir, 'plugin-no-skills');
    fs.mkdirSync(pluginRoot, { recursive: true });
    const manifestPath = path.join(tmpDir, 'installed_plugins.json');
    fs.writeFileSync(manifestPath, JSON.stringify({ plugins: { 'p@m': [{ installPath: pluginRoot }] } }));
    expect(loadPluginSkills(manifestPath)).toEqual([]);
  });
});
