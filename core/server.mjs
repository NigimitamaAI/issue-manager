/**
 * issue_manager サーバー (core エントリポイント・Apache 2.0)
 *
 * ライセンス: Apache License 2.0
 * 著作権者: Kazutora Harada / 和魂LOVE (Nigimitamalove)
 *
 * 役割: 設定読み込み・依存配線・http サーバー起動のみ。
 *   実装本体は lib/ 配下:
 *     - lib/constants.mjs   定数
 *     - lib/utils.mjs       純粋ユーティリティ
 *     - lib/template.mjs    プロジェクトテンプレ
 *     - lib/logger.mjs      ロガー (factory)
 *     - lib/tickets.mjs     チケット CRUD・移動・archive
 *     - lib/projects.mjs    プロジェクト検出
 *     - lib/scaffold.mjs    プロジェクト初期化・移行
 *     - lib/status-md.mjs   STATUS.md 自動生成 (factory)
 *     - lib/http-utils.mjs  HTTP ヘルパ
 *     - lib/routes.mjs      ルーティング (factory)
 *
 * 使い方:
 *   node server.mjs [--port 5180] [--root <path>] [--config <path>]
 *
 * 終了:
 *   Ctrl+C
 */

import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfigWithEnv } from '../lib/load-config.mjs'
import {
  SCHEMA_VERSION, SERVER_ID, VERSION, DEFAULT_PORT,
} from '../lib/constants.mjs'
import { createLogger } from '../lib/logger.mjs'
import * as tickets from '../lib/tickets.mjs'
import * as projects from '../lib/projects.mjs'
import * as scaffold from '../lib/scaffold.mjs'
import { createStatusMdGenerator } from '../lib/status-md.mjs'
import { createAiStateManager } from '../lib/ai-state.mjs'
import { makeHandler } from '../lib/routes.mjs'
import { normalizeSharedConfig } from '../lib/shared-config.mjs'
import { PUBLIC_FILES } from './public_embedded.mjs'

// ────────────────────────────────────────────────
// パス定数
// ────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const APP_ROOT = path.resolve(__dirname, '..')
const DEFAULT_ROOT = path.resolve(APP_ROOT, '..')
const PUBLIC_DIR = path.join(APP_ROOT, 'public')
const TEMPLATE_DIR = path.join(APP_ROOT, '_template')
const SELF_DIR = path.join(APP_ROOT, '_self')
const CONFIG_PATH_DEFAULT = path.join(APP_ROOT, 'config.json')

// ────────────────────────────────────────────────
// CLI 引数 ・ config.json
// 優先順位: CLI引数 > config.json > 既定値
// ────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--port' && argv[i + 1]) { args.port = Number(argv[i + 1]); i++ }
    else if (argv[i] === '--root' && argv[i + 1]) { args.root = path.resolve(argv[i + 1]); i++ }
    else if (argv[i] === '--config' && argv[i + 1]) { args.configPath = path.resolve(argv[i + 1]); i++ }
    else if (argv[i] === '--ai-name' && argv[i + 1]) { args.aiName = String(argv[i + 1]); i++ }
  }
  return args
}

const CLI_ARGS = parseArgs(process.argv)

// ロガーを「とりあえず」logDir なしで先に作る (config 読み込み中の警告にも使うため)。
// config 読み込み後に実 logDir 付きに作り直す。
let logger = createLogger({})

const BASE_CONFIG_PATH = CLI_ARGS.configPath || CONFIG_PATH_DEFAULT
const ENTERPRISE_CONFIG_PATH = path.join(path.dirname(BASE_CONFIG_PATH), 'config-enterprise.json')

const BASE_FILE_CONFIG = loadConfigWithEnv(BASE_CONFIG_PATH, {
  port: DEFAULT_PORT,
  root: DEFAULT_ROOT,
  roots: [],
  nodeExe: 'node',
  bomFixerPath: '',
  logDir: path.join(APP_ROOT, 'logs'),
  projectName: '',
  aiName: '',
  apiToken: '',
  shared: {},
  assistantPrompts: {
    enabled: true,
    root: '_prompts',
    enabledPromptIds: [
      'package:db-development-guidelines',
    ],
    projectPromptIds: [],
    ticketPromptDefaults: {
      db: [
        'package:db-development-guidelines',
      ],
    },
    triggers: {
      db: [
        'DB',
        'database',
        'SQLite',
        'Neo4j',
        'PostgreSQL',
        'MySQL',
        'migration',
        'import',
        'index',
        'データ投入',
        'マイグレーション',
        'インデックス',
      ],
    },
    prompts: [
      {
        id: 'package:db-development-guidelines',
        category: 'packages',
        label: 'DB開発指針',
        path: '_prompts/packages/db_development_guidelines.md',
        trigger: 'db',
      },
    ],
  },
}, {
  // aiName は path 系ではないので pathKeys に含めない (path.resolve すると壊れる)
  pathKeys: ['root', 'nodeExe', 'bomFixerPath', 'logDir'],
  logger: { log: (...a) => logger.log(...a), warn: (...a) => logger.log(...a), error: (...a) => logger.logErr(...a) },
})
const FILE_CONFIG = fs.existsSync(ENTERPRISE_CONFIG_PATH)
  ? loadConfigWithEnv(ENTERPRISE_CONFIG_PATH, BASE_FILE_CONFIG, {
      pathKeys: ['root', 'nodeExe', 'bomFixerPath', 'logDir'],
      logger: { log: (...a) => logger.log(...a), warn: (...a) => logger.log(...a), error: (...a) => logger.logErr(...a) },
    })
  : BASE_FILE_CONFIG

