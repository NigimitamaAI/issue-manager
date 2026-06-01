# Enterprise / Open 拡張ポリシー

作成日: 2026-05-24
更新日: 2026-06-01（4 層ライセンス境界保護モデル L1-L3 導入 / open 系統正式化）

## 目的

拡張機能を issue_manager 本体から分離し、追加、無効化、削除、**ライセンス境界の機械的保護**を安全に行えるようにする。

## 拡張系統と 3 層ライセンス

issue_manager は 3 層構造を持つ。

```text
issue_manager/
  core/                ← 本体（Apache-2.0）
  open/<id>/           ← 公開拡張（Apache-2.0）
  enterprise/<id>/     ← 有償拡張（BSL-1.1）
```

URL prefix とディレクトリは 1:1 で対応する。

| 系統 | ディレクトリ | URL prefix | 許可ライセンス |
| --- | --- | --- | --- |
| open | `open/<id>/` | `/open/<id>/...` | Apache-2.0 |
| enterprise | `enterprise/<id>/` | `/enterprise/<id>/...` | BSL-1.1 |

## 4 層ライセンス境界保護モデル（2026-06-01 確定）

config 操作だけでライセンスを越境させない、改ざんを検出可能にする、という設計指針。

| 層 | 内容 | 実装状況 |
|---|---|---|
| **L1 系統分離 + 整合性チェック** | 配置ディレクトリと `extension.json.tier` の一致必須化 / config キーも系統別 | ✅ 2026-06-01 実装 |
| **L2 ライセンス明示** | `extension.json` に `license` 必須 / 各拡張に `LICENSE` ファイル必須 / tier×license 検証 | ✅ 2026-06-01 実装 |
| **L3 起動時ライセンス監査ログ** | サーバ起動時に全拡張のライセンス情報をログ出力 | ✅ 2026-06-01 実装 |
| **L4 署名検証** | enterprise 拡張のベンダー秘密鍵による manifest 署名検証 | ❌ 将来（EXE 化対応と統合検討） |

L4 がなくても **L1+L2+L3 で「うっかり違反」「config 編集だけでの越境」「軽微な改ざん」はほぼ全部阻止可能**。

## 基本方針

拡張機能は本体に直結させず、`enterprise/<extension-id>/` または `open/<extension-id>/` 配下の拡張として扱う。

```text
issue_manager/
  open/
    preview-lane/
      extension.json
      routes.mjs
      LICENSE
      assets/
        preview-lane.js
        preview-lane.css
  enterprise/
    paper-platform/
      extension.json
      routes.mjs
      LICENSE
      assets/
        paper-platform.js
        paper-platform.css
```

## 依存2層化ルール（2026-05-30 確定）

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

各拡張は `extension.json` を持つ。`tier`、`license`、`requiresStandardApi`、`dependencies` は必須。

```json
{
  "id": "preview-lane",
  "name": "プレビューレーン（確認・テスト環境管理）",
  "tier": "open",
  "license": "Apache-2.0",
  "requiresStandardApi": "1.0",
  "dependencies": [],
  "enabledByDefault": true,
  "version": "0.1.0",
  "capabilities": [
    "previewLane.manage"
  ]
}
```

### `tier`

- `enterprise` または `open`。
- 配置ディレクトリと一致しないと L1 でロード拒否される。

### `license`

- SPDX 識別子。
- `TIER_ALLOWED_LICENSES` (「open → Apache-2.0」/「enterprise → BSL-1.1」) に含まれない値は L2 でロード拒否される。

### `requiresStandardApi`

- 本体標準 API の必要バージョンを宣言する
- メジャーバージョン不一致の場合、拡張のロードを拒否する（エラーログを出してスキップ）
- 現在の標準 API バージョン: `1.0`

### `dependencies`

- 他拡張への依存を宣言するフィールド
- 依存ツリー2層化ルールにより、**常に空配列 `[]` のみ許可**
- 他拡張ID を列挙することは禁止

## 有効化・ON/OFF 制御

### 判定ロジック（系統別、優先順）

#### open 系統

1. `config.json` の `extensions.open.disabled[]` に ID が含まれる → false（明示無効化）
2. `manifest.enabledByDefault === true` → true
3. それ以外 → false

**open 系統は enterprise のホワイトリストの影響を受けない**（ライセンス境界保護）。

#### enterprise 系統

1. `config.json` に `extensions.enterprise.enabled[]` が配列で存在 → そのリストでホワイトリスト判定
2. （後方互換）`enterprise.enabledExtensions[]` が配列で存在 → 同上 + deprecation 警告
3. リストがない → `manifest.enabledByDefault === true` フォールバック

実装: `lib/extension-api.mjs` の `isExtensionEnabled(id, manifest, config, tier)`

### config.json で明示制御する例

```json
{
  "extensions": {
    "enterprise": {
      "enabled": [
        "review-workflow",
        "paper-platform"
      ]
    },
    "open": {
      "disabled": []
    }
  }
}
```

### 旧 schema（deprecation）

`config.enterprise.enabledExtensions[]` は後方互換のため引き続き読まれるが、起動時に deprecation 警告がログに出る。新 schema に移行すること。

## L1 系統整合チェック

サーバは `extension.json.tier` と配置ディレクトリを照合する。不一致はロード拒否される。

## L2 ライセンス検証

`lib/extension-api.mjs` の `TIER_ALLOWED_LICENSES`：

```js
{
  open: ['Apache-2.0'],
  enterprise: ['BSL-1.1'],
}
```

- `manifest.license` がリストに含まれない → ロード拒否
- `manifest.license` が未定義 → ロード拒否

各拡張ディレクトリに `LICENSE` ファイルを併記する。

## L3 起動時ライセンス監査ログ

サーバ起動時に 1 度だけ `[license]` プレフィックスのログを出し、全拡張のロード状態・ライセンス・有効化経路を表示する。

## 一時的に外す

### open 拡張

1. `config.json` の `extensions.open.disabled[]` に拡張IDを追加する
2. issue_manager を再起動する
3. 起動ログの `[license]` セクションと画面の両方で無効を確認する

### enterprise 拡張

1. `extensions.enterprise.enabled[]` が設定されている場合 → そのリストから拡張IDを削除する
2. `enabledByDefault: true` 経由で有効化されていた場合 → `extensions.enterprise.enabled[]` を新規作成し、**残したい他の enterprise 拡張だけ**を列挙し、当該拡張は含めない
3. issue_manager を再起動する
4. 起動ログの `[license]` セクションと画面の両方で無効を確認する

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
- L1 系統整合チェック
- L2 ライセンス検証
- L3 起動時監査ログ
- 標準 API バージョンチェック
- 拡張 JS/CSS/API の読み込み制御
- `parsedBody` / `tryAiUpdate` の自動処理

拡張（open / enterprise）:

- 独自画面
- 独自 API（`helpers` 経由でのみ本体機能を使う）
- capability 検索
- 外部プロジェクトとの接続 UI
- 適切な `tier` と `license` の宣言
- ディレクトリ内 `LICENSE` ファイルの同梱

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
