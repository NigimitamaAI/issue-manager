# issue_manager クイックスタート

新しい環境で issue_manager を立ち上げる**最速の手順**です。
詳しい仕組み・トラブルシューティングは [INSTALL.md](INSTALL.md) を参照してください。

> **v1.1 から**: 環境変数(setx)による設定は廃止し、`config.json` 一本化になりました。
> v1.0 から移行する場合は [MIGRATION.md](MIGRATION.md) を参照してください。

---

## Windows: ダブルクリックで完了

```
1. install.bat をダブルクリック
2. ダイアログでプロジェクトのルートフォルダを選択（例: G:\claudedir）
3. ポート番号を確認（既定 5180、Enter で確定）
4. node.exe と BOM 除去ツールは任意（PATH に node があれば不要）
5. 自動的に config.json が作成される
6. start.bat をダブルクリックで起動
```

これだけです。`setx` は使いません。OS の環境変数も触りません。

### install.bat が何をしているか

1. `install.ps1` を呼び出す（PowerShell 経由でフォルダ選択ダイアログを出すため）
2. ダイアログで選んだ値を **インスタンスフォルダ直下の `config.json` に書き込む**
3. 設定結果を一覧表示

書き込まれる項目:
- `port`: サーバーポート（既定 5180）
- `root`: プロジェクト検出のルートディレクトリ（必須・フォルダ選択ダイアログ）
- `nodeExe`: node 実行ファイルのパス（任意・PATH 上にあれば `node` のまま）
- `bomFixerPath`: BOM 除去ツールのパス（任意）

---

## macOS / Linux: シェルスクリプト

現状、Mac/Linux 用の対話セットアップスクリプトは未提供です。

```bash
cd issue_manager
cp config.example.json config.json
# エディタで config.json を編集（root を絶対パスに）
chmod +x start.sh
./start.sh
```

将来的に `install.sh` を追加予定です。

---

## 複数インスタンスを同時に動かしたい

issue_manager フォルダごとコピーして、それぞれ別ポートで起動できます。

```
G:\projects_work\issue_manager\     ← config.json: port 5180
G:\projects_personal\issue_manager\ ← config.json: port 5181
```

各フォルダで `install.bat` を実行（別ポートを指定）してから、それぞれの `start.bat` を起動してください。

同じプロジェクトを複数 AI で共存運用する場合は、各 `config.json` に異なる `aiName` を設定してください。設定例と運用ルールは [複数 AI 共存ガイド](../_docs/ISSUE_MANAGER_MULTI_AI.md) を参照してください。

---

## トラブル時

### 「config.json を編集したのに反映されない」

サーバーを再起動してください。起動中のサーバーは config.json の変更を自動では拾いません。

### 「install.bat を実行したらすぐ閉じた」

PowerShell の実行が許可されていない可能性があります。
コマンドプロンプトを開いて以下を実行し、エラーメッセージを確認してください:

```cmd
cd /d "<issue_manager のフォルダ>"
install.bat
```

### 「ポートが既に使用されている」

`config.json` を直接編集して `port` を別の値に変更するか、`install.bat` を再実行してポートを変更してください。

### 「やり直したい」

`install.bat` を再実行してください。既存の config.json があれば現在値をデフォルトとして編集できます。

### 「設定をリセットしたい」

`config.json` を削除すると次回起動時は既定値（port: 5180 / root: 親ディレクトリ）で動きます。
または `install.bat` で作り直してください。
