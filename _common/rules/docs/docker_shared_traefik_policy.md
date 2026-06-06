# Docker 共有 Traefik プロキシ運用ポリシー

作成日: 2026-06-01
更新日: 2026-06-01（ホスト側ポート 8280、PowerShell `curl.exe` 表記、`traefik.docker.network` ラベル必須化、トラブルシュート追加）
対象: issue_manager 管理下で Docker 化された全プロジェクト

## 目的

issue_manager 管理下の複数プロジェクトを同一ホスト上で同時起動する際、ポート競合を避けつつ
`<project>.localhost:8280` 形式の固定ホスト名でブラウザアクセスできるよう、共有 Traefik プロキシを
標準ルーティング基盤として規定する。

## 基本方針

- 各プロジェクトはホスト側固定ポートを直接占有しない。
- プロジェクト側は **internal port のみ** を持ち、Traefik ラベルでホスト名ルーティングを宣言する。
- 共有 Traefik コンテナが `traefik` という名前の external Docker network を介して全プロジェクトを束ねる。
- 共有 Traefik 本体は issue_manager の `config.shared.traefikRoot` に置き、プロジェクト横断の単一インスタンスとして運用する。
- プロジェクト側には共有 Traefik の実体パスを書かない。プロジェクトは共有環境IDや `source: shared` などの論理参照だけを持つ。
- ホスト側 HTTP 公開ポートは **8280** を標準とする（80 を避けることで IIS / Apache / Skype 等のホスト側 Web サービスとの競合を回避）。

## ディレクトリと構成

```text
<issue_manager config shared.root>\
  traefik\
    docker-compose.yml      # 共有 Traefik 本体
<managed root>\
  <project>\
    docker-compose.yml      # プロジェクト側（traefik ラベル + external network 参照）
```

共有 Traefik の標準構成（抜粋）:

- image: `traefik:v3.0`
- entrypoint: `web` = `:80`（コンテナ内）
- ホスト側公開ポート: `8280 → 80`（HTTP）、`8080 → 8080`（dashboard）
- providers: Docker socket (`/var/run/docker.sock`、read-only)
- network: external `traefik`

ホスト側 8280、コンテナ内 80 という非対称マッピングを採る理由は次節参照。

## ポート方針

| 用途 | ホスト側 | コンテナ内 | 備考 |
|---|---|---|---|
| HTTP ルーティング | 8280 | 80 | ブラウザは `http://<id>.localhost:8280/` でアクセス |
| Traefik dashboard | 8080 | 8080 | `--api.insecure=true` のため開発用途のみ |

ホスト側を 80 にしない理由:

- Windows ホスト上の IIS、Skype（旧バージョン）、Apache などと衝突しやすい。
- ポート 80 は通常別用途で予約されていることが多く、競合検出のたびに調整するコストが大きい。
- プロジェクト側 compose のラベルは Traefik 内部リスナー（`:80`）に対するルーティング宣言であり、ホスト側マッピングと独立しているため、ホスト側を 8280 に変えてもプロジェクト側設定の修正は不要。

将来 HTTPS を追加する場合は、ホスト側 `8443 → 443` を併設し、`websecure` entrypoint を追加する。

## Docker network 規約

| 項目 | 値 |
|---|---|
| network name | `traefik` |
| driver | bridge（デフォルト） |
| 作成主体 | 利用者が一度だけ手動作成（external 扱い） |
| 用途 | Traefik ⇄ 各プロジェクトコンテナ間の HTTP ルーティング |

### 初回セットアップ（network 作成）

```powershell
docker network create traefik
```

既に存在する場合は `network with name traefik already exists` が出るが無害。

## 起動・停止手順

### 起動

```powershell
cd <shared.traefikRoot>
docker compose up -d
```

確認:

```powershell
docker ps --filter name=traefik
curl.exe -s http://localhost:8080/api/rawdata | Select-Object -First 1
```

dashboard: `http://localhost:8080/dashboard/`

### 停止

```powershell
cd <shared.traefikRoot>
docker compose down
```

## PowerShell での curl 利用に関する注意

PowerShell では `curl` が `Invoke-WebRequest` のエイリアスになっており、`-H` オプションの構文が
真の curl と異なる。本ポリシーの動作確認例は **PowerShell 上では `curl.exe` を明示** して
Windows 同梱の本物の curl を呼ぶことを前提とする。

