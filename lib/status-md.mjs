// ────────────────────────────────────────────────
// issue_manager STATUS.md 自動生成
// ────────────────────────────────────────────────
//
// 各プロジェクトの tickets/STATUS.md を「各レーンの実ファイル一覧」として
// 自動生成する。INDEX.md と実態の乖離による引継ぎ事故を防ぐための仕組み。
// このファイルは編集禁止。手書きの推奨実行順や引継ぎメモは INDEX.md に書く。
//
// このモジュールは「listTickets / detectProjects / logger」を依存注入で受ける
// ファクトリ形式。tickets.mjs / projects.mjs / logger.mjs に静的依存しない
// (循環参照防止 + テスト容易性のため)。

import fsp from 'node:fs/promises'
import path from 'node:path'

// ────────────────────────────────────────────────
// レンダリングヘルパ (純粋関数)
// ────────────────────────────────────────────────

// 1 チケットの 1 行表現を作る。
// `- <file> — <title> (作成日:..., 完了日:..., 元:..., 状態:...)`
function fmtItem(t) {
  const parts = []
  if (t.title && t.title !== t.file.replace(/\.md$/, '')) parts.push(t.title)
  const meta = []
  if (t.createdAt) meta.push(`作成日:${t.createdAt}`)
  if (t.completedAt) meta.push(`完了日:${t.completedAt}`)
  if (t.archivedFrom) meta.push(`元:${t.archivedFrom}`)
  if (t.status && !['todo', 'doing', 'blocked', 'done', 'inbox'].includes(t.status)) {
    meta.push(`状態:${t.status}`)
  }
  let line = `- ${t.file}`
  if (parts.length) line += ` — ${parts.join(' ')}`
  if (meta.length) line += ` (${meta.join(', ')})`
  return line
}

// レーン全件レンダリング。doing/blocked/todo/inbox 用。
function renderLane(list, laneKey, label) {
  const items = list[laneKey] || []
  const out = [`## ${label} (${items.length})`]
  if (items.length === 0) out.push('_なし_')
  else for (const t of items) out.push(fmtItem(t))
  return out.join('\n')
}

// レーン直近 N 件レンダリング。done/archive 用 (件数が増えがちなので頭出しのみ)。
function renderRecent(list, laneKey, label, n) {
  const items = (list[laneKey] || []).slice().sort((a, b) => b.mtime - a.mtime).slice(0, n)
  const out = [`## 直近 ${label} (最新 ${n} 件 / 全 ${(list[laneKey] || []).length} 件)`]
  if (items.length === 0) out.push('_なし_')
  else for (const t of items) out.push(fmtItem(t))
  return out.join('\n')
}

// ローカルタイムゾーン付き ISO 文字列を作る (例: 2026-05-05T22:31:07+09:00)。
function localIsoNow() {
  const now = new Date()
  const tzOffset = -now.getTimezoneOffset()
  const sign = tzOffset >= 0 ? '+' : '-'
  const pad = n => String(Math.abs(n)).padStart(2, '0')
  const tzStr = `${sign}${pad(tzOffset / 60 | 0)}:${pad(tzOffset % 60)}`
  return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${tzStr}`
}

// ────────────────────────────────────────────────
// ファクトリ
// ────────────────────────────────────────────────
// deps:
//   - listTickets: lib/tickets.mjs の listTickets 関数
//   - detectProjects: lib/projects.mjs の detectProjects 関数
//   - logger: { log, logErr } を持つロガー (失敗時の通知用、null でも動く)
//
// 戻り値: { generateOne, generateAll }
//   - generateOne(project): 1 プロジェクトの STATUS.md を生成
//   - generateAll(roots): root 配下の全プロジェクトに対して generateOne
export function createStatusMdGenerator({ listTickets, detectProjects, logger }) {
  async function generateOne(project) {
    if (!project || !project.ticketsDir) return
    try {
      const list = await listTickets(project)
      const stats = [
        `doing:${(list.doing || []).length}`,
        `blocked:${(list.blocked || []).length}`,
        `todo:${(list.todo || []).length}`,
        `inbox:${(list.inbox || []).length}`,
        `done:${(list.done || []).length}`,
        `archive:${(list.archive || []).length}`,
        `.trash:${(list.trash || []).length}`,
      ].join(' / ')

      const md = [
        `# チケット状態（自動生成）`,
        ``,
        `最終更新: ${localIsoNow()}`,
        `プロジェクト: ${project.projectName || project.name}`,
        ``,
        `**このファイルは server.mjs が自動生成します。手で編集しないでください。**`,
        `編集したい内容（推奨実行順・引継ぎメモ等）は INDEX.md へ。`,
        ``,
        renderLane(list, 'doing', 'doing'),
        ``,
        renderLane(list, 'blocked', 'blocked'),
        ``,
        renderLane(list, 'todo', 'todo'),
        ``,
        renderLane(list, 'inbox', 'inbox'),
        ``,
        renderRecent(list, 'done', 'done', 7),
        ``,
        renderRecent(list, 'archive', 'archive', 7),
        ``,
        `## 統計`,
        stats,
        ``,
      ].join('\n')

      await fsp.writeFile(path.join(project.ticketsDir, 'STATUS.md'), md, 'utf8')
    } catch (e) {
      if (logger) logger.log(`STATUS.md generate failed for ${project && project.name}: ${e.message}`)
    }
  }

  async function generateAll(root) {
    try {
      const list = await detectProjects(root, logger)
      for (const p of list) await generateOne(p)
    } catch (e) {
      if (logger) logger.log(`generateAllStatusMd failed: ${e.message}`)
    }
  }

  return { generateOne, generateAll }
}
