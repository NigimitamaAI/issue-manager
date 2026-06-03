// ──────────────────────────────────────────────────
// issue_manager Enterprise / Open 拡張 標準 API v1.0
// ──────────────────────────────────────────────────
//
// このファイルは、拡張が本体から受け取る "helpers" オブジェクトの公式インターフェース定義、
// および 4 層防御モデル（L1+L2+L3）のうち系統・ライセンス・有効化判定に関わる関数群を提供する。
//
// ## 拡張系統
//
//   open/<id>/       ← 公開拡張（Apache 2.0）
//   enterprise/<id>/ ← 有償拡張（BSL 1.1）
//
// ## 依存ツリー規則
//
//   issue_manager 本体（このファイルで定義された標準API）
//       ├── 拡張A         ← 標準APIのみに依存
//       ├── 拡張B         ← 標準APIのみに依存
//       └── 拡張A+B統合   ← 連携が必要な場合は統合拡張として1本化
//
// ## 拡張が守るべきルール
//
//   - helpers に含まれていない機能を使いたい場合は本体標準APIへの追加を申請する（チケット起票）
//   - 拡張 → 別拡張の内部関数への依存：禁止
//   - 拡張 → lib/ への直接 import：禁止
//       （CI チェック対象: enterprise/**/*.mjs と open/**/*.mjs に "from '../../lib/" が出たら警告）
//
// ## バージョニング
//
//   CURRENT_STANDARD_API_VERSION が extension.json の requiresStandardApi と照合される。
//   メジャーバージョンが一致しない場合、拡張はロードを拒否される。

import path from 'node:path'

/** 現在の標準 API バージョン */
export const CURRENT_STANDARD_API_VERSION = '1.0'

/**
 * 各 tier に許可された SPDX ライセンス識別子のホワイトリスト（L2 ライセンス明示）。
 *
 * - open: 公開拡張は Apache 2.0 のみ許可（将来 MIT 等を追加する場合はここに足す）
 * - enterprise: 有償拡張は BSL 1.1 のみ許可（将来 Commercial 等を追加する場合はここに足す）
 *
 * 拡張の extension.json.license がこのリストに含まれない場合、ロードを拒否する。
 */
export const TIER_ALLOWED_LICENSES = {
  open: ['Apache-2.0'],
  enterprise: ['BSL-1.1'],
}

/**
 * 標準 API helpers オブジェクトを構築して返す。
 * routes.mjs の handleEnterpriseApi() がこれを使って拡張に渡す。
 *
 * @param {object} params
 * @param {Function} params.sendJson             - sendJson(res, status, body)
 * @param {Function} params.getProject           - getProject(projectId) -> project | null
 * @param {Function} params.rootForProject       - rootForProject(project) -> rootInfo | null
 * @param {Function} params.requireRootCapability - requireRootCapability(root, cap) -> null | {status, error}
 * @param {Function} params.openSystemPath       - openSystemPath(target) -> void
 * @param {Function} params.listAppManifestEntries - listAppManifestEntries(filters) -> entries[]
 * @param {Function} params.sanitizeFilename     - sanitizeFilename(name) -> string
 * @param {Function} params.generateStatusMd     - generateStatusMd(project) -> void
 * @param {Function} params.tryAiUpdate          - tryAiUpdate(project, patch) -> void
 * @param {object}   [params.shared]             - issue_manager shared roots
 * @param {object}   [params.logger]             - { log, logErr } ログ出力（省略可）
 * @returns {EnterpriseHelpers}
 */
export function buildEnterpriseHelpers({
  sendJson,
  getProject,
  rootForProject,
  requireRootCapability,
  openSystemPath,
  listAppManifestEntries,
  sanitizeFilename,
  generateStatusMd,
  tryAiUpdate,
  shared,
  logger,
}) {
  return {
    // ── Response ──
    sendJson,

    // ── Project / root ──
    getProject,
    rootForProject,
    requireRootCapability,

    // ── OS ──
    openSystemPath,

    // ── app.json ──
    listAppManifestEntries,

    // ── Filename ──
    sanitizeFilename,

    // ── Path safety ──
    /**
     * parent が child を含む（または同一）かを検証する。
     * パス traversal 防止用。拡張がファイルパスを組み立てる前に使う。
     */
    isPathSafe(parent, child) {
      const p = path.resolve(parent)
      const c = path.resolve(child)
      const rel = path.relative(p, c)
      return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel))
    },

    // ── STATUS.md ──
    generateStatusMd,

    // ── AI state ──
    tryAiUpdate: tryAiUpdate || (async () => {}),

    // ── Shared issue_manager resources ──
    shared: shared || null,

    // ── Logging ──
    logger: logger || { log: () => {}, logErr: () => {} },
  }
}