```powershell
# 推奨: curl.exe を明示
curl.exe -H "Host: kikichronicle.localhost" http://127.0.0.1:8280/

# PowerShell ネイティブで書く場合
Invoke-WebRequest -Uri "http://127.0.0.1:8280/" -Headers @{ Host = "kikichronicle.localhost" }
```

`curl` のまま実行すると `Invoke-WebRequest` に渡され、`-Headers` が `IDictionary` 型を期待するため
`"Host: ..."` 文字列の渡し方でエラーになる（典型的なハマりどころ）。WSL や Git Bash 上では素の `curl` で問題ない。

## プロジェクト側 compose の標準ラベル

新規 Docker プロジェクトを共有 Traefik に乗せる場合、`docker-compose.yml` に以下を含める。
ラベル内のポート（`server.port`）はあくまで **コンテナ内のサービスポート** であり、
共有 Traefik のホスト側 8280 とは別物なので注意。

```yaml
services:
  app:
    # ... 既存設定 ...
    labels:
      - traefik.enable=true
      - traefik.docker.network=traefik
      - traefik.http.routers.<project-id>.rule=Host(`<project-id>.localhost`)
      - traefik.http.routers.<project-id>.entrypoints=web
      - traefik.http.services.<project-id>.loadbalancer.server.port=<internal-port>
    networks:
      - default
      - traefik

networks:
  traefik:
    external: true
    name: traefik
```

ポイント:

- `<project-id>` はプロジェクトを一意に識別する短い英小文字（例: `kikichronicle`）。
- `Host()` のクォートはバッククォート必須。`Host()` には **ポート番号を書かない**（ホスト名のみ）。
- ホスト側ポート (`ports:`) は **公開しない**。Traefik 経由でのみ届く。
- `networks.default` を残すことで同プロジェクト内コンテナ（DB など）への接続を保つ。
- `<internal-port>` はプロジェクトのコンテナが listen している番号（kikiChronicle なら 8000）。
- **`traefik.docker.network=traefik` は複数 network 参加時に必須**。これが無いと Traefik が
  `<project>_default` 側の IP をサービス URL に登録してしまい、Traefik コンテナからは
  到達できず Gateway Timeout になる。詳細はトラブルシュートの該当節を参照。

## `*.localhost` 解決方法

`*.localhost` は **RFC 6761 によりループバック扱い**が規格上推奨されるが、
Windows の DNS リゾルバは標準ではワイルドカード `*.localhost` を `127.0.0.1` に解決しない。

### 解決策（いずれか 1 つ）

#### 方法 1: hosts ファイル編集（推奨、ブラウザでそのまま開ける）

`C:\Windows\System32\drivers\etc\hosts` を **管理者権限** で編集し、追記:

```text
127.0.0.1   kikichronicle.localhost
127.0.0.1   <next-project>.localhost
```

プロジェクトを増やすたび 1 行追加する。ポート番号は hosts ファイルには書かない
（hosts は名前解決のみ、ポートはアクセス側 URL で指定）。

#### 方法 2: Host ヘッダを明示（hosts 編集不要、curl 等の動作確認用）

```powershell
curl.exe -H "Host: kikichronicle.localhost" http://127.0.0.1:8280/
```

PowerShell ネイティブで書くなら:

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:8280/" -Headers @{ Host = "kikichronicle.localhost" }
```

ブラウザでは使えないので、開発確認や CI ヘルスチェック向け。

#### 方法 3: ローカル DNS（acrylic-dns-proxy 等）

複数プロジェクトを頻繁に追加する場合に検討。本ポリシーでは標準化しない。

## 動作確認

共有 Traefik 起動後、プロジェクトを起動し以下で疎通確認:

```powershell
# Host ヘッダで（hosts 編集不要）
curl.exe -H "Host: <project-id>.localhost" http://127.0.0.1:8280/

# hosts 編集済みなら
curl.exe http://<project-id>.localhost:8280/
```

ブラウザからは `http://<project-id>.localhost:8280/` でアクセスする（ポート 8280 を URL に明記）。

Traefik dashboard (`http://localhost:8080/dashboard/`) で Router/Service が緑表示なら正常。

## トラブルシュート

### 症状 1: Gateway Timeout（504 / `Gateway Timeout` テキスト）

Traefik はリクエストを受け取ったが、バックエンドコンテナから応答が得られなかった状態。
切り分け順に確認する。

