# Enterprise 拡張ポリシー

作成日: 2026-05-24
更新日: 2026-05-30（標準API v1.0 確定・依存ツリー2層化ルール追加）

## 目的

有料拡張や業務向け拡張を issue_manager 本体から分離し、入れる、外す、一時停止する操作を安全に行えるようにする。

## 基本方針

Enterprise 機能は本体に直結させず、`enterprise/<extension-id>/` 配下の拡張として扱う。

```text
issue_manager/
  enterprise/
    paper-platform/
      extension.json
      routes.mjs
      assets/
        paper-platform.js
        paper-platform.css
```

## 依存ツリー2層化ルール（2026-05-30 確定）

拡張の依存関係を2層に固定する。

```
issue_manager 本体（標準 API: lib/extension-api.mjs）
    ├── 拡張A         ← 本体標準APIのみに依存
    ├── 拡張B         ← 本体標準APIのみに依存
    └── 拡張A+B統合   ← AとBの連携が必要な場合は統合拡張として1本化
```

### 許可・禁止事項

| 依存の種類 | 可否 |
|---|---|
| 拡張 → 本体標準API（`helpers` 経由） | ✅ OK |
| 拡張 → 別拡張の内部関数 | ❌ 禁止 |
| 拡張 → `lib/` への直接 `import` | ❌ 禁止 |
| 拡張 → `node:*` 組み込みモジュール | ✅ OK（ただし実行安全性を守ること） |

拡張 routes.mjs で `from '../../lib/'` が出たら CI で検出する（将来対応）。

### 標準 API に含まれていない機能を使いたい場合

1. チケットを `inbox/` に起票する（「標準API追加申請」とラベル明記）
2. 承認後に `lib/extension-api.mjs` の `buildEnterpriseHelpers` に追加される
3. それまでは代替手段を検討するか実装を保留する

直接 `lib/` を import する回避策は禁止。コードレビューで検出できる状態を維持する。

## 標準 API v1.0 の構成（`helpers` オブジェクト）

拡張が受け取れる唯一の接点は本体が渡す `helpers` オブジェクトのみ。
定義元: `lib/extension-api.mjs` の `buildEnterpriseHelpers()`。

| API | 用途 |
|---|---|
| `sendJson(res, status, body)` | HTTP JSON レスポンス送信 |
| `getProject(projectId)` | プロジェクト情報取得 |
| `rootForProject(project)` | root情報取得 |
| `requireRootCapability(root, cap)` | 権限チェック |
| `openSystemPath(target)` | OS のファイルマネージャーで開く |
| `listAppManifestEntries(filters)` | app.json manifest 一覧取得 |
| `sanitizeFilename(name)` | ファイル名サニタイズ |
| `generateStatusMd(project)` | STATUS.md 再生成 |
| `logger` | `{ log, logErr }` ログ出力 |

### 意図的に除外した項目（内部化済み）

| 項目 | 理由 |
|---|---|
| `isInsideOrSame` | 本体内部のパス検証ロジック。拡張がパス検証を意識しないよう内部化 |
| `tryAiUpdate` | mutation 後に本体が自動呼び出し。拡張が意識不要 |
| `readBody` | 本体がパースして `parsedBody` として渡す |

## 拡張 manifest（extension.json）

各拡張は `extension.json` を持つ。`requiresStandardApi` と `dependencies` は必須。

```json
{
  "id": "preview-lane",
  "name": "プレビューレーン（確認・テスト環境管理）",
  "tier": "enterprise",
  "requiresStandardApi": "1.0",
  "dependencies": [],
  "enabledByDefault": true,
  "version": "0.1.0",
  "capabilities": [
    "previewLane.manage"
  ]
}
```

### `requiresStandardApi`

- 本体標準 API の必要バージョンを宣言する
- メジャーバージョン不一致の場合、拡張のロードを拒否する（エラーログを出してスキップ）
- 現在の標準 API バージョン: `1.0`

### `dependencies`

- 他拡張への依存を宣言するフィールド
- 依存ツリー2層化ルールにより、**常に空配列 `[]` のみ許可**
- 他拡張ID を列挙することは禁止

## 有効化・ON/OFF 制御

### 判定ロジック（優先順）

1. `config.json` に `enterprise.enabledExtensions` が配列で存在する → そのリストに含まれる拡張のみ有効
2. `enterprise.enabledExtensions` がない → 各拡張の `extension.json` の `enabledByDefault` に従う
3. `extension.json` がない → 無効（安全側）

実装: `lib/extension-api.mjs` の `isExtensionEnabled()`

### config.json で明示制御する例

```json
{
  "enterprise": {
    "enabledExtensions": [
      "preview-lane",
      "review-workflow"
    ]
  }
}
```

## 一時的に外す

1. `config.json` の `enabledExtensions` から拡張IDを削除する（またはフィールド自体を削除して `enabledByDefault` に委ねる）
2. issue_manager を再起動する
3. 画面と API の両方で無効になっていることを確認する

物理ファイルは削除しない。

## 完全に削除する

1. `enabledExtensions` から拡張IDを削除する
2. issue_manager を停止する
3. `enterprise/<extension-id>/` をバックアップする
4. `enterprise/<extension-id>/` を削除する
5. issue_manager を起動して、拡張が出ないことを確認する

## 責任分離

issue_manager 本体:

- 拡張 manifest の探索
- 有効/無効の判定（`lib/extension-api.mjs`）
- 標準 API バージョンチェック
- 拡張 JS/CSS/API の読み込み制御
- `parsedBody` / `tryAiUpdate` の自動処理

Enterprise 拡張:

- 独自画面
- 独自 API（`helpers` 経由でのみ本体機能を使う）
- capability 検索
- 外部プロジェクトとの接続 UI

外部ツール:

- 実処理
- ファイル生成
- テンプレート
- ビルド処理

## 実行安全性

- 外部コマンドは shell 文字列で組み立てない
- 固定 command と引数配列で実行する
- manifest の path が provider project 内に収まることを確認する
- capability、root、権限を実行前に検証する
