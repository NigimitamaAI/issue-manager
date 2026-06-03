// ────────────────────────────────────────────────
// issue_manager プロジェクト検出モジュール
// ────────────────────────────────────────────────
//
// ルートディレクトリ配下を走査して issue_manager 対応プロジェクトを検出する。
// 新構造 (tickets/VERSION.md 配下) と旧構造 (RULES.md/INDEX.md/todo がルート直下)
// の両方を識別する。
//
// 依存方向: utils.mjs / constants.mjs にのみ依存。
// logger は引数で注入してもらう。

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

import { SCHEMA_VERSION, ISSUEMGR_DIR, ISSUEMGR_PROJECT_FILE } from './constants.mjs'
import { parseFrontmatter } from './utils.mjs'

const UNREGISTERED_FILE = 'unregistered.json'

function sanitizeRootId(id, fallback) {
  const s = String(id || '').trim()
  return /^[A-Za-z0-9_-]+$/.test(s) ? s : fallback
}

const DEFAULT_LOCAL_CAPABILITIES = [
  'read',
  'browse',
  'createProject',
  'importProject',
  'writeTickets',
  'writeMeta',
  'openExternal',
]
const DEFAULT_WRITE_SCOPES = ['tickets', '.issuemgr']

function normalizeStringList(value, fallback) {
  if (!Array.isArray(value)) return [...fallback]
  const out = value.map(v => String(v || '').trim()).filter(Boolean)
  return out.length ? out : [...fallback]
}

export function normalizeRoots({ root, roots } = {}) {
  if (Array.isArray(roots) && roots.length > 0) {
    const used = new Set()
    return roots
      .map((r, i) => {
        const rawPath = typeof r === 'string' ? r : r && r.path
        if (!rawPath) return null
        let id = sanitizeRootId(typeof r === 'string' ? '' : r.id, `r${i}`)
        if (used.has(id)) id = `${id}_${i}`
        used.add(id)
        const rootPath = path.resolve(rawPath)
        const type = typeof r === 'object' && r && r.type ? String(r.type) : 'local'
        return {
          id,
          type,
          path: rootPath,
          label: (typeof r === 'object' && r && r.label) ? String(r.label) : id,
          capabilities: normalizeStringList(
            typeof r === 'object' && r ? r.capabilities : null,
            DEFAULT_LOCAL_CAPABILITIES,
          ),
          writeScopes: normalizeStringList(
            typeof r === 'object' && r ? r.writeScopes : null,
            DEFAULT_WRITE_SCOPES,
          ),
        }
      })
      .filter(Boolean)
  }

  const rootPath = path.resolve(root || process.cwd())
  return [{
    id: 'default',
    type: 'local',
    path: rootPath,
    label: 'default',
    capabilities: [...DEFAULT_LOCAL_CAPABILITIES],
    writeScopes: [...DEFAULT_WRITE_SCOPES],
  }]
}

function makeProjectId(rootId, displayName) {
  return `${rootId}~${encodeURIComponent(displayName)}`
}

function withRootInfo(project, rootInfo) {
  return {
    ...project,
    id: makeProjectId(rootInfo.id, project.name),
    rootId: rootInfo.id,
    rootPath: rootInfo.path,
    rootLabel: rootInfo.label,
    displayName: project.name,
  }
}

// .issuemgr/project.json を読み込んでパース、スキーマ検証した上で返す。
// 存在しない・読めない・JSON パース失敗・$schema 不一致 いずれも null を返す。
// $schema は SCHEMA_VERSION と一致したものだけ「正規」として受け入れる。
async function readIssuemgrProjectJson(projectDir) {
  const projectFile = path.join(projectDir, ISSUEMGR_DIR, ISSUEMGR_PROJECT_FILE)
  if (!fs.existsSync(projectFile)) return null
  let text
  try {
    text = await fsp.readFile(projectFile, 'utf8')
  } catch (_) {
    return null
  }
  let obj
  try {
    obj = JSON.parse(text)
  } catch (_) {
    return null
  }
  if (!obj || typeof obj !== 'object') return null
  if (obj.$schema !== SCHEMA_VERSION) return null
  return obj
}

function isUnregisteredProject(projectDir) {
  return fs.existsSync(path.join(projectDir, ISSUEMGR_DIR, UNREGISTERED_FILE))
}

