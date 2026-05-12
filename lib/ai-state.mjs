// ────────────────────────────────────────────────
// issue_manager AI ステート (.issuemgr/ai-<aiName>.json) 読み書き
// ────────────────────────────────────────────────
//
// Phase 2-A で導入。「ポート別に別 AI が同じプロジェクトを触る」運用のために
// AI ごとのステートファイルを .issuemgr/ai-<aiName>.json として保存する。
//
// 設計原則:
//   - 主体が書き、他 AI は読み専用 (物理分離原則)。
//   - サーバーは自身の aiName 以外の ai-*.json には絶対に書き込まない。
//   - aiName 空 / 不正の時は updateSelf / setNotes / heartbeat を NO-OP にする
//     (機能無効化、互換性確保)。
//   - 並列書き込みは「同 aiName 内では起きない (シングルプロセス)」「異 aiName は別ファイル」
//     で十分なので fs.writeFile の atomic 書きは不要、上書きで OK。
//
// 依存方向: constants.mjs にのみ依存。HTTP/ロガーは引数で注入してもらう。

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

import {
  ISSUEMGR_DIR,
  ISSUEMGR_AI_STATE_PREFIX,
  AI_STATE_SCHEMA_VERSION,
} from './constants.mjs'

// ────────────────────────────────────────────────
// aiName のサニタイズ
// ────────────────────────────────────────────────
// ファイル名に使うため、英数字・ハイフン・アンダースコアのみを許可。
// それ以外の文字が含まれていたら null を返す (空扱い → 機能無効化)。
// 空文字 / null / undefined も null。
export function sanitizeAiName(name) {
  if (typeof name !== 'string') return null
  const trimmed = name.trim()
  if (!trimmed) return null
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) return null
  return trimmed
}

// ai-<aiName>.json の絶対パスを組み立てる。
// project.projectDir 直下の .issuemgr/ に置く。
function aiStateFilePath(project, aiName) {
  return path.join(
    project.projectDir,
    ISSUEMGR_DIR,
    `${ISSUEMGR_AI_STATE_PREFIX}${aiName}.json`,
  )
}

// .issuemgr/ ディレクトリ自体を確保する (無ければ作る)。
async function ensureIssuemgrDir(project) {
  const dir = path.join(project.projectDir, ISSUEMGR_DIR)
  await fsp.mkdir(dir, { recursive: true })
  return dir
}

// 1 ファイルを安全に読む。存在しない / JSON 不正は null を返す。
async function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null
  let text
  try {
    text = await fsp.readFile(filePath, 'utf8')
  } catch (_) {
    return null
  }
  try {
    const obj = JSON.parse(text)
    if (!obj || typeof obj !== 'object') return null
    return obj
  } catch (_) {
    return null
  }
}

// 空ステートのテンプレート (初回作成時 / 読み込み失敗フォールバック用)
function emptyState(aiName) {
  return {
    $schema: AI_STATE_SCHEMA_VERSION,
    aiName,
    lastSeenAt: null,
    lastTicket: null,
    lastAction: null,
    notes: '',
    extras: {},
  }
}

// ファイル名から aiName を逆算する。'ai-foo.json' → 'foo'
// プレフィックス・拡張子に合わない名前は null。
function fileNameToAiName(fileName) {
  if (!fileName.startsWith(ISSUEMGR_AI_STATE_PREFIX)) return null
  if (!fileName.endsWith('.json')) return null
  const middle = fileName.slice(
    ISSUEMGR_AI_STATE_PREFIX.length,
    fileName.length - '.json'.length,
  )
  return sanitizeAiName(middle)
}

