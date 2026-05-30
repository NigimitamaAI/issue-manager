// ────────────────────────────────────────────────
// issue_manager チケット操作モジュール
// ────────────────────────────────────────────────
//
// レーン (inbox/todo/doing/review/blocked/done/.trash/archive) に対する CRUD と
// レーン間移動・archive/unarchive・メタファイル読み出しを担当する。
//
// すべての関数は project オブジェクト ({ ticketsDir, indexPath, rulesPath, ... })
// を受け取る純粋寄りの関数群。HTTP/ロガー/ARGS には依存しない。
//
// 依存方向: utils.mjs / constants.mjs にのみ依存。
//
// 注意: STATUS.md の自動再生成はこのモジュールでは行わない。
// 呼び出し側 (routes.mjs / server.mjs) で mutation 後に generateStatusMd を
// 別途呼ぶ責務を持つ（責務分離）。

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

import { LANES, LANES_WITH_TRASH } from './constants.mjs'
import { sanitizeFilename, nowStamp, readHead } from './utils.mjs'

// ────────────────────────────────────────────────
// レーン名の正規化ヘルパ
// ────────────────────────────────────────────────
// API パスやクライアントは 'trash' を使うが、ファイルシステム上は '.trash'。
// この差異を吸収する。
function laneToDir(lane) {
  return lane === 'trash' ? '.trash' : lane
}

