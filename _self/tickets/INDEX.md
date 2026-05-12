# アクティブチケット一覧

プロジェクト: issue_manager
最終更新: 2026-05-08 (Phase 2 起票 / 3 分割)

## 推奨実行順（依存解決済み・上から着手）
_なし_

## doing（着手中）
_なし_

## blocked（ブロック中）
_なし_

## todo（精査済み・優先度順）

### P2（中・通常）
_なし_

## inbox（未整理の入力）

### Claude提案
_なし_

### 規約改訂前の重複 (整理済み)
_なし_

## 直近done（参考、最新7件）
- `20260512_P1_機能_プロジェクト登録解除` — プロジェクト一覧から外す登録解除機能を追加。チケット保持 / 圧縮コピー付き解除を選択可能。
- `20260512_P1_UI_既存フォルダ導入の選択動作修正` — フォルダ一覧のクリックを選択、ダブルクリックを移動に変更し、導入対象を明確化。
- `20260512_P2_UI_プロジェクト追加root選択復旧` — `プロジェクト追加` で登録済み root を選択し、その root 内候補を表示できるように復旧。
- `20260512_P2_UI_root選択とプロジェクト追加の責務分離` — `ルート管理` に root 選択/追加を集約し、`プロジェクト追加` は選択中 root 配下だけを扱うように修正。
- `20260511_P2_UI_プロジェクトルート管理導線` — ヘッダーに「ルート管理」を追加し、root 追加を config.json に保存できるようにした。
- `20260511_P2_UI_プロジェクト情報ポップアップ` — 追加直後と選択中プロジェクトで root / 実パス / tickets パスを確認できる情報ポップアップを追加。
- `20260511_P2_UI_プロジェクト追加フォルダ一覧はみ出し修正` — プロジェクト追加ダイアログを広幅・内部スクロール・フォルダ名フィルター付きに修正。
- `IDEA_npm_global_install` — 公開 npm は保留し、`npm link` / ローカル tarball 用の CLI 下地 (`issue-manager init/serve`) を実装。
- `20260506_P2_UI_既存チケット編集にもツールバー` — 詳細ビューにクリップボードコピー型ツールバーを追加済み。`public/` 反映も確認。
- `20260510_P1_セキュリティ_root_policy_api防御` — ローカル主軸 + 将来 adapter 拡張方針を文書化し、root policy / realpath 境界 / API token / Origin 検証を実装。
- `20260510_P2_UI_プロジェクト追加フォルダ選択UI` — プロジェクト追加をエクスプローラー風 UI に変更。`G:\codex` / `D:\dev\test` のような独立 roots と root 内相対パス指定に対応。
- `20260509_P2_機能_既存フォルダをプロジェクト導入` — 複数 root / project id 化、既存フォルダ導入 API と UI 導線を実装・検証完了。
- `20260506_P1_設計_issuemgr_phase1` — .issuemgr/ ディレクトリ方式 Phase 1 完了。project.json + README.md をマーカー、他 AI 共存規約の土台。`hasIssuemgr` フラグまで対応。
- `20260506_P1_機能_チケット作成入力支援ツールバー` — 新規チケットモーダルにツールバー 7 ボタン追加、ID 生成インラインパネル
- `20260505_P2_文書_ARCHITECTURE.md起票` — _docs/ISSUE_MANAGER_ARCHITECTURE.md 起票、依存図＋逆引き 15 項＋トラップ集＋履歴表を含む1 枚ドキュメント
- `20260505_P2_リファクタ_status-md_logger切り出し` — lib/logger.mjs + lib/status-md.mjs ファクトリ新設
- `20260505_P1_リファクタ_routes.mjs切り出し` — http-utils/projects/scaffold/routes の 4 モジュール新設
- `20260505_P1_リファクタ_tickets.mjs切り出し` — lib/utils.mjs + lib/tickets.mjs 新設
- `20260505_P0_バグ修正_template.mjs_SCHEMA_VERSION未定義` — 起動時 ReferenceError バグ修正

## 関連実装メモ (2026-05-08 セッション)
- B 案実装: 詳細ビューにツールバー 6 ボタンを追加 (クリップボードコピー動作)。`core/public_embedded.mjs` に変更を加えた。`public/` を退避・サーバー再起動で展開反映済み。
- Phase 2 起票・3 分割: P1 (API + ポート別識別) を doing/、P2 連携 / P2 文書を todo/ に配置。

---
## メモ
- 推奨実行順はセッション終了時に更新（次セッション開始時の選択材料）
- 優先度P0から順に着手
- 新規追加指示は inbox/ へ、精査後に todo/ へ昇格
- 完了チケットは done/ へ移動し INDEX から削除
- **INBOX の運用**: Claude提案・Claude推奨などのラベルをタイトル or 本文に明記する

## .issuemgr/ ディレクトリ方式の段階的展開
```
Phase 1 (done): .issuemgr/project.json 導入、プロジェクトマーカー化
  └→ Phase 2-A (doing): ai-<name>.json 読み書き API + ポート別 AI 識別
        ├→ Phase 2-B (todo): 再開プロンプトに ai-state 反映
        └→ Phase 2-C (todo): 複数 AI 共存運用ガイド (2-B と並行可)
              └→ Phase 3 (未起票): VERSION.md の役割再定義 (Phase 2 完了後に検討)
```

## ポート分離方式の合意 (2026-05-08)
複数 AI の同一プロジェクト並行運用は「AI ごとに別ポートで issue_manager を起動」する方式で確定。
- AI 識別は config.json の `aiName` (新規追加) で実現。サーバーは自分の aiName を知っているので自動で `ai-<aiName>.json` だけに書き込む
- ポート割り当てはユーザー任意 (固定マッピング規約は作らない)。衝突は OS の EADDRINUSE で検知
- 読み書きポリシー: 主体が書き、他 AI は読み専用 (Phase 1 物理分離原則の延長)
