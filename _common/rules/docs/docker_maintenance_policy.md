# Docker 保守・クリーンアップ運用ポリシー

作成日: 2026-06-01
対象: G:\codex\ 配下で Docker 化された全プロジェクト

## 目的

Docker 上でプロジェクトを継続開発・運用する際の「リビルド／再作成／再起動の使い分け」と
「ディスクに溜まる成果物の掃除手順」を共通化し、無用なリビルド時間とディスク逼迫を避ける。

## 基本原則

- 通常のアプリコード編集では **イメージのリビルドは発生しない**。ホストファイルは bind mount で
  コンテナ内に直結しているため、保存した瞬間にコンテナ内へ反映される。
- 設定 (compose.yml のラベル・環境変数・ネットワーク・ボリューム宣言など) を変えた場合は、
  **コンテナの再作成 (recreate)** のみで足りる。イメージリビルドは不要。
- イメージリビルドが必要なのは **Dockerfile を変更したとき** か、ベースイメージ／OS パッケージを
  作り直したいときに限る。
- 開発の主流は ① ホスト側で編集 → ② ブラウザリロード or `docker compose restart app`、で十分。
  リビルドはイベントベースで稀にしか発生しない。

## issue_manager の責務境界

- `issue_manager` は Docker 確認環境の状態表示、起動・停止・再起動・明示 build、確認URL、AI向け案内を扱う。
- `issue_manager` は Docker の容量削除・整理を代行しない。容量管理の主体は Docker Desktop と Docker CLI。
- 画面に表示してよいのは、環境名、compose path、コンテナ状態、確認URL、共有環境候補、低リスクな確認コマンドの案内まで。
- `docker system df` 相当の容量読み取り表示は、標準UIには実装しない。理由は、容量の解釈には Docker Desktop 全体の文脈が必要で、削除操作と誤って結び付きやすいため。
- 容量が気になる場合は Docker Desktop の UI または `docker system df` / `docker system df -v` をユーザーが手元で確認する。
- `down -v`、`docker volume rm`、`docker volume prune`、`docker system prune --volumes` は標準ボタン化しない。必要時は一覧確認後にユーザーが明示判断する。

## リビルド・再作成・再起動の使い分け

| 種類 | コマンド | コスト | いつ必要か |
|---|---|---|---|
| ① イメージリビルド | `docker compose build` / `docker compose up -d --build` | 重い (数分〜) | `Dockerfile` 変更、ベースイメージ更新、`apt-get install` 等で OS レイヤを変えた時 |
| ② コンテナ再作成 (recreate) | `docker compose up -d` (自動検知) / `--force-recreate` | 軽い (数秒) | `docker-compose.yml` の設定変更 (env / label / network / volume / depends_on 等) を検知させたい時 |
| ③ コンテナ再起動 (restart) | `docker compose restart [service]` | 最軽 (1-2 秒) | アプリプロセスだけ立て直したい時、依存パッケージを起動時にインストールする構成での反映 |

### よくある変更ごとの正解

| 変更 | 推奨手順 |
|---|---|
| アプリのソースコード (Python / HTML / JS / MD) | **何もしない**。bind mount で即反映、ブラウザリロードのみ |
| `requirements.txt` に依存追加（startup スクリプトが pip install する構成） | `docker compose restart app` |
| `requirements.txt` に依存追加（Dockerfile でビルド時に pip install する構成） | `docker compose up -d --build` |
| `docker-compose.yml` のラベル・環境変数・ネットワーク変更 | `docker compose up -d`（自動 recreate） |
| `docker-compose.yml` の変更が検知されない | `docker compose up -d --force-recreate <service>` |
| `Dockerfile` 変更（ベースイメージ・OS パッケージ・ビルド手順） | `docker compose up -d --build` |
| ボリューム内データのリセット（DB 初期化など） | `docker compose down -v` → `docker compose up -d`（**注意: データ削除**） |

### compose の `--build` フラグの誤用に注意

「念のため `--build` を付けておく」を毎回やると、毎回イメージリビルドが走り、無駄に時間と
ストレージを消費する。Dockerfile を変えていない時は付けない。

## ディスクに溜まるもの

Docker の運用で増えるものは大きく 5 種類:

| 種類 | 何か | 発生源 | 削除の安全度 |
|---|---|---|---|
| 古いコンテナ | 停止中・終了済みコンテナ | recreate 時に旧版は即削除されるので、ほとんど残らない | 高（基本残らない） |
| dangling image | タグの付いていない中間イメージレイヤ | リビルドのたびに発生 | 高（即消してよい） |
| 未使用 image | タグ付きだが、どのコンテナからも参照されないイメージ | base image 更新後、古い版が残る | 中（再 pull で復元可能） |
| 未使用ボリューム | どのコンテナにもマウントされていない名前付きボリューム | プロジェクト削除時、`docker compose down -v` で消し忘れ | **低（データ消失リスク）** |
| 未使用ネットワーク | どのコンテナも繋いでいないネットワーク | プロジェクト削除時の `_default` 等 | 高（必要なら再作成される） |

