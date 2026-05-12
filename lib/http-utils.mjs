// ────────────────────────────────────────────────
// issue_manager HTTP ユーティリティ
// ────────────────────────────────────────────────
//
// HTTP レスポンス送信のヘルパ群と、汎用エラーハンドラ。
//
// 依存方向: 何にも依存しない（logger は引数で注入してもらう）。
// routes.mjs / server.mjs から使われる。

import fsp from 'node:fs/promises'
import path from 'node:path'

// 静的ファイル配信時の Content-Type マップ
export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
}

// JSON レスポンスを送信。
export function sendJson(res, status, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

// テキストレスポンスを送信。
export function sendText(res, status, text, mime = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': mime, 'Cache-Control': 'no-store' })
  res.end(text)
}

// 静的ファイルを送信。拡張子から MIME を自動判定。
// 読み取り失敗時は 404。
export async function sendFile(res, filepath) {
  try {
    const data = await fsp.readFile(filepath)
    const ext = path.extname(filepath).toLowerCase()
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    res.end(data)
  } catch (e) {
    sendText(res, 404, 'Not Found')
  }
}

// リクエストボディを文字列として読む。limit (バイト) を超えたら reject。
export async function readBody(req, limit = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    req.on('data', c => {
      total += c.length
      if (total > limit) { reject(new Error('payload too large')); req.destroy() }
      else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

// 既知のエラーコードを HTTP ステータスにマッピングしてレスポンス。
// logger は { logErr } 形を期待。未知エラーは 500 + ロギング。
export function makeFileErrorHandler(logger) {
  return function handleFileError(res, e) {
    if (e.code === 'ENOENT') return sendJson(res, 404, { error: 'not found' })
    if (e.code === 'MTIME_MISMATCH') return sendJson(res, 409, { error: 'ファイルが外部で更新されています。再読み込みしてください。' })
    if (e.code === 'EXISTS') return sendJson(res, 409, { error: 'ファイルが既に存在します' })
    if (e.code === 'BAD_NAME') return sendJson(res, 400, { error: 'ファイル名が不正です' })
    if (e.code === 'BAD_LANE') return sendJson(res, 400, { error: 'レーン指定が不正です' })
    if (e.code === 'EBUSY' || e.code === 'EPERM') {
      return sendJson(res, 409, { error: 'ファイルがエディタ等で掴まれています(EBUSY/EPERM)。エディタを閉じてから再試行してください。', code: e.code })
    }
    logger.logErr('server error:', e)
    return sendJson(res, 500, { error: e.message })
  }
}
