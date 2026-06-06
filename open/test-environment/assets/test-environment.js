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
      id: 'btn-test-environment',
      class: 'hdr-btn',
      disabled: true,
      text: '🚀 テスト確認',
      onclick: () => testEnvironmentDialog(),
    })
    return button
  }

  // 独自APIの呼び出しヘルパー
  async function getEnvStatus(projectId, envId = '') {
    const suffix = envId
      ? '/test-environment/environments/' + encodeURIComponent(envId) + '/status'
      : '/test-environment/status'
    const r = await fetch('/api/projects/' + encodeURIComponent(projectId) + suffix)
    if (!r.ok) throw await r.json()
    return r.json()
  }

  async function getEnvironments(projectId) {
    const r = await fetch('/api/projects/' + encodeURIComponent(projectId) + '/test-environment/environments')
    if (!r.ok) throw await r.json()
    return r.json()
  }

  async function getEnvironmentStatus(projectId, envId) {
    const r = await fetch('/api/projects/' + encodeURIComponent(projectId) + '/test-environment/environments/' + encodeURIComponent(envId) + '/status')
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
      ? '/test-environment/environments/' + encodeURIComponent(envId) + '/start'
      : '/test-environment/start'
    const r = await fetch('/api/projects/' + encodeURIComponent(projectId) + suffix, {
      method: 'POST',
      headers: api.jsonHeaders()
    })
    if (!r.ok) throw await r.json()
    return r.json()
  }

  async function stopEnv(projectId, envId = '') {
    const suffix = envId
      ? '/test-environment/environments/' + encodeURIComponent(envId) + '/stop'
      : '/test-environment/stop'
    const r = await fetch('/api/projects/' + encodeURIComponent(projectId) + suffix, {
      method: 'POST',
      headers: api.jsonHeaders()
    })
    if (!r.ok) throw await r.json()
    return r.json()
  }

  async function restartEnv(projectId, envId = '') {
    const suffix = envId
      ? '/test-environment/environments/' + encodeURIComponent(envId) + '/restart'
      : '/test-environment/restart'
    const r = await fetch('/api/projects/' + encodeURIComponent(projectId) + suffix, {
      method: 'POST',
      headers: api.jsonHeaders()
    })
    if (!r.ok) throw await r.json()
    return r.json()
  }

  async function buildEnv(projectId, envId = '') {
    const suffix = envId
      ? '/test-environment/environments/' + encodeURIComponent(envId) + '/build'
      : '/test-environment/build'
    const r = await fetch('/api/projects/' + encodeURIComponent(projectId) + suffix, {
      method: 'POST',
      headers: api.jsonHeaders()
    })
    if (!r.ok) throw await r.json()
    return r.json()
  }

  async function openFolder(projectId) {
    const r = await fetch('/api/projects/' + encodeURIComponent(projectId) + '/test-environment/open-folder', {
      method: 'POST',
      headers: api.jsonHeaders()
    })
    if (!r.ok) throw await r.json()
    return r.json()
  }

  // ダイアログ内のUI構築と更新
  async function testEnvironmentDialog() {
    const projectId = state.activeProject
    if (!projectId) return

    const container = el('div', { class: 'test-environment-container' })
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
    let currentSharedCandidates = []

    async function refreshAll() {
      await renderEnvironmentPicker()
      await updateStatusView()
    }

    async function renderEnvironmentPicker() {
      envPanel.innerHTML = ''
      try {
        const res = await getEnvironments(projectId)
        const environments = Array.isArray(res.environments) ? res.environments : []
        currentSharedCandidates = Array.isArray(res.sharedEnvironmentCandidates) ? res.sharedEnvironmentCandidates : []
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
          renderSharedCandidates(envPanel)
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

    function renderSharedCandidates(mountEl) {
      if (!currentSharedCandidates.length) return
      const box = el('div', { class: 'preview-shared-candidates' })
      box.appendChild(el('div', { class: 'preview-section-title compact', text: '共有標準環境候補' }))
      const list = el('div', { class: 'preview-candidate-list' })
      for (const candidate of currentSharedCandidates) {
        const meta = []
        if (candidate.purpose) meta.push(candidate.purpose)
        if (candidate.weight) meta.push(`cost: ${candidate.weight}`)
        meta.push(candidate.requiresProjectBuild ? 'build必要' : 'build不要')
        list.appendChild(el('div', { class: 'preview-candidate-item' },
          el('strong', { text: candidate.name || candidate.id }),
          el('span', { text: ` / ${candidate.id}` }),
          el('small', { text: meta.join(' / ') })
        ))
      }
      box.appendChild(list)
      mountEl.appendChild(box)
    }

    function renderEnvironmentDetails(res) {
      const env = res.environment || {}
      const rows = []
      if (env.source) rows.push(['source', env.source])
      if (env.sharedEnvironmentId) rows.push(['shared', env.sharedEnvironmentId])
      if (env.composeFile) rows.push(['compose', env.composeFile])
      if (env.dockerfile) rows.push(['Dockerfile', env.dockerfile])
      if (env.image) rows.push(['image', env.image])
      if (env.cost && env.cost.weight) rows.push(['cost', env.cost.weight])
      if (env.cost && env.cost.rebuildUsuallyNeeded != null) rows.push(['rebuild', env.cost.rebuildUsuallyNeeded ? '通常必要' : '通常不要'])
      if (env.safety && env.safety.allowPrune === false) rows.push(['prune', '非表示'])
      if (!rows.length) return null

      const grid = el('dl', { class: 'preview-env-meta-grid' })
      for (const [label, value] of rows) {
        grid.appendChild(el('dt', { text: label }))
        grid.appendChild(el('dd', { text: String(value) }))
      }
      return grid
    }

    function renderCustomActions(res) {
      const actions = res.environment && Array.isArray(res.environment.customActions)
        ? res.environment.customActions
        : []
      if (!actions.length) return null
      const box = el('div', { class: 'preview-custom-actions-box' })
      box.appendChild(el('div', { class: 'preview-section-title', text: 'カスタム操作' }))
      const row = el('div', { class: 'preview-targets-row' })
      for (const action of actions) {
        row.appendChild(el('button', {
          type: 'button',
          class: 'hdr-btn',
          title: action.description || action.id || '',
          onclick: () => {
            window.confirm(`${action.label || action.id}\n\n${action.description || '説明なし'}\n\nこの画面は登録済み customActions だけを表示します。実行APIは未接続のため、任意 shell 文字列は実行しません。`)
          },
          text: action.label || action.id || 'customAction'
        }))
      }
      box.appendChild(row)
      return box
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

        const checkTargets = Array.isArray(res.checkTargets) ? res.checkTargets.filter(t => t && t.url) : []
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
        const details = renderEnvironmentDetails(res)
        if (details) statusPanel.appendChild(details)

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
        const targetLinksEnabled = (isConfigured && isRunning) || (!isConfigured && checkTargets.length > 0)

        const actionsRow = el('div', { class: 'preview-actions-row' },
          // 起動ボタン
          el('button', {
            type: 'button',
            class: 'hdr-btn primary',
            title: 'docker compose up -d',
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
            text: '▶ 起動'
          }),
          // 停止ボタン
          el('button', {
            type: 'button',
            class: 'hdr-btn warn',
            title: 'docker compose down',
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
            text: '■ 停止'
          }),
          el('button', {
            type: 'button',
            class: 'hdr-btn',
            title: 'docker compose restart',
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
            text: '↻ 再起動'
          }),
          el('button', {
            type: 'button',
            class: 'hdr-btn warn',
            title: 'docker compose build',
            disabled: !isConfigured,
            onclick: async () => {
              const ok = window.confirm('build は Dockerfile、依存関係、ベースイメージを変更したときの明示操作です。\n通常のソース編集や静的WEB確認では、restart またはブラウザ再読込で足りることが多いです。\n\n選択中の環境で docker compose build を実行しますか？')
              if (!ok) return
              try {
                statusPanel.insertBefore(el('div', { class: 'preview-progress-box', text: 'build 要求を送信中です。完了まで時間がかかる場合があります。' }), actionsRow)
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
            text: '📁 フォルダ'
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

        if (checkTargets.length > 0) {
          const targetsBox = el('div', { class: 'preview-targets-box' })
          targetsBox.appendChild(el('div', { class: 'preview-section-title', text: '確認先' }))
          const targetRow = el('div', { class: 'preview-targets-row' })
          for (const target of checkTargets) {
            targetRow.appendChild(el('button', {
              type: 'button',
              class: 'hdr-btn link-btn preview-target-btn',
              disabled: !targetLinksEnabled,
              title: target.url,
              onclick: () => window.open(target.url, '_blank'),
              text: target.label || target.id || target.url
            }))
          }
          targetsBox.appendChild(targetRow)
          statusPanel.appendChild(targetsBox)
        }

        const customActionsBox = renderCustomActions(res)
        if (customActionsBox) statusPanel.appendChild(customActionsBox)

      } catch (e) {
        statusPanel.innerHTML = '<div class="preview-error-box">ステータス取得失敗: ' + (e.error || e.message) + '</div>'
      }
    }

    // 初回ステータス読み込み
    refreshAll()

    // モーダル表示
    await modal({
      title: 'テスト確認（確認環境・試験環境）',
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
            '- issue_manager 画面から操作できるよう、環境ID、表示名、用途、composeFile、checkTargets、必要なら customActions を設定する',
            '- checkTargets にはブラウザで開けるホスト側URLを設定し、0.0.0.0 をURLとして使わない',
            '- 共有 Traefik を使う場合は Host / port / path を明示し、プロジェクト単位で衝突しない名前にする',
            '- 通常の反映、restart、stop/start、build、customActions の違いが分かるようにする',
            '- customActions は許可済みバッチ/固定コマンドだけを登録し、任意 shell 文字列を画面から直接実行させない',
            '- volume削除、prune、down -v などの危険操作を標準ボタン化しない',
            '- 容量管理は Docker Desktop / Docker CLI 側の責務とし、issue_manager には削除操作を追加しない',
            '',
            '## 出力してほしいもの',
            '- 共有標準環境を使うか、プロジェクト固有環境を作るかの判断',
            '- 画面に出す環境名、状態確認先、主 checkTarget',
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
            '- checkTargets は公開してよい localhost / project-id.localhost / 127.0.0.1 などの開発用URLに限定する',
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
            '- 動作確認方法（checkTargets、start/status/restart/build のどれで確認するか）',
          ].join('\n'),
        },
        {
          id: 'diagnose',
          label: '🔍 Docker環境を診断する',
          buildText: async (proj) => {
            let statusInfo = '（ステータス取得中...）'
            let reportPath = `${proj.projectDir}\\_docker\\reports\\docker-verification-report.md`
            try {
              const res = await getEnvStatus(projectId, selectedEnvId)
              const lines = [`ステータス: ${res.status}`]
              const env = res.environment || {}
              const envId = String(env.id || selectedEnvId || 'default').replace(/[^A-Za-z0-9_-]/g, '-')
              reportPath = `${proj.projectDir}\\_docker\\reports\\${envId}-verification-report.md`
              if (res.environment) {
                lines.push('環境:')
                if (env.id) lines.push(`  - ID: ${env.id}`)
                if (env.name) lines.push(`  - 名前: ${env.name}`)
                if (env.purpose) lines.push(`  - 用途: ${env.purpose}`)
                if (env.source) lines.push(`  - source: ${env.source}`)
                if (env.composeFile) lines.push(`  - composeFile: ${env.composeFile}`)
                if (env.traefik && env.traefik.host) {
                  const port = env.traefik.httpPort || env.traefik.port || ''
                  lines.push(`  - Traefik: ${env.traefik.host}${port ? ':' + port : ''}`)
                }
              }
              if (res.containers && res.containers.length) {
                lines.push('コンテナ:')
                for (const c of res.containers) {
                  lines.push(`  - ${c.name}: ${c.state}${c.ports ? ' / ' + c.ports : ''}`)
                }
              }
              if (res.error) lines.push(`エラー: ${res.error}`)
              if (Array.isArray(res.checkTargets) && res.checkTargets.length) {
                lines.push('確認先:')
                for (const target of res.checkTargets) {
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
              lines.push('ログ取得方法:')
              if (env.source === 'not_configured') {
                lines.push('  - Docker未構成環境のため docker compose logs は不要。確認URL、画面表示、アプリ本体ログを確認する。')
              } else if (env.composeFile) {
                lines.push(`  - docker compose -f "${env.composeFile}" logs --tail 200`)
                lines.push(`  - docker compose -f "${env.composeFile}" ps`)
              } else {
                lines.push('  - docker compose logs --tail 200')
                lines.push('  - docker compose ps')
              }
              if (env.source === 'shared') {
                lines.push('  - 共有環境の実体パスは issue_manager config.shared.dockerRoot で解決し、プロジェクトrepoへ書き込まない。')
              }
              lines.push('AI確認用レポート出力先:')
              lines.push(`  - ${reportPath}`)
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
              `ログ、確認URL、実行した確認手順、結果、未解決事項をまとめたレポートを ${reportPath} に作成してください。`,
              'レポートを作成する前に、出力先ディレクトリがプロジェクト配下であることを確認してください。',
              'リフレッシュ操作は、ブラウザ再読込、restart、stop/start、build、customActions のどれが適切かを分けて判断してください。',
              'Docker容量が問題になっている場合は、まず Docker Desktop または `docker system df` / `docker system df -v` で種別別の使用量を確認してください。',
              '削除を提案する前に、停止コンテナ、dangling image、未使用ネットワーク、未使用image、volumeを分けて一覧確認してください。',
              'volume削除、prune、down -v などの危険操作は、ユーザー確認なしに実行しないでください。',
              '`docker system prune --volumes`、`docker volume prune`、`docker compose down -v` はデータ消失リスクがあるため、通常UIの操作や軽い提案として扱わないでください。',
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
        content: `確認URLは環境メタデータの <code>checkTargets</code> から表示します。<code>0.0.0.0</code> はlisten addressであり、ブラウザで開くURLには使いません。<br>
                  レポート再生成などプロジェクト固有の補助処理は <code>customActions</code> として登録された固定バッチ/固定コマンドだけを画面から実行します。<br>
                  volume削除、prune、<code>down -v</code> などの危険操作は標準ボタン化せず、必要時にDocker DesktopまたはCLIで手動判断します。`
      },
      {
        title: '4. 容量診断と安全境界',
        content: `Docker容量の管理主体は Docker Desktop と Docker CLI です。issue_manager は容量削除を代行せず、確認環境の状態表示と安全な案内に留めます。<br>
                  容量が増えた場合は <code>docker system df</code> や <code>docker system df -v</code> で種類別に確認します。画面には削除ボタンを出しません。<br>
                  dangling image、停止コンテナ、未使用ネットワークは低リスクですが、volume削除、<code>volume prune</code>、<code>system prune --volumes</code> はデータ消失リスクがあるため、一覧確認後に手動判断します。`
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
    id: 'test-environment',
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

