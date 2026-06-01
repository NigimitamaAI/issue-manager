# VS Code クリーン開発環境構築・運用ルール

本ドキュメントは、1年後に開発環境を再確認した際にも迷わず、安定してクリーンな環境を再構築できるようにするための「VS Code Dev Containers」の運用基本ルールブックです。

---

## 1. 運用の基本3原則

1. **ホスト（Windows / WSL2）は「空っぽ（プレーン）」に保つ**
   * ホストOSやWSL2のメインのVS Codeには、言語別の拡張機能（例: JavaScript、Python、Go、Rustなど）、フォーマッター、Linterなどのツールは一切インストールしません。
   * インストールを許可する唯一の共通拡張機能は **「Dev Containers（開発コンテナ）」** です。
2. **すべての開発ツールと設定を `.devcontainer/` に閉じ込める**
   * 各プロジェクトに個別の `.devcontainer/devcontainer.json` を配置します。
   * そのプロジェクトでのみ必要な「VS Code 拡張機能のリスト」や「Linter / Formatter の自動適用設定」をコードとして定義し、プロジェクトと一緒にバージョン管理します。
3. **プロジェクト起動と同時に自動でクリーン環境を構築**
   * VS Codeでプロジェクトを開くと、自動的にコンテナが起動し、コンテナ内部にのみ必要なツールや拡張機能がロードされます。
   * プロジェクトを閉じる、またはコンテナを破棄すれば、ホスト環境は完全にクリーンな状態が維持されます。

---

## 2. 開発環境パッケージ化 テンプレート例（Webアプリ等）

各プロジェクトでクリーンな開発・ビルド・ホットリロードを実現するための標準的な構成ファイル例です。

### 2.1 `docker-compose.yml`（マウントと自動起動設定）
ホストのソースコードをコンテナ内にマウントし、起動時に自動で依存関係を解決してホットリロード付きの開発サーバーを動かします。

```yaml
version: '3.8'

services:
  app:
    image: mcr.microsoft.com/devcontainers/javascript-node:20
    volumes:
      # ソースコードをバインドマウント（ホストの変更が即時コンテナに同期）
      - .:/workspace:cached
    working_dir: /workspace
    # コンテナ起動時に自動でビルド＆開発サーバー立ち上げ
    command: /bin/sh -c "npm install && npm run dev"
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
    # 共通ネットワークに接続（他サービスとの連携用）
    networks:
      - dev-net

networks:
  dev-net:
    external: true
```

### 2.2 `.devcontainer/devcontainer.json`（VS Code環境のコード化）
このファイルを設定することで、VS Code起動時に必要な拡張機能が自動でコンテナ内にロードされます。

```json
{
  "name": "Node.js Custom Project",
  "dockerComposeFile": "../docker-compose.yml",
  "service": "app",
  "workspaceFolder": "/workspace",
  
  // コンテナ内でVS Codeに読み込ませる拡張機能
  "customizations": {
    "vscode": {
      "settings": {
        "editor.formatOnSave": true,
        "editor.defaultFormatter": "esbenp.prettier-vscode"
      },
      "extensions": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "dsznajder.es7-react-js-snippets"
      ]
    }
  },

  // コンテナ作成後に自動実行するコマンド（例：依存関係のプレインストールなど）
  "postCreateCommand": "npm install"
}
```

---

## 3. 1年後でも迷わないためのトラブルシューティング手順

環境が立ち上がらない、あるいは動作が不審な場合は以下の順に実行してください。

1. **Dockerが動いているか確認**
   Windows側で Docker Desktop が起動しているか確認します。
2. **キャッシュをクリアしてコンテナを再ビルド**
   VS Codeのコマンドパレット（`Ctrl+Shift+P`）を開き、以下を実行します。
   `Dev Containers: Rebuild Container Without Cache` （キャッシュなしでコンテナを再ビルド）
3. **共有ネットワークの確認**
   プロジェクト間で連携する場合、共通のDockerネットワーク `dev-net` が必要です。存在しない場合は、以下のコマンドで作成します。
   `docker network create dev-net`
## 4. Docker Desktop + Traefik 初回テスト手順

Preview Lane で `http://<project-name>.localhost` 形式の確認環境を使う場合は、共通 Traefik proxy の安全な初回起動手順として [`docker_traefik_test_environment_guide.md`](./docker_traefik_test_environment_guide.md) を参照してください。既存コンテナ・ネットワーク・ポートを壊さない確認順序を優先します。
