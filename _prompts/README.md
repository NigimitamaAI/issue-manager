# 補助プロンプト

issue_manager の再開プロンプトやチケット再開プロンプトに追加できる補助プロンプト置き場。

## ディレクトリ

- `packages/`: issue_manager が同梱するパッケージ補助プロンプト
- `customize/`: 利用者が追加するユーザー定義補助プロンプト
- `presets/`: 毎回追加したい組み合わせやプロジェクト既定の補助プロンプト

`preset` はID接頭辞、`presets/` はディレクトリ名として使う。

## ID 規約

- package: `<category>:<id>` のうち `package:<id>`
- customize: `customize:<id>`
- preset: `preset:<id>`

例: `package:db-development-guidelines`

## 再開プロンプトでの扱い

補助プロンプト機能は、カタログと選択UIを有効化した状態で使う。
ただし未選択の補助プロンプトは再開プロンプトへ差し込まない。

- プロジェクト再開プロンプト: `projectPromptIds` に含まれる補助プロンプトだけを差し込む
- チケット再開プロンプト: チケット本文の `assistantPromptIds` があればそれを優先する
- チケット再開プロンプト: `assistantPromptIds` がない場合は、トリガー一致時に `ticketPromptDefaults` の候補を差し込む
- 新規チケット作成: `projectPromptIds` を初期ONとして表示し、保存時に `assistantPromptIds` を本文へ書く

このため、補助プロンプト機能を有効化しても、未選択のプロンプトが全チケットへ無条件に混入することはない。
