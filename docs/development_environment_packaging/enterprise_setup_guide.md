# テスト確認（確認・テスト環境管理） 導入手順・システム要件

本ドキュメントは、`issue_manager` のOpen（公開）拡張機能である「テスト確認（test-environment）」を導入する際のシステム要件、およびDocker等のインフラセットアップ手順を解説します。

---

## 1. システム必要要件 (Prerequisites)

本機能を利用するためには、ホストPCに以下の環境が構築されている必要があります。

| 項目 | 必須要件 | 備考 |
| :--- | :--- | :--- |
| **OS** | Windows 10 / 11 | Pro または Home (21H2以降) |
| **WSL2** | 有効化済み | Linuxディストリビューション（Ubuntu推奨）が動作していること |
| **Docker** | Docker Desktop for Windows | インストール済みであること |
| **Node.js** | v18.0.0 以上 | `issue_manager` サーバーが動作するバージョン |
| **エディタ** | VS Code (または Cursor等) | ホストOS側に「Dev Containers」拡張機能がインストールされていること |

---

## 2. Docker・WSL2 の事前設定

DockerとWSL2が正しく連携されている必要があります。以下の手順で設定を確認・実施してください。

### 2.1 Docker Desktop の WSL2 連携設定
1. **Docker Desktop** を起動します。
2. 右上の設定アイコン（歯車）をクリックします。
3. **General** タブで、`Use the WSL 2 based engine` にチェックが入っていることを確認します。
4. **Resources** > **WSL integration** タブへ移動します。
5. `Enable integration with my default WSL distro` にチェックを入れ、お使いのLinuxディストリビューション（Ubuntu等）のトグルを **ON** にします。
6. 右下の **Apply & restart** をクリックします。

---

## 3. テスト確認拡張機能の導入手順

### ステップ1: 拡張機能ファイルの配置
本拡張パッケージ（`test-environment`）を、`issue_manager` ディレクトリ内の `open` フォルダ配下にコピーします。

**正しい配置構成:**
```text
issue_manager/
  ├─ open/
  │    └─ test-environment/
  │         ├─ extension.json
  │         ├─ routes.mjs
  │         └─ assets/
  │              ├─ test-environment.js
  │              └─ test-environment.css
```

### ステップ2: 権限（capabilities）の確認
テスト確認からWindowsのエクスプローラーを開くには、`issue_manager` のプロジェクトルート設定において `openExternal` 権限が必要です。
`config.json` を開き、対象の `roots` 設定に `openExternal` が含まれていることを確認してください。

**`config.json` 例:**
```json
{
  "roots": [
    {
      "id": "default",
      "path": "G:\\codex",
      "capabilities": [
        "read",
        "browse",
        "openExternal"  // ◄ これが必須です
      ]
    }
  ]
}
```

### ステップ3: 共通リバースプロキシの起動（推奨・ポート競合対策）
同時に複数のプロジェクトを起動して動作確認する場合、ポートの重複を避けるために共通のリバースプロキシを立ち上げることを強く推奨します。

1. 共通プロキシ用のディレクトリ（例: `G:\codex\_tools\local-proxy`）を作成します。
2. 以下の `docker-compose.yml` を配置します。

**共通プロキシの `docker-compose.yml` 例（Nginx Proxyを使用する場合）:**
```yaml
version: '3.8'

services:
  nginx-proxy:
    image: nginxproxy/nginx-proxy
    ports:
      - "80:80"
    volumes:
      - /var/run/docker.sock:/tmp/docker.sock:ro
    networks:
      - dev-net

networks:
  dev-net:
    name: dev-net
    external: false
```

3. ターミナルで `docker compose up -d` を実行してプロキシを常駐させます。
4. 各プロジェクト側の `docker-compose.yml` で、環境変数 `VIRTUAL_HOST=<プロジェクト名>.localhost` を設定し、共通ネットワーク `dev-net` に所属させることで、ポート競合なく `http://<プロジェクト名>.localhost` でアクセスできるようになります。

---
### Traefik 版の初回テスト手順

Docker Desktop 上で Test Environment 用の共通 Traefik proxy を使う場合は、既存環境を壊さないための確認順序をまとめた [`docker_traefik_test_environment_guide.md`](./docker_traefik_test_environment_guide.md) を参照してください。

## 4. 導入後の動作確認

1. `issue_manager` サーバーを再起動します。
2. ブラウザで管理画面（例：`http://127.0.0.1:5180/`）を開きます。
3. 画面上部に **「🚀 テスト確認」** ボタンが表示されていることを確認します。
4. ボタンを押し、プロジェクトのコンテナ状態が取得できること、およびアコーディオン形式の「利用説明書」が展開されることを確認してください。