// Windows のシステム/ごみ箱領域に該当するディレクトリ名かどうかを判定する。
// 該当する場合はプロジェクト検出の対象外とする。
//   - '$' で始まる名前: $RECYCLE.BIN, $WinREAgent, $SysReset, $Windows.~BT など
//   - 'System Volume Information': ボリュームシャドウコピー等のメタ領域
// 通常のユーザープロジェクトが '$' で始まることは無いため安全に一括除外できる。
function isWindowsSystemDirName(name) {
  if (!name) return false
  if (name.charAt(0) === '$') return true
  if (name === 'System Volume Information') return true
  return false
}

// ルートディレクトリを走査してプロジェクト一覧を返す。
// logger は { logErr } 形を期待。
// 戻り値の各要素: { name, layout, projectDir, ticketsDir, rulesPath, indexPath,
//                  hasVersion, schemaOk, projectName }
//   layout: 'new'    = tickets/ 配下に統合された新構造
//           'legacy' = ルート直下にレーンディレクトリと RULES.md/INDEX.md がある旧構造
async function detectProjectsInRoot(rootInfo, logger, selfPath) {
  const out = []
  const skipDirs = new Set(['node_modules', '.git', '.svn', '.hg'])
  // selfPath: このサーバーインスタンス自身の APP_ROOT（絶対パス）。
  // 一致するディレクトリは自分自身なのでプロジェクト一覧から除外する。
  const selfResolved = selfPath ? path.resolve(selfPath) : null

  function isSelf(dir) {
    return !!selfResolved && path.resolve(dir) === selfResolved
  }

  // ルート自身が Windows システム領域（ごみ箱など）の場合は検出を一切行わない。
  // 通常運用では発生しないが、誤って root: "G:/$RECYCLE.BIN" 等を指定されても
  // 何も検出しない（＝余計なプロジェクトを生やさない）のが正しい振る舞い。
  if (isWindowsSystemDirName(path.basename(rootInfo.path))) {
    return out
  }

  async function addProjectIfFound(projectDir, displayName) {
    if (isSelf(projectDir)) return false
    if (isUnregisteredProject(projectDir)) return false
    const info = await inspectTicketsDir(projectDir, displayName)
    if (!info) return false
    out.push(withRootInfo(info, rootInfo))
    return true
  }

  async function addSelfProjectIfFound(appDir, displayName) {
    const selfTickets = path.join(appDir, '_self', 'tickets')
    if (!fs.existsSync(selfTickets)) return false
    const info = await inspectTicketsDir(path.join(appDir, '_self'), displayName)
    if (!info) return false
    out.push(withRootInfo(info, rootInfo))
    return true
  }

  const rootBaseName = path.basename(rootInfo.path) || rootInfo.label || rootInfo.id
  await addProjectIfFound(rootInfo.path, rootBaseName)
  await addSelfProjectIfFound(rootInfo.path, `${rootBaseName}/_self`)

  async function walk(currentDir, relDir) {
    let entries
    try {
      entries = await fsp.readdir(currentDir, { withFileTypes: true })
    } catch (e) {
      if (!relDir && logger) logger.logErr(`ルートディレクトリ読み取り失敗: ${rootInfo.path}`, e.message)
      return
    }

    for (const ent of entries) {
      if (!ent.isDirectory()) continue
      if (skipDirs.has(ent.name)) continue
      if (ent.name.startsWith('.')) continue
      if (ent.name.startsWith('_')) continue
      // Windows のシステム/ごみ箱領域（$RECYCLE.BIN, $WinREAgent 等、
      // および System Volume Information）を一括除外する。
      if (isWindowsSystemDirName(ent.name)) continue

      const childRel = relDir ? `${relDir}/${ent.name}` : ent.name
      const projPath = path.join(currentDir, ent.name)
      if (isUnregisteredProject(projPath)) continue
      if (isSelf(projPath)) continue

      // issue_manager 自体のチケット (_self/tickets/) は特殊扱い
      if (!relDir && (ent.name === 'issue_manager' || ent.name === 'issue-manager')) {
        await addSelfProjectIfFound(projPath, `${ent.name}/_self`)
      }

      // 新構造: tickets/ ディレクトリ配下に集約されている
      const newTickets = path.join(projPath, 'tickets')
      if (fs.existsSync(newTickets)) {
        if (await addProjectIfFound(projPath, childRel)) continue
      }

      // 旧構造: プロジェクト直下にレーンと RULES.md/INDEX.md
      const oldRules = path.join(projPath, 'RULES.md')
      const oldIndex = path.join(projPath, 'INDEX.md')
      const oldTodo = path.join(projPath, 'todo')
      if (fs.existsSync(oldRules) && fs.existsSync(oldIndex) && fs.existsSync(oldTodo)) {
        out.push(withRootInfo({
          name: childRel,
          layout: 'legacy',
          projectDir: projPath,
          ticketsDir: projPath,
          rulesPath: oldRules,
          indexPath: oldIndex,
          hasVersion: false,
          schemaOk: false,
          projectName: ent.name,
        }, rootInfo))
        continue
      }

      await walk(projPath, childRel)
    }
  }

  await walk(rootInfo.path, '')
  return out
}

