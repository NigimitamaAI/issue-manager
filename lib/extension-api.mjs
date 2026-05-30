// ──────────────────────────────────────────────────
// issue_manager Enterprise 拡張 標準 API v1.0
// ──────────────────────────────────────────────────
//
// このファイルは、Enterprise 拡張が本体から受け取る "helpers" オブジェクトの
// 公式インターフェース定義である。
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
//       （CI チェック対象: enterprise/**/*.mjs に "from '../../lib/" が出たら警告）
//
// ## バージョニング
//
//   CURRENT_STANDARD_API_VERSION が extension.json の requiresStandardApi と照合される。
//   メジャーバージョンが一致しない場合、拡張はロードを拒否される。

import path from 'node:path'

/** 現在の標準 API バージョン */
export const CURRENT_STANDARD_API_VERSION = '1.0'

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
  logger,
}) {
  return {
    // ── Response ──
    /** HTTP JSON レスポンスを送信する */
    sendJson,

    // ── Project / root ──
    /** プロジェクトIDからプロジェクト情報を取得する */
    getProject,
    /** project からその root 情報を取得する */
    rootForProject,
    /** root の capability を検証する。エラーがあれば {status, error} を返す */
    requireRootCapability,

    // ── OS ──
    /** OS のファイルマネージャーで対象を開く */
    openSystemPath,

    // ── app.json ──
    /** app.json manifest エントリー一覧を取得する（filters でフィルタリング可） */
    listAppManifestEntries,

    // ── Filename ──
    /** ファイル名をサニタイズする（unsafe 文字を除去） */
    sanitizeFilename,

    // ── Path safety ──
    /**
     * parent が child を含む（または同一）かを検証する。
     * パス traversal 防止用。拡張がファイルパスを組み立てる前に使う。
     * @param {string} parent
     * @param {string} child
     * @returns {boolean}
     */
    isPathSafe(parent, child) {
      const p = path.resolve(parent)
      const c = path.resolve(child)
      const rel = path.relative(p, c)
      return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel))
    },

    // ── STATUS.md ──
    /** チケット操作後に STATUS.md を再生成する */
    generateStatusMd,

    // ── AI state ──
    /**
     * 拡張独自アクションを AI state に記録する。
     * ai-state 機能が無効な場合は何もしない（エラーにならない）。
     * @param {object} project
     * @param {object} patch - { lastTicket?: { lane, file }, lastAction?: string }
     */
    tryAiUpdate: tryAiUpdate || (async () => {}),

    // ── Logging ──
    /** ロガー { log, logErr }。拡張が本体のログ出力に書き込む際に使う */
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
      `[enterprise] extension "${extensionJson.id}" requiresStandardApi="${required}" is ` +
      `incompatible with current standard API v${CURRENT_STANDARD_API_VERSION}. Skipping load.`
    )
    return false
  }
  return true
}

/**
 * 拡張が有効かどうかを判定する。
 *
 * 判定ロジック（優先順）:
 *   1. config.enterprise.enabledExtensions が配列で存在する -> そのリストに含まれる拡張のみ有効
 *   2. ない -> extension.json の enabledByDefault に従う
 *   3. extension.json がない -> false（安全側）
 *
 * @param {string} extensionId
 * @param {object|null} extensionJson
 * @param {object} config
 * @returns {boolean}
 */
export function isExtensionEnabled(extensionId, extensionJson, config) {
  const enterpriseConfig = (config && config.enterprise) || {}
  const enabledList = enterpriseConfig.enabledExtensions
  if (Array.isArray(enabledList)) return enabledList.includes(extensionId)
  if (!extensionJson) return false
  return extensionJson.enabledByDefault === true
}
