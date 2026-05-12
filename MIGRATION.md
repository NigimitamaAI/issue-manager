# issue_manager v1.0 → v1.1 移行ガイド

v1.1 で **環境変数(setx)による設定方式は廃止** しました。
すべての設定はインスタンスフォルダ直下の `config.json` に集約されます。

このガイドは v1.0（環境変数方式）から v1.1（config.json 一本化）への移行手順です。

---

## 何が変わったか

### v1.0（旧）
- OS のユーザー環境変数 `ISSUE_MANAGER_ROOT` `ISSUE_MANAGER_NODE` `ISSUE_MANAGER_BOM_FIXER` で設定
- `config.json` 内で `${ISSUE_MANAGER_ROOT}` のような環境変数展開構文をサポート
- `install.bat` が setx で環境変数を永続化

### v1.1（新）
- インスタンスフォルダ直下の `config.json` に直書き
- 環境変数展開構文は撤去（`${VAR}` `${VAR:-default}` は使えません）
- `install.bat` は config.json を生成（setx は使わない）
- 同一 PC で複数インスタンスを別ポートで同時起動できる

---

## 移行手順

### 手順1: 現在の環境変数値を確認

PowerShell で:

```powershell
echo $env:ISSUE_MANAGER_ROOT
echo $env:ISSUE_MANAGER_NODE
echo $env:ISSUE_MANAGER_BOM_FIXER
```

### 手順2: v1.1 のファイル一式に更新

git pull するか、配布版で `core/` `lib/` `start.bat` `install.bat` `install.ps1` `config.example.json` を上書き。
（`config.json` は既存のまま残しておいて OK。次の手順で書き換えます）

### 手順3: install.bat を再実行（推奨）

```
install.bat をダブルクリック
```

ダイアログで以下を入力:
- **Project Root Directory**: 手順1 で確認した `ISSUE_MANAGER_ROOT` の値を選択
- **Port**: 既定 5180（変える必要があれば変更）
- **Node.js**: PATH に node があれば `node` のまま、それ以外は手順1 で確認した `ISSUE_MANAGER_NODE` の値
- **BOM Fixer**: 手順1 で確認した `ISSUE_MANAGER_BOM_FIXER` の値（不要ならスキップ）

これで `config.json` が新フォーマットで上書き生成されます。

### 手順3の代替: 手動で config.json を編集

`config.json` を直接編集してもOKです。`${ISSUE_MANAGER_ROOT}` のような展開構文はもう使えないので、直接パスを書いてください。

```json
{
  "port": 5180,
  "root": "G:/claudedir",
  "nodeExe": "node",
  "bomFixerPath": "G:/claudedir/_tools/BOM修復所_v1.bat",
  "projectName": ""
}
```

Windows のパスは `/` 区切りで書けます。`\` で書く場合は `\\` でエスケープが必要です。

### 手順4: 起動して動作確認

```
start.bat をダブルクリック
```

ブラウザで `http://127.0.0.1:5180/` が開けば成功です。
プロジェクト一覧と既存のチケットがそのまま見えるはず。

### 手順5（任意）: 不要になった環境変数を削除

OS の環境変数はもう参照されないので、消しても残しても構いません。
削除する場合は PowerShell で:

```powershell
[Environment]::SetEnvironmentVariable("ISSUE_MANAGER_ROOT", $null, "User")
[Environment]::SetEnvironmentVariable("ISSUE_MANAGER_NODE", $null, "User")
[Environment]::SetEnvironmentVariable("ISSUE_MANAGER_BOM_FIXER", $null, "User")
```

または「Windows設定 → システム → バージョン情報 → システムの詳細設定 → 環境変数」から GUI で削除。

---

## こんな時は

### `${ISSUE_MANAGER_ROOT}` を含む config.json のままサーバーを起動したらどうなる？

v1.1 の `lib/load-config.mjs` は環境変数展開を行わないため、`${ISSUE_MANAGER_ROOT}` という文字列がそのまま `root` の値として扱われます。
結果、その文字列で path.resolve された無効なパスがプロジェクトルートとして設定され、プロジェクトが何も見えない状態になります。

→ **手順3 で config.json を新フォーマットに書き換えてください。**

### v1.0 に戻したい

`lib/load-config.mjs` `lib/expand-env.mjs` `start.bat` `install.bat` `install.ps1` を v1.0 のものに差し戻し、setx で環境変数を再設定してください。

ただし、複数インスタンス同時起動は v1.0 ではできません。

### 複数インスタンスを動かしたい

v1.1 の本命機能です。

```
G:\projects_work\issue_manager\     ← config.json: port 5180, root G:/projects_work
G:\projects_personal\issue_manager\ ← config.json: port 5181, root G:/projects_personal
```

issue_manager フォルダごとコピーして、それぞれ別ポートで `install.bat` を実行してください。
両方の `start.bat` を順に起動すれば、ブラウザで別タブとして並行運用できます。

---

## 関連ドキュメント

- [INSTALL.md](INSTALL.md) — v1.1 のセットアップ全体
- [QUICKSTART.md](QUICKSTART.md) — 最短手順
- [README.md](README.md) — 概要・使い方
