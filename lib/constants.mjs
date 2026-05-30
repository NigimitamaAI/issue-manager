// ────────────────────────────────────────────────
// issue_manager 共有定数
// ────────────────────────────────────────────────
//
// このモジュールは「誰にも依存しない最下層」として扱う。
// 他のモジュール（template.mjs / tickets.mjs / server.mjs 等）から
// import されるが、ここから他モジュールを import してはならない。
//
// 定数を増やす際は、このファイルが本当に「全モジュールで共有される」もの
// だけに留めること。特定モジュールでしか使わないものは各モジュール内に置く。

// スキーマバージョン: tickets/VERSION.md の `schema:` 行に書かれる識別子。
// プロジェクト検出時にこの値と一致するかで「issue_manager 対応プロジェクト」と判定する。
export const SCHEMA_VERSION = 'issue-manager-v1'

// サーバー識別子（X-Server レスポンスヘッダや /api/ping で返す値）
export const SERVER_ID = 'issue_manager'

// アプリケーションバージョン
export const VERSION = '1.0.0'

// 既定ポート（CLI 引数 --port や config.json で上書き可能）
export const DEFAULT_PORT = 5180

// 通常レーン（チケットの「状態」を表すフォルダ）
export const LANES = ['inbox', 'todo', 'doing', 'review', 'blocked', 'done']

// 通常レーン + 特殊レーン（.trash と archive を含む全レーン一覧）
// 一覧表示・全レーン走査時に使う
export const LANES_WITH_TRASH = [...LANES, '.trash', 'archive']

// .issuemgr/ ディレクトリ名 (プロジェクトルートの直下に置かれるマーカーディレクトリ)
export const ISSUEMGR_DIR = '.issuemgr'

// .issuemgr/ 配下のファイル名定数
export const ISSUEMGR_PROJECT_FILE = 'project.json'
export const ISSUEMGR_README_FILE = 'README.md'

// .issuemgr/ai-<aiName>.json のファイル名プレフィックス。
// サフィックス '.json' とサニタイズ済 aiName を結合してファイル名を組み立てる。
export const ISSUEMGR_AI_STATE_PREFIX = 'ai-'

// ai-<aiName>.json の $schema 識別子。Phase 1 の project.json と同じく
// バージョン違いを判別するためのリテラルマーカーとして用いる。
export const AI_STATE_SCHEMA_VERSION = 'issue-manager-ai-state-v1'
