/**
 * config.json 読み込みモジュール
 *
 * v1.0 から変更:
 *   - 環境変数展開機能 (${VAR} / ${VAR:-default}) を撤去
 *   - 単純な JSON 直書き + 既定値マージのみ
 *   - 関数名 loadConfigWithEnv は後方互換のため維持(server.mjs を変更しないため)
 *
 * 機能:
 *   1. config.json を読み込む(存在しなければ既定値を返す)
 *   2. _comment_ で始まるキーと先頭が記号($)のメタキーを自動的に除去
 *   3. パス系の値は path.resolve で正規化
 *
 * 設計判断:
 *   複数インスタンス同時起動を可能にするため、環境変数(setx)依存を撤去した。
 *   各インスタンスフォルダの config.json で port/root を別々に指定すれば
 *   1台の PC で複数の issue_manager を別ポートで走らせられる。
 *
 * 使用例:
 *   import { loadConfigWithEnv } from './lib/load-config.mjs'
 *   const config = loadConfigWithEnv('./config.json', {
 *     port: 5180,
 *     root: process.cwd(),
 *     nodeExe: 'node',
 *   })
 */

import fs from 'node:fs'
import path from 'node:path'

/**
 * config.json を読み込んで既定値とマージする。
 *
 * 関数名は v1.0 互換のため維持(中身は環境変数展開をしない単純版)。
 *
 * @param {string} configPath - config.json のパス
 * @param {object} defaults - 既定値オブジェクト(未指定キー or ファイル不在時に使用)
 * @param {object} [opts]
 * @param {string[]} [opts.pathKeys] - path.resolve を適用するキー
 * @param {object} [opts.logger=console] - ログ出力先(log/warn/error メソッドを持つオブジェクト)
 * @returns {object} 正規化済みの設定オブジェクト
 */
export function loadConfigWithEnv(configPath, defaults, opts = {}) {
  const pathKeys = opts.pathKeys ?? ['root', 'nodeExe', 'bomFixerPath', 'logDir']
  const logger = opts.logger ?? console

  // ファイルが無ければ既定値をそのまま返す
  if (!fs.existsSync(configPath)) {
    return { ...defaults }
  }

  // JSON パース
  let raw
  try {
    const text = fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '')
    raw = JSON.parse(text)
  } catch (e) {
    logger.error(`[config] 読み込み失敗: ${configPath}: ${e.message}`)
    return { ...defaults }
  }

  // メタキー除去:
  //   _comment* で始まるキー(JSONコメント代用)
  //   先頭が記号で始まるキー($schema など)
  const cleaned = {}
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith('_comment')) continue
    if (k.charCodeAt(0) === 0x24) continue // 0x24 = '$'
    cleaned[k] = v
  }

  // 既定値とマージし、パス系を正規化
  const result = { ...defaults }
  for (const [k, v] of Object.entries(cleaned)) {
    if (v == null || v === '') {
      // 空値は既定値を維持
      continue
    }
    if (pathKeys.includes(k) && typeof v === 'string' && v !== 'node') {
      // 'node' リテラルは path.resolve しない(PATH 上の node を意味)
      result[k] = path.resolve(v)
    } else {
      result[k] = v
    }
  }

  return result
}
