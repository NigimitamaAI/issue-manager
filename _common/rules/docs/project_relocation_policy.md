# プロジェクト移動・絶対パス依存管理ポリシー

作成日: 2026-06-06
対象: issue_manager 管理下プロジェクト

## 目的

プロジェクトを `G:\codex` などの既存配置から `G:\dev` など別ルートへ移動しても、移動履歴とパス依存を追跡できるようにする。
移動後に Docker、スクリプト、チケット、外部連携で旧パス参照によるデグレが起きた場合、原因を棚卸しできる状態を標準とする。

## 基本方針

- プロジェクトはフォルダ移動されうるものとして設計する。
- コード、スクリプト、設定、Docker 定義には、個人環境の絶対パスをできるだけ直書きしない。
- 絶対パスが必要な場合は、`.issuemgr/app.json`、`.issuemgr/project.json`、プロジェクト固有のローカル設定ファイル、または issue_manager の root 設定を参照する。
- チケット本文に残る絶対パスは過去操作の記録として許容するが、移動時には棚卸し対象として扱う。
- 移動・登録解除・再登録の履歴は `.issuemgr/move-history.json` と `.issuemgr/unregistered.json` に残す。

## 絶対パスを避ける設計

推奨:

- プロジェクトルートからの相対パスで記述する
- `.issuemgr/app.json` の `capabilities` にコマンドや連携情報を置く
- 実体パスが環境ごとに変わるものは、公開 repo ではなくローカル設定に置く
- Docker 共有環境は `sharedEnvironmentId` など論理参照にし、共有フォルダの実体パスを書かない

避ける:

- `G:\codex\...` や `/mnt/g/codex/...` をコード・設定へ直接埋め込む
- `file:///G:/...` を正本の設定値として使う
- README や scripts に個人環境の絶対パスを前提として書く
- 公開 repo にローカルPC固有のパスを含める

## 移動前チェック

プロジェクト移動前に、issue_manager の `path-audit` で次の候補を確認する。

- `tickets/**/*.md`
- `.issuemgr/*.json`
- `.well-known/issue-manager.json`
- `docker-compose*.yml`
- `.env*`
- `package.json`
- `pyproject.toml`
- `README*.md`
- `scripts/**/*`

検出対象:

- Windows パス: `G:\...`
- WSL パス: `/mnt/g/...`
- file URI: `file:///G:/...`

## 登録解除と再登録

移動前に issue_manager から登録解除する場合:

1. 登録解除ダイアログで理由と移動先候補を入力する。
2. `.issuemgr/unregistered.json` に、その時点の `projectDir`、`rootPath`、`rootId`、`projectId` が残る。
3. `.issuemgr/move-history.json` に `type: "unregister"` の履歴が追記される。

移動後に再登録する場合:

1. 移動先 root を issue_manager に登録する。
2. プロジェクト追加から、移動後フォルダを選ぶ。
3. `tickets/` と `.issuemgr/unregistered.json` がある場合、登録解除済みプロジェクトとして再登録する。
4. `unregistered.json` は `.issuemgr/unregistered/restored_<stamp>.json` へ退避される。
5. `.issuemgr/move-history.json` に `type: "reregister"` の履歴が追記される。

## 移動後チェック

- プロジェクト情報で move-history の最新履歴を確認する。
- 絶対パス棚卸しを再実行し、旧ルートの参照が残っていないか確認する。
- Docker、外部エディタ起動、レビュー確認リンク、テスト確認環境、paper 系連携など、プロジェクト固有の確認項目を実行する。

## 関連実装

このポリシーを根拠に移動機能やパス棚卸しを変更する場合は、文書だけで判断せず次の実装も確認する。

- `lib/projects.mjs`: プロジェクト検出、`.issuemgr/unregistered.json` による除外
- `lib/routes.mjs`: 登録解除、再登録、`move-history.json`、`/api/projects/:id/path-audit`
- `core/public-assets/app.js`: プロジェクト情報、登録解除ダイアログ、既存フォルダ導入、絶対パス棚卸しUI
- `core/public-assets/style.css`: 絶対パス棚卸し表示
- `lib/shared-config.mjs`: 共有 Docker / Traefik ルート解決
- `open/test-environment/routes.mjs`: Docker 確認環境のパス解決
