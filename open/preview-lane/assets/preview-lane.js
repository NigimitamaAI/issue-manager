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
  async function getEnvStatus(projectId) {
    const r = await fetch('/api/projects/' + encodeURIComponent(projectId) + '/preview-lane/status')
    if (!r.ok) throw await r.json()
    return r.json()
  }

  async function startEnv(projectId) {
    const r = await fetch('/api/projects/' + encodeURIComponent(projectId) + '/preview-lane/start', {
      method: 'POST',
      headers: api.jsonHeaders()
    })
    if (!r.ok) throw await r.json()
    return r.json()
  }

  async function stopEnv(projectId) {
    const r = await fetch('/api/projects/' + encodeURIComponent(projectId) + '/preview-lane/stop', {
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
    const statusPanel = el('div', { class: 'preview-status-panel' })
    const manualPanel = el('div', { class: 'preview-manual-panel' })

    container.appendChild(statusPanel)
    container.appendChild(manualPanel)

    // マニュアル・利用説明書エリアの描画
    renderManual(manualPanel)

    // AIプロンプトコピーパネルの描画（ステータスの次、マニュアルの前）
    const aiPanel = el('div', { class: 'preview-ai-panel' })
    renderAiPromptPanel(aiPanel, projectId)
    container.insertBefore(aiPanel, manualPanel)

    // ステータスを読み込んで表示を更新する関数
    async function updateStatusView() {
      statusPanel.innerHTML = '<div class="preview-loading">ステータス取得中...</div>'
      try {
        const res = await getEnvStatus(projectId)
        statusPanel.innerHTML = ''

        // 1. 基本ステータス表示
        const statusClass = 'status-badge-' + res.status
        const statusLabelMap = {
          'running': '起動中',
          'stopped': '停止中',
          'not_configured': '未構成 (docker-compose.yml なし)',
          'error': 'エラー / Docker未起動'
        }
        const label = statusLabelMap[res.status] || res.status

        const statusRow = el('div', { class: 'preview-status-row' },
          el('span', { class: 'preview-status-label', text: '現在の状態: ' }),
          el('span', { class: 'preview-status-badge ' + statusClass, text: label })
        )
        statusPanel.appendChild(statusRow)

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
                const startRes = await startEnv(projectId)
                toast(startRes.message || '起動要求を送信しました', 'ok')
                // 3秒後に再取得
                setTimeout(updateStatusView, 3000)
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
                const stopRes = await stopEnv(projectId)
                toast(stopRes.message || '停止要求を送信しました', 'ok')
                // 3秒後に再取得
                setTimeout(updateStatusView, 3000)
              } catch (e) {
                toast('停止に失敗しました: ' + (e.error || e.message), 'err')
              }
            },
            text: '■ 停止 (docker compose down)'
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
            disabled: !isRunning,
            onclick: () => {
              // 独自ドメイン (例: project-name.localhost) を開く
              const localUrl = 'http://' + projectId.toLowerCase().replace(/[^a-z0-9-]/g, '-') + '.localhost/'
              window.open(localUrl, '_blank')
            },
            text: '🌐 プレビューを開く'
          }),
          // 手動更新ボタン
          el('button', {
            type: 'button',
            class: 'hdr-btn',
            onclick: updateStatusView,
            text: '↻ 状態更新'
          })
        )
        statusPanel.appendChild(actionsRow)

      } catch (e) {
        statusPanel.innerHTML = '<div class="preview-error-box">ステータス取得失敗: ' + (e.error || e.message) + '</div>'
      }
    }

    // 初回ステータス読み込み
    updateStatusView()

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
          label: '🐳 docker-compose.yml を作成する',
          buildText: (proj) => [
            '# Docker環境セットアップ依頼',
            '',
            `プロジェクト: ${proj.displayName || proj.name}`,
            `パス: ${proj.projectDir}`,
            '',
            '## 依頼内容',
            '以下のプロジェクト用に docker-compose.yml を作成してください。',
            '',
            '## 要件',
            '- ホストのソースコードをコンテナにバインドマウントし、ホットリロードが効くようにする',
            '- コンテナ起動時に依存関係インストール（npm install 等）が自動実行される構成にする',
            '- 共通リバースプロキシ（Traefik）経由で http://<project-name>.localhost でアクセスできるようにする',
            '- .devcontainer/devcontainer.json も合わせて作成する',
            '',
            '## 注意',
            '- docker利用ルール文書: _common/rules/docs/ を参照してください（未整備の場合は一般的なベストプラクティスに従ってください）',
            '- 実行安全性: 外部コマンドはshell文字列で組み立てず、固定コマンドと引数配列で実行してください',
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
              if (res.containers && res.containers.length) {
                for (const c of res.containers) {
                  lines.push(`  - ${c.name}: ${c.state}${c.ports ? ' / ' + c.ports : ''}`)
                }
              }
              if (res.error) lines.push(`エラー: ${res.error}`)
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
              '上記のDocker環境が正常に動作しない原因を調査し、修正手順を教えてください。',
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
        title: '1. ソースコードの即時反映（マウント・ホットリロード）',
        content: `ローカルのソースコードは Docker コンテナ内にバインドマウントされています。<br>
                  Sakura EditorやObsidianなどでソースを直接修正・保存すると、コンテナ内のファイルも即座に更新され、
                  ホットリロード対応のWebアプリであればブラウザ画面やAPIの変更がすぐに反映されます。`
      },
      {
        title: '2. ビルドの運用ルール',
        content: `・<b>確認・テスト時の自動ビルド</b>: プレビューレーンの「起動」ボタンから立ち上げる際、
                  依存関係の解決（<code>npm install</code>等）やビルドはコンテナ起動時に自動で実行されるよう定義されています。<br>
                  ・<b>開発時の手動ビルド</b>: 本番用ビルドなど明示的なビルドは、ホストPC側ではなく、VS Codeの「Dev Containers（開発コンテナ）」内のターミナルで実行してください。`
      },
      {
        title: '3. VS Code クリーン運用の基本ルール（1年後も安定）',
        content: `1. <b>ホストVS Codeのクリーン化</b>: ローカルPCには言語別の拡張機能を入れず、「Dev Containers」拡張機能のみとします。<br>
                  2. <b>.devcontainerによるパッケージ化</b>: 各プロジェクトに必要な拡張機能やLinter設定は、プロジェクト内の <code>.devcontainer/devcontainer.json</code> に定義します。<br>
                  3. <b>起動と自動消去</b>: プロジェクトを開くと専用コンテナ内で必要な拡張機能がロードされ、閉じるとホストには何も残りません。`
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
