// ────────────────────────────────────────────────
// issue_manager 初期化・スキャフォールディング
// ────────────────────────────────────────────────
//
// プロジェクトの新規作成 (テンプレ展開)・旧構造からの移行・
// public/ や _self/_template/ の自動初期化を扱う。
//
// 依存方向: template.mjs / constants.mjs。
// logger は引数で注入してもらう。

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

import { LANES, LANES_WITH_TRASH, SCHEMA_VERSION, ISSUEMGR_DIR, ISSUEMGR_PROJECT_FILE, ISSUEMGR_README_FILE } from './constants.mjs'
import { EMBEDDED_TEMPLATE } from './template.mjs'

// .issuemgr/README.md の人間向け説明文。生成されるプロジェクト名を受け取る。
function makeIssuemgrReadme(projectName) {
  return `# .issuemgr/

このディレクトリは issue_manager がプロジェクトを認識・管理するためのメタ情報を格納します。

## ファイル一覧

- \`project.json\` — プロジェクト基本情報 (スキーマバージョン、表示名、作成日、チケットディレクトリパス、拡張フィールド)
- \`README.md\` — このファイル (人間向け説明)

## 他 AI との共存 (Phase 2 以降)

将来、複数の AI ツールが同じプロジェクトを触る際の状態保存先として、以下のファイル名規約を予定しています:

| ファイル名 | 書き込み主体 |
|----------|------------|
| \`project.json\` | 人間のみ (AI は読み取り専用) |
| \`ai-claude.json\` | Claude のみ |
| \`ai-chatgpt.json\` | ChatGPT のみ |
| \`ai-cursor.json\` | Cursor のみ |
| \`shared-notes.md\` | 全 AI 共有 (利用は限定的に) |

複数 AI が同時並行で動作しても、それぞれ自分のファイルだけ書き込む規約にすることで、ロックを使わずに衡突を防ぐ設計になっています。

## このディレクトリの手編集について

\`project.json\` は人間が手で編集してもOK。ただし \`$schema\` を変えると issue_manager に認識されなくなります。

## 関連資料

- プロジェクト \`tickets/RULES.md\` — チケット運用ルール
- プロジェクト \`tickets/INDEX.md\` — アクティブチケット一覧・推奨実行順
`
}

// ────────────────────────────────────────────────
// プロジェクト新規作成
// ────────────────────────────────────────────────
// projectDir 配下に tickets/ ディレクトリと全レーンディレクトリを作り、
// EMBEDDED_TEMPLATE の各ファイルを展開する。
// さらに .issuemgr/project.json + README.md も生成する (Phase 1)。
// 既存ファイルは上書きしない (新規作成 / unarchive ループ後の再展開でも安全)。
export async function scaffoldProject(projectDir, projectName) {
  const ticketsDir = path.join(projectDir, 'tickets')
  await fsp.mkdir(ticketsDir, { recursive: true })
  for (const lane of LANES_WITH_TRASH) {
    await fsp.mkdir(path.join(ticketsDir, lane), { recursive: true })
  }
  const today = new Date().toISOString().slice(0, 10)
  const ctx = { projectName, today }
  for (const [name, render] of Object.entries(EMBEDDED_TEMPLATE)) {
    const target = path.join(ticketsDir, name)
    if (!fs.existsSync(target)) {
      await fsp.writeFile(target, render(ctx), 'utf8')
    }
  }

  // .issuemgr/ ディレクトリと必要ファイルを生成 (Phase 1)
  const issuemgrDir = path.join(projectDir, ISSUEMGR_DIR)
  await fsp.mkdir(issuemgrDir, { recursive: true })

  const projectFilePath = path.join(issuemgrDir, ISSUEMGR_PROJECT_FILE)
  if (!fs.existsSync(projectFilePath)) {
    const projectInfo = {
      $schema: SCHEMA_VERSION,
      projectName,
      createdAt: today,
      ticketsDir: 'tickets',
      extras: {},
    }
    await fsp.writeFile(projectFilePath, JSON.stringify(projectInfo, null, 2) + '\n', 'utf8')
  }

  const readmePath = path.join(issuemgrDir, ISSUEMGR_README_FILE)
  if (!fs.existsSync(readmePath)) {
    await fsp.writeFile(readmePath, makeIssuemgrReadme(projectName), 'utf8')
  }
}