### 現状の可視化

```powershell
# 全体サマリ（TYPE 別の使用量・回収可能量）
docker system df

# より詳細
docker system df -v

# 個別の確認
docker image ls -a
docker container ls -a
docker volume ls
docker network ls
```

`RECLAIMABLE` カラムが「掃除すれば取り戻せる量」を示す。

## 定期掃除の手順（リスク低→高）

数週間〜月 1 回の頻度で、リスクの低いものから順に実行する。

### レベル 1: 完全に安全（dangling image / 停止コンテナ / 未使用ネットワーク）

```powershell
# 停止中のコンテナを掃除
docker container prune -f

# タグ無しの dangling image を掃除
docker image prune -f

# 未使用ネットワーク（接続コンテナ無しのもの）
docker network prune -f
```

これらは「使用中のものは絶対に消さない」ため、走らせて壊れることは無い。

### レベル 2: 中リスク（未使用の全 image）

```powershell
# どのコンテナからも参照されていない image をすべて削除
docker image prune -a -f
```

タグ付きでも未使用なら消える。次回 `docker compose up` 時に再 pull/build される（時間がかかる）。

### レベル 3: 高リスク（ボリューム）

**ボリュームには DB データなど永続化された情報が入っている可能性がある**。実行前に必ず確認:

```powershell
# まず一覧を見て、必要なボリュームが含まれていないか確認
docker volume ls

# 個別に削除（推奨）
docker volume rm <volume-name>

# 一括（未使用のもののみ。それでも危険、必ず ls してから）
docker volume prune -f
```

特に `kikichronicle-neo4j-data` など名前付きボリュームは Neo4j の全データが入っているため、
プロジェクト破棄時以外は削除しない。

### レベル 4: 全部一括（注意）

```powershell
# 停止コンテナ + dangling image + 未使用ネットワーク + Build cache をまとめて削除
docker system prune -f

# 上記 + 未使用 image (タグ付き含む) も削除
docker system prune -a -f

# 上記 + 未使用ボリュームも削除（最も危険）
docker system prune -a --volumes -f
```

`--volumes` を付ける運用は推奨しない。必要に応じ `-a` までで止め、ボリュームは個別判断で。

## プロジェクト終了時のクリーンアップ

プロジェクトを完全に破棄するとき:

```powershell
cd G:\codex\<project>
docker compose down -v --rmi local
```

- `-v`: 名前付きボリュームも削除（**データ消失、本当に終了する時のみ**）
- `--rmi local`: ローカルでビルドした image も削除
- `--remove-orphans` を併用すると、compose.yml から削除済みのサービスのコンテナも消える

## トラブル時の確認ポイント

### イメージリビルドが想定外に走る

- `docker compose up -d --build` を癖で付けていないか
- `Dockerfile` または compose の `build:` ブロックを参照しているサービスで、何かファイルが
  変わっていないか（`build.context` 内のファイル更新もキャッシュ無効化のトリガー）

### Recreate が想定外に走る

- compose.yml のフィールド順序・引用符・空白差で「変更あり」と判定されることがある。
  違いを確認するには `docker compose config` で正規化済み yaml を出力して比較する。

### ディスクが急に膨らんだ

- `docker system df -v` でどの種別が増えたか確認
- Build cache の肥大化は `docker builder prune` で個別削除
- 低リスク: dangling image、停止コンテナ、未使用ネットワークを順に確認する
- 中リスク: 未使用 image は再 pull/build 可能だが、次回起動に時間がかかる
- 高リスク: volume は DB や生成済みデータを含む可能性があるため、削除前に `docker volume ls` と volume 名を必ず確認する

## 命名規則と容量診断

容量診断時に Docker Desktop / Docker CLI 上で由来を追いやすくするため、共有環境・プロジェクト固有環境は次の命名を基本にする。

- compose project name: `<project-id>-<environment-id>`
- Traefik router/service: `<project-id>-<environment-id>`
- コンテナ名: compose project name と service 名から自動生成される名前を使い、固定 `container_name` は原則使わない
- volume 名: 永続データを含む場合は `<project-id>-<environment-id>-<purpose>` が分かる名前にする
- 共有環境は `sharedEnvironmentId` を論理参照として残し、共有フォルダの実体パスをプロジェクト repo に書かない

## 関連

- `docker_shared_traefik_policy.md`: 共有 Traefik プロキシ運用とトラブルシュート
- `git_public_private_policy.md`: Docker 関連ファイル (compose.yml, Dockerfile, .dockerignore) の公開/非公開判断

## 関連実装

このポリシーを根拠に Docker 確認環境や容量案内を変更する場合は、文書だけで判断せず次の実装も確認する。

- `open/preview-lane/routes.mjs`: Docker 環境メタデータ、compose 解決、AI 向けプロンプト生成
- `open/preview-lane/assets/preview-lane.js`: テスト確認 UI、危険操作の表示・非表示
- `lib/shared-config.mjs`: 共有 Docker / Traefik ルート解決
- `_share/docker/catalog.json`: 共有 Docker 環境カタログ