// ────────────────────────────────────────────────
// factory
// ────────────────────────────────────────────────
// aiName は起動時に固定。クロージャに閉じ込めて updateSelf 等から渡し忘れる
// 事故を防ぐ。logger は { log, logErr } 形を期待 (任意)。
export function createAiStateManager({ aiName, logger } = {}) {
  const safeAiName = sanitizeAiName(aiName)
  const enabled = Boolean(safeAiName)
  const log = logger || { log: () => {}, logErr: () => {} }

  // aiName 設定はあったが妥当性検査で弾かれた場合は警告だけ出す。
  if (aiName && !safeAiName) {
    log.logErr(`[ai-state] aiName "${aiName}" は不正な値のため AI ステート機能を無効化します (英数字・ハイフン・アンダースコアのみ許可)`)
  }

  // 内部: 自分の ai-<aiName>.json を読み、merge して書き戻す。
  // patch は { lastTicket, lastAction, notes 等 } の部分更新。lastSeenAt は常に now で上書き。
  // ファイル書き込みは ベストエフォート (失敗しても呼び出し側のレスポンスを止めない)。
  async function writeSelf(project, patch) {
    if (!enabled) return null
    const filePath = aiStateFilePath(project, safeAiName)
    let current = await readJsonFile(filePath)
    if (!current) current = emptyState(safeAiName)

    // schema/aiName は常に自分のもので上書き (古いファイルや手書き分の救済)
    current.$schema = AI_STATE_SCHEMA_VERSION
    current.aiName = safeAiName
    if (current.notes == null || typeof current.notes !== 'string') current.notes = ''
    if (!current.extras || typeof current.extras !== 'object') current.extras = {}

    // patch を浅くマージ (lastTicket は object 丸ごと差し替え)
    if (patch && typeof patch === 'object') {
      for (const [k, v] of Object.entries(patch)) {
        if (k === 'aiName' || k === '$schema') continue
        current[k] = v
      }
    }
    current.lastSeenAt = new Date().toISOString()

    try {
      await ensureIssuemgrDir(project)
      await fsp.writeFile(filePath, JSON.stringify(current, null, 2) + '\n', 'utf8')
      return current
    } catch (e) {
      log.logErr(`[ai-state] 書き込み失敗: ${filePath}: ${e.message}`)
      return null
    }
  }

  return {
    // 機能が有効か (aiName が設定済み & 妥当)
    isEnabled() { return enabled },

    // 自身の aiName を返す (無効時は null)
    getAiName() { return safeAiName },

    // 特定 AI のステートを返す。なければ null。
    // enabled に関わらず動く (読み込みは誰でも可能)。
    async readOne(project, targetAiName) {
      const safe = sanitizeAiName(targetAiName)
      if (!safe) return null
      const filePath = aiStateFilePath(project, safe)
      return await readJsonFile(filePath)
    },

    // .issuemgr/ai-*.json を全部読み込んで配列で返す。
    // 該当ファイルが無ければ空配列。
    // enabled に関わらず動く。
    async readAll(project) {
      const dir = path.join(project.projectDir, ISSUEMGR_DIR)
      if (!fs.existsSync(dir)) return []
      let entries
      try {
        entries = await fsp.readdir(dir, { withFileTypes: true })
      } catch (_) { return [] }
      const out = []
      for (const ent of entries) {
        if (!ent.isFile()) continue
        const aiName = fileNameToAiName(ent.name)
        if (!aiName) continue
        const obj = await readJsonFile(path.join(dir, ent.name))
        if (obj) out.push(obj)
      }
      // aiName でソート (安定した出力のため)
      out.sort((a, b) => String(a.aiName || '').localeCompare(String(b.aiName || '')))
      return out
    },

    // 自身のステートを部分更新する。enabled でなければ NO-OP。
    // ベストエフォート (失敗しても例外を投げない)。
    async updateSelf(project, patch) {
      if (!enabled) return null
      try {
        return await writeSelf(project, patch || {})
      } catch (e) {
        log.logErr(`[ai-state] updateSelf 失敗: ${e.message}`)
        return null
      }
    },

    // notes 欄を上書き設定。enabled でなければ NO-OP。
    async setNotes(project, text) {
      if (!enabled) return null
      const safeText = typeof text === 'string' ? text : ''
      return await writeSelf(project, { notes: safeText, lastAction: 'setNotes' })
    },

    // 「生存報告」: lastSeenAt と lastAction='heartbeat' のみ更新。enabled でなければ NO-OP。
    async heartbeat(project) {
      if (!enabled) return null
      return await writeSelf(project, { lastAction: 'heartbeat' })
    },
  }
}