// ────────────────────────────────────────────────
// 旧構造 → 新構造の移行
// ────────────────────────────────────────────────
// レーンディレクトリと RULES.md / INDEX.md / TICKET_TEMPLATE.md を tickets/ 配下に
// 移動。VERSION.md が無ければテンプレから生成する (これで新構造化が完了する)。
export async function migrateToNew(project) {
  const projDir = project.projectDir
  const newTickets = path.join(projDir, 'tickets')
  await fsp.mkdir(newTickets, { recursive: true })
  for (const lane of LANES_WITH_TRASH) {
    await fsp.mkdir(path.join(newTickets, lane), { recursive: true })
  }
  for (const lane of LANES) {
    const src = path.join(projDir, lane)
    const dst = path.join(newTickets, lane)
    if (!fs.existsSync(src)) continue
    const files = await fsp.readdir(src)
    for (const f of files) {
      await fsp.rename(path.join(src, f), path.join(dst, f))
    }
    await fsp.rmdir(src).catch(() => {})
  }
  for (const name of ['RULES.md', 'INDEX.md', 'TICKET_TEMPLATE.md']) {
    const src = path.join(projDir, name)
    const dst = path.join(newTickets, name)
    if (fs.existsSync(src) && !fs.existsSync(dst)) {
      await fsp.rename(src, dst)
    }
  }
  const today = new Date().toISOString().slice(0, 10)
  const verPath = path.join(newTickets, 'VERSION.md')
  if (!fs.existsSync(verPath)) {
    await fsp.writeFile(verPath, EMBEDDED_TEMPLATE['VERSION.md']({ projectName: project.name, today }), 'utf8')
  }
}

// ────────────────────────────────────────────────
// 起動時のディレクトリ初期化
// ────────────────────────────────────────────────
// public/ ディレクトリと埋め込みファイル群を準備。既存ファイルはそのまま。
// publicFiles: { 'index.html': '...', 'style.css': '...', 'app.js': '...' } 形式。
export async function ensurePublic(publicDir, publicFiles, logger) {
  if (!fs.existsSync(publicDir)) {
    await fsp.mkdir(publicDir, { recursive: true })
    if (logger) logger.log('public/ ディレクトリを作成しました')
  }
  for (const [name, content] of Object.entries(publicFiles)) {
    const target = path.join(publicDir, name)
    if (!fs.existsSync(target)) {
      await fsp.writeFile(target, content, 'utf8')
      if (logger) logger.log(`public/${name} を展開しました`)
    }
  }
}

// _self/tickets/ (issue_manager 自身のチケット領域) を初期化。
export async function ensureSelf(selfDir, logger) {
  const ticketsDir = path.join(selfDir, 'tickets')
  if (!fs.existsSync(ticketsDir)) {
    await scaffoldProject(selfDir, 'issue_manager')
    if (logger) logger.log('_self/tickets/ を初期化しました')
  } else {
    for (const lane of LANES_WITH_TRASH) {
      const d = path.join(ticketsDir, lane)
      if (!fs.existsSync(d)) {
        await fsp.mkdir(d, { recursive: true })
        if (logger) logger.log(`_self/tickets/${lane}/ を追加作成しました`)
      }
    }
  }
}

// _template/tickets/ (新規プロジェクト作成時の参照テンプレ) を初期化。
export async function ensureTemplate(templateDir, logger) {
  const tplTickets = path.join(templateDir, 'tickets')
  if (!fs.existsSync(tplTickets)) {
    await scaffoldProject(templateDir, '<プロジェクト名>')
    if (logger) logger.log('_template/tickets/ を初期化しました')
  } else {
    for (const lane of LANES_WITH_TRASH) {
      const d = path.join(tplTickets, lane)
      if (!fs.existsSync(d)) {
        await fsp.mkdir(d, { recursive: true })
        if (logger) logger.log(`_template/tickets/${lane}/ を追加作成しました`)
      }
    }
  }
}
