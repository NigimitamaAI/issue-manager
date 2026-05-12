# issue_manager

ローカル PC 配下のプロジェクトを横断的にチケット管理する、シンプルな Web アプリです。

- **AI 協働に最適化**: Claude / Codex / ChatGPT など各種 AI アシスタントとのセッション間でチケットベースに引き継ぎ可能
- **Markdown ファイル**: チケット1枚 = 1ファイル。エディタ直接編集も可
- **ローカル完結**: 認証なし、`127.0.0.1` バインドのみ。外部に情報を送信しない
- **依存最小**: Node.js 18+ のみ、npm install 不要

## スクリーンショット

（TODO: 画面キャプチャを追加）

## クイックスタート

### 1. 依存の確認

Node.js 18 以上が必要です。
```bash
node --version
```

### 2. clone

```bash
cd <親ディレクトリ>   # プロジェクトを置きたい親（例: X:\AIprojects, ~/projects）
git clone https://github.com/<owner>/issue_manager.git
```

### 3. 設定ファイルを作成

```bash
cd issue_manager
cp config.example.json config.json
```

`config.json` を環境に合わせて編集：
```json
{
  "port": 5180,
  "root": "X:\\AIprojects",
  "nodeExe": "node",
  "bomFixerPath": "",
  "projectName": ""
}
```

### 4. 起動

**Windows**:
```
start.bat をダブルクリック
```

**macOS / Linux**:
```bash
chmod +x start.sh
./start.sh
```

ブラウザで http://127.0.0.1:5180/ が自動的に開きます。

## 新しい環境に導入する時

Windows なら `install.bat` をダブルクリックすると、フォルダ選択ダイアログ付きで `config.json` を対話生成できます。詳しくは [QUICKSTART.md](QUICKSTART.md) または [INSTALL.md](INSTALL.md) を参照してください。

AI アシスタントにセットアップや運用移行を手伝わせる場合は、まず [AI_SETUP.md](AI_SETUP.md) を参照してください。Claude 向けの互換プロンプトは [CLAUDE_SETUP.md](CLAUDE_SETUP.md) にあります。

## CLI で起動する場合

開発版では `npm link` またはローカル tarball 配布で `issue-manager` コマンドを使えます。公開 npm への publish は、パッケージ名・ライセンス・配布方針を決めてから行います。

```bash
npm link
issue-manager init --root G:/codex --port 5180
issue-manager serve
```

`serve` はカレントディレクトリの `config.json` を優先して読みます。直接指定する場合は `issue-manager serve --config ./config.json` を使います。

## 複数インスタンスを同時に動かしたい

issue_manager フォルダごとコピーして、それぞれ別ポートで起動できます（v1.1 から対応）。詳細は [INSTALL.md](INSTALL.md) の「複数インスタンスの同時起動」セクション、[MIGRATION.md](MIGRATION.md)、または [複数 AI 共存ガイド](../_docs/ISSUE_MANAGER_MULTI_AI.md) を参照してください。

## 使い方

### プロジェクト構造

各プロジェクトは `tickets/` ディレクトリを持ちます：

```
<プロジェクト名>/
└── tickets/
    ├── VERSION.md          # issue_manager 対応マーカー
    ├── RULES.md            # 運用ルール
    ├── INDEX.md            # アクティブチケット一覧
    ├── TICKET_TEMPLATE.md  # チケット雛形
    ├── inbox/              # 未整理のアイデア・報告・気付き
    ├── todo/               # 精査済み・着手可能
    ├── doing/              # 着手中
    ├── blocked/            # ブロック中（外部待ち・判断待ち）
    ├── done/               # 完了済み
    ├── archive/            # 見えなくしたいが削除しないチケット
    └── .trash/             # ソフト削除退避先
```

### 画面機能

| 機能 | 説明 |
|---|---|
| **カンバン** | inbox / todo / doing / blocked / done の5列。ドラッグ&ドロップで移動 |
| **詳細表示** | Markdown レンダリング、エディタで開くボタン |
| **次の一手は？** | doing または推奨実行順から次に着手すべきチケットを提案 |
| **📋 再開プロンプト** | AI に渡す再開用プロンプトをクリップボードにコピー。複数 AI 運用時は直近の AI セッション履歴も付与 |
| **📦 アーカイブ** | 見えなくしたいチケットを archive/ へ退避（元レーン記録、復元可能） |
| **⬇ エクスポート** | TSV / JSON でチケット一覧を出力（タイムライン連携用） |
| **新規プロジェクト** | テンプレートから新規プロジェクトを作成 |

### AI との連携

1. 画面で作業するプロジェクトを選択
2. 「📋 再開プロンプト」または「📋 このチケットで再開」でプロンプトをコピー
3. 利用中の AI アシスタントに貼り付け
4. AI が `tickets/RULES.md` を読んで、`doing/` のチケットから作業を再開

複数 AI を同じプロジェクトで併用する場合は、各インスタンスに別の `aiName` を設定してください。詳細は [複数 AI 共存ガイド](../_docs/ISSUE_MANAGER_MULTI_AI.md) を参照してください。

### 初回運用のおすすめ

- 既に `tickets/` があるプロジェクトなら、AI に `STATUS.md` → `RULES.md` → `INDEX.md` → `doing/` の順で読ませる
- まだ `tickets/` がない既存プロジェクトなら、AI に [AI_SETUP.md](AI_SETUP.md) の「既存プロジェクトを初めてチケット運用へ移行する手順」を実行させる

