# issue_manager 導入ガイド（Claude向け互換プロンプト）

このドキュメントは、新しい環境に issue_manager を導入する際に **Claude にそのまま渡しやすい形** にしたガイドです。
AI 非依存の運用原則は [AI_SETUP.md](AI_SETUP.md) を参照してください。

## AI への導入プロンプト（コピペ用）

以下をそのままコピーして Claude に渡してください。

---

```
あなたはローカルPCの設定を手伝うアシスタントです。
issue_manager というチケット管理ツールをこの環境で使えるようにセットアップしてください。

## issue_manager とは
- ローカル PC 配下のプロジェクトディレクトリを横断的にチケット管理する Web アプリ
- Node.js 18+ で動作、ポート 5180 で localhost バインドのローカルサーバー
- プロジェクトごとに tickets/ ディレクトリを配置し、その中で inbox/todo/doing/blocked/done/archive の6レーンでカンバン運用
- チケットは Markdown ファイル、issue_manager の画面で CRUD・移動・削除・アーカイブが可能
- Claude と独立してユーザーが画面から操作できる（削除やアーカイブなど）

## セットアップ手順

### 1. ルートディレクトリを決める
プロジェクトを置く親ディレクトリを決めてください。たとえば:
- Windows: `C:\work\claudedir` または `G:\claudedir`
- macOS/Linux: `/Users/<name>/claudedir` または `/home/<name>/claudedir`

以下このパスを `<ROOT>` と表記します。

### 2. issue_manager を clone
```
cd <ROOT>
git clone https://github.com/<owner>/issue_manager.git
```

### 3. config.json を作成

**Windows なら推奨: 対話セットアップ**

```
<ROOT>/issue_manager/install.bat をダブルクリック
```

ダイアログでプロジェクトルート・ポート・任意で node.exe / BOM 修復ツールを入力すると、`config.json` が自動生成されます。**setx は使いません（v1.1 以降）。**

**手動で作る場合**

`<ROOT>/issue_manager/config.example.json` を `config.json` としてコピーし、ユーザー環境に合わせて編集:

- `port`: 既定 5180 で OK。複数インスタンスを同時に起動したい場合は別ポートに
- `root`: `<ROOT>` の絶対パス（Windows なら `\\` でエスケープ、または `/` を使う）
- `nodeExe`: `node` で PATH から解決できるならそのまま。独立 Node をインストール済みならそのパス
- `bomFixerPath`: Windows の場合のみ、BOM修復所_v1.bat のパス（なければ空のまま）

**重要**: `${ISSUE_MANAGER_ROOT}` のような環境変数展開構文は v1.1 で廃止されました。値はすべて直書きしてください。

### 4. Node.js 18+ の確認
```
node --version
```
バージョンが 18 以上であることを確認。足りなければインストールを案内してください。

### 5. 初回起動
- Windows: `issue_manager/start.bat` をダブルクリック
- macOS/Linux: `chmod +x issue_manager/start.sh && issue_manager/start.sh`

初回起動時、以下が自動的に行われます:
- `public/` ディレクトリが自動展開される
- `_self/tickets/` が自動初期化される（issue_manager 自身の運用チケット領域）
- `_template/tickets/` が自動初期化される（新規プロジェクト作成時の雛形）
- ブラウザで http://127.0.0.1:5180/ が開かれる

### 6. 動作確認
画面左のプロジェクト一覧に、`<ROOT>` 配下のプロジェクト（tickets/ を持つもの）が並びます。
issue_manager 自身は `issue_manager/_self` として認識されます。

### 7. 最初のプロジェクトを作る
画面右上の「＋ 新規プロジェクト」をクリックしてディレクトリ名を入力。
`<ROOT>/<名前>/tickets/` が自動作成され、テンプレートが展開されます。

## トラブルシューティング

### Windows で start.bat が動かない（文字化けエラー）
UTF-8 BOM が付与された可能性があります。修復方法:
1. `BOM修復所_v1.bat` のような BOM 除去ツールにドラッグ&ドロップ
2. または PowerShell で:
```
$p = "<パス>\issue_manager\start.bat"
[System.IO.File]::WriteAllText($p, [System.IO.File]::ReadAllText($p), (New-Object System.Text.UTF8Encoding $false))
```

### ポート 5180 が別プロセスに占有されている
- `config.json` で `port` を別の値に変更
- または起動時に `node server.mjs --port 5181` のように指定

### public/ ディレクトリが壊れた/古い
1. サーバー停止
2. `public/` ディレクトリを削除
3. サーバー再起動（public/ が `public_embedded.mjs` から再展開される）

## その後の運用
- プロジェクトは `<ROOT>/<projectName>/tickets/` 配下で管理
- Claude にセッション開始時は画面の「📋 再開プロンプト」ボタンで生成されるプロンプトを渡す
- 詳細は `issue_manager/README.md` と `<プロジェクト>/tickets/RULES.md` を参照

ユーザーに上記の手順を順に実行してもらい、各ステップで問題があれば解決してください。
```

---

## 追加の情報（Claude が質問されたら参照）

### アーキテクチャ
- **サーバー**: `server.mjs`（Node.js 18+、素の http モジュール、追加依存なし）
- **フロント**: `public_embedded.mjs` が `public/` を自動展開。素のJS + marked.js(CDN)
- **設定**: `config.json` から起動時に読み込み。CLI引数で上書き可能

### 設定ファイル仕様（config.json）
```json
{
  "port": 5180,
  "root": "<プロジェクト置き場の絶対パス>",
  "nodeExe": "node",
  "bomFixerPath": "",
  "projectName": ""
}
```

### 外部依存
- Node.js 18 以上（`fs/promises`, `http`, ESM サポート）
- ブラウザ（Chromium系 / Firefox / Safari いずれでも可）
- Windows: `cmd`, PowerShell（`start.bat` 用）
- macOS/Linux: `bash`, `curl`, `xdg-open`/`open`（`start.sh` 用）

### プロジェクトディレクトリ構造
```
<ROOT>/
├── issue_manager/          ← このリポジトリ
│   ├── server.mjs
│   ├── public_embedded.mjs
│   ├── config.json         ← 環境固有（.gitignore）
│   ├── config.example.json ← 雛形（リポジトリに含む）
│   ├── start.bat / start.sh
│   ├── _template/          ← 新規プロジェクト雛形
│   └── _self/              ← issue_manager 自身のチケット運用
└── <projectA>/
    └── tickets/
        ├── VERSION.md      ← schema: issue-manager-v1
        ├── RULES.md
        ├── INDEX.md
        ├── TICKET_TEMPLATE.md
        ├── inbox/
        ├── todo/
        ├── doing/
        ├── blocked/
        ├── done/
        ├── archive/
        └── .trash/
```

### プロジェクト検出条件
`<ROOT>/<name>/tickets/` 配下に以下すべてが存在:
- `VERSION.md`（`schema: issue-manager-v1` のYAMLフロントマター）
- `RULES.md`
- `INDEX.md`

旧構造（`<ROOT>/<name>/` 直下に `todo/`, `RULES.md` 等が配置）も互換モードとして認識。画面の「⚠ 新構造へ移行」ボタンで新構造に変換可能。

### セキュリティ
- 認証なし。ただし `127.0.0.1` バインド限定（外部LANからアクセス不可）
- プロジェクトルート外のパスはサーバー側で拒否（path escape 防止）
- 楽観ロック（mtime 照合）でエディタとの編集衝突を検知
