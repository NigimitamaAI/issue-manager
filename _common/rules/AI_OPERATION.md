# AI_OPERATION: AI/Codex/Claude 運用ガイド

作成日: 2026-06-05
対象: issue_manager 管理下プロジェクトで作業する AI セッション

## 目的

AI が共通ポリシーだけを読んで、実装上の真実を確認せずに作業する事故を防ぐ。
この文書は、初回セッション、再開セッション、別プロジェクトから issue_manager 機能を使うセッションで読む。

## 主要パス

- 運用版: `G:\issue-manager-main`
- 開発版: `G:\codex\issue_manager`
- 共通ルール: `_common\rules\RULES.md`
- 共通ポリシー: `_common\rules\docs\*.md`
- 初回/再開プロンプト案: `_common\rules\prompts\initial_or_resume.md`

## 基本フロー

1. 共通ルール、必要な共通ポリシー、プロジェクト固有 `tickets\RULES.md`、`tickets\INDEX.md` を読む。
2. `review/` にチケットがあり、ユーザー返信や判定が入っていれば新規作業より先に処理する。
3. `doing/` にチケットがあれば、作業ログのサマリ欄と引継ぎメモを読んで継続する。
4. `doing/` がなければ `todo/` またはユーザー指定チケットを `doing/` に整合してから開始する。
5. チケットがない初回相談では、まず用件を整理し、必要なら `inbox/` または `doing/` に起票してから作業する。

## 確認義務トリガー

ポリシー文書を読んだだけで作業を確定しない。以下に該当する場合は、対応する実装ファイルも読む。

| 作業対象 | 必ず確認する実装 |
|---|---|
| `_docker/`、Docker確認環境、環境カタログ | `open\test-environment\routes.mjs`、`open\test-environment\assets\test-environment.js`、`_share\docker\catalog.json` |
| Docker共有設定、Traefik | `lib\shared-config.mjs`、`open\test-environment\routes.mjs`、`_share\traefik\docker-compose.yml` |
| `review/` レーン、レビュー返信、判定 | `enterprise\review-workflow\RULES.md`、`enterprise\review-workflow\docs\review_prompt_policy.md`、`enterprise\review-workflow\routes.mjs` |
| 拡張機能の追加、削除、有効化 | `lib\extension-api.mjs`、`lib\routes.mjs`、対象 `extension.json`、対象 `routes.mjs` |
| `.issuemgr\app.json`、プロジェクト検出 | `lib\projects.mjs`、`lib\scaffold.mjs` |
| チケット読み書き、文字コード、レーン移動 | `lib\tickets.mjs`、`lib\routes.mjs`、`tickets\RULES.md` |
| 再開プロンプト、補助プロンプト、AI引継ぎ | `core\public-assets\app.js`、`lib\routes.mjs`、関連 docs |
| ポリシー文書の新設・改訂 | 対応する上記実装ファイルと、文書末尾の「関連実装」セクション |

## Docker 確認環境で特に見る箇所

`open\test-environment\routes.mjs` では、少なくとも次の関数の実挙動を確認する。

- `readProjectDockerMetadata`
- `resolveComposeForEnvironment`
- `normalizeCustomAction`
- `buildPromptPayload`

ポリシーやカタログにある項目でも、実装で読まれていないフィールドは運用上の効果を持たない。

## memory に入れる内容

memory には詳細仕様を入れず、この文書へのポインタだけを入れる。

```text
issue_manager:
- 運用版: G:\issue-manager-main
- 開発版: G:\codex\issue_manager
- セッション開始時は G:\codex\issue_manager\_common\rules\AI_OPERATION.md を読む
- ポリシー文書を読む作業では、文書末尾の関連実装と該当 routes.mjs / lib 実装も確認する
```

## 終了時

- 対象チケットの作業ログサマリに今回の成果を1行追記する。
- 詳細ログに原文相当の作業記録を追記する。
- 引継ぎメモを1-3行に更新する。
- ユーザー確認が必要なら `review/` に移動し、レビュー欄を具体化する。

