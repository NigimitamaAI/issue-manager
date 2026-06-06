// ────────────────────────────────────────────────
// issue_manager HTTP ルーティング
// ────────────────────────────────────────────────
//
// すべての API エンドポイントと静的ファイル配信を担当する。
// 外部依存はすべて ctx (server.mjs から構築して渡される) 経由で受ける。
//
// ctx の中身:
//   - args: { root, roots, port, ... }    ARGS 相当
//   - publicDir: string                   静的ファイルのルート
//   - logger: { log, logErr }
//   - tickets: lib/tickets.mjs から import した関数群
//   - projects: lib/projects.mjs から import した関数群 (detectProjects, getProjectById)
//   - scaffold: lib/scaffold.mjs から import した関数群 (scaffoldProject, migrateToNew)
//   - statusMd: { generateStatusMd, generateAllStatusMd }
//
// 依存方向: utils.mjs / http-utils.mjs にのみ静的依存。
// それ以外はすべて ctx 経由 (循環参照とテスト容易性のため)。

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import zlib from 'node:zlib'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { sanitizeFilename, nowStamp } from './utils.mjs'
import { sendJson, sendText, sendFile, readBody, makeFileErrorHandler } from './http-utils.mjs'
import { assessRootSafety } from './root-safety.mjs'
import { buildEnterpriseHelpers, checkExtensionCompatibility, isExtensionEnabled, validateTierLicense, isUsingDeprecatedConfigSchema, CURRENT_STANDARD_API_VERSION } from './extension-api.mjs'

const UNREGISTERED_FILE = 'unregistered.json'
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENTERPRISE_DIR = path.join(REPO_ROOT, 'enterprise')
const OPEN_DIR = path.join(REPO_ROOT, 'open')
const APP_MANIFEST_SCHEMA = 'issue-manager-app-manifest-v1'

// 拡張系統の登録テーブル。
// 各系統は {tier, dir, urlPrefix, candidates} を持つ。
//   tier: extension.json の tier 値とライセンス境界に対応する識別子
//   dir : 拡張ディレクトリの絶対パス
//   urlPrefix: 静的配信・モジュール読込時の URL prefix
//   candidates: その系統で受け入れる拡張ID/jsファイル名のホワイトリスト
// 拡張ID は系統間で衝突しない前提（同じ id を enterprise/ と open/ の両方に置かないこと）。
const EXTENSION_TIERS = [
  {
    tier: 'enterprise',
    dir: ENTERPRISE_DIR,
    urlPrefix: '/enterprise',
    candidates: [
      { id: 'review-workflow', label: 'Review Workflow', jsFile: 'review-workflow.js' },
      { id: 'paper-platform',  label: 'Paper Platform',  jsFile: 'paper-platform.js' },
    ],
  },
  {
    tier: 'open',
    dir: OPEN_DIR,
    urlPrefix: '/open',
    candidates: [
      { id: 'test-environment', label: 'Test Environment', jsFile: 'test-environment.js' },
    ],
  },
]