// ────────────────────────────────────────────────
// 一覧
// ────────────────────────────────────────────────
// 全レーンを走査して、各 .md ファイルのメタ情報を返す。
// 戻り値: { inbox: [...], todo: [...], ..., trash: [...], archive: [...] }
// 各要素: { file, lane, title, status, archivedFrom, createdAt, completedAt, mtime, ctime, size }
export async function listTickets(project) {
  const result = { inbox: [], todo: [], doing: [], review: [], blocked: [], done: [], trash: [], archive: [] }
  for (const lane of LANES_WITH_TRASH) {
    const laneKey = lane === '.trash' ? 'trash' : lane
    const dir = path.join(project.ticketsDir, lane)
    if (!fs.existsSync(dir)) continue
    let files
    try {
      files = await fsp.readdir(dir, { withFileTypes: true })
    } catch (_) { continue }
    for (const f of files) {
      if (!f.isFile()) continue
      if (!f.name.endsWith('.md')) continue
      if (f.name.startsWith('.')) continue
      if (f.name === '.gitkeep.md') continue
      const full = path.join(dir, f.name)
      let stat
      try { stat = await fsp.stat(full) } catch (_) { continue }
      let title = f.name.replace(/\.md$/, '')
      let status = null
      let archivedFrom = null
      let createdAt = null
      let completedAt = null
      try {
        const head = await readHead(full, 30)
        const mt = head.match(/^#\s+(.+?)\s*$/m)
        if (mt) title = mt[1].trim()
        const ms = head.match(/^\s*-\s*ステータス\s*:\s*(\S+)/m)
        if (ms) status = ms[1].trim()
        const ma = head.match(/^\s*-\s*archive元\s*:\s*(\S+)/m)
        if (ma) archivedFrom = ma[1].trim()
        const mc = head.match(/^\s*-\s*作成日\s*:\s*(\S+)/m)
        if (mc) createdAt = mc[1].trim()
        const md = head.match(/^\s*-\s*完了日\s*:\s*(\S+)/m)
        if (md) completedAt = md[1].trim()
      } catch (_) {}
      result[laneKey].push({
        file: f.name,
        lane: laneKey,
        title,
        status,
        archivedFrom,
        createdAt,
        completedAt,
        mtime: stat.mtimeMs,
        ctime: stat.birthtimeMs || stat.ctimeMs,
        size: stat.size,
      })
    }
    result[laneKey].sort((a, b) => a.file.localeCompare(b.file))
  }
  return result
}

// ────────────────────────────────────────────────
// 単一チケットの読み書き
// ────────────────────────────────────────────────
export async function readTicket(project, lane, file) {
  const laneDir = laneToDir(lane)
  const full = path.join(project.ticketsDir, laneDir, file)
  if (!full.startsWith(project.ticketsDir)) throw new Error('path escape')
  const stat = await fsp.stat(full)
  const content = await fsp.readFile(full, 'utf8')
  return { content, mtime: stat.mtimeMs, size: stat.size, path: full }
}

export async function writeTicket(project, lane, file, content, expectedMtime) {
  const laneDir = laneToDir(lane)
  const full = path.join(project.ticketsDir, laneDir, file)
  if (!full.startsWith(project.ticketsDir)) throw new Error('path escape')

  if (expectedMtime != null) {
    const stat = await fsp.stat(full)
    if (Math.abs(stat.mtimeMs - expectedMtime) > 1) {
      const err = new Error('mtime mismatch')
      err.code = 'MTIME_MISMATCH'
      throw err
    }
  }
  await fsp.writeFile(full, content, 'utf8')
  const stat = await fsp.stat(full)
  return { mtime: stat.mtimeMs, size: stat.size }
}

export async function createTicket(project, lane, filename, content) {
  const safeName = sanitizeFilename(filename)
  if (!safeName || !safeName.endsWith('.md')) {
    const err = new Error('invalid filename')
    err.code = 'BAD_NAME'
    throw err
  }
  if (!LANES.includes(lane)) {
    const err = new Error('invalid lane')
    err.code = 'BAD_LANE'
    throw err
  }
  const laneDir = path.join(project.ticketsDir, lane)
  await fsp.mkdir(laneDir, { recursive: true })
  const full = path.join(laneDir, safeName)
  if (fs.existsSync(full)) {
    const err = new Error('file exists')
    err.code = 'EXISTS'
    throw err
  }
  await fsp.writeFile(full, content, 'utf8')
  const stat = await fsp.stat(full)
  return { file: safeName, lane, mtime: stat.mtimeMs, size: stat.size }
}

// ────────────────────────────────────────────────
// レーン間移動・削除（ソフト削除）
// ────────────────────────────────────────────────
// done へ移動する時は本文に「完了日」を自動挿入する。
// .trash へ移動する時、衝突時はタイムスタンプ付与で逃がす。
// 通常レーンへの移動で衝突した場合は EXISTS エラー。
export async function moveTicket(project, fromLane, file, toLane, expectedMtime) {
  const fromDirName = laneToDir(fromLane)
  const toDirName = laneToDir(toLane)
  if (!LANES_WITH_TRASH.includes(fromDirName) || !LANES_WITH_TRASH.includes(toDirName)) {
    const err = new Error('invalid lane')
    err.code = 'BAD_LANE'
    throw err
  }
  const src = path.join(project.ticketsDir, fromDirName, file)
  const dstDir = path.join(project.ticketsDir, toDirName)
  await fsp.mkdir(dstDir, { recursive: true })
  let dst = path.join(dstDir, file)

  if (expectedMtime != null) {
    const stat = await fsp.stat(src)
    if (Math.abs(stat.mtimeMs - expectedMtime) > 1) {
      const err = new Error('mtime mismatch')
      err.code = 'MTIME_MISMATCH'
      throw err
    }
  }
  if (fs.existsSync(dst)) {
    if (toDirName === '.trash') {
      const base = file.replace(/\.md$/, '')
      dst = path.join(dstDir, `${base}__${nowStamp()}.md`)
    } else {
      const err = new Error('destination exists')
      err.code = 'EXISTS'
      throw err
    }
  }
  if (toLane === 'done' && fromLane !== 'done') {
    let content = await fsp.readFile(src, 'utf8')
    content = injectCompletedAt(content)
    await fsp.writeFile(dst, content, 'utf8')
    await fsp.unlink(src)
  } else {
    await fsp.rename(src, dst)
  }
  const stat = await fsp.stat(dst)
  return { newLane: toLane, newFile: path.basename(dst), mtime: stat.mtimeMs }
}

export async function deleteTicket(project, lane, file, expectedMtime) {
  return moveTicket(project, lane, file, 'trash', expectedMtime)
}

// ────────────────────────────────────────────────
// archive / unarchive
// ────────────────────────────────────────────────
// archive: 元レーン名を本文の archive元 メタに記録して archive/ へ退避。
//          archive/ や trash/ から archive することは禁止。
// unarchive: archive元 メタを読んで元レーンへ復元。メタが無い/不正なら拒否。
export async function archiveTicket(project, fromLane, file, expectedMtime) {
  if (fromLane === 'archive' || fromLane === 'trash') {
    const err = new Error('archive/trash from is not allowed')
    err.code = 'BAD_LANE'
    throw err
  }
  const src = path.join(project.ticketsDir, fromLane, file)
  if (!fs.existsSync(src)) {
    const err = new Error('source not found')
    err.code = 'ENOENT'
    throw err
  }
  const stat = await fsp.stat(src)
  if (expectedMtime != null && Math.abs(stat.mtimeMs - expectedMtime) > 1) {
    const err = new Error('mtime mismatch')
    err.code = 'MTIME_MISMATCH'
    throw err
  }
  let content = await fsp.readFile(src, 'utf8')
  content = injectArchiveFromMeta(content, fromLane)
  const archiveDir = path.join(project.ticketsDir, 'archive')
  await fsp.mkdir(archiveDir, { recursive: true })
  let dst = path.join(archiveDir, file)
  if (fs.existsSync(dst)) {
    const base = file.replace(/\.md$/, '')
    dst = path.join(archiveDir, `${base}__${nowStamp()}.md`)
  }
  await fsp.writeFile(dst, content, 'utf8')
  await fsp.unlink(src)
  const newStat = await fsp.stat(dst)
  return { newLane: 'archive', newFile: path.basename(dst), mtime: newStat.mtimeMs }
}

export async function unarchiveTicket(project, file, expectedMtime) {
  const src = path.join(project.ticketsDir, 'archive', file)
  if (!fs.existsSync(src)) {
    const err = new Error('source not found')
    err.code = 'ENOENT'
    throw err
  }
  const stat = await fsp.stat(src)
  if (expectedMtime != null && Math.abs(stat.mtimeMs - expectedMtime) > 1) {
    const err = new Error('mtime mismatch')
    err.code = 'MTIME_MISMATCH'
    throw err
  }
  let content = await fsp.readFile(src, 'utf8')
  const from = extractArchiveFromMeta(content)
  if (!from || !LANES.includes(from)) {
    const err = new Error('archive元 メタが無いか不正です')
    err.code = 'NO_ARCHIVE_META'
    throw err
  }
  content = stripArchiveFromMeta(content)
  const dstDir = path.join(project.ticketsDir, from)
  await fsp.mkdir(dstDir, { recursive: true })
  const dst = path.join(dstDir, file)
  if (fs.existsSync(dst)) {
    const err = new Error('戻し先に同名ファイルがあります')
    err.code = 'EXISTS'
    throw err
  }
  await fsp.writeFile(dst, content, 'utf8')
  await fsp.unlink(src)
  const newStat = await fsp.stat(dst)
  return { newLane: from, newFile: file, mtime: newStat.mtimeMs }
}

// ────────────────────────────────────────────────
// 本文メタ操作（純粋関数）
// ────────────────────────────────────────────────
// 本文先頭付近の Markdown リスト形式メタ (`- 完了日: ...` 等) を挿入・抽出・除去する。
// テスト容易性のため副作用なし・引数の string を加工して返すのみ。

// done レーンへの移動時、本文に `- 完了日: YYYY-MM-DD` を挿入する。
// 既に完了日が書かれていれば何もしない。
// 挿入位置は「ステータス行の直下」→「作成日行の直下」→「2行目」の優先順位。
export function injectCompletedAt(content) {
  if (/^\s*-\s*完了日\s*:\s*\S+/m.test(content)) return content
  const today = new Date().toISOString().slice(0, 10)
  const line = `- 完了日: ${today}`
  if (/^\s*-\s*ステータス\s*:/m.test(content)) {
    return content.replace(/(^\s*-\s*ステータス\s*:.*$)/m, `$1\n${line}`)
  }
  if (/^\s*-\s*作成日\s*:/m.test(content)) {
    return content.replace(/(^\s*-\s*作成日\s*:.*$)/m, `$1\n${line}`)
  }
  const idx = content.indexOf('\n')
  if (idx >= 0) {
    return content.slice(0, idx + 1) + '\n' + line + '\n' + content.slice(idx + 1)
  }
  return content + '\n' + line + '\n'
}

// archive 退避時、本文に `- archive元: <fromLane>` を挿入する。
// 既存の archive元 行は一旦削除してから新しい値で書き直す（archive→unarchive→
// 別レーンへ→再archive のサイクルで古いメタが残らないように）。
export function injectArchiveFromMeta(content, fromLane) {
  let result = content.replace(/^\s*-\s*archive元\s*:\s*\S+\s*$\r?\n?/m, '')
  const line = `- archive元: ${fromLane}`
  if (/^\s*-\s*ステータス\s*:/m.test(result)) {
    result = result.replace(/(^\s*-\s*ステータス\s*:.*$)/m, `$1\n${line}`)
  } else {
    const idx = result.indexOf('\n')
    if (idx >= 0) {
      result = result.slice(0, idx + 1) + '\n' + line + '\n' + result.slice(idx + 1)
    } else {
      result = result + '\n' + line + '\n'
    }
  }
  return result
}

export function extractArchiveFromMeta(content) {
  const m = content.match(/^\s*-\s*archive元\s*:\s*(\S+)/m)
  return m ? m[1].trim() : null
}

export function stripArchiveFromMeta(content) {
  return content.replace(/^\s*-\s*archive元\s*:\s*\S+\s*$\r?\n?/m, '')
}

// ────────────────────────────────────────────────
// メタファイル (INDEX.md / RULES.md) の読み出し
// ────────────────────────────────────────────────
// kind: 'index' | 'rules'
export async function readMetaFile(project, kind) {
  const p = kind === 'index' ? project.indexPath
         : kind === 'rules' ? project.rulesPath
         : null
  if (!p) throw new Error('unknown kind')
  const stat = await fsp.stat(p)
  const content = await fsp.readFile(p, 'utf8')
  return { content, mtime: stat.mtimeMs, path: p }
}