#### 確認 A: Traefik から見たバックエンドの状態と URL

```powershell
curl.exe -s http://localhost:8080/api/http/services/<project-id>@docker
```

`serverStatus` が `UP` になっていて、`servers[].url` に IP:port が入っているか確認する。

#### 確認 B: その IP が「`traefik` ネットワーク上の IP か」を確認

```powershell
docker inspect <container-name> --format "{{json .NetworkSettings.Networks}}"
```

`traefik` セクションの `IPAddress` と、確認 A の `servers[].url` の IP が **一致するか** を見る。
一致しない（`<project>_default` 側の IP が入っている）場合、これが原因。

##### 原因と対処

プロジェクトコンテナが複数 network（例: `<project>_default` + `traefik`）に参加しているとき、
Traefik はどの network 上の IP をサービス URL とするかを `traefik.docker.network` ラベルで決める。
このラベルが無いと、Docker が返すネットワーク一覧の先頭（典型的には `<project>_default`）の IP を
誤って採用してしまい、Traefik コンテナからはそのサブネットに到達できないため Gateway Timeout になる。

**対処**: プロジェクト側 compose の対象サービスに次のラベルを追加して `docker compose up -d` でコンテナ再作成。

```yaml
labels:
  - traefik.docker.network=traefik
```

確認 A の `servers[].url` が `traefik` ネットワーク側の IP に更新されれば修復完了。

#### 確認 C: バックエンドが本当に応答しているか（同一 network から直接続）

```powershell
docker run --rm --network traefik curlimages/curl:latest -s -o /dev/null -w "%{http_code}`n" --max-time 5 http://<container-name>:<internal-port>/
```

`200` 等が返ればアプリは生きている。`000`/タイムアウトならアプリ側の listen / 起動コマンドを疑う。

### 症状 2: 接続そのものが拒否される

- Traefik コンテナが起動しているか: `docker ps --filter name=traefik`
- ホスト側ポート 8280 が他プロセスに占有されていないか:
  `Get-NetTCPConnection -LocalPort 8280 -ErrorAction SilentlyContinue`
- アクセス URL に `:8280` が含まれているか（省略すると `:80` 扱いで届かない）

### 症状 3: 名前解決できない（ブラウザで「サーバが見つかりません」）

- hosts ファイルに `127.0.0.1 <project-id>.localhost` が追記されているか確認
- hosts 編集が反映されない場合は `ipconfig /flushdns` を実行

## 既知の制約

- Windows hosts ファイル編集は **管理者権限が必須**。`runas /user:Administrator notepad`
  または管理者で開いた PowerShell からの編集が必要。
- ブラウザのアクセス URL は **ポート 8280 を明記** する必要がある（`:8280` を省略すると `:80` 扱いになり接続できない）。ブックマーク登録時に注意。
- 共有 Traefik はホスト側ポート 8280 と 8080 を占有するため、これらと衝突する別サービスを同時起動しない。
- `--api.insecure=true` は開発用途のみ。外部公開時は basicauth 等の保護が必要。
- HTTPS (`websecure` entrypoint) は本ポリシーでは未規定。必要になった時点で `8443 → 443` 等を追加する。
- PowerShell では `curl` が `Invoke-WebRequest` のエイリアスのため、本物の curl を使うには `curl.exe` と明示する。WSL や Git Bash では不要。
- 複数 network に参加するコンテナは **`traefik.docker.network=traefik` ラベル必須**。これを忘れると Gateway Timeout の原因になる。

## 関連

- `git_public_private_policy.md`: 共有 Traefik 設定そのものは公開してよい構成情報。`config.shared.traefikRoot` 配下を Git 管理する場合は公開 repo に置いて差し支えない。
- `project_identity_policy.md`: プロジェクト固有の `<project-id>` 命名は `.issuemgr/app.json` の `appId` と整合させることを推奨する。

## 関連実装

このポリシーを根拠に Traefik や Docker 環境を変更する場合は、文書だけで判断せず次の実装も確認する。

- `lib/shared-config.mjs`: `config.shared` と共有ルートの正規化
- `open/test-environment/routes.mjs`: 環境別 compose 解決、確認 URL、AI 向けプロンプト生成
- `_share/traefik/docker-compose.yml`: 共有 Traefik 本体の実設定
- `_share/docker/catalog.json`: 共有環境カタログとテンプレート参照