// ctx を受け取り、http サーバーに渡せる handle(req, res) を返す。
export function makeHandler(ctx) {
  const {
    args,
    publicDir,
    logger,
    serverId,
    version,
    schemaVersion,
    tickets: T,
    projects: P,
    scaffold: S,
    statusMd: SMD,
    aiState: AIS,
    apiToken,
    configPath,
    selfPath,
  } = ctx

  const handleFileError = makeFileErrorHandler(logger)

  // L3 起動時ライセンス監査 (1 プロセスあたり 1 回だけ)
  performLicenseAudit()

  // ai-state 自動更新のヘルパ。
  // - aiState 未設定 (Phase 2-A 以前の ctx 互換性) または isEnabled() = false なら何もしない。
  // - 更新中の例外は握りつぶしてクライアントレスポンスを止めない (factory 側でも try/catch してるが二重防護)。
  async function tryAiUpdate(project, patch) {
    if (!AIS || typeof AIS.isEnabled !== 'function' || !AIS.isEnabled()) return
    try {
      await AIS.updateSelf(project, patch)
    } catch (e) {
      logger.logErr(`[ai-state] auto-update 例外: ${e && e.message}`)
    }
  }

  function findRoot(rootId) {
    const roots = Array.isArray(args.roots) && args.roots.length ? args.roots : P.normalizeRoots({ root: args.root })
    return roots.find(r => r.id === rootId) || roots[0]
  }

  function strictRoot(rootId) {
    const roots = Array.isArray(args.roots) && args.roots.length ? args.roots : P.normalizeRoots({ root: args.root })
    return roots.find(r => r.id === rootId) || null
  }

  function sanitizeRootId(id, fallback) {
    const s = String(id || '').trim()
    return /^[A-Za-z0-9_-]+$/.test(s) ? s : fallback
  }

  function makeUniqueRootId(base) {
    const used = new Set((args.roots || []).map(r => r.id))
    let id = sanitizeRootId(base, 'root')
    if (!used.has(id)) return id
    let i = 2
    while (used.has(`${id}_${i}`)) i++
    return `${id}_${i}`
  }

  function rootIdFromPath(rootPath) {
    const parsed = path.parse(rootPath)
    const base = path.basename(rootPath) || parsed.root.replace(/[^A-Za-z0-9]+/g, '') || 'root'
    return base.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'root'
  }

  function publicRootJson(rootInfo) {
    return {
      id: rootInfo.id,
      label: rootInfo.label,
      type: rootInfo.type,
      path: rootInfo.path,
      capabilities: rootInfo.capabilities,
      writeScopes: rootInfo.writeScopes,
      safety: assessRootSafety(rootInfo.path),
    }
  }

  function configRootJson(rootInfo) {
    return {
      id: rootInfo.id,
      label: rootInfo.label,
      type: rootInfo.type,
      path: rootInfo.path,
      capabilities: rootInfo.capabilities,
      writeScopes: rootInfo.writeScopes,
    }
  }

  async function saveRootsToConfig() {
    if (!configPath) {
      const e = new Error('configPath が未設定のため保存できません')
      e.status = 500
      throw e
    }
    let raw = {}
    if (fs.existsSync(configPath)) {
      try {
        raw = JSON.parse((await fsp.readFile(configPath, 'utf8')).replace(/^\uFEFF/, ''))
      } catch (e) {
        e.status = 500
        e.message = `config.json を読み込めません: ${e.message}`
        throw e
      }
    }
    raw.roots = (args.roots || []).map(configRootJson)
    await fsp.writeFile(configPath, JSON.stringify(raw, null, 2) + '\n', 'utf8')
  }

  function tarHeader(name, size, mtime, type = '0') {
    const buf = Buffer.alloc(512, 0)
    const write = (s, off, len) => buf.write(String(s).slice(0, len), off, len, 'utf8')
    write(name.replace(/\\/g, '/'), 0, 100)
    write('0000777\0', 100, 8)
    write('0000000\0', 108, 8)
    write('0000000\0', 116, 8)
    write(size.toString(8).padStart(11, '0') + '\0', 124, 12)
    write(Math.floor(mtime / 1000).toString(8).padStart(11, '0') + '\0', 136, 12)
    buf.fill(0x20, 148, 156)
    write(type, 156, 1)
    write('ustar\0', 257, 6)
    write('00', 263, 2)
    let sum = 0
    for (const b of buf) sum += b
    write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8)
    return buf
  }

  async function collectTarEntries(baseDir, relDir = '') {
    const out = []
    const entries = await fsp.readdir(path.join(baseDir, relDir), { withFileTypes: true })
    for (const ent of entries) {
      const rel = relDir ? `${relDir}/${ent.name}` : ent.name
      const full = path.join(baseDir, rel)
      const st = await fsp.stat(full)
      if (ent.isDirectory()) {
        out.push({ rel: rel + '/', full, stat: st, dir: true })
        out.push(...await collectTarEntries(baseDir, rel))
      } else if (ent.isFile()) {
        out.push({ rel, full, stat: st, dir: false })
      }
    }
    return out
  }

  async function writeTarGz(srcDir, destFile, prefix) {
    const chunks = []
    const entries = await collectTarEntries(srcDir)
    for (const ent of entries) {
      const name = `${prefix}/${ent.rel}`
      const data = ent.dir ? Buffer.alloc(0) : await fsp.readFile(ent.full)
      chunks.push(tarHeader(name, data.length, ent.stat.mtimeMs, ent.dir ? '5' : '0'))
      if (data.length) {
        chunks.push(data)
        const pad = (512 - (data.length % 512)) % 512
        if (pad) chunks.push(Buffer.alloc(pad, 0))
      }
    }
    chunks.push(Buffer.alloc(1024, 0))
    await fsp.writeFile(destFile, zlib.gzipSync(Buffer.concat(chunks)))
  }

  function hasCapability(rootInfo, capability) {
    return !!rootInfo && Array.isArray(rootInfo.capabilities) && rootInfo.capabilities.includes(capability)
  }

  function requireRootCapability(rootInfo, capability) {
    if (hasCapability(rootInfo, capability)) return null
    return { status: 403, error: `root '${rootInfo && rootInfo.id}' には ${capability} 権限がありません` }
  }

  function rootForProject(project) {
    return strictRoot(project && project.rootId)
  }

  function isMutation(method) {
    return method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH'
  }

  function requestOriginAllowed(req, url) {
    const origin = req.headers.origin
    if (!origin) return true
    const host = req.headers.host || `127.0.0.1:${args.port}`
    const allowed = new Set([
      `http://${host}`,
      `http://127.0.0.1:${args.port}`,
      `http://localhost:${args.port}`,
    ])
    return allowed.has(origin) || origin === url.origin
  }

  function mutationGuard(req, url) {
    if (!url.pathname.startsWith('/api/') || !isMutation(req.method)) return null
    if (!requestOriginAllowed(req, url)) return { status: 403, error: 'Origin が許可されていません' }
    if (apiToken && req.headers['x-issue-manager-token'] !== apiToken) {
      return { status: 403, error: 'API token が不正です' }
    }
    const ct = String(req.headers['content-type'] || '').toLowerCase()
    if (!ct.includes('application/json')) return { status: 415, error: 'Content-Type は application/json が必要です' }
    return null
  }

  function isInsideOrSame(parent, child) {
    const p = path.resolve(parent)
    const c = path.resolve(child)
    const rel = path.relative(p, c)
    return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel))
  }

  async function assertRealPathInside(rootInfo, full) {
    const rootReal = await fsp.realpath(rootInfo.path)
    const targetReal = await fsp.realpath(full)
    if (!isInsideOrSame(rootReal, targetReal)) {
      const e = new Error('root 外のパスは指定できません')
      e.status = 400
      throw e
    }
  }

  async function resolveRootRelative(rootInfo, relPath, opts = {}) {
    const raw = String(relPath || '').replace(/\\/g, '/').trim()
    if (path.isAbsolute(raw) || /^[A-Za-z]:/.test(raw) || raw.startsWith('//')) {
      const e = new Error('root 外のパスは指定できません')
      e.status = 400
      throw e
    }
    const full = path.resolve(rootInfo.path, raw || '.')
    if (!isInsideOrSame(rootInfo.path, full)) {
      const e = new Error('root 外のパスは指定できません')
      e.status = 400
      throw e
    }
    if (opts.mustExist !== false) await assertRealPathInside(rootInfo, full)
    return { full, rel: path.relative(rootInfo.path, full).replace(/\\/g, '/') }
  }

  async function getProject(projectId) {
    return P.getProjectById(projectId, args.roots, logger, selfPath)
  }

  function manifestCandidates(project) {
    return [
      path.join(project.projectDir, '.issuemgr', 'app.json'),
      path.join(project.projectDir, '.well-known', 'issue-manager.json'),
    ]
  }

  function validateAppManifest(raw) {
    const errors = []
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, errors: ['manifest is not an object'] }
    }
    for (const key of ['schema', 'appId', 'familyId', 'role', 'displayName', 'environment', 'version']) {
      if (typeof raw[key] !== 'string' || !raw[key].trim()) errors.push(`${key} is required`)
    }
    if (raw.schema && raw.schema !== APP_MANIFEST_SCHEMA) errors.push(`unsupported schema: ${raw.schema}`)
    if (raw.capabilities != null && (typeof raw.capabilities !== 'object' || Array.isArray(raw.capabilities))) {
      errors.push('capabilities must be an object')
    }
    return { ok: errors.length === 0, errors }
  }

  function readAppManifest(project) {
    for (const full of manifestCandidates(project)) {
      if (!fs.existsSync(full)) continue
      try {
        const raw = JSON.parse(fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, ''))
        const validation = validateAppManifest(raw)
        return {
          path: full,
          ok: validation.ok,
          errors: validation.errors,
          schema: raw.schema || null,
          appId: raw.appId || null,
          familyId: raw.familyId || null,
          role: raw.role || null,
          displayName: raw.displayName || null,
          environment: raw.environment || null,
          version: raw.version || null,
          capabilities: raw.capabilities || {},
        }
      } catch (e) {
        return {
          path: full,
          ok: false,
          errors: [`invalid json: ${e.message}`],
          capabilities: {},
        }
      }
    }
    return null
  }

  function manifestSummary(manifest) {
    if (!manifest) return null
    return {
      path: manifest.path,
      ok: manifest.ok,
      errors: manifest.errors,
      schema: manifest.schema,
      appId: manifest.appId,
      familyId: manifest.familyId,
      role: manifest.role,
      displayName: manifest.displayName,
      environment: manifest.environment,
      version: manifest.version,
      capabilityNames: Object.keys(manifest.capabilities || {}),
    }
  }

  function manifestPublic(manifest) {
    if (!manifest) return null
    return {
      ...manifestSummary(manifest),
      capabilities: manifest.capabilities || {},
    }
  }

  function manifestMatches(manifest, filters) {
    if (!manifest) return false
    if (filters.familyId && manifest.familyId !== filters.familyId) return false
    if (filters.role && manifest.role !== filters.role) return false
    if (filters.environment && manifest.environment !== filters.environment) return false
    if (filters.capability && !Object.prototype.hasOwnProperty.call(manifest.capabilities || {}, filters.capability)) return false
    return true
  }

  async function listAppManifestEntries(filters = {}) {
    const projects = await P.detectProjects(args.roots, logger)
    const entries = []
    for (const project of projects) {
      const manifest = readAppManifest(project)
      if (!manifestMatches(manifest, filters)) continue
      entries.push({
        project,
        projectInfo: projectJson(project),
        manifest,
      })
    }
    return entries
  }

  function projectJson(p) {
    const id = p.id || p.name
    return {
      id: p.id,
      shortId: 'p_' + crypto.createHash('sha256').update(id).digest('hex').slice(0, 10),
      name: p.name,
      displayName: p.displayName || p.name,
      projectName: p.projectName,
      rootId: p.rootId,
      rootPath: p.rootPath,
      rootLabel: p.rootLabel,
      projectDir: p.projectDir,
      ticketsDir: p.ticketsDir,
      rulesPath: p.rulesPath,
      indexPath: p.indexPath,
      layout: p.layout,
      schemaOk: p.schemaOk,
      hasVersion: p.hasVersion,
      dockerPolicy: p.dockerPolicy || null,
      appManifest: manifestSummary(readAppManifest(p)),
      commonRules: commonRulesJson(),
    }
  }

  function commonRulesJson() {
    const rulesDir = path.join(REPO_ROOT, '_common', 'rules')
    const rulesPath = path.join(rulesDir, 'RULES.md')
    const docsDir = path.join(rulesDir, 'docs')
    const docs = []
    if (fs.existsSync(docsDir)) {
      try {
        for (const ent of fs.readdirSync(docsDir, { withFileTypes: true })) {
          if (ent.isFile() && ent.name.endsWith('.md')) docs.push(path.join(docsDir, ent.name))
        }
      } catch (_) {}
    }
    docs.sort((a, b) => a.localeCompare(b, 'ja'))
    return {
      exists: fs.existsSync(rulesPath),
      rulesDir,
      rulesPath,
      docs,
    }
  }

  async function openSystemPath(target) {
    const { spawn } = await import('node:child_process')
    if (process.platform === 'win32') {
      spawn('explorer.exe', [target], { detached: true, stdio: 'ignore' }).unref()
    } else if (process.platform === 'darwin') {
      spawn('open', [target], { detached: true, stdio: 'ignore' }).unref()
    } else {
      spawn('xdg-open', [target], { detached: true, stdio: 'ignore' }).unref()
    }
  }

  function extensionAiGuidance(id, tierInfo, extJson) {
    const raw = extJson && extJson.aiGuidance
    if (!raw || raw.includeInResumePrompt === false) return null
    const extDir = path.resolve(tierInfo.dir, id)
    const normalizeRel = value => {
      const rel = String(value || '').trim()
      if (!rel || path.isAbsolute(rel)) return null
      const full = path.resolve(extDir, rel)
      if (!isInsideOrSame(extDir, full) || !fs.existsSync(full)) return null
      return full
    }
    const rulesPath = normalizeRel(raw.rules || 'RULES.md')
    const docs = Array.isArray(raw.docs)
      ? raw.docs.map(normalizeRel).filter(Boolean)
      : []
    if (!rulesPath && !docs.length) return null
    return {
      rulesPath,
      docs,
    }
  }

  function assistantPromptsJson() {
    const raw = args.config && args.config.assistantPrompts ? args.config.assistantPrompts : {}
    const enabled = raw.enabled === true
    const rootValue = String(raw.root || '_prompts').trim() || '_prompts'
    const promptRoot = path.isAbsolute(rootValue)
      ? path.resolve(rootValue)
      : path.resolve(REPO_ROOT, rootValue)
    const promptRootOk = isInsideOrSame(REPO_ROOT, promptRoot) && fs.existsSync(promptRoot)
    const configuredPrompts = Array.isArray(raw.prompts) ? raw.prompts : []
    const prompts = []
    const seen = new Set()
    const addPrompt = (item, source) => {
      if (!item || typeof item !== 'object') return
      const id = String(item.id || '').trim()
      const rel = String(item.path || '').trim()
      if (!id || !rel || path.isAbsolute(rel)) return
      const full = path.resolve(REPO_ROOT, rel)
      if (!isInsideOrSame(REPO_ROOT, full) || !fs.existsSync(full)) return
      if (seen.has(id)) return
      seen.add(id)
      prompts.push({
        id,
        category: String(item.category || '').trim() || categoryFromPromptId(id),
        label: String(item.label || '').trim() || labelFromPromptId(id),
        path: full,
        labelPath: path.relative(REPO_ROOT, full) || full,
        trigger: String(item.trigger || '').trim(),
        source,
      })
    }
    for (const item of configuredPrompts) addPrompt(item, 'config')

    if (promptRootOk) {
      for (const category of ['packages', 'customize', 'presets']) {
        const dir = path.join(promptRoot, category)
        if (!fs.existsSync(dir)) continue
        let entries = []
        try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch (_) { entries = [] }
        for (const ent of entries) {
          if (!ent.isFile() || !ent.name.endsWith('.md') || ent.name.toLowerCase() === 'readme.md') continue
          const base = ent.name.replace(/\.md$/i, '')
          const id = `${promptIdPrefix(category)}:${base.replace(/_/g, '-')}`
          addPrompt({
            id,
            category,
            label: base.replace(/[-_]+/g, ' '),
            path: path.relative(REPO_ROOT, path.join(dir, ent.name)),
          }, 'scan')
        }
      }
    }

    const triggers = {}
    if (raw.triggers && typeof raw.triggers === 'object' && !Array.isArray(raw.triggers)) {
      for (const [key, words] of Object.entries(raw.triggers)) {
        if (!Array.isArray(words)) continue
        const clean = words.map(w => String(w || '').trim()).filter(Boolean)
        if (clean.length) triggers[key] = clean
      }
    }

    const enabledPromptIds = normalizePromptIdList(raw.enabledPromptIds, prompts.map(p => p.id))
    const projectPromptIds = normalizePromptIdList(raw.projectPromptIds, [])
    const ticketPromptDefaults = {}
    if (raw.ticketPromptDefaults && typeof raw.ticketPromptDefaults === 'object' && !Array.isArray(raw.ticketPromptDefaults)) {
      for (const [key, ids] of Object.entries(raw.ticketPromptDefaults)) {
        const clean = normalizePromptIdList(ids, [])
        if (clean.length) ticketPromptDefaults[key] = clean
      }
    }

    return {
      enabled,
      root: promptRootOk ? promptRoot : null,
      prompts,
      enabledPromptIds,
      projectPromptIds,
      ticketPromptDefaults,
      triggers,
    }
  }

  function promptIdPrefix(category) {
    if (category === 'packages') return 'package'
    if (category === 'customize') return 'customize'
    if (category === 'presets') return 'preset'
    return 'prompt'
  }

  function categoryFromPromptId(id) {
    const prefix = String(id || '').split(':')[0]
    if (prefix === 'package') return 'packages'
    if (prefix === 'customize') return 'customize'
    if (prefix === 'preset') return 'presets'
    return 'custom'
  }

  function labelFromPromptId(id) {
    return String(id || '').split(':').pop().replace(/[-_]+/g, ' ')
  }

  function normalizePromptIdList(value, fallback) {
    const src = Array.isArray(value) ? value : fallback
    return src.map(v => String(v || '').trim()).filter(Boolean)
  }

  function enterpriseFeatureJson(id, label, tier, urlPrefix, extJson) {
    const tierInfo = findExtensionTier(id)
    const jsPath = tierInfo ? path.join(tierInfo.dir, id, 'assets', `${id}.js`) : ''
    const cssPath = tierInfo ? path.join(tierInfo.dir, id, 'assets', `${id}.css`) : ''
    const jsVersion = jsPath && fs.existsSync(jsPath) ? String(Math.floor(fs.statSync(jsPath).mtimeMs)) : version
    const cssVersion = cssPath && fs.existsSync(cssPath) ? String(Math.floor(fs.statSync(cssPath).mtimeMs)) : version
    const feature = {
      id,
      label,
      tier,
      modulePath: `${urlPrefix}/${id}/${id}.js?v=${encodeURIComponent(jsVersion)}`,
      cssPath: `${urlPrefix}/${id}/${id}.css?v=${encodeURIComponent(cssVersion)}`,
    }
    const aiGuidance = tierInfo ? extensionAiGuidance(id, tierInfo, extJson) : null
    if (aiGuidance) feature.aiGuidance = aiGuidance
    return feature
  }

  // 拡張ID から、それが属する系統エントリ を返す。
  // 同じ id が複数系統に存在した場合は最初に見つかった方 (EXTENSION_TIERS の先頭側) を返す。
  function findExtensionTier(extensionId) {
    for (const tier of EXTENSION_TIERS) {
      if (tier.candidates.some(c => c.id === extensionId)) return tier
    }
    return null
  }

  function loadExtensionJson(extensionId, dir, expectedTier) {
    const jsonPath = path.join(dir, extensionId, 'extension.json')
    if (!fs.existsSync(jsonPath)) return null
    let data
    try {
      data = JSON.parse(fs.readFileSync(jsonPath, 'utf8').replace(/^\uFEFF/, ''))
    } catch (e) {
      logger.logErr(`[extensions] extension.json 読み込みエラー (${extensionId}): ${e.message}`)
      return null
    }
    // L1 系統整合チェック: extension.json.tier と配置ディレクトリの一致を検証
    if (expectedTier && data && data.tier !== expectedTier) {
      logger.logErr(
        `[extensions] tier mismatch: "${extensionId}" は ${expectedTier}/ に配置されているが manifest tier="${data.tier}"。` +
        `ライセンス境界保護のためロードを拒否します。`
      )
      return null
    }
    return data
  }

  function availableEnterpriseFeatures() {
    const config = args.config || {}

    // 全系統 (enterprise/open/...) を順に走査して features を集める。
    // API エンドポイント名は availableEnterpriseFeatures のままだが、
    // 返却には open/ 系統の拡張も含まれる (クライアントは modulePath の URL だけを見るので透過的)。
    const features = []
    for (const tier of EXTENSION_TIERS) {
      for (const { id, label, jsFile } of tier.candidates) {
        const extDir = path.join(tier.dir, id)
        if (!fs.existsSync(path.join(extDir, 'routes.mjs'))) continue
        if (!fs.existsSync(path.join(extDir, 'assets', jsFile))) continue

        // L1 ロード + tier 整合チェック (不整合は null)
        const extJson = loadExtensionJson(id, tier.dir, tier.tier)
        if (!extJson) continue

        // バージョン互換チェック
        if (!checkExtensionCompatibility(extJson, logger)) continue

        // L2 ライセンス検証 (連続実行時に何度もログすると騒がしいため、
        // その違反は起動時 audit だけログ出力。ここでは黙ってスキップ)
        const lic = validateTierLicense(extJson, tier.tier)
        if (!lic.ok) continue

        // ON/OFF 判定
        if (!isExtensionEnabled(id, extJson, config, tier.tier)) continue

        features.push(enterpriseFeatureJson(id, label, tier.tier, tier.urlPrefix, extJson))
      }
    }
    return features
  }

  /**
   * L3 起動時ライセンス監査ログ。
   * makeHandler 生成時に 1 回だけ呼ぶ。全拡張のロード状態とライセンスを表示する。
   */
  function performLicenseAudit() {
    const config = args.config || {}

    // 旧 schema deprecation 警告
    if (isUsingDeprecatedConfigSchema(config)) {
      logger.log('[license] DEPRECATION: config.enterprise.enabledExtensions は廃止予定。config.extensions.enterprise.enabled を使ってください。')
    }

    logger.log('[license] === Extension license audit (4-layer model: L1+L2+L3) ===')

    for (const tier of EXTENSION_TIERS) {
      for (const { id, jsFile } of tier.candidates) {
        const extDir = path.join(tier.dir, id)
        const hasRoutes = fs.existsSync(path.join(extDir, 'routes.mjs'))
        const hasJs = fs.existsSync(path.join(extDir, 'assets', jsFile))
        if (!hasRoutes || !hasJs) {
          // 物理ファイル不足 → 候補だがスキップ (明示表示はしない)
          continue
        }

        const extJson = loadExtensionJson(id, tier.dir, tier.tier)
        if (!extJson) {
          logger.log(`[license]   ${tier.tier}/${id}  REJECTED (manifest load failed or tier mismatch)`)
          continue
        }

        const compat = checkExtensionCompatibility(extJson, { log: () => {}, logErr: () => {} })
        const lic = validateTierLicense(extJson, tier.tier)
        const enabled = isExtensionEnabled(id, extJson, config, tier.tier)

        const version = extJson.version || '?'
        const licStr = extJson.license || 'UNKNOWN'

        if (!compat) {
          logger.log(`[license]   ${tier.tier}/${id} v${version} (${licStr})  REJECTED: standard API version mismatch (requires=${extJson.requiresStandardApi})`)
          continue
        }
        if (!lic.ok) {
          logger.log(`[license]   ${tier.tier}/${id} v${version} (${licStr})  REJECTED: ${lic.reason}`)
          continue
        }

        // 有効化経路を記述
        let how = ''
        if (tier.tier === 'open') {
          const disabledList = config && config.extensions && config.extensions.open && config.extensions.open.disabled
          how = (Array.isArray(disabledList) && disabledList.includes(id))
            ? ' (explicitly disabled via config.extensions.open.disabled)'
            : ' (via enabledByDefault)'
        } else {
          const newList = config && config.extensions && config.extensions.enterprise && config.extensions.enterprise.enabled
          const oldList = config && config.enterprise && config.enterprise.enabledExtensions
          if (Array.isArray(newList)) {
            how = newList.includes(id) ? ' (via config.extensions.enterprise.enabled)' : ' (not in whitelist)'
          } else if (Array.isArray(oldList)) {
            how = oldList.includes(id) ? ' (via legacy config.enterprise.enabledExtensions)' : ' (not in legacy whitelist)'
          } else {
            how = ' (via enabledByDefault)'
          }
        }

        const status = enabled ? 'enabled' : 'disabled'
        logger.log(`[license]   ${tier.tier}/${id} v${version} (${licStr})  ${status}${how}`)
      }
    }

    logger.log('[license] === end ===')
  }

  async function handleEnterpriseStatic(pathname, res) {
    // 旧: /enterprise/<id>/<file> のみ → 新: /enterprise/<id>/<file> または /open/<id>/<file>
    const m = pathname.match(/^\/(enterprise|open)\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_.-]+)$/)
    if (!m) return false
    const tierKey = m[1]
    const feature = m[2]
    const file = m[3]
    // URL prefix から該当する系統のディレクトリを逆引する
    const tier = EXTENSION_TIERS.find(t => t.urlPrefix === `/${tierKey}`)
    if (!tier) return false
    const full = path.resolve(tier.dir, feature, 'assets', file)
    const assetsDir = path.resolve(tier.dir, feature, 'assets')
    if (!isInsideOrSame(assetsDir, full)) return sendText(res, 400, 'Bad path')
    if (!fs.existsSync(full)) return sendText(res, 404, 'Not Found')
    return sendFile(res, full)
  }

  async function handleEnterpriseApi(req, res, pathname, method, projectId) {
    const features = availableEnterpriseFeatures()

    // 標準 API helpers を構築（論点1: 公式公開API v1.0）
    // - isInsideOrSame: 内部化（本体が resolveRootRelative 経由でパス検証済みデータを渡す）
    // - tryAiUpdate: 内部化（本体ルーティングが mutation 後に自動呼び出し）
    // - readBody: 内部化（本体がパースして parsedBody として渡す）
    const helpers = buildEnterpriseHelpers({
      sendJson,
      getProject,
      rootForProject,
      requireRootCapability,
      openSystemPath,
      listAppManifestEntries,
      sanitizeFilename,
      generateStatusMd: SMD.generateStatusMd,
      tryAiUpdate,
      shared: args.shared,
      logger,
    })

    // リクエストボディを本体でパースして渡す（拡張が readBody を直接呼ばなくて済む）
    let parsedBody = {}
    if (req.headers['content-length'] && Number(req.headers['content-length']) > 0) {
      try { parsedBody = JSON.parse(await readBody(req)) } catch (_) { parsedBody = {} }
    }

    if (pathname.includes('/review/') && features.some(f => f.id === 'review-workflow')) {
      const tier = findExtensionTier('review-workflow')
      const mod = await import(pathToFileURL(path.join(tier.dir, 'review-workflow', 'routes.mjs')).href)
      return mod.handleReviewWorkflowRoute({ req, res, pathname, method, projectId, helpers, parsedBody })
    }
    if (pathname.includes('/paper/') && features.some(f => f.id === 'paper-platform')) {
      const tier = findExtensionTier('paper-platform')
      const mod = await import(pathToFileURL(path.join(tier.dir, 'paper-platform', 'routes.mjs')).href)
      return mod.handlePaperPlatformRoute({ req, res, pathname, method, projectId, helpers, parsedBody })
    }
    if (pathname.includes('/test-environment/') && features.some(f => f.id === 'test-environment')) {
      const tier = findExtensionTier('test-environment')
      const mod = await import(pathToFileURL(path.join(tier.dir, 'test-environment', 'routes.mjs')).href)
      return mod.handleTestEnvironmentRoute({ req, res, pathname, method, projectId, helpers, parsedBody })
    }
    return false
  }

  return async function handle(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`)
    const { pathname } = url
    const method = req.method

    res.setHeader('X-Server', serverId)
    const guard = mutationGuard(req, url)
    if (guard) return sendJson(res, guard.status, { error: guard.error })

    try {
      if (pathname === '/api/ping' && method === 'GET') {
        return sendJson(res, 200, {
          server: serverId,
          version,
          schema: schemaVersion,
          root: args.root,
          roots: args.roots,
          shared: args.shared || null,
          enterpriseConfigPath: args.enterpriseConfigPath || null,
          bomFixerPath: args.bomFixerPath,
          logDir: args.logDir,
          platform: process.platform,
          apiToken,
          // Phase 2-A: 自サーバーの aiName を公開。
          // クライアントが「他 AI と」「自 AI と」を識別するために使う (Phase 2-B で消費)。
          // ai-state 機能が無効 (aiName 未設定 / 不正) なら null を返す。
          aiName: AIS && AIS.isEnabled() ? AIS.getAiName() : null,
        })
      }

      if (pathname === '/api/projects' && method === 'GET') {
        const projects = await P.detectProjects(args.roots, logger, selfPath)
        return sendJson(res, 200, {
          root: args.root,
          roots: args.roots,
          projects: projects.map(projectJson),
        })
      }

      if (pathname === '/api/common-rules' && method === 'GET') {
        return sendJson(res, 200, commonRulesJson())
      }

      if (pathname === '/api/app-manifests' && method === 'GET') {
        const filters = {
          familyId: url.searchParams.get('familyId') || '',
          role: url.searchParams.get('role') || '',
          environment: url.searchParams.get('environment') || '',
          capability: url.searchParams.get('capability') || '',
        }
        const entries = await listAppManifestEntries(filters)
        const manifests = entries.map(entry => ({
          project: entry.projectInfo,
          manifest: manifestPublic(entry.manifest),
        }))
        return sendJson(res, 200, { manifests })
      }

      if (pathname === '/api/enterprise/features' && method === 'GET') {
        return sendJson(res, 200, { features: availableEnterpriseFeatures() })
      }

      if (pathname === '/api/assistant-prompts' && method === 'GET') {
        return sendJson(res, 200, assistantPromptsJson())
      }

      if (pathname === '/api/roots' && method === 'POST') {
        const body = JSON.parse(await readBody(req))
        const rawPath = String(body.path || '').trim()
        if (!rawPath) return sendJson(res, 400, { error: 'path が未指定です' })
        if (!path.isAbsolute(rawPath) && !/^[A-Za-z]:[\\/]/.test(rawPath)) {
          return sendJson(res, 400, { error: 'root path は絶対パスで指定してください' })
        }
        const rootPath = path.resolve(rawPath)
        let stat
        try {
          stat = await fsp.stat(rootPath)
        } catch (_) {
          return sendJson(res, 404, { error: '指定フォルダが存在しません' })
        }
        if (!stat.isDirectory()) return sendJson(res, 400, { error: '指定 path はディレクトリではありません' })
        const safety = assessRootSafety(rootPath)
        if (safety.level === 'blocked') {
          return sendJson(res, 400, {
            error: safety.message,
            code: safety.code,
            safety,
          })
        }
        const newReal = await fsp.realpath(rootPath)
        for (const r of args.roots || []) {
          try {
            const existingReal = await fsp.realpath(r.path)
            if (existingReal.toLowerCase() === newReal.toLowerCase()) {
              return sendJson(res, 409, { error: 'この root は既に登録されています', root: publicRootJson(r) })
            }
          } catch (_) {}
        }
        const id = makeUniqueRootId(body.id || rootIdFromPath(rootPath))
        const rootInfo = P.normalizeRoots({ roots: [{
          id,
          label: String(body.label || id).trim() || id,
          type: 'local',
          path: rootPath,
        }] })[0]
        args.roots.push(rootInfo)
        await saveRootsToConfig()
        await SMD.generateAllStatusMd()
        return sendJson(res, 200, { ok: true, root: publicRootJson(rootInfo), roots: args.roots.map(publicRootJson) })
      }

      if (pathname === '/api/projects/new' && method === 'POST') {
        const body = JSON.parse(await readBody(req))
        const name = sanitizeFilename(body.name)
        if (!name) return sendJson(res, 400, { error: 'ディレクトリ名が不正' })
        const rootInfo = strictRoot(body.rootId)
        if (!rootInfo) return sendJson(res, 400, { error: 'rootId が不正' })
        const capErr = requireRootCapability(rootInfo, 'createProject')
        if (capErr) return sendJson(res, capErr.status, { error: capErr.error })
        let parent
        try {
          parent = await resolveRootRelative(rootInfo, body.parentPath || '')
        } catch (e) {
          return sendJson(res, e.status || 400, { error: e.message })
        }
        if (!fs.existsSync(parent.full)) return sendJson(res, 404, { error: '親フォルダが存在しません' })
        const parentStat = await fsp.stat(parent.full)
        if (!parentStat.isDirectory()) return sendJson(res, 400, { error: '親フォルダがディレクトリではありません' })
        const projDir = path.join(parent.full, name)
        if (fs.existsSync(projDir)) return sendJson(res, 409, { error: '同じ場所に同名フォルダが既に存在します' })
        await fsp.mkdir(projDir, { recursive: true })
        await S.scaffoldProject(projDir, name)
        await SMD.generateAllStatusMd()
        const relName = parent.rel ? `${parent.rel}/${name}` : name
        const id = `${rootInfo.id}~${encodeURIComponent(relName)}`
        return sendJson(res, 200, { ok: true, id, name, path: relName, rootId: rootInfo.id })
      }

      if (pathname === '/api/fs/children' && method === 'GET') {
        const rootInfo = strictRoot(url.searchParams.get('rootId'))
        if (!rootInfo) return sendJson(res, 400, { error: 'rootId が不正' })
        const capErr = requireRootCapability(rootInfo, 'browse')
        if (capErr) return sendJson(res, capErr.status, { error: capErr.error })
        let current
        try {
          current = await resolveRootRelative(rootInfo, url.searchParams.get('path') || '')
        } catch (e) {
          return sendJson(res, e.status || 400, { error: e.message })
        }
        let stat
        try {
          stat = await fsp.stat(current.full)
        } catch (_) {
          return sendJson(res, 404, { error: 'フォルダが存在しません' })
        }
        if (!stat.isDirectory()) return sendJson(res, 400, { error: 'ディレクトリではありません' })

        const managed = await P.detectProjects(args.roots, logger, selfPath)
        const managedDirs = new Set(managed.map(p => path.resolve(p.projectDir).toLowerCase()))
        const currentManaged = managedDirs.has(path.resolve(current.full).toLowerCase())
        const entries = []
        for (const ent of await fsp.readdir(current.full, { withFileTypes: true })) {
          if (!ent.isDirectory()) continue
          if (ent.name.startsWith('.') || ent.name.startsWith('_')) continue
          if (ent.name === 'node_modules') continue
          const full = path.join(current.full, ent.name)
          const relPath = path.relative(rootInfo.path, full).replace(/\\/g, '/')
          entries.push({
            name: ent.name,
            path: relPath,
            managed: managedDirs.has(path.resolve(full).toLowerCase()),
            hasTickets: fs.existsSync(path.join(full, 'tickets')),
          })
        }
        entries.sort((a, b) => a.name.localeCompare(b.name, 'ja'))
        const parentPath = current.rel ? path.dirname(current.rel).replace(/\\/g, '/') : null
        return sendJson(res, 200, {
          rootId: rootInfo.id,
          rootLabel: rootInfo.label,
          rootPath: rootInfo.path,
          path: current.rel,
          absPath: current.full,
          parentPath: parentPath === '.' ? '' : parentPath,
          managed: currentManaged,
          hasTickets: fs.existsSync(path.join(current.full, 'tickets')),
          entries,
        })
      }

      if (pathname === '/api/projects/import-candidates' && method === 'GET') {
        const managed = await P.detectProjects(args.roots, logger, selfPath)
        const managedDirs = new Set(managed.map(p => path.resolve(p.projectDir).toLowerCase()))
        const candidates = []
        for (const rootInfo of args.roots) {
          let entries
          try {
            entries = await fsp.readdir(rootInfo.path, { withFileTypes: true })
          } catch (e) {
            logger.logErr(`import candidates read failed: ${rootInfo.path}: ${e.message}`)
            continue
          }
          for (const ent of entries) {
            if (!ent.isDirectory()) continue
            if (ent.name.startsWith('.') || ent.name.startsWith('_')) continue
            if (ent.name === 'node_modules' || ent.name === 'issue_manager') continue
            const full = path.join(rootInfo.path, ent.name)
            if (managedDirs.has(path.resolve(full).toLowerCase())) continue
            if (fs.existsSync(path.join(full, 'tickets'))) continue
            candidates.push({
              rootId: rootInfo.id,
              rootLabel: rootInfo.label,
              rootPath: rootInfo.path,
              name: ent.name,
              path: full,
            })
          }
        }
        return sendJson(res, 200, { roots: args.roots, candidates })
      }

      if (pathname === '/api/projects/import' && method === 'POST') {
        const body = JSON.parse(await readBody(req))
        const rootInfo = strictRoot(body.rootId)
        if (!rootInfo) return sendJson(res, 400, { error: 'rootId が不正' })
        const capErr = requireRootCapability(rootInfo, 'importProject')
        if (capErr) return sendJson(res, capErr.status, { error: capErr.error })
        let target
        try {
          target = await resolveRootRelative(rootInfo, body.path || '')
        } catch (e) {
          return sendJson(res, e.status || 400, { error: e.message })
        }
        const projDir = target.full
        const name = path.basename(projDir)
        if (!name) return sendJson(res, 400, { error: 'ディレクトリ名が不正' })
        if (!fs.existsSync(projDir)) return sendJson(res, 404, { error: 'フォルダが存在しません' })
        const stat = await fsp.stat(projDir)
        if (!stat.isDirectory()) return sendJson(res, 400, { error: 'ディレクトリではありません' })
        if (fs.existsSync(path.join(projDir, 'tickets'))) {
          return sendJson(res, 409, { error: '既に tickets ディレクトリが存在します' })
        }
        await S.scaffoldProject(projDir, name)
        await SMD.generateAllStatusMd()
        const id = `${rootInfo.id}~${encodeURIComponent(target.rel)}`
        return sendJson(res, 200, { ok: true, id, name, path: target.rel, rootId: rootInfo.id })
      }

      if (/^\/api\/projects\/[^/]+\/migrate$/.test(pathname) && method === 'POST') {
        const projectId = decodeURIComponent(pathname.split('/')[3])
        const project = await getProject(projectId)
        if (!project) return sendJson(res, 404, { error: 'project not found' })
        const capErr = requireRootCapability(rootForProject(project), 'writeTickets')
        if (capErr) return sendJson(res, capErr.status, { error: capErr.error })
        if (project.layout === 'new') return sendJson(res, 400, { error: '既に新構造です' })
        await S.migrateToNew(project)
        const refreshed = await getProject(projectId)
        if (refreshed) await SMD.generateStatusMd(refreshed)
        return sendJson(res, 200, { ok: true })
      }

      if (/^\/api\/projects\/[^/]+\/unregister$/.test(pathname) && method === 'POST') {
        const projectId = decodeURIComponent(pathname.split('/')[3])
        const project = await getProject(projectId)
        if (!project) return sendJson(res, 404, { error: 'project not found' })
        const capErr = requireRootCapability(rootForProject(project), 'writeMeta')
        if (capErr) return sendJson(res, capErr.status, { error: capErr.error })
        const body = JSON.parse(await readBody(req))
        const mode = body.mode === 'pack' ? 'pack' : 'keep'
        const issuemgrDir = path.join(project.projectDir, '.issuemgr')
        await fsp.mkdir(issuemgrDir, { recursive: true })
        let archivePath = ''
        if (mode === 'pack') {
          const archiveDir = path.join(issuemgrDir, 'unregistered')
          await fsp.mkdir(archiveDir, { recursive: true })
          archivePath = path.join(archiveDir, `tickets_${nowStamp()}.tar.gz`)
          await writeTarGz(project.ticketsDir, archivePath, 'tickets')
        }
        const payload = {
          unregisteredAt: new Date().toISOString(),
          mode,
          projectId: project.id,
          projectName: project.projectName || project.name,
          ticketsDir: path.relative(project.projectDir, project.ticketsDir).replace(/\\/g, '/'),
          archivePath: archivePath ? path.relative(project.projectDir, archivePath).replace(/\\/g, '/') : '',
          note: mode === 'keep'
            ? 'tickets/ はそのまま残し、このファイルにより issue_manager の検出対象から除外します。'
            : 'tickets/ はそのまま残し、圧縮コピーを作成した上で、このファイルにより issue_manager の検出対象から除外します。',
        }
        await fsp.writeFile(path.join(issuemgrDir, UNREGISTERED_FILE), JSON.stringify(payload, null, 2) + '\n', 'utf8')
        await SMD.generateAllStatusMd()
        return sendJson(res, 200, { ok: true, mode, archivePath, projectId })
      }

      let m = pathname.match(/^\/api\/projects\/([^/]+)\/app-manifest$/)
      if (m && method === 'GET') {
        const project = await getProject(decodeURIComponent(m[1]))
        if (!project) return sendJson(res, 404, { error: 'project not found' })
        const manifest = readAppManifest(project)
        if (!manifest) return sendJson(res, 404, { error: 'app manifest not found' })
        return sendJson(res, 200, {
          project: projectJson(project),
          manifest: manifestPublic(manifest),
        })
      }

      m = pathname.match(/^\/api\/projects\/([^/]+)\/tickets$/)
      if (m && method === 'GET') {
        const project = await getProject(decodeURIComponent(m[1]))
        if (!project) return sendJson(res, 404, { error: 'project not found' })
        const list = await T.listTickets(project)
        return sendJson(res, 200, { project: project.id, projectInfo: projectJson(project), layout: project.layout, tickets: list })
      }

      m = pathname.match(/^\/api\/projects\/([^/]+)\/export$/)
      if (m && method === 'GET') {
        const project = await getProject(decodeURIComponent(m[1]))
        if (!project) return sendJson(res, 404, { error: 'project not found' })
        const fmt = (url.searchParams.get('format') || 'tsv').toLowerCase()
        const includeArchive = url.searchParams.get('includeArchive') !== 'false'
        const list = await T.listTickets(project)

        const targetLanes = ['inbox', 'todo', 'doing', 'review', 'blocked', 'done']
        if (includeArchive) targetLanes.push('archive')

        const rows = []
        for (const lane of targetLanes) {
          const items = list[lane] || []
          for (const t of items) {
            let completedAt = t.completedAt || ''
            if (!completedAt && lane === 'done') {
              completedAt = new Date(t.mtime).toISOString().slice(0, 10)
            }
            let priority = ''
            const pm = t.file.match(/_P(\d)_/)
            if (pm) priority = 'P' + pm[1]
            rows.push({
              file: t.file,
              lane,
              title: t.title || '',
              priority,
              status: t.status || '',
              archivedFrom: t.archivedFrom || '',
              createdAt: t.createdAt || '',
              completedAt,
              mtime: new Date(t.mtime).toISOString(),
              ctime: t.ctime ? new Date(t.ctime).toISOString() : '',
              path: path.join(project.ticketsDir, lane, t.file),
            })
          }
        }

        const stamp = nowStamp()
        const baseName = (project.projectName || project.name).replace(/[^A-Za-z0-9_\-]/g, '_')
        if (fmt === 'json') {
          const body = JSON.stringify({
            project: project.projectName || project.name,
            exportedAt: new Date().toISOString(),
            includeArchive,
            totalCount: rows.length,
            tickets: rows,
          }, null, 2)
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="${baseName}_tickets_${stamp}.json"`,
            'Cache-Control': 'no-store',
          })
          res.end(body)
          return
        }
        const cols = ['file', 'lane', 'title', 'priority', 'status', 'archivedFrom', 'createdAt', 'completedAt', 'mtime', 'ctime', 'path']
        const esc = v => String(v == null ? '' : v).replace(/[\t\r\n]/g, ' ')
        const lines = [cols.join('\t')]
        for (const r of rows) {
          lines.push(cols.map(c => esc(r[c])).join('\t'))
        }
        const body = '\ufeff' + lines.join('\r\n') + '\r\n'
        res.writeHead(200, {
          'Content-Type': 'text/tab-separated-values; charset=utf-8',
          'Content-Disposition': `attachment; filename="${baseName}_tickets_${stamp}.tsv"`,
          'Cache-Control': 'no-store',
        })
        res.end(body)
        return
      }

      m = pathname.match(/^\/api\/projects\/([^/]+)\/ticket\/([^/]+)\/(.+)$/)
      if (m && method === 'GET') {
        const project = await getProject(decodeURIComponent(m[1]))
        if (!project) return sendJson(res, 404, { error: 'project not found' })
        const lane = decodeURIComponent(m[2])
        const file = decodeURIComponent(m[3])
        const safe = sanitizeFilename(file)
        if (!safe) return sendJson(res, 400, { error: 'invalid filename' })
        const { content, mtime, size, path: full } = await T.readTicket(project, lane, safe)
        await tryAiUpdate(project, { lastTicket: { lane, file: safe }, lastAction: 'readTicket' })
        return sendJson(res, 200, { content, mtime, size, path: full, lane, file: safe })
      }

      if (m && method === 'PUT') {
        const project = await getProject(decodeURIComponent(m[1]))
        if (!project) return sendJson(res, 404, { error: 'project not found' })
        const capErr = requireRootCapability(rootForProject(project), 'writeTickets')
        if (capErr) return sendJson(res, capErr.status, { error: capErr.error })
        const lane = decodeURIComponent(m[2])
        const file = decodeURIComponent(m[3])
        const safe = sanitizeFilename(file)
        if (!safe) return sendJson(res, 400, { error: 'invalid filename' })
        const body = JSON.parse(await readBody(req))
        const { mtime, size } = await T.writeTicket(project, lane, safe, body.content, body.expectedMtime)
        await SMD.generateStatusMd(project)
        await tryAiUpdate(project, { lastTicket: { lane, file: safe }, lastAction: 'writeTicket' })
        return sendJson(res, 200, { ok: true, mtime, size })
      }

      m = pathname.match(/^\/api\/projects\/([^/]+)\/ticket\/([^/]+)\/([^/]+)\/move$/)
      if (m && method === 'POST') {
        const project = await getProject(decodeURIComponent(m[1]))
        if (!project) return sendJson(res, 404, { error: 'project not found' })
        const capErr = requireRootCapability(rootForProject(project), 'writeTickets')
        if (capErr) return sendJson(res, capErr.status, { error: capErr.error })
        const fromLane = decodeURIComponent(m[2])
        const file = decodeURIComponent(m[3])
        const safe = sanitizeFilename(file)
        if (!safe) return sendJson(res, 400, { error: 'invalid filename' })
        const body = JSON.parse(await readBody(req))
        const result = await T.moveTicket(project, fromLane, safe, body.toLane, body.expectedMtime)
        await SMD.generateStatusMd(project)
        await tryAiUpdate(project, {
          lastTicket: { lane: result.newLane, file: result.newFile },
          lastAction: 'moveTicket',
        })
        return sendJson(res, 200, { ok: true, ...result })
      }

      m = pathname.match(/^\/api\/projects\/([^/]+)\/ticket\/([^/]+)\/([^/]+)$/)
      if (m && method === 'DELETE') {
        const project = await getProject(decodeURIComponent(m[1]))
        if (!project) return sendJson(res, 404, { error: 'project not found' })
        const capErr = requireRootCapability(rootForProject(project), 'writeTickets')
        if (capErr) return sendJson(res, capErr.status, { error: capErr.error })
        const lane = decodeURIComponent(m[2])
        const file = decodeURIComponent(m[3])
        const safe = sanitizeFilename(file)
        if (!safe) return sendJson(res, 400, { error: 'invalid filename' })
        const body = req.headers['content-length'] && Number(req.headers['content-length']) > 0
          ? JSON.parse(await readBody(req))
          : {}
        const result = await T.deleteTicket(project, lane, safe, body.expectedMtime)
        await SMD.generateStatusMd(project)
        // 削除済みなので lastTicket は null (ただし lastSeenAt は更新される)
        await tryAiUpdate(project, { lastTicket: null, lastAction: 'deleteTicket' })
        return sendJson(res, 200, { ok: true, ...result })
      }

      m = pathname.match(/^\/api\/projects\/([^/]+)\/ticket\/([^/]+)\/([^/]+)\/archive$/)
      if (m && method === 'POST') {
        const project = await getProject(decodeURIComponent(m[1]))
        if (!project) return sendJson(res, 404, { error: 'project not found' })
        const capErr = requireRootCapability(rootForProject(project), 'writeTickets')
        if (capErr) return sendJson(res, capErr.status, { error: capErr.error })
        const fromLane = decodeURIComponent(m[2])
        const file = decodeURIComponent(m[3])
        const safe = sanitizeFilename(file)
        if (!safe) return sendJson(res, 400, { error: 'invalid filename' })
        const body = req.headers['content-length'] && Number(req.headers['content-length']) > 0
          ? JSON.parse(await readBody(req))
          : {}
        const result = await T.archiveTicket(project, fromLane, safe, body.expectedMtime)
        await SMD.generateStatusMd(project)
        await tryAiUpdate(project, {
          lastTicket: { lane: result.newLane, file: result.newFile },
          lastAction: 'archiveTicket',
        })
        return sendJson(res, 200, { ok: true, ...result })
      }

      m = pathname.match(/^\/api\/projects\/([^/]+)\/ticket\/archive\/([^/]+)\/unarchive$/)
      if (m && method === 'POST') {
        const project = await getProject(decodeURIComponent(m[1]))
        if (!project) return sendJson(res, 404, { error: 'project not found' })
        const capErr = requireRootCapability(rootForProject(project), 'writeTickets')
        if (capErr) return sendJson(res, capErr.status, { error: capErr.error })
        const file = decodeURIComponent(m[2])
        const safe = sanitizeFilename(file)
        if (!safe) return sendJson(res, 400, { error: 'invalid filename' })
        const body = req.headers['content-length'] && Number(req.headers['content-length']) > 0
          ? JSON.parse(await readBody(req))
          : {}
        const result = await T.unarchiveTicket(project, safe, body.expectedMtime)
        await SMD.generateStatusMd(project)
        await tryAiUpdate(project, {
          lastTicket: { lane: result.newLane, file: result.newFile },
          lastAction: 'unarchiveTicket',
        })
        return sendJson(res, 200, { ok: true, ...result })
      }

      m = pathname.match(/^\/api\/projects\/([^/]+)\/ticket$/)
      if (m && method === 'POST') {
        const project = await getProject(decodeURIComponent(m[1]))
        if (!project) return sendJson(res, 404, { error: 'project not found' })
        const capErr = requireRootCapability(rootForProject(project), 'writeTickets')
        if (capErr) return sendJson(res, capErr.status, { error: capErr.error })
        const body = JSON.parse(await readBody(req))
        const result = await T.createTicket(project, body.lane || 'todo', body.filename, body.content)
        await SMD.generateStatusMd(project)
        await tryAiUpdate(project, {
          lastTicket: { lane: result.lane, file: result.file },
          lastAction: 'createTicket',
        })
        return sendJson(res, 200, { ok: true, ...result })
      }

      m = pathname.match(/^\/api\/projects\/([^/]+)\/meta\/(index|rules|template)$/)
      if (m && method === 'GET') {
        const project = await getProject(decodeURIComponent(m[1]))
        if (!project) return sendJson(res, 404, { error: 'project not found' })
        if (m[2] === 'template') {
          const tplPath = path.join(project.ticketsDir, 'TICKET_TEMPLATE.md')
          if (!fs.existsSync(tplPath)) return sendJson(res, 404, { error: 'template not found' })
          const stat = await fsp.stat(tplPath)
          const content = await fsp.readFile(tplPath, 'utf8')
          return sendJson(res, 200, { content, mtime: stat.mtimeMs, path: tplPath })
        }
        const data = await T.readMetaFile(project, m[2])
        return sendJson(res, 200, data)
      }

      if (m && method === 'PUT') {
        const project = await getProject(decodeURIComponent(m[1]))
        if (!project) return sendJson(res, 404, { error: 'project not found' })
        const capErr = requireRootCapability(rootForProject(project), 'writeMeta')
        if (capErr) return sendJson(res, capErr.status, { error: capErr.error })
        if (m[2] !== 'index') return sendJson(res, 400, { error: 'index 以外は編集不可' })
        const body = JSON.parse(await readBody(req))
        const stat = await fsp.stat(project.indexPath)
        if (body.expectedMtime != null && Math.abs(stat.mtimeMs - body.expectedMtime) > 1) {
          return sendJson(res, 409, { error: 'INDEX.md が外部で更新されています' })
        }
        await fsp.writeFile(project.indexPath, body.content, 'utf8')
        const newStat = await fsp.stat(project.indexPath)
        await SMD.generateStatusMd(project)
        return sendJson(res, 200, { ok: true, mtime: newStat.mtimeMs })
      }

      // ────────────────────────────────
      // ai-state 系 4 API (Phase 2-A)
      // ────────────────────────────────
      // 1) GET  /api/projects/:name/ai-state             → 全 AI のステート集約
      // 2) GET  /api/projects/:name/ai-state/:aiName     → 特定 AI のステート
      // 3) POST /api/projects/:name/ai-state/heartbeat   → 自身の生存報告 (他 AI 指定不可)
      // 4) PUT  /api/projects/:name/ai-state/notes       → 自身の notes を明示更新
      m = pathname.match(/^\/api\/projects\/([^/]+)\/ai-state$/)
      if (m && method === 'GET') {
        const project = await getProject(decodeURIComponent(m[1]))
        if (!project) return sendJson(res, 404, { error: 'project not found' })
        const list = (AIS && typeof AIS.readAll === 'function')
          ? await AIS.readAll(project)
          : []
        return sendJson(res, 200, { aiStates: list })
      }

      m = pathname.match(/^\/api\/projects\/([^/]+)\/ai-state\/([^/]+)$/)
      if (m && method === 'GET') {
        const project = await getProject(decodeURIComponent(m[1]))
        if (!project) return sendJson(res, 404, { error: 'project not found' })
        const targetAiName = decodeURIComponent(m[2])
        const state = (AIS && typeof AIS.readOne === 'function')
          ? await AIS.readOne(project, targetAiName)
          : null
        if (!state) return sendJson(res, 404, { error: 'ai-state not found', aiName: targetAiName })
        return sendJson(res, 200, { aiState: state })
      }

      m = pathname.match(/^\/api\/projects\/([^/]+)\/ai-state\/heartbeat$/)
      if (m && method === 'POST') {
        const project = await getProject(decodeURIComponent(m[1]))
        if (!project) return sendJson(res, 404, { error: 'project not found' })
        const capErr = requireRootCapability(rootForProject(project), 'writeMeta')
        if (capErr) return sendJson(res, capErr.status, { error: capErr.error })
        if (!AIS || !AIS.isEnabled()) {
          return sendJson(res, 400, { error: 'aiName が設定されていないため ai-state 機能は無効です' })
        }
        // ヘッダー同梱の任意ボディを読むが、aiName を URL/ボディで上書きはさせない。
        // 他 AI の ai-state を更新しようとする試みはエラーとする。
        if (req.headers['content-length'] && Number(req.headers['content-length']) > 0) {
          let body
          try { body = JSON.parse(await readBody(req)) } catch (_) { body = {} }
          if (body && typeof body === 'object' && body.aiName && body.aiName !== AIS.getAiName()) {
            return sendJson(res, 403, {
              error: '他 AI の ai-state は更新できません (ポート分離原則)',
              myAiName: AIS.getAiName(),
              requestedAiName: body.aiName,
            })
          }
        }
        const state = await AIS.heartbeat(project)
        return sendJson(res, 200, { ok: true, aiState: state })
      }

      m = pathname.match(/^\/api\/projects\/([^/]+)\/ai-state\/notes$/)
      if (m && method === 'PUT') {
        const project = await getProject(decodeURIComponent(m[1]))
        if (!project) return sendJson(res, 404, { error: 'project not found' })
        const capErr = requireRootCapability(rootForProject(project), 'writeMeta')
        if (capErr) return sendJson(res, capErr.status, { error: capErr.error })
        if (!AIS || !AIS.isEnabled()) {
          return sendJson(res, 400, { error: 'aiName が設定されていないため ai-state 機能は無効です' })
        }
        const body = JSON.parse(await readBody(req))
        if (body && body.aiName && body.aiName !== AIS.getAiName()) {
          return sendJson(res, 403, {
            error: '他 AI の notes は更新できません (ポート分離原則)',
            myAiName: AIS.getAiName(),
            requestedAiName: body.aiName,
          })
        }
        const text = typeof body.notes === 'string' ? body.notes : ''
        const state = await AIS.setNotes(project, text)
        return sendJson(res, 200, { ok: true, aiState: state })
      }

      m = pathname.match(/^\/api\/projects\/([^/]+)\/(paper|review|test-environment)\/[A-Za-z0-9_/-]+$/)
      if (m) {
        const handled = await handleEnterpriseApi(req, res, pathname, method, decodeURIComponent(m[1]))
        if (handled !== false) return handled
        return sendJson(res, 404, { error: 'enterprise feature not found' })
      }

      m = pathname.match(/^\/api\/projects\/([^/]+)\/open$/)
      if (m && method === 'POST') {
        const project = await getProject(decodeURIComponent(m[1]))
        if (!project) return sendJson(res, 404, { error: 'project not found' })
        const capErr = requireRootCapability(rootForProject(project), 'openExternal')
        if (capErr) return sendJson(res, capErr.status, { error: capErr.error })
        const body = JSON.parse(await readBody(req))
        const lane = body.lane
        const file = sanitizeFilename(body.file)
        if (!file) return sendJson(res, 400, { error: 'invalid filename' })
        const laneDir = lane === 'trash' ? '.trash' : lane
        let target
        if (body.kind === 'meta' && body.file === 'INDEX.md') target = project.indexPath
        else if (body.kind === 'meta' && body.file === 'RULES.md') target = project.rulesPath
        else target = path.join(project.ticketsDir, laneDir, file)
        if (!fs.existsSync(target)) return sendJson(res, 404, { error: 'file not found' })
        await openSystemPath(target)
        return sendJson(res, 200, { ok: true, opened: target })
      }

      // 静的ファイル配信
      if (method === 'GET') {
        if (pathname.startsWith('/enterprise/') || pathname.startsWith('/open/')) {
          const handled = await handleEnterpriseStatic(pathname, res)
          if (handled !== false) return handled
        }
        let reqPath = pathname === '/' ? '/index.html' : pathname
        if (reqPath.includes('..')) return sendText(res, 400, 'Bad path')
        const filepath = path.join(publicDir, reqPath)
        if (!filepath.startsWith(publicDir)) return sendText(res, 400, 'Bad path')
        return sendFile(res, filepath)
      }

      sendText(res, 404, 'Not Found')
    } catch (e) {
      handleFileError(res, e)
    }
  }
}