// ルートディレクトリ群を走査してプロジェクト一覧を返す。
// 引数は互換のため string root も受けるが、実運用では normalizeRoots() 済み配列を渡す。
export async function detectProjects(rootsOrRoot, logger, selfPath) {
  const roots = Array.isArray(rootsOrRoot)
    ? rootsOrRoot
    : normalizeRoots({ root: rootsOrRoot })
  const out = []
  for (const rootInfo of roots) {
    out.push(...await detectProjectsInRoot(rootInfo, logger, selfPath))
  }
  return out
}

// 単一プロジェクトディレクトリを検査して、新構造として認識できれば情報を返す。
// 必須ファイル (tickets/VERSION.md, RULES.md, INDEX.md) のうちひとつでも欠ければ null。
//
// 認識の優先順位 (Phase 1):
//   1. .issuemgr/project.json が存在し $schema が一致 → こちらから projectName / ticketsDir を取り、schemaOk = true
//   2. (1) 不在・不正、且つ VERSION.md フロントマターの schema が一致 → schemaOk = true (互換モード)
//   3. どちらも不一致 → schemaOk = false (不明な issue_manager プロジェクトとして表示だけする)
export async function inspectTicketsDir(projectDir, displayName) {
  // まず .issuemgr/project.json を試し、そこから ticketsDir を取ってくる (未指定なら 'tickets')
  const issuemgrInfo = await readIssuemgrProjectJson(projectDir)
  const ticketsDirName = (issuemgrInfo && typeof issuemgrInfo.ticketsDir === 'string')
    ? issuemgrInfo.ticketsDir
    : 'tickets'
  const ticketsDir = path.join(projectDir, ticketsDirName)
  const versionPath = path.join(ticketsDir, 'VERSION.md')
  const rulesPath = path.join(ticketsDir, 'RULES.md')
  const indexPath = path.join(ticketsDir, 'INDEX.md')

  if (!fs.existsSync(versionPath) || !fs.existsSync(rulesPath) || !fs.existsSync(indexPath)) {
    return null
  }

  let schemaOk = false
  let projectName = displayName
  let hasIssuemgr = false

  // 優先順位 1: .issuemgr/project.json
  if (issuemgrInfo) {
    schemaOk = true
    hasIssuemgr = true
    if (issuemgrInfo.projectName && issuemgrInfo.projectName !== '<プロジェクト名>') {
      projectName = issuemgrInfo.projectName
    }
  } else {
    // 優先順位 2: VERSION.md フロントマター (互換モード)
    try {
      const txt = await fsp.readFile(versionPath, 'utf8')
      const fm = parseFrontmatter(txt)
      if (fm && fm.schema === SCHEMA_VERSION) {
        schemaOk = true
        if (fm.project_name && fm.project_name !== '<プロジェクト名>') {
          projectName = fm.project_name
        }
      }
    } catch (_) {}
  }

  return {
    name: displayName,
    layout: 'new',
    projectDir,
    ticketsDir,
    rulesPath,
    indexPath,
    hasVersion: true,
    schemaOk,
    hasIssuemgr,
    projectName,
    issueManagerProject: issuemgrInfo || null,
    dockerPolicy: issuemgrInfo && issuemgrInfo.extras && typeof issuemgrInfo.extras === 'object'
      ? issuemgrInfo.extras.docker || null
      : null,
  }
}

// project id からプロジェクトを取得（detectProjects のラッパ）。
export async function getProjectById(id, roots, logger, selfPath) {
  const projects = await detectProjects(roots, logger, selfPath)
  return projects.find(p => p.id === id)
}
