# Git 公開/非公開分離ポリシー

作成日: 2026-05-24
最終更新: 2026-05-31 (open/ 層を追加)

## 目的

GitHub で公開または共有する本体 repo と、公開しない `_private/` 領域を明確に分離する。

## 基本方針

- 本体 repo には、公開してよいコード、仕様、一般手順だけを置く。
- `_private/` には、公開しない運用メモ、内部資料、画像、個人情報、秘密情報を置く。
- `_private/` は本体 repo の `.gitignore` で除外する。
- `_private/` が Git 管理を必要とする場合は、別 repo として管理する。

## 三層ディレクトリ構造と push 判定

issue_manager 本体は、公開とライセンスの軽重により以下の 3 ディレクトリに分けて管理する。さらに「完全に公開しない `_private/` 」を加えて計 4 区分となる。

| ディレクトリ | ライセンス | GitHub push | 用途 |
|---|---|---|---|
| `core/` | Apache 2.0 | される | サーバー本体・基本機能 |
| `open/` | Apache 2.0 | される | 公開拡張機能（extension.json を持つプラグイン） |
| `enterprise/` | BSL 1.1 | されない | 業務拡張機能（個人・教育・非営利は無償、商用は別途契約） |
| `_private/` | 非公開 | されない | 運用メモ、内部資料、個人情報 |

`core/` と `open/` は同ライセンスだが、`core/` はサーバー本体、`open/` は extension プラグインという役割分担。`enterprise/` はライセンス境界としても分離されているため、`.gitignore` で push 対象から除外する。

## 標準構成

```text
project/
  .git/
  .gitignore
  _private/
    .git/
    doc/
  tickets/
  src/
```

この構成では、`project` 本体と `_private` は別の Git 履歴を持つ。

## 確認コマンド

本体 repo で `_private/` が ignore されているか確認する。

```powershell
git -C G:\codex\issue_manager status --short --ignored
```

`!! _private/` と表示されれば、本体 repo から無視されている。

`_private` 自体が別 Git repo か確認する。

```powershell
Test-Path G:\codex\issue_manager\_private\.git
git -C G:\codex\issue_manager\_private status --short
```

## コミット方針

本体 repo にコミットするもの:

- `core/` 下のソースコード
- `open/` 下の公開拡張（Apache 2.0）
- 公開仕様
- 公開してよい共通ルール
- `_common/rules/` 以下の公開ポリシー

本体 repo にコミットしないもの（`.gitignore` で除外）:

- `enterprise/` 下の拡張（BSL 1.1 、別途公開体制の下で取り扱う）
- `_private/` 以下のすべて

`_private` repo にコミットするもの:

- 非公開手順
- 内部メモ
- 公開しない画像や素材
- 運用上の個別事情

コミットしないもの:

- API key
- token
- 認証情報
- 個人情報
- 一時ログ
- build 出力

## 注意

運用版だけに変更を置くと、開発版から同期したときに消える。
重要な変更は、GitHub 連携している開発版に先に入れる。
