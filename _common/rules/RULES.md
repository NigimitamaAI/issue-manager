# issue_manager 共通運用ルール

作成日: 2026-05-24
対象: issue_manager で管理する全プロジェクト

## 目的

issue_manager 管理下の各プロジェクトで、公開範囲、非公開領域、開発版と運用版、アプリ間連携、Enterprise 拡張の扱いを共通化する。

各プロジェクト固有の `tickets/RULES.md` は、そのプロジェクト固有の作業手順を定義する。
この `_common/rules/` は、全プロジェクトで共通して守る上位ルールを定義する。

## 読む順序

セッション開始時は、原則として次の順に読む。

1. この共通ルール: `_common/rules/RULES.md`
2. 必要な共通ポリシー文書: `_common/rules/docs/*.md`
3. 対象プロジェクトの `tickets/RULES.md`
4. 対象プロジェクトの `tickets/INDEX.md`
5. `doing/` のチケット、または `todo/` の次チケット（確認待ちは `review/`）

## 共通ポリシー

- 公開 repo と非公開 repo の分離: `docs/git_public_private_policy.md`
- プロジェクト識別とアプリ間連携: `docs/project_identity_policy.md`
- Enterprise 拡張の入れ外し: `docs/enterprise_extension_policy.md`
- Docker 共有 Traefik プロキシ運用: `docs/docker_shared_traefik_policy.md`
- Docker 保守・クリーンアップ運用: `docs/docker_maintenance_policy.md`

## 公開/非公開の原則

- 公開してよい仕様、コード、一般手順は本体 repo に置く。
- 公開しない運用メモ、画像、秘密情報、内部資料は `_private/` に置く。
- `_private/` は本体 repo から ignore し、必要に応じて別 Git repo として管理する。
- 本体 repo に `_private/` の内容を混ぜない。
- 公開配信するプロジェクトの Docker 確認環境では、issue_manager 共有フォルダの実体パスをプロジェクト repo に書かない。共有環境は `source: shared` / `sharedEnvironmentId` の論理参照にし、実体パスは issue_manager の `config.shared` で解決する。

## 開発版/運用版の原則

- GitHub 連携する本流は、原則として `G:\codex\issue_manager` のような開発版に置く。
- `G:\issue-manager-main` のような運用版は実行環境として扱う。
- 機能追加や仕様変更は開発版で実装、確認してから運用版へ反映する。
- 運用版だけに重要変更を置かない。

## issue_manager プロジェクトの標準構造

issue_manager で管理するプロジェクトは、原則として次を持つ。

```text
tickets/
  VERSION.md
  RULES.md
  INDEX.md
  TICKET_TEMPLATE.md
  inbox/
  todo/
  doing/
  review/
  blocked/
  done/
  archive/
  .trash/
```

`review/` は、AI側の作業が完了し、ユーザー確認・承認を待つ状態を表す。`doing/` は実装・調査などAIが手を動かしている最中に限定し、確認待ちは `review/` に分離する。

プロジェクトがアプリやツールとして他プロジェクトから参照される場合は、機械可読 manifest を持つ。

```text
.issuemgr/app.json
```

## AI 作業時の原則

- 共通ルールとプロジェクト固有ルールが衝突する場合は、ユーザーに確認する。
- セッション中に思いついた横断的な改善案は、対象プロジェクトの `tickets/inbox/` に起票する。
- 「Claude提案」「Claude推奨」など、由来が分かるラベルをタイトルまたは本文に明記する。
- 作業完了時は、対象チケットの Summary / Detail Log / Handoff を更新する。

## 将来の issue_manager 機能

将来的には、issue_manager が再開プロンプト生成時に次を自動で含める。

- `_common/rules/RULES.md`
- 対象プロジェクトが参照する共通 docs
- 対象プロジェクトの `tickets/RULES.md`
- 対象プロジェクトの `tickets/INDEX.md`
