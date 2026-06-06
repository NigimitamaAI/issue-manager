# issue_manager Open Extensions

このディレクトリは、issue_manager の **公開拡張機能（Open Extensions）** の配置場所です。

## ライセンス

このディレクトリ以下のファイルは **Apache License 2.0** で提供されます。
詳細はリポジトリルートの `LICENSE-APACHE` を参照してください。

## 著作権

Copyright (c) 2026 Kazutora Harada / 和魂LOVE (Nigimitamalove)
連絡先: nigimitamalove.info@gmail.com

## 三層ライセンス構成

issue_manager は以下の三層ライセンスで提供されます：

| ディレクトリ | ライセンス | 用途 |
|---|---|---|
| `core/` | Apache License 2.0 | 基本機能（誰でも自由に利用・改変・再配布可） |
| `open/` | Apache License 2.0 | 公開拡張機能（誰でも自由に利用・改変・再配布可） |
| `enterprise/` | Business Source License 1.1 | 業務拡張機能（個人・教育・非営利は無償、商用は別途契約） |

`core/` と `open/` の違いは**配置の役割分担**で、ライセンスは同じです。
- `core/`: issue_manager のサーバー本体・基本機能
- `open/`: 拡張機構を通じて issue_manager にプラグインされる公開機能（独立した extension.json を持つ）

## 現在含まれている拡張

- `test-environment/`: Docker Compose ベースのテスト確認環境管理（起動/停止/状態表示、フォルダオープン、AI 向け定型プロンプトコピー）。元は Enterprise 拡張として試作されたが、公開価値が高く商用機能ではないため `open/` に移管。

## 拡張の作り方

`open/` に拡張を追加する手順は `enterprise/` と同じで、以下のファイル構成を取る:

```text
open/
  <extension-id>/
    extension.json
    routes.mjs          # サーバー側 API ハンドラー
    assets/
      <extension-id>.js   # フロントエンド JS モジュール
      <extension-id>.css  # フロントエンド CSS
```

`extension.json` の `tier` フィールドは `"open"` とする。`lib/routes.mjs` の `EXTENSION_TIERS` テーブルに candidate として登録する。

## URL prefix

`open/<id>/` 配下の assets は `/open/<id>/<file>` で配信される（`enterprise/` は `/enterprise/<id>/<file>`）。

## 関連文書

- [`../LICENSE`](../LICENSE) - ライセンス全体の説明
- [`../LICENSE-APACHE`](../LICENSE-APACHE) - core / open 部分の Apache License 2.0
- [`../LICENSE-BSL`](../LICENSE-BSL) - enterprise 部分の BSL 1.1
- [`../enterprise/README.md`](../enterprise/README.md) - Enterprise 拡張の説明
- [`../_common/rules/docs/enterprise_extension_policy.md`](../_common/rules/docs/enterprise_extension_policy.md) - 拡張ポリシー
- [`../_common/rules/docs/git_public_private_policy.md`](../_common/rules/docs/git_public_private_policy.md) - 公開/非公開分離ポリシー

