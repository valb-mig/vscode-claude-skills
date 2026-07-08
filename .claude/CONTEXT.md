# Contexto do Projeto

## O que é
Extensão VS Code ("Claude Skills Explorer") que lista skills do Claude Code
(global, projeto, plugins) numa sidebar dedicada, sem depender do Claude Code
CLI/extensão instalado — só lê a mesma estrutura de diretórios `~/.claude`.

## Stack
- TypeScript 5.4 (typecheck via `tsc --noEmit`), bundle via `esbuild`.
- API nativa `vscode` (VS Code Extension API, engine `^1.85.0`).
- Zero dependências de runtime — só `devDependencies` (`@types/node`, `@types/vscode`,
  `typescript`, `esbuild`, `vitest`, `@vscode/vsce`).
- Testes: `vitest` (`src/skills.test.ts`), cobre lógica pura de `skills.ts`.
- CI: GitHub Actions (`.github/workflows/ci.yml`) roda typecheck+test+build em
  push/PR pra `main`. Release (`.github/workflows/release.yml`) publica no
  Marketplace via `vsce publish` em push de tag `v*` — precisa do secret
  `VSCE_PAT` configurado no repo (não configurado automaticamente).
- Publisher: `valbmig` (id existente reaproveitado, ver commit `8f16ea1`).

## Arquitetura
Extensão minimalista, 3 arquivos fonte em `src/`:
- `extension.ts` — ponto de entrada (`activate`/`deactivate`), registra comandos,
  `TreeDataProvider`, e file watchers (skills globais, skills de projeto por
  workspace folder, `installed_plugins.json`).
- `skills.ts` — lógica pura, sem dependência de `vscode` (testável fora do
  extension host):
  - parse de frontmatter YAML simplificado (regex, não usa lib de YAML) de `SKILL.md`.
  - `loadSkillsFrom` — lê skills globais (`~/.claude/skills/*/SKILL.md`) e de
    projeto (`.claude/skills/*/SKILL.md` por workspace folder).
  - `loadPluginSkills` — lê `~/.claude/plugins/installed_plugins.json` e
    resolve skills de cada plugin instalado (prefixadas `plugin:skill`).
- `skillsProvider.ts` — camada que depende de `vscode`:
  - `SkillsProvider` implementa `vscode.TreeDataProvider`, monta árvore
    (Pinned/Global/Project/Plugins), persiste pins em `context.globalState`.
  - `SkillGroup`, `SkillItem`, `PlaceholderItem` — `TreeItem`s da árvore.
  - `projectSkillsRoots()` — só essa função usa `vscode.workspace`.
  - re-exporta `Skill`, `SkillScope`, `globalSkillsRoot`, `installedPluginsPath`
    de `skills.ts` pra não quebrar imports de `extension.ts`.

Fluxo: `activate()` cria o provider, registra a view, os comandos
(`refresh`, `activate`, `insertInTerminal`, `copyName`, `revealInExplorer`,
`pin`/`unpin`) e watchers de filesystem que chamam `provider.refresh()`
quando `SKILL.md` ou `installed_plugins.json` mudam.

## Decisões importantes
- Sem dependência do Claude Code CLI/extensão — lê diretamente a estrutura de
  arquivos `~/.claude` — para funcionar mesmo sem o Claude Code instalado.
- Parse de frontmatter feito na mão via regex em vez de lib YAML — mantém
  zero dependências de runtime, ao custo de suporte parcial ao formato YAML
  (não lida com todos os casos de multiline/aspas).
- Pins persistidos em `context.globalState` (por instalação do VS Code, não
  por workspace) — pin sobrevive a restart e é compartilhado entre projetos.
- Lógica pura separada em `skills.ts` (sem import de `vscode`) — permite testar
  com `vitest` puro, sem precisar de `@vscode/test-electron`/extension host.
- Build via `esbuild` (bundle único, `vscode` como `external`) em vez de `tsc`
  puro — `tsc` fica só pra typecheck (`--noEmit`), não gera mais os `.js`.

## Estado atual
Funcional e publicado (v0.1.0). Features do README todas implementadas:
tree view com 4 grupos, pin/unpin, abrir SKILL.md, inserir `/skill-name` no
terminal, copiar nome, revelar no explorador de arquivos, auto-refresh via
watchers. Testes (`vitest`), CI e build (`esbuild`) configurados. Publicação
real no Marketplace via tag ainda não disparada (secret `VSCE_PAT` pendente
de configuração no GitHub, ação do usuário).
