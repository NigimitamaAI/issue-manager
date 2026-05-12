# _private/

このディレクトリは **非公開のサブモジュール** または個人運用ファイルの置き場です。

## 用途

- 公開リポジトリには含めない個人的なメモ、設定、メタ情報
- 開発者本人のみが利用するスクリプトやチケット
- submodule として別リポジトリ（private repository）を紐付ける場合のマウントポイント

## 取り扱い

- このディレクトリ配下は `.gitignore` により基本除外されます
- ただし本ファイル（`_private/README.md`）と `.gitkeep` のみは追跡対象です
- submodule として運用する場合は、別途 `git submodule add` で紐付けてください

## ライセンス上の位置づけ

`_private/` 配下のファイルは公開リポジトリの一部ではなく、
ライセンス（Apache License 2.0 / BSL 1.1）の対象外です。

---

Contact: nigimitamalove.info@gmail.com