## 設定

### config.json

| キー | 既定値 | 説明 |
|---|---|---|
| `port` | `5180` | サーバーポート |
| `root` | issue_manager の親 | 単一 root 用の互換設定 |
| `roots` | `[]` | 複数 storage root。`G:/codex` と `D:/dev/test` のような独立絶対パスを指定 |
| `nodeExe` | `node` | 起動スクリプトが使う node.exe のパス |
| `bomFixerPath` | （空） | `_tools/Filetool.bat` または Windows の BOM 除去ツールのパス |
| `logDir` | `logs` | ログ出力先 |
| `aiName` | （空） | 複数 AI 運用時の AI 識別子 |
| `projectName` | （空） | 画面上の表示名の上書き |

### CLI 引数

```bash
node server.mjs --port 5181 --root /custom/path --config custom.json
```

優先順位: **CLI引数 > config.json > 既定値**

## トラブルシューティング

### Windows: start.bat が動かない（文字化けエラー）

```
'm' は、内部コマンドまたは外部コマンド...
```

UTF-8 BOM が付与されています。PowerShell で修復：
```powershell
$p = ".\start.bat"
[System.IO.File]::WriteAllText($p, [System.IO.File]::ReadAllText($p), (New-Object System.Text.UTF8Encoding $false))
```

### ポート 5180 が占有されている

`config.json` の `port` を別の値に変更するか、別プロセスを終了してください。

### public/ を再生成したい

```bash
rm -rf public
# 再起動すると core/public-assets/ から自動再展開
```

## ディレクトリ構造（リポジトリ）

```
issue_manager/
├── README.md               # このファイル
├── CLAUDE_SETUP.md         # AI向け導入プロンプト
├── LICENSE                 # ライセンス概要（二段階構成）
├── LICENSE-APACHE          # core/ およびルートファイル用 (Apache License 2.0)
├── LICENSE-BSL             # enterprise/ 用 (Business Source License 1.1)
├── COMMERCIAL_LICENSE.md   # 商用利用に関する案内
├── PRIVACY.md              # プライバシーポリシー
├── NOTICE                  # 著作権・ライセンス通知
├── .gitignore
├── package.json
├── config.example.json     # 設定の見本（コピーして config.json に）
├── install.bat             # Windows 対話セットアップランチャー
├── install.ps1             # 対話セットアップ本体（config.json を生成）
├── start.bat               # Windows 起動スクリプト（config.json から port/nodeExe を読む）
├── start.sh                # macOS/Linux 起動スクリプト
├── core/                   # コア機能 (Apache License 2.0)
│   ├── server.mjs          # Node.js サーバー本体
│   ├── public_embedded.mjs # public/ 自動展開用の集約モジュール
│   └── public-assets/      # public/ のソース（HTML/CSS/JS）
├── lib/                    # 共通ライブラリ（config 読み込み等）
├── enterprise/             # エンタープライズ機能 (BSL 1.1)
├── _template/              # 新規プロジェクトテンプレート
│   └── tickets/
├── _private/               # 非公開サブモジュール用（基本除外）
└── _self/                  # issue_manager 自身のチケット運用
    └── tickets/
        └── done/           # 開発履歴（サンプルとして共有）
```

## 設計思想

- **トークン節約**: AI が毎回プロジェクト全体を読まずに、アクティブな 1 チケット + INDEX だけで作業再開
- **引継ぎ容易**: セッション跨ぎ、別 Claude での継続でもコンテキストが失われない
- **監査可能**: 詳細ログを原文のまま残し、判断経緯を後から追える
- **2層ログ**: サマリ欄で軽量運用、詳細ログ欄で完全性を担保
- **ツール非依存**: チケットは素の Markdown ファイル。issue_manager がなくてもエディタで閲覧・編集可能

## ライセンス

本ソフトウェアは **二段階ライセンス** で提供されています。

| 対象 | ライセンス | ライセンス全文 |
|---|---|---|
| `core/` ディレクトリ配下、およびルートファイル（README, 設定例, 起動スクリプト等） | **Apache License 2.0** | [LICENSE-APACHE](LICENSE-APACHE) |
| `enterprise/` ディレクトリ配下 | **Business Source License 1.1** | [LICENSE-BSL](LICENSE-BSL) |

- **個人利用・教育目的・非営利利用は無償** で利用可能です
- `enterprise/` の **商用利用** には別途ライセンス契約が必要です（[COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md) 参照）
- BSL の **Change Date は 2030-04-30**。それ以降、`enterprise/` も自動的に Apache License 2.0 に切り替わります
- ライセンス概要全体は [LICENSE](LICENSE) を、プライバシーポリシーは [PRIVACY.md](PRIVACY.md) をご参照ください

商用利用に関するお問い合わせ: nigimitamalove.info@gmail.com

応援（任意）: [GitHub Sponsors](https://github.com/sponsors/nigimitamalove)

## 貢献

バグ報告・機能要望は GitHub Issues にお願いします。
PR も歓迎します。

なお、PR を提出いただいた際は、`core/` への貢献は Apache License 2.0、
`enterprise/` への貢献は BSL 1.1 の条件下で配布されることに同意いただいたものとみなします。
