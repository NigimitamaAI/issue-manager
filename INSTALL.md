# issue_manager セットアップガイド

このドキュメントは、issue_manager を新しい環境に導入する際の手順をまとめたものです。

> **v1.1 からの変更**: 環境変数(setx)による設定方式は廃止しました。
> すべての設定はインスタンスフォルダ直下の `config.json` で完結します。
> v1.0 から移行する場合は [MIGRATION.md](MIGRATION.md) を参照してください。

---

## 概要

issue_manager の設定（プロジェクトのルートディレクトリ・ポート・Node.js のパスなど）は、
**インスタンスフォルダ直下の `config.json` 1ファイル** で完結します。

この方式により:
- 同じ PC で **複数のインスタンスを別々のポートで同時起動** できる
- フォルダごとコピーするだけで別インスタンスを増やせる（ポータブル）
- OS の環境変数を一切汚さない
- CI / Docker / 別マシン移行時も `config.json` を差し替えるだけ

---

## 必要なもの

- Node.js 18 以上
- ブラウザ（Chromium 系 / Firefox / Safari いずれでも可）
- Windows / macOS / Linux いずれでも動作

---

## セットアップ手順（推奨: 対話セットアップ）

### Windows: install.bat をダブルクリック

```
1. install.bat をダブルクリック
2. ダイアログでプロジェクトのルートフォルダを選択（例: G:\claudedir）
3. ポート番号を確認（既定 5180、Enter で確定）
4. node.exe / BOM 修復ツールは任意（PATH に node があれば 'node' のままで OK）
5. config.json が自動作成される
6. start.bat をダブルクリックでサーバー起動
```

`install.bat` は内部で `install.ps1` を呼び出し、`config.json` を生成します。
**setx は使いません。OS の環境変数は一切変更しません。**

### macOS / Linux: 手動で config.json を作成

現状、Mac/Linux 用の対話セットアップスクリプトは未提供です。

```bash
cd issue_manager
cp config.example.json config.json
# エディタで config.json を編集（root を絶対パスに）
chmod +x start.sh
./start.sh
```

---

## 設定ファイル仕様（config.json）

```json
{
  "port": 5180,
  "root": "G:/claudedir",
  "nodeExe": "node",
  "bomFixerPath": "G:/claudedir/issue_manager/_tools/Filetool.bat",
  "projectName": ""
}
```

| キー | 必須 | 既定値 | 説明 |
|---|---|---|---|
| `port` | 任意 | `5180` | サーバーポート。複数インスタンス時は別ポートに |
| `root` | 任意 | issue_manager の親ディレクトリ | プロジェクト検出のルート。空または未指定なら親ディレクトリを使用 |
| `nodeExe` | 任意 | `node` | start.bat が使う node 実行ファイル。PATH 上にあれば `node` のままで OK |
| `bomFixerPath` | 任意 | `""` | `Filetool.bat` または Windows .bat の BOM 除去ツールパス（任意） |
| `projectName` | 任意 | `""` | issue_manager 自身を画面表示する時の名前 |

**Windows のパスは `/` 区切りで書けます**（例: `G:/claudedir`）。
`\` で書く場合は JSON エスケープで `\\` が必要ですが、`/` を使うほうが楽です。

`_comment*` で始まるキーは無視されます（JSON コメント代用）。
`config.example.json` には説明コメント付きのサンプルがあります。

---

## CLI 引数による上書き

```bash
node server.mjs --port 5181 --root /custom/path --config custom.json
```

優先順位: **CLI 引数 > config.json > 既定値**

`--config` で別の設定ファイルを指定することもできます。

---

## 複数インスタンスの同時起動

issue_manager のフォルダごとコピーすれば、別ポートで同時起動できます。

例: 仕事用と個人用を分けたい場合

```
G:\projects_work\issue_manager\     ← config.json: { "port": 5180, "root": "G:/projects_work" }
G:\projects_personal\issue_manager\ ← config.json: { "port": 5181, "root": "G:/projects_personal" }
```

各フォルダで `start.bat` を実行すれば、それぞれ独立したサーバーがブラウザに表示されます。

---

## 起動

**Windows**:
```
start.bat をダブルクリック
```

**macOS / Linux**:
```bash
chmod +x start.sh
./start.sh
```

ブラウザで `http://127.0.0.1:<port>/` が自動的に開きます。

start.bat は config.json から `port` と `nodeExe` を読み出し、それに応じてサーバーを起動します。
config.json が存在しない場合は既定値（port: 5180 / nodeExe: node）にフォールバックします。

### CLI で起動する場合

開発版では `npm link` またはローカル tarball 配布で `issue-manager` コマンドを使えます。

```bash
npm link
issue-manager init --root G:/codex --port 5180
issue-manager serve
```

`issue-manager init` はカレントディレクトリに `config.json` を作成します。既存ファイルを上書きする場合だけ `--force` を付けてください。

`issue-manager serve` はカレントディレクトリの `config.json` を自動で使います。別ファイルを使う場合は `--config <path>` を指定します。

公開 npm への publish は未実施です。パッケージ名、ライセンス、配布対象、グローバルインストール時のデータ置き場を確定してから行います。

---

## トラブルシューティング

### config.json を編集してもサーバーに反映されない

サーバーを再起動してください。issue_manager は起動時に config.json を読み込みます。
ブラウザのリロードだけでは反映されません。

### ポートが既に使用されている

```
[ERROR] Port 5180 is already used by another server.
```

`config.json` の `port` を別の値（例: 5181, 5182）に変更してから start.bat を再実行してください。

### 「Node.js could not be executed」と表示される

- `nodeExe` が `node` のままなのに PATH に node が無い → Node.js を [nodejs.org](https://nodejs.org/) からインストール
- フルパスを指定したい場合は `config.json` の `nodeExe` を `"C:/Program Files/nodejs/node.exe"` のように書き換える

### Windows で start.bat が文字化けエラーで動かない

```
'm' は、内部コマンドまたは外部コマンド...
```

UTF-8 BOM が付与されています。Claude が生成した .bat は `_tools/Filetool.bat` などのツールで BOM を除去してください。
PowerShell で修復する場合:

```powershell
$p = ".\start.bat"
[System.IO.File]::WriteAllText($p, [System.IO.File]::ReadAllText($p), (New-Object System.Text.UTF8Encoding $false))
```

### 「やり直したい」

`install.bat` を再実行してください。既存の config.json があれば現在値をデフォルトとして編集ダイアログが出ます。

---

## v1.0（環境変数方式）からの移行

v1.0 で `setx ISSUE_MANAGER_ROOT` を使っていた場合の移行手順は
[MIGRATION.md](MIGRATION.md) を参照してください。

要点だけ:
1. `install.bat` を実行して config.json を作る（または手動で作成）
2. 不要になった環境変数を削除（任意）

---

## 設計の根拠

### なぜ config.json 一本化なのか

v1.0 では `setx ISSUE_MANAGER_ROOT` で OS のユーザー環境変数に root を永続化していました。
しかしこの方式では:

- 同一 OS ユーザーで 1 つしか root を設定できない
- 別ポートで複数の issue_manager を同時に動かせない
- 設定がインスタンスのフォルダ外に散らばる

複数インスタンス同時起動と「フォルダ丸ごとコピーで増やせるポータブル性」のため、v1.1 で config.json 一本化に切り替えました。
