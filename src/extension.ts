import * as vscode from 'vscode';
import * as path from 'path';
import { Skill, SkillItem, SkillsProvider, globalSkillsRoot, installedPluginsPath, projectSkillsRoots } from './skillsProvider';

async function activateSkill(skill: Skill) {
  const doc = await vscode.workspace.openTextDocument(skill.filePath);
  await vscode.window.showTextDocument(doc, { preview: true });
}

function findTargetTerminal(): vscode.Terminal {
  const active = vscode.window.activeTerminal;
  if (active) {
    return active;
  }
  const claudeTerminal = vscode.window.terminals.find((t) => /claude/i.test(t.name));
  if (claudeTerminal) {
    return claudeTerminal;
  }
  return vscode.window.createTerminal('Claude Code');
}

function insertInTerminal(skill: Skill) {
  const terminal = findTargetTerminal();
  terminal.show(true);
  terminal.sendText(`/${skill.name} `, false);
}

async function copySkillName(skill: Skill) {
  await vscode.env.clipboard.writeText(`/${skill.name}`);
  vscode.window.showInformationMessage(`Copiado: /${skill.name}`);
}

function revealInFileManager(skill: Skill) {
  vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(skill.filePath));
}

function watchSkillFolder(root: string, provider: SkillsProvider): vscode.Disposable {
  const watcher = vscode.workspace.createFileSystemWatcher(path.join(root, '*', 'SKILL.md'));
  watcher.onDidCreate(() => provider.refresh());
  watcher.onDidChange(() => provider.refresh());
  watcher.onDidDelete(() => provider.refresh());
  return watcher;
}

export function activate(context: vscode.ExtensionContext) {
  const provider = new SkillsProvider(context);
  vscode.window.registerTreeDataProvider('claudeSkillsView', provider);

  let projectWatchers: vscode.Disposable[] = [];
  const rebuildProjectWatchers = () => {
    projectWatchers.forEach((d) => d.dispose());
    projectWatchers = projectSkillsRoots().map((root) => watchSkillFolder(root, provider));
  };
  rebuildProjectWatchers();

  const pluginWatcher = vscode.workspace.createFileSystemWatcher(installedPluginsPath());
  pluginWatcher.onDidCreate(() => provider.refresh());
  pluginWatcher.onDidChange(() => provider.refresh());
  pluginWatcher.onDidDelete(() => provider.refresh());

  context.subscriptions.push(
    watchSkillFolder(globalSkillsRoot(), provider),
    pluginWatcher,
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      rebuildProjectWatchers();
      provider.refresh();
    }),
    { dispose: () => projectWatchers.forEach((d) => d.dispose()) },
    vscode.commands.registerCommand('claudeSkills.refresh', () => provider.refresh()),
    vscode.commands.registerCommand('claudeSkills.activate', (skill: Skill) => activateSkill(skill)),
    vscode.commands.registerCommand('claudeSkills.insertInTerminal', (item: SkillItem) => insertInTerminal(item.skill)),
    vscode.commands.registerCommand('claudeSkills.copyName', (item: SkillItem) => copySkillName(item.skill)),
    vscode.commands.registerCommand('claudeSkills.revealInExplorer', (item: SkillItem) => revealInFileManager(item.skill)),
    vscode.commands.registerCommand('claudeSkills.pin', (item: SkillItem) => provider.togglePin(item.skill.filePath)),
    vscode.commands.registerCommand('claudeSkills.unpin', (item: SkillItem) => provider.togglePin(item.skill.filePath))
  );
}

export function deactivate() {}
