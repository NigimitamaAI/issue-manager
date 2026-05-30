# プロジェクト識別とアプリ間連携ポリシー

作成日: 2026-05-24

## 目的

issue_manager 管理下の複数プロジェクト、開発版、運用版、外部ツールを安全に識別し、アプリ間連携の判断を機械可読にする。

## 基本方針

人間向けの作業入口は `tickets/RULES.md` と `tickets/INDEX.md` に置く。
アプリや issue_manager が読む識別情報は `.issuemgr/app.json` に置く。

## app manifest

標準配置:

```text
<project-root>/.issuemgr/app.json
```

標準 schema:

```json
{
  "schema": "issue-manager-app-manifest-v1",
  "appId": "codex_latex_paper_env_pack",
  "familyId": "math-paper-platform",
  "role": "latex-paper-env-pack",
  "displayName": "LaTeX Paper Environment Pack",
  "environment": "development",
  "version": "0.1.0",
  "capabilities": {}
}
```

## 識別子

- `appId`: アプリまたはツール固有のID
- `familyId`: 同じ目的を持つ仲間ID
- `role`: そのプロジェクトの役割
- `environment`: `development`, `production`, `staging` など
- `version`: アプリ/ツール側のバージョン
- `capabilities`: 提供または利用可能な機能

## 連携判断

issue_manager や Enterprise 拡張は、フォルダ名だけで対象を判断しない。
原則として `.issuemgr/app.json` の `familyId`, `role`, `capabilities` を見て判断する。

例:

```json
{
  "familyId": "math-paper-platform",
  "capabilities": {
    "paperProject.create": {
      "type": "command",
      "command": "python",
      "args": ["tools/new_paper_project.py"]
    }
  }
}
```

## 開発版/運用版

- 開発版と運用版は `environment` で区別する。
- 同じ `familyId` に複数候補がある場合、UI で明示する。
- 自動実行する場合は、環境、root、capability、権限を検証する。

## 禁止事項

- `INDEX.md` だけを根拠にアプリ連携対象を判断しない。
- フォルダ名だけで実行対象を確定しない。
- manifest の command を shell 文字列として連結実行しない。
- capability がない処理を推測で実行しない。
