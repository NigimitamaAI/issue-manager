// ────────────────────────────────────────────────
// issue_manager 共有ユーティリティ
// ────────────────────────────────────────────────
//
// このモジュールには「複数モジュールから使われる小粒な純粋関数」を置く。
// 依存方向: constants.mjs にのみ依存可。tickets.mjs / projects.mjs /
// routes.mjs / server.mjs などから import される。

import fsp from 'node:fs/promises'

// ファイル名の安全性チェック。パストラバーサル・禁則文字・長さ超過を弾く。
// 安全なら元の name を返し、不正なら null を返す。
export function sanitizeFilename(name) {
  if (!name || typeof name !== 'string') return null
  if (name.includes('..') || name.includes('/') || name.includes('\\')) return null
  if (/[<>:"|?*\x00-\x1f]/.test(name)) return null
  if (name.length > 200) return null
  return name
}

// Markdown 先頭の YAML フロントマター (--- ... ---) を簡易パース。
// `key: value` 形式の行のみ拾う。値はクォート除去等を行わない素朴版。
// 該当なしなら null、ある場合は { key: value, ... } のオブジェクト。
export function parseFrontmatter(text) {
  const m = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/)
  if (!m) return null
  const obj = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_]+)\s*:\s*(.+?)\s*$/)
    if (kv) obj[kv[1]] = kv[2]
  }
  return obj
}

// `YYYYMMDD_HHMMSS` 形式のタイムスタンプ文字列を返す。
// .trash や archive へ重複ファイルを退避する時のサフィックスに使う。
export function nowStamp() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

// ファイル先頭 N 行を文字列として返す。
// listTickets() がチケット冒頭からタイトル・ステータス等を抽出する用途で使う。
// 大きなファイルでもメモリには全文乗る点に注意（チケットは小さい前提）。
export async function readHead(filepath, lines) {
  const content = await fsp.readFile(filepath, 'utf8')
  return content.split(/\r?\n/).slice(0, lines).join('\n')
}
