# project_archive テンプレ

## 用途

issue_manager で管理する任意のプロジェクトを動的開発から外し、`G:\_archive\projects\` 配下へ移動する際の理由書テンプレ。

## 運用手順

1. アーカイブ先ディレクトリ `G:\_archive\projects\<project_name>_YYYYMMDD\` を作成（または `move_file` の destination として指定）
2. プロジェクト本体を移動
3. 本テンプレ（`ARCHIVE_REASON.md`）をコピーし、移動先ルートで実値を埋めて配置
4. 起票元プロジェクトの該当チケットに「アーカイブ完了」を記録
5. 起票元プロジェクトの INDEX.md と引継ぎメモを更新

## テンプレ更新時の注意

- メタ情報の項目を増やす場合は、既存のアーカイブ記録に過不足が生じないか確認すること
- 「アーカイブ種別」のカテゴリを増減させる場合は、既存記録の上書きが必要か判断する

## 過去のアーカイブ事例（参考リンク）

- 2026-06-04 `astroRitualGpt`（段階廃棄）— 起票元: `AstroRitual/tickets/done/20260604_P1_調査_astroRitualGpt版差分_calendrics_ephemeris要検証.md`
