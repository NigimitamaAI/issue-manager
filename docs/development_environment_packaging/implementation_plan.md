# 実装計画：開発環境パッケージ化とテスト確認機能の実装

複数プロジェクトの並行開発における確認環境・テスト環境の管理を簡単にするため、`issue_manager` のOpen拡張として「テスト確認」機能を実装します。また、VS Codeの開発環境をクリーンに保つための設定・ルールを定義します。

## ユーザーレビュー要求事項

> [!IMPORTANT]
> - **Docker Composeの実行場所**: プロジェクトディレクトリ直下に `docker-compose.yml` が存在することを前提とします。
> - **セキュリティ考慮**: `explorer.exe` の実行や `docker` コマンドの実行はローカル環境（127.0.0.1）でのみ実行されることを前提とします。（既に `issue_manager` には `openExternal` というcapabilityがあり、これを検証して動作させます）
> - **非公開情報の扱い**: 非公開仕様は `_private/docs/` ディレクトリ配下に配置します。

## 提案される変更点

### 1. Open拡張機能 `test-environment` の追加

新しく `open/test-environment/` ディレクトリを作成し、拡張機能として独立した構成を配置します。

#### [NEW] [extension.json](file:///G:/codex/issue_manager/open/test-environment/extension.json)
拡張機能のマニフェストファイル。ID、名称、バージョン、必要な能力（capabilities）を定義します。

#### [NEW] [routes.mjs](file:///G:/codex/issue_manager/open/test-environment/routes.mjs)
テスト確認専用のAPIルートハンドラ。
- `/api/project/:projectId/test-environment/status`: `docker compose ps` による起動状況取得
- `/api/project/:projectId/test-environment/start`: `docker compose up -d` による環境起動
- `/api/project/:projectId/test-environment/stop`: `docker compose down` による環境停止
- `/api/project/:projectId/test-environment/open-folder`: `explorer.exe` によるプロジェクトフォルダ展開

#### [NEW] [test-environment.js](file:///G:/codex/issue_manager/open/test-environment/assets/test-environment.js)
フロントエンド側のUIロジック。ボタン押下時のAPI呼び出しや、コンテナ起動状態に応じたボタン表示の切り替え、利用説明書の表示を処理します。

#### [NEW] [test-environment.css](file:///G:/codex/issue_manager/open/test-environment/assets/test-environment.css)
テスト確認画面専用のスタイル定義。

---

### 2. `issue_manager` 本体への統合

#### [MODIFY] [routes.mjs](file:///G:/codex/issue_manager/lib/routes.mjs)
- `availableEnterpriseFeatures()` に `test-environment` の検出ロジックを追加します。
- `handleEnterpriseApi` にて `/test-environment/` に対するリクエストを `open/test-environment/routes.mjs` にルーティングします。

#### [MODIFY] [index.html](file:///G:/codex/issue_manager/public/index.html)
- 画面上部に「テスト確認」タブ、あるいはプロジェクト詳細画面にテスト確認操作パネルを表示する領域を追加します。

#### [MODIFY] [app.js](file:///G:/codex/issue_manager/public/app.js)
- `availableEnterpriseFeatures` を取得し、`test-environment` が有効な場合にタブを表示し、画面遷移・HTMLの挿入を行います。

---

### 3. ドキュメント類の追加

#### [NEW] [preview_lane_private_spec.md](file:///G:/codex/issue_manager/_private/docs/preview_lane_private_spec.md)
非公開仕様（具体的な接続ポート設計やセキュリティ設定など）を記述します。

#### [NEW] [vscode_env_rules.md](file:///G:/codex/issue_manager/docs/development_environment_packaging/vscode_env_rules.md)
1年後でも迷わない、VS Code Dev Containersを使用したクリーン開発環境運用の基本ルールブック。

---

## 検証計画

### 手動検証
1. 開発環境（`G:\codex\issue_manager`）で `npm run start` もしくは `start.bat` を実行し、ポート 5181 でサーバーを起動します。
2. ブラウザで管理画面にアクセスし、「テスト確認」タブが追加されていることを確認します。
3. テスト確認画面で、ローカルにあるプロジェクト（`docker-compose.yml`があるもの）の起動ボタンを押し、コンテナが起動すること、ステータスが「起動中」に変わることを確認します。
4. 「フォルダを開く」ボタンを押し、Windowsのエクスプローラーでプロジェクトディレクトリが開くことを確認します。
5. 停止ボタンを押し、コンテナが停止することを確認します。
6. 画面内で利用説明書が正しく表示されることを確認します。


