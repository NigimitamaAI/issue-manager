// ────────────────────────────────────────────────
// issue_manager ロガー
// ────────────────────────────────────────────────
//
// コンソール出力 + ファイル追記の二重書きロガー。
// `createLogger({ logDir })` で logDir を引数注入する形式にして、
// グローバル ARGS への依存を排除している。
//
// 依存方向: 何にも依存しない最下層モジュール。
// 全モジュール (server.mjs / routes.mjs / projects.mjs / scaffold.mjs ...) から
// import されるが、ここから他モジュールを import してはならない。

import fs from 'node:fs'
import path from 'node:path'

// ログ行を整形する純粋関数。
// items は console.log 風の可変長引数 (Error / object / string が混在しうる)。
// Error はスタックも含めて文字列化、object は JSON.stringify、それ以外は素直に String 化。
export function formatLogLine(level, items) {
  const stamp = new Date().toISOString()
  const body = items.map(v => {
    if (v instanceof Error) return `${v.name}: ${v.message}\n${v.stack || ''}`
    if (typeof v === 'string') return v
    try { return JSON.stringify(v) } catch (_) { return String(v) }
  }).join(' ')
  return `${stamp} [${level}] ${body}`
}

// ロガーインスタンスを生成。
// options:
//   - logDir: ログファイルを書き出すディレクトリ。空・falsy ならファイル書き込みなし。
//   - prefix: コンソール出力のプレフィクス (デフォルト '[issue_manager]')
// 戻り値: { log, logErr } を持つオブジェクト。これ以外のメソッドは追加しない。
export function createLogger({ logDir, prefix = '[issue_manager]' } = {}) {
  function appendServerLog(level, items) {
    try {
      if (!logDir) return
      fs.mkdirSync(logDir, { recursive: true })
      fs.appendFileSync(
        path.join(logDir, 'server.log'),
        formatLogLine(level, items) + '\n',
        'utf8'
      )
    } catch (_) {
      // Logging must never break the server.
    }
  }

  function log(...a) {
    console.log(prefix, ...a)
    appendServerLog('INFO', a)
  }

  function logErr(...a) {
    console.error(prefix, ...a)
    appendServerLog('ERROR', a)
  }

  return { log, logErr }
}
