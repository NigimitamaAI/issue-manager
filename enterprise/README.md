# issue_manager Enterprise Edition

このディレクトリは、issue_manager の **Enterprise 機能（拡張機能）** の配置場所です。

## ライセンス

このディレクトリ以下のファイルは **Business Source License 1.1 (BSL 1.1)** で提供されます。
詳細はリポジトリルートの `LICENSE-BSL` を参照してください。

## 著作権

Copyright (c) 2026 Kazutora Harada / 和魂LOVE (Nigimitamalove)
連絡先: nigimitamalove.info@gmail.com

## 二段階ライセンスの構成

issue_manager は以下の二段階ライセンスで提供されます：

| ディレクトリ | ライセンス | 用途 |
|---|---|---|
| `core/` | Apache License 2.0 | 基本機能（誰でも自由に利用・改変・再配布可） |
| `enterprise/` | Business Source License 1.1 | 拡張機能（個人・教育・非営利は無償、商用は別途契約） |

## 現在の状態

このディレクトリは **Enterprise拡張機能の受け入れ先**です。

現在含まれている拡張:

- `paper-platform/`: 数学論文作成・確認ワークフロー
- `review-workflow/`: review/ レーン向けのレビュー依頼・構造化返信ワークフロー

## 想定されるEnterprise機能

将来的に以下のような機能が追加される予定です（順不同・確定ではありません）：

- 複数ユーザー対応
- 権限管理（読み取り専用ユーザー等）
- Git連携（チケット変更を自動コミット）
- Slack / Teams 通知
- AIによるチケット自動要約・分析
- リアルタイム同期（WebSocket）
- 監査ログ・コンプライアンス機能
- 複数プロジェクトの統合ダッシュボード
- チケットテンプレートのカスタマイズUI

## 商用利用

Enterprise 機能の商用利用にはライセンス契約が必要です。
詳細は `COMMERCIAL_LICENSE.md` を参照してください。

## なぜこの構成にしているか

- **コア機能は誰でも自由に使える**: 個人開発者がカジュアルに導入できる
- **Enterprise 機能は応援+正当利用モデル**: 個人・教育・非営利は無償で利用可能、企業利用時は記名や有償契約をお願いすることで持続可能な開発を実現
- **将来的に OSS 化**: BSL 1.1 の Change Date（4年後）を経過すると Apache 2.0 として OSS 化される

## 関連文書

- [`../LICENSE`](../LICENSE) - ライセンス全体の説明
- [`../LICENSE-APACHE`](../LICENSE-APACHE) - core 部分の Apache License 2.0
- [`../LICENSE-BSL`](../LICENSE-BSL) - enterprise 部分の BSL 1.1
- [`../COMMERCIAL_LICENSE.md`](../COMMERCIAL_LICENSE.md) - 商用利用案内
- [`../PRIVACY.md`](../PRIVACY.md) - プライバシーポリシー
