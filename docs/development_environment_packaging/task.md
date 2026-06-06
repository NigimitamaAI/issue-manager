# タスクリスト：開発環境パッケージ化とテスト確認実装

- [x] 設計とドキュメント作成
  - [x] 非公開仕様書 `_private/docs/preview_lane_private_spec.md` の作成
  - [x] VS Codeクリーン環境構築ルール `docs/development_environment_packaging/vscode_env_rules.md` の作成
  - [x] 必要要件と導入手順書 `docs/development_environment_packaging/enterprise_setup_guide.md` の作成
- [x] 拡張機能 `test-environment` の骨組み実装
  - [x] `open/test-environment/extension.json` の作成
  - [x] `open/test-environment/routes.mjs` のスケルトン作成
- [x] `issue_manager` 本体へのルーティング接続
  - [x] `lib/routes.mjs` を修正し、`test-environment` 拡張を認識させてルーティングする
- [x] バックエンド（`open/test-environment/routes.mjs`）の実装
  - [x] Docker status 取得APIの実装
  - [x] Docker start/stop APIの実装
  - [x] `explorer.exe` 呼び出しAPIの実装
- [x] フロントエンドUIの実装
  - [x] `public/index.html` へのUI要素の追加（既存の拡張用マウント要素 enterprise-actions を利用するため本体変更不要であることを確認）
  - [x] `public/app.js` と `open/test-environment/assets/test-environment.js` / `test-environment.css` の実装（マウント機構を利用して拡張機能単体で実装完了）
  - [x] 画面内への利用説明書の組み込み（アコーディオン形式で組み込み完了）
- [x] 実機検証と最終確認
  - [x] `docs/development_environment_packaging/walkthrough.md` の作成