/**
 * @typedef {object} EnterpriseHelpers
 * @property {Function} sendJson
 * @property {Function} getProject
 * @property {Function} rootForProject
 * @property {Function} requireRootCapability
 * @property {Function} openSystemPath
 * @property {Function} listAppManifestEntries
 * @property {Function} sanitizeFilename
 * @property {Function} isPathSafe
 * @property {Function} generateStatusMd
 * @property {Function} tryAiUpdate
 * @property {object}   logger
 */

/**
 * extension.json を読み込み、標準 API バージョンの互換性を検証する。
 *
 * @param {object|null} extensionJson
 * @param {object} logger - { log, logErr }
 * @returns {boolean}
 */
export function checkExtensionCompatibility(extensionJson, logger) {
  if (!extensionJson) return true
  const required = extensionJson.requiresStandardApi
  if (!required) return true
  const [reqMajor] = String(required).split('.')
  const [curMajor] = String(CURRENT_STANDARD_API_VERSION).split('.')
  if (reqMajor !== curMajor) {
    logger.logErr(
      `[extensions] extension "${extensionJson.id}" requiresStandardApi="${required}" is ` +
      `incompatible with current standard API v${CURRENT_STANDARD_API_VERSION}. Skipping load.`
    )
    return false
  }
  return true
}

/**
 * L2 ライセンス検証。tier × license の組み合わせが TIER_ALLOWED_LICENSES に合致するか。
 *
 * 用途:
 * - 配置ディレクトリの tier と extension.json.license が整合しているか確認
 * - 不整合（例: enterprise/ に Apache-2.0 拡張）はライセンス境界違反としてロード拒否
 *
 * 純関数。ログ出力は呼び出し側が決める。
 *
 * @param {object|null} extensionJson
 * @param {string} tier - 'open' | 'enterprise'
 * @returns {{ ok: boolean, reason: string|null }}
 */
export function validateTierLicense(extensionJson, tier) {
  if (!extensionJson) return { ok: false, reason: 'extension.json not loaded' }
  const license = extensionJson.license
  if (!license || typeof license !== 'string') {
    return { ok: false, reason: `missing required "license" field (expected SPDX identifier for tier "${tier}")` }
  }
  const allowed = TIER_ALLOWED_LICENSES[tier]
  if (!Array.isArray(allowed)) {
    return { ok: false, reason: `unknown tier "${tier}"` }
  }
  if (!allowed.includes(license)) {
    return {
      ok: false,
      reason: `license "${license}" is not permitted for tier "${tier}" (allowed: ${allowed.join(', ')})`,
    }
  }
  return { ok: true, reason: null }
}

/**
 * 拡張が有効かどうかを判定する（L1 系統分離つき）。
 *
 * 判定ロジック:
 *   - open 系統:
 *       1. config.extensions.open.disabled に extensionId が含まれる → false（明示無効化）
 *       2. それ以外は extension.json.enabledByDefault === true なら true
 *       open 系統は enterprise 用ホワイトリストの影響を受けない（ライセンス境界保護）
 *
 *   - enterprise 系統:
 *       1. config.extensions.enterprise.enabled が配列で存在 → そのリストでホワイトリスト判定
 *       2. （後方互換）config.enterprise.enabledExtensions が配列で存在 → 同上（deprecation 対象）
 *       3. リストがない → extension.json.enabledByDefault === true なら true
 *
 * @param {string} extensionId
 * @param {object|null} extensionJson
 * @param {object} config - config.json の内容
 * @param {string} tier - 'open' | 'enterprise'
 * @returns {boolean}
 */
export function isExtensionEnabled(extensionId, extensionJson, config, tier) {
  if (tier === 'open') {
    const disabledList = config && config.extensions && config.extensions.open && config.extensions.open.disabled
    if (Array.isArray(disabledList) && disabledList.includes(extensionId)) return false
    if (!extensionJson) return false
    return extensionJson.enabledByDefault === true
  }

  // enterprise 系統
  const newList = config && config.extensions && config.extensions.enterprise && config.extensions.enterprise.enabled
  const oldList = config && config.enterprise && config.enterprise.enabledExtensions  // deprecated
  const list = Array.isArray(newList) ? newList : (Array.isArray(oldList) ? oldList : null)
  if (list) return list.includes(extensionId)

  if (!extensionJson) return false
  return extensionJson.enabledByDefault === true
}

/**
 * 旧 schema (`config.enterprise.enabledExtensions`) が使われているかを判定する。
 * 起動時 audit log で deprecation 警告を出すために使う。
 *
 * @param {object} config
 * @returns {boolean}
 */
export function isUsingDeprecatedConfigSchema(config) {
  const newList = config && config.extensions && config.extensions.enterprise && config.extensions.enterprise.enabled
  const oldList = config && config.enterprise && config.enterprise.enabledExtensions
  return Array.isArray(oldList) && !Array.isArray(newList)
}