const SHARED_CONFIG = normalizeSharedConfig(FILE_CONFIG, APP_ROOT)

const ARGS = {
  configPath: BASE_CONFIG_PATH,
  enterpriseConfigPath: fs.existsSync(ENTERPRISE_CONFIG_PATH) ? ENTERPRISE_CONFIG_PATH : '',
  port: CLI_ARGS.port != null ? CLI_ARGS.port : FILE_CONFIG.port,
  root: CLI_ARGS.root || FILE_CONFIG.root,
  roots: projects.normalizeRoots(CLI_ARGS.root
    ? { root: CLI_ARGS.root }
    : { root: FILE_CONFIG.root, roots: FILE_CONFIG.roots }),
  nodeExe: FILE_CONFIG.nodeExe,
  bomFixerPath: FILE_CONFIG.bomFixerPath,
  logDir: FILE_CONFIG.logDir,
  projectName: FILE_CONFIG.projectName,
  // aiName: CLI > config.json > 既定値 ''
  aiName: CLI_ARGS.aiName != null ? CLI_ARGS.aiName : (FILE_CONFIG.aiName || ''),
  apiToken: FILE_CONFIG.apiToken || crypto.randomBytes(24).toString('base64url'),
  shared: SHARED_CONFIG,
  config: FILE_CONFIG,
}

// 確定した logDir でロガーを作り直す。
logger = createLogger({ logDir: ARGS.logDir })

// ────────────────────────────────────────────────
// 依存配線
// ────────────────────────────────────────────────
const statusMd = createStatusMdGenerator({
  listTickets: tickets.listTickets,
  detectProjects: (roots, logger) => projects.detectProjects(roots, logger, APP_ROOT),
  logger,
})

// 旧 API 名 (generateStatusMd / generateAllStatusMd) を維持して routes に渡す。
// ctx.statusMd 越しに routes.mjs から呼ばれる。
const statusMdAdapter = {
  generateStatusMd: statusMd.generateOne,
  generateAllStatusMd: () => statusMd.generateAll(ARGS.roots),
}

// AI ステート (.issuemgr/ai-<aiName>.json) マネージャー
// aiName が空 / 不正なら自動的に NO-OP モードになる (factory 内で判定)
const aiState = createAiStateManager({ aiName: ARGS.aiName, logger })

// ────────────────────────────────────────────────
// 起動
// ────────────────────────────────────────────────
await scaffold.ensurePublic(PUBLIC_DIR, PUBLIC_FILES, logger).catch(e => { logger.logErr('public展開失敗:', e); process.exit(1) })
// ensureSelf は廃止 (_self/tickets は使わない運用に移行済み。起動のたびに再作成されるため削除)
await scaffold.ensureTemplate(TEMPLATE_DIR, logger).catch(e => { logger.logErr('_template初期化失敗:', e) })

const handler = makeHandler({
  args: ARGS,
  publicDir: PUBLIC_DIR,
  logger,
  serverId: SERVER_ID,
  version: VERSION,
  schemaVersion: SCHEMA_VERSION,
  tickets,
  projects,
  scaffold,
  statusMd: statusMdAdapter,
  aiState,
  apiToken: ARGS.apiToken,
  configPath: ARGS.configPath,
  selfPath: APP_ROOT,
})

const server = http.createServer(handler)
server.listen(ARGS.port, '127.0.0.1', () => {
  logger.log(`listening on http://127.0.0.1:${ARGS.port}`)
  logger.log(`root: ${ARGS.root}`)
  logger.log(`roots: ${ARGS.roots.map(r => `${r.id}=${r.path}`).join(', ')}`)
  if (ARGS.enterpriseConfigPath) logger.log(`enterpriseConfig: ${ARGS.enterpriseConfigPath}`)
  logger.log(`logDir: ${ARGS.logDir}`)
  logger.log(`sharedRoot: ${ARGS.shared.root}`)
  logger.log(`version: ${VERSION}`)
  logger.log(`aiName: ${aiState.isEnabled() ? aiState.getAiName() : '(disabled)'}`)
  logger.log(`apiToken: ${FILE_CONFIG.apiToken ? '(config)' : '(generated per process)'}`)
  statusMdAdapter.generateAllStatusMd().catch(e => logger.log(`startup STATUS.md generate failed: ${e.message}`))
})
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    logger.logErr(`ポート ${ARGS.port} は既に使用されています。既存サーバーを確認してください。`)
    process.exit(2)
  }
  logger.logErr(e)
  process.exit(1)
})

process.on('SIGINT', () => { logger.log('shutting down'); process.exit(0) })
process.on('SIGTERM', () => { logger.log('shutting down'); process.exit(0) })
