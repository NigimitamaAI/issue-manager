# 実装計画：issue_manager 本格EXE化対応

`issue_manager` のプログラムおよびNode.jsランタイムを1つのWindows実行可能ファイル（EXE）にパックし、Node.jsがインストールされていない環境でもダブルクリックだけで起動可能にします。

## ユーザーレビュー要求事項

> [!IMPORTANT]
> - **外部アセットと拡張機能の扱い**: 
>   `open/`（公開拡張機能）と `enterprise/`（有償拡張機能）や `_private/`（非公開仕様等）、チケットデータは、EXE内部にパックするとユーザーが編集できなくなるため、**「EXEファイルと同じディレクトリに置かれた外部ファイル」**としてロードする設計にします。
> - **設定ファイル `config.json`**:
>   これもEXEの隣に配置された外部ファイルからロードし、実行ポートなどを設定可能にします。
> - **ビルドツール**:
>   Vercel社の `pkg` を使用し、`npm run build:exe` または `build-exe.bat` でビルドを行います。

## 提案される変更点

### 1. パス解決ロジックの修正（EXE実行への対応）

`pkg` でビルドされた環境では、`__dirname` が仮想ディレクトリ `/snapshot/issue_manager/...` を指すため、実ファイル（`config.json`, `enterprise/` など）にアクセスするには実行ファイルパスである `process.execPath` から相対パスを解決する必要があります。

#### [MODIFY] [server.mjs](file:///G:/codex/issue_manager/core/server.mjs)
- `process.pkg`（pkgで実行中を示すフラグ）が存在する場合、`APP_ROOT` を `process.execPath` のある親ディレクトリ（EXEの配置場所）として解決するロジックを追加します。
  ```javascript
  const isPkg = typeof process.pkg !== 'undefined';
  const APP_ROOT = isPkg ? path.dirname(process.execPath) : path.resolve(__dirname, '..');
  ```
- 設定ファイル `config.json` や各種自動展開ディレクトリ（`public/`, `_template/`）のベースパスをこの新しい `APP_ROOT` に追従させます。

#### [MODIFY] [routes.mjs](file:///G:/codex/issue_manager/lib/routes.mjs)
- `ENTERPRISE_DIR` などの動的ロード先について、`process.pkg` で実行中の場合はEXE外部のディレクトリを検索するよう調整します。

---

### 2. `pkg` ビルド設定の追加

#### [MODIFY] [package.json](file:///G:/codex/issue_manager/package.json)
- `pkg` のビルド設定を追加し、同梱する静的ファイル（ヘルパーモジュール等）とターゲット（`node20-win-x64` 等）を指定します。
- `scripts` に `"build:exe": "pkg . --out-path dist"` を追加します。

---

### 3. ビルドバッチの追加

#### [NEW] [build-exe.bat](file:///G:/codex/issue_manager/build-exe.bat)
- 依存モジュールのインストールから `pkg` によるビルドまでを自動で実行するバッチファイルを作成します（共通ルールに従い、UTF-8 BOMなし、BOM修復ツール適用、`chcp 65001 >nul` を含めます）。

---

## 検証計画

### 手動検証
1. `build-exe.bat` を実行し、`dist/issue_manager.exe` が正常に生成されることを確認します。
2. 生成された `issue_manager.exe` を別のテスト用空フォルダに配置します。
3. テストフォルダに、ダミーの `config.json` と `open/test-environment` ディレクトリをコピーします。
4. コマンドプロンプトから一時的に `PATH` から `node` を除外する（`set PATH=` 等）か、Node.js がないテスト環境で `issue_manager.exe` を実行し、エラーなくポート 5180/5181 で起動することを確認します。
5. ブラウザから管理画面にアクセスし、「テスト確認」ボタンが表示され、問題なく動作することを確認します。


