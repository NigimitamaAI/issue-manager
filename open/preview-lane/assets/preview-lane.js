export async function registerIssueManagerExtension(ctx) {
  const { api, state, el, modal, toast, mount } = ctx
  if (!mount && !ctx.laneMounts) return null

  // ボタンはモジュールスコープでキャッシュし、ensureButton() で同一ノードを返す。
  // レーン DOM が作り直されてもこのボタンノード自体は生きる（親から外れるだけ）ため、
  // core の attachExtensionLaneParts() が毎回 appendChild して与えるだけでおいしいとこに戻る。
  let button = null
  function ensureButton() {
    if (button) return button
    button = el('button', {
      id: 'btn-preview-lane',
      class: 'hdr-btn',
      disabled: true,
      text: '🚀 テスト確認',
      onclick: () => previewLaneDialog(),
    })
    return button
  }

  // 独自APIの呼び出しヘルパー
  async function getEnvStatus(projectId, envId = '') {
    const suffix = envId
      ? '/preview-lane/environments/' + encodeURIComponent(envId) + '/status'
      : '/preview-lane/status'
    const r = await fetch('/api/projects/' + encodeURIComponent(projectId) + suffix)
    if (!r.ok) throw await r.json()
    return r.json()
  }

  async function getEnvironments(projectId) {
    const r = await fetch('/api/projects/' + encodeURIComponent(projectId) + '/preview-lane/environments')
    if (!r.ok) throw await r.json()
    return r.json()
  }

  async function getEnvironmentStatus(projectId, envId) {
    const r = await fetch('/api/projects/' + encodeURIComponent(projectId) + '/preview-lane/environments/' + encodeURIComponent(envId) + '/status')
    if (!r.ok) throw await r.json()
    return r.json()
  }

  function statusLabel(status) {
    const statusLabelMap = {
      'running': '起動中',
      'stopped': '停止中',
      'not_configured': '未構成',
      'error': 'エラー',
      'loading': '取得中',
      'unknown': '不明',
      'default': '既定'
    }
    return statusLabelMap[status] || status
  }

  async function startEnv(projectId, envId = '') {
    const suffix = envId
      ? '/preview-lane/environments/' + encodeURIComponent(envId) + '/start'
      : '/preview-lane/start'
    const r = await fetch('/api/projects/' + encodeURIComponent(projectId) + suffix, {
      method: 'POST',
      headers: api.jsonHeaders()
    })
    if (!r.ok) throw await r.json()
    return r.json()
  }

  async function stopEnv(projectId, envId = '') {
    const suffix = envId
      ? '/preview-lane/environments/' + encodeURIComponent(envId) + '/stop'
      : '/preview-lane/stop'
    const r = await fetch('/api/projects/' + encodeURIComponent(projectId) + suffix, {
      method: 'POST',
      headers: api.jsonHeaders()
    })
    if (!r.ok) throw await r.json()
    return r.json()
  }

  async function restartEnv(projectId, envId = '') {
    const suffix = envId
      ? '/preview-lane/environments/' + encodeURIComponent(envId) + '/restart'
      : '/preview-lane/restart'
    const r = await fetch('/api/projects/' + encodeURIComponent(projectId) + suffix, {
      method: 'POST',
      headers: api.jsonHeaders()
    })
    if (!r.ok) throw await r.json()
    return r.json()
  }

  async function buildEnv(projectId, envId = '') {
    const suffix = envId
      ? '/preview-lane/environments/' + encodeURIComponent(envId) + '/build'
      : '/preview-lane/build'
    const r = await fetch('/api/projects/' + encodeURIComponent(projectId) + suffix, {
      method: 'POST',
      headers: api.jsonHeaders()
    })
    if (!r.ok) throw await r.json()
    return r.json()
  }

  async function openFolder(projectId) {
    const r = await fetch('/api/projects/' + encodeURIComponent(projectId) + '/preview-lane/open-folder', {
      method: 'POST',
      headers: api.jsonHeaders()
    })
    if (!r.ok) throw await r.json()
    return r.json()
  }

  // ダイアログ内のUI構築と更新
  async function previewLaneDialog() {
    const projectId = state.activeProject
    if (!projectId) return

    const container = el('div', { class: 'preview-lane-container' })
    const envPanel = el('div', { class: 'preview-env-panel', style: 'display:none;' })
    const statusPanel = el('div', { class: 'preview-status-panel' })
    const manualPanel = el('div', { class: 'preview-manual-panel' })

    container.appendChild(envPanel)
    container.appendChild(statusPanel)
    container.appendChild(manualPanel)

    // マニュアル・利用説明書エリアの描画
    renderManual(manualPanel)

    // AIプロンプトコピーパネルの描画（ステータスの次、マニュアルの前）
    const aiPanel = el('div', { class: 'preview-ai-panel' })
    renderAiPromptPanel(aiPanel, projectId)
    container.insertBefore(aiPanel, manualPanel)

    let selectedEnvId = ''
    let currentEnvironments = []

    async function refreshAll() {
      await renderEnvironmentPicker()
      await updateStatusView()
    }

    async function renderEnvironmentPicker() {
      envPanel.innerHTML = ''
      try {
        const res = await getEnvironments(projectId)
        const environments = Array.isArray(res.environments) ? res.environments : []
        currentEnvironments = environments
        if (!selectedEnvId) selectedEnvId = res.defaultEnvironment || environments[0]?.id || ''
        if (environments.length <= 1) {
          envPanel.style.display = 'none'
          return
        }
        envPanel.style.display = ''

        const renderTabs = (statusById = {}) => {
          envPanel.innerHTML = ''
          envPanel.appendChild(el('div', { class: 'preview-section-title', text: 'Docker環境' }))
          const tabs = el('div', { class: 'preview-env-tabs' })
          for (const env of environments) {
            const current = statusById[env.id]
            const status = current && current.status ? current.status : 'loading'
            const isActive = env.id === selectedEnvId
            tabs.appendChild(el('button', {
              type: 'button',
              class: `preview-env-tab env-status-${status}${isActive ? ' active' : ''}`,
              title: [env.description || env.purpose || '', statusLabel(status)].filter(Boolean).join(' / '),
              onclick: async () => {
                selectedEnvId = env.id
                renderTabs(statusById)
                await updateStatusView()
              },
              text: `${env.name || env.id}${env.default ? ' (default)' : ''} - ${statusLabel(status)}`
            }))
          }
          envPanel.appendChild(tabs)
        }

        renderTabs()
        const statuses = {}
        await Promise.all(environments.map(async (env) => {
          try {
            statuses[env.id] = await getEnvironmentStatus(projectId, env.id)
          } catch (e) {
            statuses[env.id] = { status: 'error', error: e.error || e.message }
          }
        }))
        renderTabs(statuses)
      } catch (e) {
        envPanel.style.display = ''
        envPanel.appendChild(el('div', { class: 'preview-error-box', text: '環境一覧の取得に失敗しました: ' + (e.error || e.message) }))
      }
    }

    // ステータスを読み込んで表示を更新する関数
    async function updateStatusView() {
      statusPanel.innerHTML = '<div class="preview-loading">ステータス取得中...</div>'
      try {
        const res = await getEnvStatus(projectId, selectedEnvId)
        statusPanel.innerHTML = ''

        // 1. 基本ステータス表示
        const statusClass = 'status-badge-' + res.status
        const label = res.status === 'not_configured'
          ? '未構成 (docker-compose.yml なし)'
          : (res.status === 'error' ? 'エラー / Docker未起動' : statusLabel(res.status))

        const statusRow = el('div', { class: 'preview-status-row' },
          el('span', { class: 'preview-status-label', text: '現在の状態: ' }),
          el('span', { class: 'preview-status-badge ' + statusClass, text: label })
        )
        statusPanel.appendChild(statusRow)

        const previewTargets = Array.isArray(res.previewTargets) ? res.previewTargets.filter(t => t && t.url) : []
        const primaryTarget = previewTargets.find(t => t.primary) || previewTargets[0] || null
        const environmentName = res.environment && (res.environment.name || res.environment.id)
          ? String(res.environment.name || res.environment.id)
          : ''
        if (environmentName) {
          statusPanel.appendChild(el('div', { class: 'preview-env-line', text: `環境: ${environmentName}` }))
        }
        if (res.environment && (res.environment.purpose || res.environment.description)) {
          const envMeta = []
          if (res.environment.purpose) envMeta.push(`用途: ${res.environment.purpose}`)
          if (res.environment.description) envMeta.push(res.environment.description)
          statusPanel.appendChild(el('div', { class: 'preview-env-detail', text: envMeta.join(' / ') }))
        }

        // 2. コンテナ一覧の表示 (起動中または停止中の場合)
        if (res.containers && res.containers.length > 0) {
          const list = el('ul', { class: 'preview-container-list' })
          for (const c of res.containers) {
            list.appendChild(el('li', {},
              el('strong', { text: c.name }),
              el('span', { class: 'container-state ' + (String(c.state).includes('Up') || String(c.state).includes('running') ? 'up' : 'down'), text: ` [${c.state}]` }),
              c.ports ? el('small', { text: ` (Ports: ${c.ports})` }) : null
            ))
          }
          statusPanel.appendChild(el('div', { class: 'preview-section-title', text: '構成コンテナ一覧:' }))
          statusPanel.appendChild(list)
        } else if (res.status === 'error' && res.error) {
          statusPanel.appendChild(el('div', { class: 'preview-error-box', text: `エラー詳細: ${res.error}` }))
        }

        // 3. アクションボタンの作成
        const isConfigured = res.status !== 'not_configured'
        const isRunning = res.status === 'running'

        const actionsRow = el('div', { class: 'preview-actions-row' },
          // 起動ボタン
          el('button', {
            type: 'button',
            class: 'hdr-btn primary',
            disabled: !isConfigured || isRunning,
            onclick: async () => {
              try {
                const startRes = await startEnv(projectId, selectedEnvId)
                toast(startRes.message || '起動要求を送信しました', 'ok')
                // 3秒後に再取得
                setTimeout(refreshAll, 3000)
              } catch (e) {
                toast('起動に失敗しました: ' + (e.error || e.message), 'err')
              }
            },
            text: '▶ 起動 (docker compose up)'
          }),
          // 停止ボタン
          el('button', {
            type: 'button',
            class: 'hdr-btn warn',
            disabled: !isConfigured || !isRunning,
            onclick: async () => {
              try {
                const stopRes = await stopEnv(projectId, selectedEnvId)
                toast(stopRes.message || '停止要求を送信しました', 'ok')
                // 3秒後に再取得
                setTimeout(refreshAll, 3000)
              } catch (e) {
                toast('停止に失敗しました: ' + (e.error || e.message), 'err')
              }
            },
            text: '■ 停止 (docker compose down)'
          }),
          el('button', {
            type: 'button',
            class: 'hdr-btn',
            disabled: !isConfigured || !isRunning,
            onclick: async () => {
              try {
                const restartRes = await restartEnv(projectId, selectedEnvId)
                toast(restartRes.message || '再起動要求を送信しました', 'ok')
                setTimeout(refreshAll, 3000)
              } catch (e) {
                toast('再起動に失敗しました: ' + (e.error || e.message), 'err')
              }
            },
            text: '↻ restart'
          }),
          el('button', {
            type: 'button',
            class: 'hdr-btn warn',
            disabled: !isConfigured,
            onclick: async () => {
              const ok = await modal({
                title: 'Docker build の確認',
                body: el('div', {},
                  el('p', { text: 'build は Dockerfile、依存関係、ベースイメージを変更したときの明示操作です。通常のソース編集や静的WEB確認では、restart またはブラウザ再読込で足りることが多いです。' }),
                  el('p', { text: '選択中の環境で docker compose build を実行しますか？' })
                ),
                actions: [
                  { label: 'キャンセル', value: false },
                  { label: 'build を実行', value: true, class: 'warn' },
                ],
              })
              if (!ok) return
              try {
                const buildRes = await buildEnv(projectId, selectedEnvId)
                toast(buildRes.message || 'ビルド要求を送信しました', 'ok')
                setTimeout(refreshAll, 3000)
              } catch (e) {
                toast('ビルドに失敗しました: ' + (e.error || e.message), 'err')
              }
            },
            text: '◆ build'
          }),
          // フォルダを開くボタン
          el('button', {
            type: 'button',
            class: 'hdr-btn',
            onclick: async () => {
              try {
                await openFolder(projectId)
                toast('エクスプローラーを開きました', 'ok')
              } catch (e) {
                toast('フォルダを開けませんでした: ' + (e.error || e.message), 'err')
              }
            },
            text: '📁 フォルダを開く'
          }),
          // プレビュー表示リンク
          el('button', {
            type: 'button',
            class: 'hdr-btn link-btn',
            disabled: !isRunning || !primaryTarget,
            onclick: () => {
              if (primaryTarget) window.open(primaryTarget.url, '_blank')
            },
            text: primaryTarget ? `🌐 ${primaryTarget.label || 'プレビューを開く'}` : '🌐 プレビューを開く'
          }),
          // 手動更新ボタン
          el('button', {
            type: 'button',
            class: 'hdr-btn',
            onclick: refreshAll,
            text: '↻ 状態更新'
          })
        )
        statusPanel.appendChild(actionsRow)

        if (previewTargets.length > 1) {
          const targetsBox = el('div', { class: 'preview-targets-box' })
          targetsBox.appendChild(el('div', { class: 'preview-section-title', text: '確認先' }))
          const targetRow = el('div', { class: 'preview-targets-row' })
          for (const target of previewTargets) {
            targetRow.appendChild(el('button', {
              type: 'button',
              class: 'hdr-btn link-btn preview-target-btn',
              disabled: !isRunning,
              title: target.url,
              onclick: () => window.open(target.url, '_blank'),
              text: target.label || target.id || target.url
            }))
          }
          targetsBox.appendChild(targetRow)
          statusPanel.appendChild(targetsBox)
        }

      } catch (e) {
        statusPanel.innerHTML = '<div class="preview-error-box">ステータス取得失敗: ' + (e.error || e.message) + '</div>'
      }
    }

    // 初回ステータス読み込み
    refreshAll()

    // モーダル表示
    await modal({
      title: 'プレビューレーン（確認環境・試験環境）',
      body: container,
      actions: [{ label: '閉じる', value: null }]
    })
  }

  // AIプロンプトコピーパネルの描画
    function renderAiPromptPanel(mountEl, projectId) {
      // 定型プロンプトのひな形
      const PROMPTS = [
        {
          id: 'create',
          label: '🐳 Docker確認環境を選定/構築する',
          buildText: (proj) => [
            '# Docker確認環境の選定・構築依頼',
            '',
            `プロジェクト: ${proj.displayName || proj.name}`,
            `パス: ${proj.projectDir}`,
            '',
            '## 依頼内容',
            'このプロジェクトの確認用途に合う Docker 環境を選定または構築してください。',
            'まず issue_manager の共有 Docker カタログを読み、必要十分な標準環境があればそれを利用してください。',
            '標準環境で不足する場合だけ、プロジェクト固有の _docker 環境を作成してください。',
            '',
            '## 参照する標準方針',
            '- 共有 Docker カタログ: issue_manager config の shared.dockerRoot 配下 catalog.json',
            '- 共有 Docker 環境: issue_manager config の shared.dockerRoot 配下',
            '- 共有 Traefik: issue_manager config の shared.traefikRoot',
            '- プロジェクト固有環境: <project>\\_docker\\',
            '- Docker 運用ルール: issue_manager ルートの _common\\rules\\docs\\docker_maintenance_policy.md',
            '- 共有 Traefik ルール: issue_manager ルートの _common\\rules\\docs\\docker_shared_traefik_policy.md',
            '',
            '## 必須要件',
            '- Dockerfile と docker-compose.yml は組として扱い、どの compose がどの Dockerfile を使うか明確にする',
            '- 共有標準環境で足りる場合は、プロジェクト側に不要な Dockerfile / compose を増やさない',
            '- 共有環境を使う場合、プロジェクト側には source: shared と sharedEnvironmentId だけを記録し、共有フォルダの実体パスを書かない',
            '- カスタマイズが必要な場合だけ <project>\\_docker\\environments.json と環境別ファイルを作成する',
            '- issue_manager 画面から操作できるよう、環境ID、表示名、用途、composeFile、previewTargets、必要なら customActions を設定する',
            '- previewTargets にはブラウザで開けるホスト側URLを設定し、0.0.0.0 をURLとして使わない',
            '- 共有 Traefik を使う場合は Host / port / path を明示し、プロジェクト単位で衝突しない名前にする',
            '- 通常の反映、restart、stop/start、build、customActions の違いが分かるようにする',
            '- customActions は許可済みバッチ/固定コマンドだけを登録し、任意 shell 文字列を画面から直接実行させない',
            '- volume削除、prune、down -v などの危険操作を標準ボタン化しない',
            '',
            '## 出力してほしいもの',
            '- 共有標準環境を使うか、プロジェクト固有環境を作るかの判断',
            '- 画面に出す環境名、状態確認先、主 previewTarget',
            '- 作成/変更するファイル一覧',
            '- 起動、停止、restart、build、customActions の使い分け',
          ].join('\n'),
        },
        {
          id: 'migrate-shared',
          label: '🔁 既存Docker設定を共有参照へ移行する',
          buildText: (proj) => [
            '# 既存Docker確認環境の共有設定移行依頼',
            '',
            `プロジェクト: ${proj.displayName || proj.name}`,
            `パス: ${proj.projectDir}`,
            '',
            '## 背景',
            'このプロジェクトは GitHub 等で公開配信される可能性があります。',
            'Docker確認環境の共有定義は issue_manager 側の config.shared で管理し、プロジェクト側には共有フォルダの実体パスを書かない方針へ移行してください。',
            '',
            '## 依頼内容',
            '既存の Dockerfile / docker-compose.yml / _docker/environments.json / README / チケット内のDocker確認手順を確認し、共有標準環境で足りるものは source: shared と sharedEnvironmentId に移行してください。',
            'プロジェクト固有のビルド、DB初期データ、永続volume、特殊なOSパッケージ、アプリ固有entrypointが必要なものだけ、<project>\\_docker に残してください。',
            '',
            '## 公開配信前提の必須ルール',
            '- プロジェクト側に G:\\\\issue-manager-main\\\\_share や G:\\\\codex\\\\issue_manager\\\\_share などのローカル実体パスを書かない',
            '- プロジェクト側には source: shared と sharedEnvironmentId などの論理参照だけを書く',
            '- config.shared.root / config.shared.dockerRoot / config.shared.traefikRoot は issue_manager 側の設定であり、プロジェクトrepoへコピーしない',
            '- 秘密情報、個人ユーザー名、ローカル絶対パス、社内URL、未公開データパスを公開repoへ入れない',
            '- previewTargets は公開してよい localhost / project-id.localhost / 127.0.0.1 などの開発用URLに限定する',
            '- compose にホスト固定ポートや container_name を安易に入れず、COMPOSE_PROJECT_NAME / IM_PROJECT_ID / IM_HOST で分離する',
            '- 既存挙動を壊さないよう、プロジェクト固有 compose が必要な場合は理由を明記して残す',
            '',
            '## 確認してほしいファイル',
            '- <project>\\_docker\\environments.json',
            '- <project>\\docker-compose.yml / docker-compose.yaml',
            '- <project>\\Dockerfile',
            '- <project>\\README.md や tickets 内のDocker確認手順',
            '- issue_manager config の shared.dockerRoot 配下 catalog.json と各 environment.json',
            '',
            '## 期待する出力',
            '- 共有参照へ移行できる環境と、プロジェクト固有のまま残す環境の一覧',
            '- 変更するファイル一覧',
            '- 公開repoへ入れてよい内容 / 入れてはいけない内容の確認結果',
            '- 移行後の _docker/environments.json の例',
            '- 動作確認方法（previewTargets、start/status/restart/build のどれで確認するか）',
          ].join('\n'),
        },
        {
          id: 'diagnose',
          label: '🔍 Docker環境を診断する',
          buildText: async (proj) => {
            let statusInfo = '（ステータス取得中...）'
            try {
              const res = await getEnvStatus(projectId)
              const lines = [`ステータス: ${res.status}`]
              if (res.environment) {
                lines.push('環境:')
                if (res.environment.id) lines.push(`  - ID: ${res.environment.id}`)
                if (res.environment.name) lines.push(`  - 名前: ${res.environment.name}`)
                if (res.environment.purpose) lines.push(`  - 用途: ${res.environment.purpose}`)
                if (res.environment.source) lines.push(`  - source: ${res.environment.source}`)
                if (res.environment.composeFile) lines.push(`  - composeFile: ${res.environment.composeFile}`)
                if (res.environment.traefik && res.environment.traefik.host) {
                  const port = res.environment.traefik.httpPort || res.environment.traefik.port || ''
                  lines.push(`  - Traefik: ${res.environment.traefik.host}${port ? ':' + port : ''}`)
                }
              }
              if (res.containers && res.containers.length) {
                lines.push('コンテナ:')
                for (const c of res.containers) {
                  lines.push(`  - ${c.name}: ${c.state}${c.ports ? ' / ' + c.ports : ''}`)
                }
              }
              if (res.error) lines.push(`エラー: ${res.error}`)
              if (Array.isArray(res.previewTargets) && res.previewTargets.length) {
                lines.push('確認先:')
                for (const target of res.previewTargets) {
                  if (target && target.url) lines.push(`  - ${target.label || target.id || 'preview'}: ${target.url}`)
                }
              }
              const customActions = res.environment && Array.isArray(res.environment.customActions)
                ? res.environment.customActions
                : []
              if (customActions.length) {
                lines.push('カスタムアクション:')
                for (const action of customActions) {
                  lines.push(`  - ${action.label || action.id}: ${action.description || '説明なし'}${action.requiresConfirm ? ' / 確認あり' : ''}`)
                }
              }
              statusInfo = lines.join('\n')
            } catch (_) {}
            return [
              '# Docker環境診断依頼',
              '',
              `プロジェクト: ${proj.displayName || proj.name}`,
              `パス: ${proj.projectDir}`,
              '',
              '## 現在の状態',
              statusInfo,
              '',
              '## 依頼内容',
              '上記のDocker確認環境が正常に動作しない原因を調査し、修正手順を教えてください。',
              '共有標準環境で足りる場合は専用環境を増やさず、必要な場合だけプロジェクト固有 _docker 環境を提案してください。',
              'リフレッシュ操作は、ブラウザ再読込、restart、stop/start、build、customActions のどれが適切かを分けて判断してください。',
              'volume削除、prune、down -v などの危険操作は、ユーザー確認なしに実行しないでください。',
              '任意 shell 文字列を画面から直接実行する提案は避け、必要な補助処理は customActions として登録できる固定バッチ/固定コマンドにしてください。',
            ].join('\n')
          },
        },
      ]

      const panel = el('div', { class: 'ai-prompt-panel' })
      panel.appendChild(el('div', { class: 'preview-section-title', text: '🤖 AIへの定型プロンプト' }))
      panel.appendChild(el('div', { class: 'ai-prompt-hint', text: 'ボタンを押すとプロンプトをクリップボードにコピーします。AIチャットに貼り付けて使ってください。' }))

      const btnRow = el('div', { class: 'ai-prompt-buttons' })

      for (const prompt of PROMPTS) {
        const btn = el('button', {
          type: 'button',
          class: 'hdr-btn ai-prompt-btn',
          disabled: !projectId,
          text: prompt.label,
          onclick: async () => {
            const proj = state.projects && state.projects.find(p => (p.id || p.name) === projectId)
            if (!proj) { toast('プロジェクト情報を取得できませんでした', 'err'); return }
            try {
              const text = typeof prompt.buildText === 'function'
                ? await Promise.resolve(prompt.buildText(proj))
                : ''
              await navigator.clipboard.writeText(text)
              toast('プロンプトをクリップボードにコピーしました', 'ok')
            } catch (e) {
              toast('コピーに失敗しました: ' + (e.message || ''), 'err')
            }
          },
        })
        btnRow.appendChild(btn)
      }

      panel.appendChild(btnRow)
      mountEl.appendChild(panel)
    }

    // 利用説明書の描画
  function renderManual(mountEl) {
    const title = el('div', { class: 'preview-section-title', text: '📖 開発環境パッケージ化・利用説明書' })
    const accordion = el('div', { class: 'preview-manual-accordion' })

    const sections = [
      {
        title: '1. 確認環境の選び方',
        content: `Docker確認環境は、まず共有標準環境カタログを優先して選びます。<br>
                  軽量WEB確認など標準環境で足りる場合は、プロジェクト固有のDockerfileやcomposeを増やさずに使います。<br>
                  共有環境を使う公開プロジェクトには、共有フォルダの実体パスではなく <code>source: shared</code> と <code>sharedEnvironmentId</code> だけを記録します。<br>
                  OSパッケージ、DB初期データ、特殊な起動手順などが必要な場合だけ、プロジェクト固有の <code>_docker</code> 環境を用意します。`
      },
      {
        title: '2. 反映・リフレッシュの使い分け',
        content: `静的WEBやbind mountで反映される成果物は、通常ブラウザ再読込または状態更新で確認できます。<br>
                  アプリプロセスだけを再起動したい場合は <code>restart</code>、コンテナを作り直したい場合は停止→起動を使います。<br>
                  <code>build</code> は Dockerfile、依存関係、ベースイメージを変えたときの明示操作として扱い、通常編集のたびに実行する操作ではありません。`
      },
      {
        title: '3. 確認先とカスタム操作',
        content: `確認URLは環境メタデータの <code>previewTargets</code> から表示します。<code>0.0.0.0</code> はlisten addressであり、ブラウザで開くURLには使いません。<br>
                  レポート再生成などプロジェクト固有の補助処理は <code>customActions</code> として登録された固定バッチ/固定コマンドだけを画面から実行します。<br>
                  volume削除、prune、<code>down -v</code> などの危険操作は標準ボタン化せず、必要時にDocker DesktopまたはCLIで手動判断します。`
      }
    ]

    for (const sec of sections) {
      const item = el('div', { class: 'manual-item' })
      const head = el('div', { class: 'manual-head', text: sec.title })
      const body = el('div', { class: 'manual-body', html: sec.content, style: 'display:none;' })

      head.onclick = () => {
        const isHidden = body.style.display === 'none'
        body.style.display = isHidden ? 'block' : 'none'
        head.classList.toggle('active', isHidden)
      }

      item.appendChild(head)
      item.appendChild(body)
      accordion.appendChild(item)
    }

    mountEl.appendChild(title)
    mountEl.appendChild(accordion)
  }

  return {
    id: 'preview-lane',
    // 宣言型レーンバインド部品。
    // core (public/app.js) の attachExtensionLaneParts() が renderKanban のたびにこれを走査し、
    // review レーンの lane-action-bar にボタンを再差し込み、updateState で状態を最新化する。
    // これによりチケット選択・移動・アーカイブ等でレーン DOM が作り直されてもボタンが消えない。
    laneButtons: [
      {
        lane: 'review',
        factory: () => ensureButton(),
        updateState: (btn) => {
          btn.disabled = !state.activeProject
        },
      },
    ],
  }
}
