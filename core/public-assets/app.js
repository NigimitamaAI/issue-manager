
const api = {
  token: '',
  jsonHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-Issue-Manager-Token': this.token,
    }
  },
  async ping() {
    const r = await fetch('/api/ping'); return r.json()
  },
  async aiStates(name) {
    const r = await fetch('/api/projects/' + encodeURIComponent(name) + '/ai-state')
    if (!r.ok) throw await r.json()
    return r.json()
  },
  async projects() {
    const r = await fetch('/api/projects'); return r.json()
  },
  async commonRules() {
    const r = await fetch('/api/common-rules')
    if (!r.ok) throw await r.json()
    return r.json()
  },
  async appManifests(params = {}) {
    const q = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value) q.set(key, value)
    }
    const r = await fetch('/api/app-manifests' + (q.toString() ? '?' + q.toString() : ''))
    if (!r.ok) throw await r.json()
    return r.json()
  },
  async appManifest(name) {
    const r = await fetch('/api/projects/' + encodeURIComponent(name) + '/app-manifest')
    if (!r.ok) throw await r.json()
    return r.json()
  },
  async importCandidates() {
    const r = await fetch('/api/projects/import-candidates')
    if (!r.ok) throw await r.json()
    return r.json()
  },
  async fsChildren(rootId, path) {
    const q = new URLSearchParams({ rootId, path: path || '' })
    const r = await fetch('/api/fs/children?' + q.toString())
    if (!r.ok) throw await r.json()
    return r.json()
  },
  async addRoot(payload) {
    const r = await fetch('/api/roots', {
      method: 'POST', headers: api.jsonHeaders(),
      body: JSON.stringify(payload)
    })
    if (!r.ok) throw await r.json()
    return r.json()
  },
  async tickets(name) {
    const r = await fetch('/api/projects/' + encodeURIComponent(name) + '/tickets'); return r.json()
  },
  async readTicket(name, lane, file) {
    const r = await fetch('/api/projects/' + encodeURIComponent(name) + '/ticket/' + encodeURIComponent(lane) + '/' + encodeURIComponent(file))
    if (!r.ok) throw await r.json()
    return r.json()
  },
  async writeTicket(name, lane, file, content, expectedMtime) {
    const r = await fetch('/api/projects/' + encodeURIComponent(name) + '/ticket/' + encodeURIComponent(lane) + '/' + encodeURIComponent(file), {
      method: 'PUT', headers: api.jsonHeaders(),
      body: JSON.stringify({ content, expectedMtime })
    })
    if (!r.ok) throw await r.json()
    return r.json()
  },
  async moveTicket(name, fromLane, file, toLane, expectedMtime) {
    const r = await fetch('/api/projects/' + encodeURIComponent(name) + '/ticket/' + encodeURIComponent(fromLane) + '/' + encodeURIComponent(file) + '/move', {
      method: 'POST', headers: api.jsonHeaders(),
      body: JSON.stringify({ toLane, expectedMtime })
    })
    if (!r.ok) throw await r.json()
    return r.json()
  },
  async deleteTicket(name, lane, file, expectedMtime) {
    const r = await fetch('/api/projects/' + encodeURIComponent(name) + '/ticket/' + encodeURIComponent(lane) + '/' + encodeURIComponent(file), {
      method: 'DELETE', headers: api.jsonHeaders(),
      body: JSON.stringify({ expectedMtime })
    })
    if (!r.ok) throw await r.json()
    return r.json()
  },
  async archiveTicket(name, fromLane, file, expectedMtime) {
    const r = await fetch('/api/projects/' + encodeURIComponent(name) + '/ticket/' + encodeURIComponent(fromLane) + '/' + encodeURIComponent(file) + '/archive', {
      method: 'POST', headers: api.jsonHeaders(),
      body: JSON.stringify({ expectedMtime })
    })
    if (!r.ok) throw await r.json()
    return r.json()
  },
  async unarchiveTicket(name, file, expectedMtime) {
    const r = await fetch('/api/projects/' + encodeURIComponent(name) + '/ticket/archive/' + encodeURIComponent(file) + '/unarchive', {
      method: 'POST', headers: api.jsonHeaders(),
      body: JSON.stringify({ expectedMtime })
    })
    if (!r.ok) throw await r.json()
    return r.json()
  },
  async createTicket(name, filename, content, lane) {
    const r = await fetch('/api/projects/' + encodeURIComponent(name) + '/ticket', {
      method: 'POST', headers: api.jsonHeaders(),
      body: JSON.stringify({ filename, content, lane: lane || 'todo' })
    })
    if (!r.ok) throw await r.json()
    return r.json()
  },
  async getMeta(name, kind) {
    const r = await fetch('/api/projects/' + encodeURIComponent(name) + '/meta/' + kind); return r.json()
  },
  async newProject(name, rootId, parentPath) {
    const r = await fetch('/api/projects/new', {
      method: 'POST', headers: api.jsonHeaders(),
      body: JSON.stringify({ name, rootId, parentPath: parentPath || '' })
    })
    if (!r.ok) throw await r.json()
    return r.json()
  },
  async importProject(rootId, path) {
    const r = await fetch('/api/projects/import', {
      method: 'POST', headers: api.jsonHeaders(),
      body: JSON.stringify({ rootId, path: path || '' })
    })
    if (!r.ok) throw await r.json()
    return r.json()
  },
  async migrate(name) {
    const r = await fetch('/api/projects/' + encodeURIComponent(name) + '/migrate', {
      method: 'POST', headers: api.jsonHeaders(),
      body: '{}'
    })
    if (!r.ok) throw await r.json()
    return r.json()
  },
  async unregisterProject(name, mode) {
    const r = await fetch('/api/projects/' + encodeURIComponent(name) + '/unregister', {
      method: 'POST', headers: api.jsonHeaders(),
      body: JSON.stringify({ mode })
    })
    if (!r.ok) throw await r.json()
    return r.json()
  },
  async openExternal(name, payload) {
    const r = await fetch('/api/projects/' + encodeURIComponent(name) + '/open', {
      method: 'POST', headers: api.jsonHeaders(),
      body: JSON.stringify(payload)
    })
    if (!r.ok) throw await r.json()
    return r.json()
  },
  async enterpriseFeatures() {
    const r = await fetch('/api/enterprise/features')
    if (!r.ok) throw await r.json()
    return r.json()
  },
  async assistantPrompts() {
    const r = await fetch('/api/assistant-prompts')
    if (!r.ok) throw await r.json()
    return r.json()
  },
}

const state = {
  projects: [],
  activeProject: null,
  tickets: null,
  activeTicket: null,
  showArchive: false,
  serverInfo: null,
  assistantPrompts: null,
  roots: [],
  activeRootId: null,
}

const enterpriseExtensions = []

const THEME_STORAGE_KEY = 'issue_manager.theme'
const THEMES = [
  { id: 'sumi', label: 'Sumi' },
  { id: 'washi', label: 'Washi' },
  { id: 'mizu', label: 'Mizu' },
  { id: 'matcha', label: 'Matcha' },
]

const LANE_META = {
  inbox: { label: 'inbox', colorName: '入力', badge: '入力' },
  todo: { label: 'todo', colorName: '灰', badge: 'todo' },
  doing: { label: 'doing', colorName: '青', badge: 'doing' },
  review: { label: 'review', colorName: '黄', badge: '確認待ち' },
  blocked: { label: 'blocked', colorName: '赤', badge: 'blocked' },
  done: { label: 'done', colorName: '黒', badge: 'done' },
  archive: { label: 'archive', colorName: '退避', badge: 'archive' },
}

function $(sel) { return document.querySelector(sel) }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)) }
function el(tag, attrs, ...children) {
  const node = document.createElement(tag)
  if (attrs) for (const [k,v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v
    else if (k === 'text') node.textContent = v
    else if (k === 'html') node.innerHTML = v
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v)
    else if (v === true) node.setAttribute(k, '')
    else if (v === false) {}
    else if (v != null) node.setAttribute(k, v)
  }
  for (const c of children) if (c) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c)
  return node
}

function normalizeThemeId(themeId) {
  return THEMES.some(t => t.id === themeId) ? themeId : THEMES[0].id
}

function applyTheme(themeId) {
  const normalized = normalizeThemeId(themeId)
  document.documentElement.dataset.theme = normalized
  localStorage.setItem(THEME_STORAGE_KEY, normalized)
  const select = $('#theme-select')
  if (select && select.value !== normalized) select.value = normalized
}

function setupThemeSelector() {
  const select = $('#theme-select')
  if (!select) return
  select.innerHTML = ''
  for (const theme of THEMES) {
    select.appendChild(el('option', { value: theme.id, text: theme.label }))
  }
  applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || THEMES[0].id)
  select.onchange = () => applyTheme(select.value)
}

let toastTimer = null
function toast(msg, level) {
  const t = $('#toast')
  t.textContent = msg
  t.className = 'show ' + (level || '')
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200)
}

function activeRoot() {
  return (state.roots || []).find(r => r.id === state.activeRootId) || (state.roots || [])[0] || null
}

function setActiveRoot(rootId) {
  const root = (state.roots || []).find(r => r.id === rootId) || (state.roots || [])[0] || null
  state.activeRootId = root ? root.id : null
  if (root) {
    localStorage.setItem('issue_manager.activeRootId', root.id)
    $('#hdr-root').textContent = 'root: ' + (root.label || root.id) + ' / ' + root.path
    $('#hdr-root').title = '選択中プロジェクトルート'
  } else {
    localStorage.removeItem('issue_manager.activeRootId')
    $('#hdr-root').textContent = 'root 未設定'
    $('#hdr-root').title = 'プロジェクトルート未設定'
  }
}

function rootNameFromPath(rawPath) {
  return String(rawPath || '')
    .trim()
    .replace(/^[A-Za-z]:$/, m => m + '/')
    .replace(/\\/g, '/')
    .replace(/[:/]+/g, '_')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function modal({ title, body, actions }) {
  return new Promise(resolve => {
    const bg = $('#modal-bg')
    $('#modal-title').textContent = title || ''
    const bodyEl = $('#modal-body')
    bodyEl.innerHTML = ''
    if (typeof body === 'string') bodyEl.innerHTML = body
    else if (body instanceof Node) bodyEl.appendChild(body)
    const actEl = $('#modal-actions')
    actEl.innerHTML = ''
    let done = false
    const close = (result) => {
      if (done) return
      done = true
      bg.style.display = 'none'
      resolve(result)
    }
    for (const a of actions || []) {
      const btn = el('button', { class: a.class || '' , text: a.label, onclick: () => close(a.value) })
      actEl.appendChild(btn)
    }
    bg.style.display = 'flex'
    const onKey = e => { if (e.key === 'Escape') { close(null); document.removeEventListener('keydown', onKey) } }
    document.addEventListener('keydown', onKey)
  })
}

async function loadEnterpriseExtensions() {
  let res
  try {
    res = await api.enterpriseFeatures()
  } catch (_) {
    return
  }
  for (const feature of res.features || []) {
    if (feature.cssPath) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = feature.cssPath
      document.head.appendChild(link)
    }
    if (!feature.modulePath) continue
    try {
      const mod = await import(feature.modulePath)
      if (typeof mod.registerIssueManagerExtension !== 'function') continue
      const ext = await mod.registerIssueManagerExtension({
        api,
        state,
        el,
        modal,
        toast,
        todayIso,
        todayCompact,
        nowIsoMinute,
        loadTickets,
        loadProjects,
        selectProject,
        selectTicket,
        escapeHtml,
        mount: $('#enterprise-actions'),
        get laneMounts() {
          const laneIds = ['inbox','todo','doing','review','blocked','done','archive']
          const result = {}
          for (const id of laneIds) {
            result[id] = document.querySelector('[data-lane-actions="' + id + '"]')
          }
          return result
        },
      })
      if (ext) {
        enterpriseExtensions.push(ext)
      }
    } catch (e) {
      toast('Enterprise extension failed: ' + (e.error || e.message), 'err')
    }
  }
}

function notifyEnterpriseExtensions(eventName) {
  for (const ext of enterpriseExtensions) {
    const fn = ext && ext['on' + eventName[0].toUpperCase() + eventName.slice(1)]
    if (typeof fn === 'function') {
      try { fn({ state }) } catch (e) { console.error(e) }
    }
  }
}

// 拡張が宣言するレーンバインド部品（laneButtons）を、その時点の DOM に一括で差し込む。
// renderKanban() はレーン DOM（lane-action-bar 含む）を毎回作り直すため、拡張が個別に足し込んだボタンはそのたび消える。
// この関数を renderKanban() の末尾で呼ぶことで、宣言型に部品を提供した拡張は何回再描画されても遺漏なく再差し込みされる。
//
// 拡張側の返却例:
//   return {
//     id: 'preview-lane',
//     laneButtons: [
//       {
//         lane: 'review',                         // 対象レーン名
//         factory: () => ensureButton(),          // ボタン要素を返す関数（同一ノードを返してよい）
//         updateState: (btn) => { ... },         // 毎レンダー後の状態更新（任意）
//       },
//     ],
//   }
function attachExtensionLaneParts() {
  for (const ext of enterpriseExtensions) {
    if (!ext || !Array.isArray(ext.laneButtons)) continue
    for (const decl of ext.laneButtons) {
      if (!decl || !decl.lane) continue
      const bar = document.querySelector('[data-lane-actions="' + decl.lane + '"]')
      if (!bar) continue  // レーンが表示中でない（archive 隠し等）ならスキップ
      let btn = null
      try {
        btn = typeof decl.factory === 'function' ? decl.factory() : null
      } catch (e) {
        console.error('[ext laneButtons] factory error for ' + (ext.id || '?'), e)
      }
      if (btn && !bar.contains(btn)) bar.appendChild(btn)
      if (btn && typeof decl.updateState === 'function') {
        try { decl.updateState(btn) } catch (e) {
          console.error('[ext laneButtons] updateState error for ' + (ext.id || '?'), e)
        }
      }
    }
  }
}

async function init() {
  setupThemeSelector()
  try {
    const ping = await api.ping()
    api.token = ping.apiToken || ''
    state.serverInfo = ping
    $('#hdr-version').textContent = 'v' + ping.version
    $('#hdr-root').textContent = ping.root
  } catch (e) {
    toast('サーバー接続失敗: ' + e.message, 'err')
    return
  }
  try {
    state.assistantPrompts = await api.assistantPrompts()
  } catch (_) {
    state.assistantPrompts = null
  }
  await loadEnterpriseExtensions()
  await loadProjects()

  $('#btn-reload').onclick = () => loadProjects()
  $('#btn-root-manager').onclick = rootManagerDialog
  $('#btn-new-project').onclick = newProjectDialog
  $('#btn-next-action').onclick = suggestNextAction
  $('#btn-resume-prompt').onclick = copyResumePromptForProject
  $('#btn-toggle-archive').onclick = toggleArchive
  $('#btn-project-info').onclick = () => showProjectInfo(state.activeProject)
  $('#btn-unregister-project').onclick = unregisterProjectDialog
  $('#btn-export').onclick = exportDialog
  $('#btn-open-index').onclick = () => openMeta('INDEX.md')
  $('#btn-open-rules').onclick = () => openMeta('RULES.md')
  $('#btn-new-ticket').onclick = newTicketDialog
  $('#btn-migrate').onclick = migrateDialog
  $('#btn-detail-open').onclick = openActiveTicketInEditor
  $('#btn-detail-reload').onclick = reloadActiveTicket
  $('#btn-detail-link').onclick = copyDeepLinkForActiveTicket
  $('#btn-detail-resume').onclick = copyResumePromptForActiveTicket
  $('#btn-detail-prompts').onclick = assistantPromptDialogForActiveTicket
  $('#btn-detail-archive').onclick = archiveActiveTicket
  $('#btn-detail-unarchive').onclick = unarchiveActiveTicket
  $('#btn-detail-delete').onclick = deleteActiveTicket
  document.querySelectorAll('#detail-move button').forEach(b => {
    b.onclick = () => moveActiveTicket(b.dataset.lane)
  })
  setupDetailToolbar()
  await applyDeepLinkFromUrl()
  window.addEventListener('hashchange', () => {
    const section = sectionFromHash()
    if (section && state.activeTicket) scrollToDetailSection(section)
  })
}

async function loadProjects() {
  try {
    const { projects, root, roots } = await api.projects()
    state.projects = projects
    state.roots = roots || []
    const savedRootId = localStorage.getItem('issue_manager.activeRootId')
    setActiveRoot(state.activeRootId || savedRootId || (state.roots[0] && state.roots[0].id) || null)
    const ul = $('#project-list')
    ul.innerHTML = ''
    for (const p of projects) {
      const projectId = p.id || p.name
      const li = el('li', { 'data-id': projectId, onclick: () => selectProject(projectId) })
      const name = el('span', { class: 'proj-name', text: p.projectName || p.name })
      if (p.layout === 'legacy') name.appendChild(el('span', { class: 'badge-legacy', text: 'legacy' }))
      else if (!p.schemaOk) name.appendChild(el('span', { class: 'badge-schema-ng', text: '?' }))
      li.appendChild(name)
      li.appendChild(el('span', { class: 'proj-meta', text: (p.rootLabel ? p.rootLabel + ' / ' : '') + p.name }))
      if (state.activeProject === projectId) li.classList.add('active')
      ul.appendChild(li)
    }
    if (state.activeProject) {
      await loadTickets(state.activeProject)
      notifyEnterpriseExtensions('projectSelected')
    }
  } catch (e) {
    toast('プロジェクト読み込み失敗: ' + (e.error || e.message), 'err')
  }
}

async function selectProject(name) {
  state.activeProject = name
  state.activeTicket = null
  document.querySelectorAll('#project-list li').forEach(li => {
    li.classList.toggle('active', li.dataset.id === name)
  })
  const proj = state.projects.find(p => (p.id || p.name) === name)
  const title = proj.projectName || name
  $('#kanban-title').textContent = title + (proj.layout === 'legacy' ? '（旧構造）' : '')
  $('#btn-open-index').disabled = false
  $('#btn-open-rules').disabled = false
  $('#btn-new-ticket').disabled = false
  $('#btn-next-action').disabled = false
  $('#btn-resume-prompt').disabled = false
  $('#btn-toggle-archive').disabled = false
  $('#btn-project-info').disabled = false
  $('#btn-unregister-project').disabled = false
  $('#btn-export').disabled = false
  $('#btn-migrate').style.display = proj.layout === 'legacy' ? '' : 'none'
  await loadTickets(name)
  notifyEnterpriseExtensions('projectSelected')
}

async function rootManagerDialog() {
  let selectedRootId = state.activeRootId || ((state.roots || [])[0] && state.roots[0].id) || null
  const list = el('div', { class: 'root-manager-list' })
  function renderRootList() {
    list.innerHTML = ''
    for (const r of state.roots || []) {
      list.appendChild(el('button', {
        type: 'button',
        class: 'root-manager-row' + (r.id === selectedRootId ? ' active' : ''),
        onclick: () => {
          selectedRootId = r.id
          renderRootList()
        },
      },
        el('div', { class: 'root-manager-head', text: (r.label || r.id) + ' (' + r.id + ')' }),
        el('code', { text: r.path }),
        el('div', { class: 'root-manager-meta', text: 'type: ' + (r.type || 'local') }),
        r.safety && r.safety.level !== 'ok'
          ? el('div', { class: 'root-safety ' + r.safety.level, text: r.safety.message || r.safety.code })
          : null
      ))
    }
  }
  const pathInput = el('input', { id: 'root-add-path', placeholder: '例: D:/games' })
  const labelInput = el('input', { id: 'root-add-label', placeholder: '表示名 例: D games' })
  const idInput = el('input', { id: 'root-add-id', placeholder: 'ID 任意 例: games' })
  let labelEdited = false
  let idEdited = false
  labelInput.addEventListener('input', () => { labelEdited = true })
  idInput.addEventListener('input', () => { idEdited = true })
  pathInput.addEventListener('input', () => {
    const name = rootNameFromPath(pathInput.value)
    if (!name) return
    if (!labelEdited || !labelInput.value.trim()) labelInput.value = name
    if (!idEdited || !idInput.value.trim()) idInput.value = name
  })
  const body = el('div', {},
    el('p', { class: 'root-manager-note', text: 'プロジェクトを探す親フォルダ(root)を先に登録します。プロジェクト追加は、登録済み root の内側だけを対象にします。' }),
    el('label', { text: '登録済み root' }),
    list,
    el('label', { text: '追加する root の絶対パス' }),
    pathInput,
    el('label', { text: '表示名' }),
    labelInput,
    el('label', { text: 'ID' }),
    idInput
  )
  renderRootList()
  const ok = await modal({
    title: 'プロジェクトルート管理',
    body,
    actions: [
      { label: '閉じる', value: null },
      { label: '選択して閉じる', value: 'select' },
      { label: 'この root にプロジェクト追加', value: 'project', class: 'primary' },
      { label: 'root を追加', value: 'add', class: 'primary' },
    ],
  })
  if (!ok) return
  if (ok === 'select' || ok === 'project') {
    setActiveRoot(selectedRootId)
    if (ok === 'project') await newProjectDialog()
    return
  }
  const rootPath = pathInput.value.trim()
  if (!rootPath) return
  try {
    const res = await api.addRoot({
      path: rootPath,
      label: labelInput.value.trim(),
      id: idInput.value.trim(),
    })
    toast('root を追加しました: ' + (res.root.label || res.root.id), 'ok')
    await loadProjects()
    setActiveRoot(res.root.id)
    await rootManagerDialog()
  } catch (e) {
    toast('root 追加失敗: ' + (e.error || e.message), 'err')
  }
}

async function loadTickets(name) {
  try {
    const { tickets } = await api.tickets(name)
    state.tickets = tickets
    renderKanban()
  } catch (e) {
    toast('チケット一覧取得失敗: ' + (e.error || e.message), 'err')
  }
}

function laneMeta(lane) {
  return LANE_META[lane] || { label: lane, colorName: lane, badge: lane }
}

function renderKanban() {
  const kanban = $('#kanban')
  kanban.innerHTML = ''
  kanban.classList.toggle('show-archive', state.showArchive)
  const lanes = state.showArchive
    ? ['inbox','todo','doing','review','blocked','done','archive']
    : ['inbox','todo','doing','review','blocked','done']
  for (const lane of lanes) {
    const items = state.tickets[lane] || []
    const laneEl = el('div', { class: 'lane' + (lane === 'archive' ? ' archive-lane' : ''), 'data-lane': lane })
    const meta = laneMeta(lane)
    laneEl.appendChild(el('div', { class: 'lane-head' },
      el('span', { class: 'lane-title', title: meta.colorName, text: meta.label }),
      el('span', { class: 'count', text: String(items.length) })
    ))
    const actionBar = el('div', { class: 'lane-action-bar', 'data-lane-actions': lane })
    laneEl.appendChild(actionBar)
    const body = el('div', { class: 'lane-body' })
    for (const t of items) {
      const card = el('div', {
        class: 'card' + (state.activeTicket && state.activeTicket.lane === lane && state.activeTicket.file === t.file ? ' active' : '') + ((t.status || '').toLowerCase() === 'pending' ? ' card-pending' : ''),
        draggable: lane === 'archive' ? 'false' : 'true',
        'data-lane': lane,
        'data-file': t.file,
        onclick: () => selectTicket(lane, t.file),
      })
      card.appendChild(el('div', { class: 'card-title', text: t.title }))
      const badges = []
      if ((t.status || '').toLowerCase() === 'pending') {
        badges.push({ cls: 'badge-pending', text: '保留' })
      } else if (lane === 'doing') {
        const s = (t.status || '').toLowerCase()
        if (s === '進行中' || s === 'active' || s === 'in_progress') {
          badges.push({ cls: 'badge-progress', text: '進行中' })
        } else if (s === '中断' || s === '中断中' || s === 'paused' || s === 'suspended') {
          badges.push({ cls: 'badge-paused', text: '中断' })
        } else if (t.status && s !== 'doing') {
          badges.push({ cls: 'badge-other', text: t.status })
        }
      } else if (lane === 'review') {
        badges.push({ cls: 'badge-lane', text: '確認待ち', lane })
      }
      if (!badges.some(b => b.cls === 'badge-lane') && lane !== 'archive') {
        badges.unshift({ cls: 'badge-lane', text: meta.badge, lane })
      }
      if (lane === 'archive' && t.archivedFrom) {
        badges.push({ cls: 'badge-archive-from', text: '元: ' + t.archivedFrom })
      }
      if (badges.length > 0) {
        const bWrap = el('div', { class: 'card-badges' })
        for (const b of badges) {
          bWrap.appendChild(el('span', {
            class: 'badge ' + b.cls,
            'data-lane': b.lane || null,
            text: b.text,
          }))
        }
        card.appendChild(bWrap)
      }
      card.appendChild(el('div', { class: 'card-meta', text: t.file }))
      if (lane !== 'archive') {
        card.addEventListener('dragstart', e => {
          e.dataTransfer.setData('application/json', JSON.stringify({ lane, file: t.file }))
          card.classList.add('dragging')
        })
        card.addEventListener('dragend', () => card.classList.remove('dragging'))
      }
      body.appendChild(card)
    }
    if (lane !== 'archive') {
      laneEl.addEventListener('dragover', e => {
        e.preventDefault()
        laneEl.classList.add('drag-over')
      })
      laneEl.addEventListener('dragleave', () => laneEl.classList.remove('drag-over'))
      laneEl.addEventListener('drop', async e => {
        e.preventDefault()
        laneEl.classList.remove('drag-over')
        const data = JSON.parse(e.dataTransfer.getData('application/json') || 'null')
        if (!data || data.lane === lane) return
        await doMove(data.lane, data.file, lane)
      })
    }
    laneEl.appendChild(body)
    kanban.appendChild(laneEl)
  }
  // 拡張が宣言したレーンバインド部品を一括再差し込み。レーン DOM を作り直した後だけ呼べばよい。
  attachExtensionLaneParts()
}

async function selectTicket(lane, file, opts = {}) {
  try {
    const data = await api.readTicket(state.activeProject, lane, file)
    let archivedFrom = null
    const ma = (data.content || '').match(/^\s*-\s*archive元\s*:\s*(\S+)/m)
    if (ma) archivedFrom = ma[1].trim()
    state.activeTicket = { lane, file, content: data.content, mtime: data.mtime, path: data.path, archivedFrom }
    renderKanban()
    renderDetail()
    if (opts.updateUrl !== false) updateTicketUrl(opts.section || null)
    if (opts.section) setTimeout(() => scrollToDetailSection(opts.section), 0)
  } catch (e) {
    toast('読み込み失敗: ' + (e.error || e.message), 'err')
  }
}

function renderDetail() {
  const t = state.activeTicket
  if (!t) {
    $('#detail-empty').style.display = 'flex'
    $('#detail-content').style.display = 'none'
    return
  }
  $('#detail-empty').style.display = 'none'
  $('#detail-content').style.display = 'flex'
  $('#detail-path').textContent = t.path
  const isArchive = t.lane === 'archive'
  $('#btn-detail-archive').style.display = isArchive ? 'none' : ''
  $('#btn-detail-unarchive').style.display = isArchive ? '' : 'none'
  $('#btn-detail-unarchive').textContent = isArchive && t.archivedFrom
    ? '← ' + t.archivedFrom + ' に戻す'
    : '← 元のレーンに戻す'
  $('#detail-move').style.display = isArchive ? 'none' : ''
  document.querySelectorAll('#detail-move button').forEach(b => {
    b.classList.toggle('current', b.dataset.lane === t.lane)
  })
  // ツールバーは archive 表示中は隠す (編集不可のため)
  const tb = $('#detail-toolbar')
  if (tb) tb.classList.toggle('is-archive', isArchive)
  const html = window.marked ? window.marked.parse(t.content) : t.content.replace(/</g, '&lt;')
  $('#detail-body').innerHTML = html
  annotateDetailHeadings()
  notifyEnterpriseExtensions('ticketSelected')
}

function normalizeSectionName(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function sectionIdFromText(text) {
  const normalized = normalizeSectionName(text)
  if (!normalized) return 'section'
  return 'section-' + encodeURIComponent(normalized)
    .replace(/%/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function annotateDetailHeadings() {
  const body = $('#detail-body')
  if (!body) return
  const used = new Map()
  for (const h of $all('h1,h2,h3,h4,h5,h6', body)) {
    const section = normalizeSectionName(h.textContent)
    if (!section) continue
    let id = sectionIdFromText(section)
    const count = used.get(id) || 0
    used.set(id, count + 1)
    if (count) id += '-' + (count + 1)
    h.id = id
    h.dataset.section = section
    h.classList.add('detail-heading-anchor')
    const anchor = el('button', {
      type: 'button',
      class: 'section-link-button',
      title: 'このセクションへのリンクをコピー',
      onclick: async e => {
        e.preventDefault()
        e.stopPropagation()
        await copyDeepLinkForActiveTicket(section)
      },
      text: '🔗',
    })
    h.appendChild(anchor)
  }
}

function sectionFromHash() {
  const raw = decodeURIComponent((location.hash || '').replace(/^#/, ''))
  if (!raw) return ''
  if (raw === 'review') return 'レビュー欄'
  if (raw === 'check-items') return 'チェック項目'
  if (raw.startsWith('section=')) return raw.slice('section='.length).trim()
  return raw.trim()
}

function findHeadingForSection(section) {
  const wanted = normalizeSectionName(section)
  if (!wanted) return null
  return $all('#detail-body h1,#detail-body h2,#detail-body h3,#detail-body h4,#detail-body h5,#detail-body h6')
    .find(h => normalizeSectionName(h.dataset.section || h.textContent.replace('🔗', '')) === wanted) || null
}

function scrollToDetailSection(section) {
  const heading = findHeadingForSection(section)
  if (!heading) {
    toast('セクションが見つかりません: ' + section, 'err')
    return
  }
  heading.scrollIntoView({ block: 'start', behavior: 'smooth' })
  heading.classList.add('section-highlight')
  setTimeout(() => heading.classList.remove('section-highlight'), 1800)
}

function currentVisibleSection() {
  const body = $('#detail-body')
  if (!body) return ''
  const headings = $all('h1,h2,h3,h4,h5,h6', body)
  if (!headings.length) return ''
  const top = body.getBoundingClientRect().top + 8
  let current = headings[0]
  for (const h of headings) {
    if (h.getBoundingClientRect().top <= top) current = h
    else break
  }
  return normalizeSectionName(current.dataset.section || current.textContent.replace('🔗', ''))
}

function updateTicketUrl(section) {
  const t = state.activeTicket
  if (!t || !state.activeProject) return
  const url = new URL(location.href)
  url.searchParams.set('project', state.activeProject)
  url.searchParams.set('lane', t.lane)
  url.searchParams.set('ticket', t.file)
  url.hash = section ? 'section=' + encodeURIComponent(section) : ''
  history.replaceState(null, '', url)
}

async function copyDeepLinkForActiveTicket(section = null) {
  const t = state.activeTicket
  if (!t) return
  const targetSection = section || currentVisibleSection()
  const url = new URL(location.href)
  url.searchParams.set('project', state.activeProject)
  url.searchParams.set('lane', t.lane)
  url.searchParams.set('ticket', t.file)
  url.hash = targetSection ? 'section=' + encodeURIComponent(targetSection) : ''
  const ok = await copyToClipboard(url.toString())
  if (ok) toast(targetSection ? 'セクションリンクをコピーしました' : 'チケットリンクをコピーしました', 'ok')
  else {
    await modal({
      title: '手動でコピーしてください',
      body: '<textarea readonly style="width:100%;height:120px;font-size:11px;font-family:monospace">' + escapeHtml(url.toString()) + '</textarea>',
      actions: [{ label: '閉じる', value: null }],
    })
  }
}

function findTicketLane(file) {
  if (!file || !state.tickets) return ''
  for (const lane of ['inbox','todo','doing','review','blocked','done','archive']) {
    if ((state.tickets[lane] || []).some(t => t.file === file)) return lane
  }
  return ''
}

async function applyDeepLinkFromUrl() {
  const params = new URLSearchParams(location.search)
  const projectId = params.get('project')
  const ticket = params.get('ticket')
  if (!projectId || !ticket) return
  if (!state.projects.some(p => (p.id || p.name) === projectId)) return
  await selectProject(projectId)
  const lane = params.get('lane') || findTicketLane(ticket)
  if (!lane) return
  await selectTicket(lane, ticket, { section: sectionFromHash(), updateUrl: false })
}

async function reloadActiveTicket() {
  const t = state.activeTicket
  if (!t) return
  await selectTicket(t.lane, t.file)
  toast('再読み込みしました', 'ok')
}

async function openActiveTicketInEditor() {
  const t = state.activeTicket
  if (!t) return
  try {
    await api.openExternal(state.activeProject, { lane: t.lane, file: t.file })
    toast('エディタで開きました', 'ok')
  } catch (e) {
    toast('エディタ起動失敗: ' + (e.error || e.message), 'err')
  }
}

async function deleteActiveTicket() {
  const t = state.activeTicket
  if (!t) return
  const ok = await modal({
    title: 'チケットを削除',
    body: '<p>以下のチケットを <code>.trash/</code> へ移動します。</p><p><code>' + escapeHtml(t.file) + '</code></p>',
    actions: [
      { label: 'キャンセル', value: null },
      { label: '削除', value: true, class: 'danger' },
    ],
  })
  if (!ok) return
  try {
    await api.deleteTicket(state.activeProject, t.lane, t.file, t.mtime)
    toast('削除しました', 'ok')
    state.activeTicket = null
    renderDetail()
    await loadTickets(state.activeProject)
  } catch (e) {
    toast('削除失敗: ' + (e.error || e.message), 'err')
  }
}

async function moveActiveTicket(toLane) {
  const t = state.activeTicket
  if (!t || t.lane === toLane) return
  await doMove(t.lane, t.file, toLane)
}

async function doMove(fromLane, file, toLane) {
  try {
    const current = await api.readTicket(state.activeProject, fromLane, file)
    const res = await api.moveTicket(state.activeProject, fromLane, file, toLane, current.mtime)
    toast('移動しました: ' + toLane, 'ok')
    if (state.activeTicket && state.activeTicket.file === file) {
      state.activeTicket.lane = res.newLane
      state.activeTicket.file = res.newFile
      state.activeTicket.mtime = res.mtime
    }
    await loadTickets(state.activeProject)
    if (state.activeTicket) {
      await selectTicket(state.activeTicket.lane, state.activeTicket.file)
    }
  } catch (e) {
    toast('移動失敗: ' + (e.error || e.message), 'err')
  }
}

async function newProjectDialog() {
  const roots = state.roots || []
  if (!roots.length) {
    toast('root が設定されていません', 'err')
    await rootManagerDialog()
    return
  }
  const root = activeRoot()
  if (!root) {
    await rootManagerDialog()
    return
  }
  const browserState = {
    rootId: root.id,
    path: '',
    selected: '',
    selectedManaged: false,
  }
  const rootSelect = el('select', { id: 'project-add-root' },
    ...roots.map(r => el('option', {
      value: r.id,
      text: (r.label || r.id) + ' - ' + r.path,
      selected: r.id === root.id,
    }))
  )
  const rootPathEl = el('code', { class: 'root-path', text: root.path })
  const rootSummary = el('div', { class: 'selected-root-summary' },
    el('label', { text: 'プロジェクトルートを選択' }),
    rootSelect,
    rootPathEl,
    el('div', { class: 'root-manager-meta', text: 'root の追加はヘッダーの「ルート管理」から行います。ここでは登録済み root だけを選択します。' })
  )
  const pathEl = el('div', { class: 'folder-path' })
  const selectedEl = el('div', { class: 'folder-selected', text: '選択中: なし' })
  const filterInput = el('input', { class: 'folder-filter', placeholder: 'フォルダ名で絞り込み' })
  const entriesEl = el('div', { class: 'folder-entries' }, el('div', { class: 'folder-empty', text: '読み込み中...' }))
  const nameInput = el('input', { id: 'new-proj-name', placeholder: '例: my_project' })
  const form = el('div', {},
    rootSummary,
    el('div', { class: 'folder-browser single-root' },
      el('div', { class: 'folder-main' },
        pathEl,
        selectedEl,
        filterInput,
        entriesEl
      )
    ),
    el('label', { text: '選択中フォルダの配下に新規作成' }),
    nameInput,
    el('div', { class: 'folder-help', text: '既存フォルダ導入は選択中フォルダ自体を対象にします。新規作成は選択中フォルダを親にします。' })
  )

  function selectedRoot() {
    return roots.find(r => r.id === browserState.rootId) || root
  }

  function updateSelected(pathValue) {
    browserState.selected = pathValue || ''
    selectedEl.textContent = '選択中: ' + (browserState.selected || 'なし')
    entriesEl.querySelectorAll('.folder-entry').forEach(row => {
      row.classList.toggle('selected', row.dataset.path === browserState.selected)
    })
  }

  rootSelect.addEventListener('change', () => {
    browserState.rootId = rootSelect.value
    browserState.path = ''
    browserState.selected = ''
    filterInput.value = ''
    const r = selectedRoot()
    rootPathEl.textContent = r.path
    setActiveRoot(r.id)
    loadFolder()
  })

  async function loadFolder(pathValue) {
    if (pathValue != null) browserState.path = pathValue
    browserState.selected = browserState.path
    entriesEl.innerHTML = ''
    entriesEl.appendChild(el('div', { class: 'folder-empty', text: '読み込み中...' }))
    try {
      const data = await api.fsChildren(browserState.rootId, browserState.path)
      browserState.path = data.path || ''
      browserState.selected = browserState.path
      browserState.selectedManaged = !!data.managed
      const root = selectedRoot()
      pathEl.textContent = (root.label || root.id) + ': ' + root.path + (browserState.path ? '\\' + browserState.path.replace(/\//g, '\\') : '')
      entriesEl.innerHTML = ''
      const filter = filterInput.value.trim().toLowerCase()
      const visibleEntries = filter
        ? data.entries.filter(item => item.name.toLowerCase().includes(filter))
        : data.entries
      if (data.parentPath != null) {
        entriesEl.appendChild(el('button', { type: 'button', class: 'folder-entry up', onclick: () => loadFolder(data.parentPath) }, '上へ戻る'))
      }
      if (!visibleEntries.length) {
        entriesEl.appendChild(el('div', { class: 'folder-empty', text: data.entries.length ? '一致するフォルダはありません' : '子フォルダはありません' }))
      }
      for (const item of visibleEntries) {
        entriesEl.appendChild(el('button', {
          type: 'button',
          class: 'folder-entry' + (item.managed ? ' managed' : '') + (item.path === browserState.selected ? ' selected' : ''),
          'data-path': item.path,
          title: 'クリックで選択、ダブルクリックで開く',
          onclick: () => updateSelected(item.path),
          ondblclick: () => loadFolder(item.path),
        }, el('span', { text: item.name }), el('span', { class: 'folder-badge', text: item.managed ? '管理中' : (item.hasTickets ? 'ticketsあり' : 'ダブルクリックで開く') })))
      }
      updateSelected(browserState.selected)
    } catch (e) {
      entriesEl.innerHTML = ''
      entriesEl.appendChild(el('div', { class: 'folder-empty err', text: e.error || e.message || '読み込み失敗' }))
    }
  }

  filterInput.addEventListener('input', () => loadFolder())
  loadFolder()
  const choice = await modal({
    title: 'プロジェクト追加',
    body: form,
    actions: [
      { label: 'キャンセル', value: null },
      { label: '既存フォルダを導入', value: 'import' },
      { label: '新規作成', value: 'create', class: 'primary' },
    ],
  })
  if (!choice) return
  try {
    let res
    if (choice === 'import') {
      if (!browserState.selected) {
        toast('root 自体は導入できません。root 内のフォルダを選択してください。', 'err')
        return
      }
      if (browserState.selectedManaged) {
        toast('選択フォルダは既に管理対象です', 'err')
        return
      }
      res = await api.importProject(browserState.rootId, browserState.selected)
      toast('既存フォルダを導入しました: ' + (browserState.selected || selectedRoot().label), 'ok')
    } else {
      const name = form.querySelector('#new-proj-name').value.trim()
      if (!name) return
      res = await api.newProject(name, browserState.rootId, browserState.selected)
      toast('プロジェクトを作成しました: ' + name, 'ok')
    }
    await loadProjects()
    await selectProject(res.id)
    await showProjectInfo(res.id)
  } catch (e) {
    toast('プロジェクト追加失敗: ' + (e.error || e.message), 'err')
  }
}

async function showProjectInfo(projectId) {
  if (!projectId) return
  const p = state.projects.find(x => (x.id || x.name) === projectId)
  if (!p) {
    toast('プロジェクト情報が見つかりません', 'err')
    return
  }
  const rows = [
    ['表示名', p.projectName || p.displayName || p.name],
    ['Project ID', p.id || p.name],
    ['root', (p.rootLabel || p.rootId || '') + (p.rootPath ? ' / ' + p.rootPath : '')],
    ['プロジェクト相対名', p.name],
    ['プロジェクトパス', p.projectDir || ''],
    ['tickets パス', p.ticketsDir || ''],
    ['INDEX.md', p.indexPath || ''],
    ['RULES.md', p.rulesPath || ''],
    ['構造', p.layout === 'legacy' ? 'legacy' : 'new'],
    ['schema', p.schemaOk ? 'OK' : '未確認 / 旧形式'],
  ]
  if (p.appManifest) {
    rows.push(
      ['アプリ識別', p.appManifest.ok ? 'OK' : '要確認'],
      ['アプリID', p.appManifest.appId || ''],
      ['仲間ID', p.appManifest.familyId || ''],
      ['役割', p.appManifest.role || ''],
      ['環境', p.appManifest.environment || ''],
      ['バージョン', p.appManifest.version || ''],
      ['機能', (p.appManifest.capabilityNames || []).join(', ')],
      ['manifest', p.appManifest.path || '']
    )
    if (!p.appManifest.ok && p.appManifest.errors && p.appManifest.errors.length) {
      rows.push(['manifestエラー', p.appManifest.errors.join('; ')])
    }
  }
  if (p.commonRules && p.commonRules.exists) {
    rows.push(
      ['共通ルール', p.commonRules.rulesPath || ''],
      ['共通docs', (p.commonRules.docs || []).join('\n')]
    )
  }
  const body = el('div', { class: 'project-info' },
    ...rows.map(([k, v]) => el('div', { class: 'project-info-row' },
      el('div', { class: 'project-info-key', text: k }),
      el('code', { class: 'project-info-val', text: String(v || '-') })
    ))
  )
  await modal({
    title: 'プロジェクト情報',
    body,
    actions: [{ label: '閉じる', value: null }],
  })
}

async function unregisterProjectDialog() {
  if (!state.activeProject) return
  const p = state.projects.find(x => (x.id || x.name) === state.activeProject)
  if (!p) return
  const body = el('div', { class: 'unregister-dialog' },
    el('p', {}, 'このプロジェクトを issue_manager の一覧から外します。'),
    el('div', { class: 'project-info-row' },
      el('div', { class: 'project-info-key', text: 'Project ID' }),
      el('code', { class: 'project-info-val', text: p.id || p.name })
    ),
    el('div', { class: 'project-info-row' },
      el('div', { class: 'project-info-key', text: 'tickets' }),
      el('code', { class: 'project-info-val', text: p.ticketsDir || '' })
    ),
    el('p', { class: 'folder-help', text: '「チケットを残して解除」は tickets/ をそのまま残し、.issuemgr/unregistered.json で検出対象から外します。' }),
    el('p', { class: 'folder-help', text: '「圧縮コピーして解除」は tickets/ の tar.gz コピーも .issuemgr/unregistered/ に作ります。元の tickets/ は削除しません。' })
  )
  const mode = await modal({
    title: 'プロジェクト登録解除',
    body,
    actions: [
      { label: 'キャンセル', value: null },
      { label: 'チケットを残して解除', value: 'keep', class: 'primary' },
      { label: '圧縮コピーして解除', value: 'pack', class: 'warn' },
    ],
  })
  if (!mode) return
  try {
    const res = await api.unregisterProject(state.activeProject, mode)
    toast(mode === 'pack' ? '圧縮コピーして登録解除しました' : '登録解除しました', 'ok')
    state.activeProject = null
    state.activeTicket = null
    await loadProjects()
    renderDetail()
    $('#kanban-title').textContent = 'プロジェクトを選択してください'
    $('#kanban').innerHTML = ''
    await modal({
      title: '登録解除完了',
      body: '<p>プロジェクト一覧から外しました。</p>' +
        '<p><code>' + escapeHtml(res.projectId || '') + '</code></p>' +
        (res.archivePath ? '<p>圧縮コピー: <code>' + escapeHtml(res.archivePath) + '</code></p>' : ''),
      actions: [{ label: '閉じる', value: null }],
    })
  } catch (e) {
    toast('登録解除失敗: ' + (e.error || e.message), 'err')
  }
}

// テキストエリアのカーソル位置に文字列を挿入するヘルパ。
// 挿入後のカーソル位置は「挿入した文字列の末尾」に移動させる。
// 選択中のテキストがあればそこを置換。textarea をフォーカス状態にして終わる。
function insertAtCursor(textarea, text) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const before = textarea.value.slice(0, start)
  const after = textarea.value.slice(end)
  textarea.value = before + text + after
  const newPos = start + text.length
  textarea.focus()
  textarea.setSelectionRange(newPos, newPos)
}

// 現在行の行頭にカーソルを移動してからテキストを挿入。
// 「チェック行」など、行頭から始まるブロックを挿入したい時に使う。
function insertAtLineStart(textarea, text) {
  const pos = textarea.selectionStart
  const before = textarea.value.slice(0, pos)
  const after = textarea.value.slice(pos)
  // before の末尾にある改行を探して、そこから後を「現在行の頭」とする
  const lastNl = before.lastIndexOf('\n')
  const lineStart = lastNl < 0 ? 0 : lastNl + 1
  const linePrefix = before.slice(0, lineStart)
  const lineCurrent = before.slice(lineStart)
  textarea.value = linePrefix + text + lineCurrent + after
  const newPos = lineStart + text.length + lineCurrent.length
  textarea.focus()
  textarea.setSelectionRange(newPos, newPos)
}

// 今日の日付を YYYY-MM-DD で返す
function todayIso() {
  return new Date().toISOString().slice(0, 10)
}
// 今日の日付を YYYYMMDD で返す (ID 生成用)
function todayCompact() {
  return todayIso().replace(/-/g, '')
}
// 現在時刻を YYYY-MM-DD HH:MM で返す (ローカルタイム)
function nowIsoMinute() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) +
         ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

async function newTicketDialog() {
  if (!state.activeProject) return
  let tplContent = ''
  try {
    const tpl = await api.getMeta(state.activeProject, 'template')
    tplContent = tpl.content || ''
  } catch (_) {}

  // ツールバー DOM を作る。ボタンの onclick はテキストエリアを後で参照するため、
  // form 生成後に querySelector で取り出してバインドする。
  const toolbar = el('div', { class: 'ticket-toolbar' },
    el('button', { type: 'button', 'data-act': 'today', text: '📅 今日', title: 'カーソル位置に今日の日付 (YYYY-MM-DD) を挿入' }),
    el('button', { type: 'button', 'data-act': 'now', text: '🕐 現在時刻', title: 'カーソル位置に現在時刻 (YYYY-MM-DD HH:MM) を挿入' }),
    el('button', { type: 'button', 'data-act': 'id', text: '🆔 ID 生成', title: '優先度と工程を指定してチケット ID を生成' }),
    el('button', { type: 'button', 'data-act': 'tpl', text: '📋 テンプレ再挿入', title: 'TICKET_TEMPLATE.md の内容をカーソル位置に挿入' }),
    el('button', { type: 'button', 'data-act': 'check', text: '✓ チェック行', title: '現在行の頭に - [ ] を挿入' }),
    el('button', { type: 'button', 'data-act': 'log', text: '⏱ ログ行', title: '作業ログ用の「YYYY-MM-DD (Claude セッション): 」を挿入' }),
    el('button', { type: 'button', 'data-act': 'hr', text: '─── 区切り', title: '区切り線 --- を挿入' })
  )

  // ID 生成用のインライン展開パネル (初期状態は隠し)
  const idPanel = el('div', { class: 'toolbar-inline-panel' },
    el('div', { class: 'row' },
      el('label', { text: '優先度' }),
      el('button', { type: 'button', class: 'pri-btn active', 'data-pri': 'P0', text: 'P0' }),
      el('button', { type: 'button', class: 'pri-btn', 'data-pri': 'P1', text: 'P1' }),
      el('button', { type: 'button', class: 'pri-btn', 'data-pri': 'P2', text: 'P2' }),
      el('button', { type: 'button', class: 'pri-btn', 'data-pri': 'P3', text: 'P3' })
    ),
    el('div', { class: 'row' },
      el('label', { text: '工程' }),
      el('input', { id: 'id-genre', placeholder: '例: 実装 / バグ修正 / 設計 / 文書 ...' })
    ),
    el('div', { class: 'row' },
      el('label', { text: 'タイトル' }),
      el('input', { id: 'id-title', placeholder: '例: 新機能_xxx (任意、ファイル名にも反映)' })
    ),
    el('div', { class: 'panel-actions' },
      el('button', { type: 'button', 'data-act': 'id-cancel', text: 'キャンセル' }),
      el('button', { type: 'button', class: 'primary', 'data-act': 'id-confirm', text: 'ID 生成' })
    )
  )

  const today = todayCompact()
  const promptItems = enabledAssistantPromptItems()
  const defaultPromptIds = new Set((state.assistantPrompts && Array.isArray(state.assistantPrompts.projectPromptIds))
    ? state.assistantPrompts.projectPromptIds
    : [])
  const promptBox = promptItems.length ? el('div', { class: 'assistant-prompt-picker' },
    el('div', { class: 'assistant-prompt-picker-title', text: '開発補助プロンプト' }),
    ...promptItems.map(item => el('label', { class: 'assistant-prompt-option' },
      el('input', {
        type: 'checkbox',
        value: item.id,
        checked: defaultPromptIds.has(item.id),
      }),
      el('span', { text: item.label || item.id }),
      el('code', { text: item.category || '' })
    ))
  ) : null
  const form = el('div', {},
    el('label', { text: '配置レーン' }),
    el('select', { id: 'new-tic-lane', style: 'margin-bottom:8px' },
      el('option', { value: 'todo', text: 'todo（精査済み）' }),
      el('option', { value: 'review', text: 'review（確認待ち）' }),
      el('option', { value: 'inbox', text: 'inbox（未整理のアイデア・報告）' })
    ),
    el('label', { text: 'ファイル名（.md 必須、例: ' + today + '_P2_実装_新機能.md）' }),
    el('input', { id: 'new-tic-name', value: today + '_P2_.md' }),
    el('label', { text: '内容（TICKET_TEMPLATE.md がベース）' }),
    promptBox,
    toolbar,
    idPanel,
    el('textarea', { id: 'new-tic-body' }, tplContent)
  )
  setTimeout(() => { form.querySelector('#new-tic-body').value = tplContent }, 0)

  // ツールバーボタン・ID パネルボタンのイベントバインド (form 起動後に実行)
  setTimeout(() => {
    const ta = form.querySelector('#new-tic-body')
    const fileInput = form.querySelector('#new-tic-name')
    const panel = form.querySelector('.toolbar-inline-panel')
    let selectedPri = 'P0'

    // ツールバーボタン
    toolbar.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault()
        const act = btn.dataset.act
        if (act === 'today') {
          insertAtCursor(ta, todayIso())
        } else if (act === 'now') {
          insertAtCursor(ta, nowIsoMinute())
        } else if (act === 'id') {
          panel.classList.toggle('show')
          if (panel.classList.contains('show')) {
            setTimeout(() => panel.querySelector('#id-genre').focus(), 0)
          }
        } else if (act === 'tpl') {
          insertAtCursor(ta, tplContent)
        } else if (act === 'check') {
          insertAtLineStart(ta, '- [ ] ')
        } else if (act === 'log') {
          insertAtCursor(ta, todayIso() + ' (Claude セッション): ')
        } else if (act === 'hr') {
          insertAtCursor(ta, '\n---\n')
        }
      })
    })

    // パネル内の優先度ボタン
    panel.querySelectorAll('.pri-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault()
        panel.querySelectorAll('.pri-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        selectedPri = btn.dataset.pri
      })
    })

    // ID 生成・キャンセルボタン
    panel.querySelector('[data-act="id-cancel"]').addEventListener('click', e => {
      e.preventDefault()
      panel.classList.remove('show')
    })
    panel.querySelector('[data-act="id-confirm"]').addEventListener('click', e => {
      e.preventDefault()
      const genre = panel.querySelector('#id-genre').value.trim()
      const titleStr = panel.querySelector('#id-title').value.trim()
      const parts = [todayCompact(), selectedPri]
      if (genre) parts.push(genre)
      if (titleStr) parts.push(titleStr)
      const idBase = parts.join('_')
      // ファイル名に反映 (ユーザーが微調整できるよう、未編集ならそのまま、手カスタマされてたら上書きしない)
      const currentName = fileInput.value.trim()
      // 初期値 (todayCompact_P2_.md) または 以前の idBase パターンなら上書き
      const looksLikeUntouched = /^\d{8}_P\d_[^.]*\.md$/.test(currentName)
      if (looksLikeUntouched) {
        fileInput.value = idBase + '.md'
      }
      // 本文中の 「- チケットID: ...」 の行を探して上書き、なければカーソル位置に挿入
      const idLineRegex = /^- チケットID:.*$/m
      if (idLineRegex.test(ta.value)) {
        ta.value = ta.value.replace(idLineRegex, '- チケットID: ' + idBase)
        // タイトル行もデフォルトの <チケットタイトル> なら置換
        if (titleStr && /^# <チケットタイトル>/m.test(ta.value)) {
          ta.value = ta.value.replace(/^# <チケットタイトル>/m, '# ' + titleStr)
        }
      } else {
        insertAtCursor(ta, '- チケットID: ' + idBase)
      }
      // 作成日も YYYY-MM-DD のデフォルトや未置換なら今日で埋める
      if (/^- 作成日: (YYYY-MM-DD|)\s*$/m.test(ta.value)) {
        ta.value = ta.value.replace(/^- 作成日: .*$/m, '- 作成日: ' + todayIso())
      }
      panel.classList.remove('show')
    })
  }, 0)

  const ok = await modal({
    title: '新規チケット',
    body: form,
    actions: [
      { label: 'キャンセル', value: null },
      { label: '作成', value: true, class: 'primary' },
    ],
  })
  if (!ok) return
  const lane = form.querySelector('#new-tic-lane').value
  const filename = form.querySelector('#new-tic-name').value.trim()
  const selectedPromptIds = promptBox
    ? $all('.assistant-prompt-option input:checked', promptBox).map(input => input.value)
    : []
  const content = injectAssistantPromptIds(form.querySelector('#new-tic-body').value, selectedPromptIds)
  if (!filename.endsWith('.md')) {
    toast('ファイル名は .md で終わる必要があります', 'err')
    return
  }
  try {
    await api.createTicket(state.activeProject, filename, content, lane)
    toast('チケットを作成しました: ' + lane, 'ok')
    await loadTickets(state.activeProject)
  } catch (e) {
    toast('作成失敗: ' + (e.error || e.message), 'err')
  }
}

async function openMeta(filename) {
  try {
    await api.openExternal(state.activeProject, { kind: 'meta', file: filename })
    toast(filename + ' をエディタで開きました', 'ok')
  } catch (e) {
    toast('起動失敗: ' + (e.error || e.message), 'err')
  }
}

async function suggestNextAction() {
  if (!state.activeProject || !state.tickets) return
  const { review, doing, todo } = state.tickets
  let msg = ''
  let pick = null
  if (review && review.length > 0) {
    pick = review[0]
    msg = '返信確認推奨: <strong>' + escapeHtml(pick.title) + '</strong> は review にあります。レビュー欄のユーザー返信と判定を確認してください。'
  } else if (doing && doing.length > 0) {
    pick = doing[0]
    msg = '続行推奨: <strong>' + escapeHtml(pick.title) + '</strong> は doing にあります。'
  } else {
    try {
      const idx = await api.getMeta(state.activeProject, 'index')
      const rec = extractRecommendedOrder(idx.content || '')
      if (rec.length > 0) {
        for (const id of rec) {
          const found = (todo || []).find(t => t.file.startsWith(id) || t.title.includes(id))
          if (found) { pick = found; break }
        }
        if (pick) msg = '推奨実行順に基づき、次は <strong>' + escapeHtml(pick.title) + '</strong> を推奨します。'
      }
    } catch (_) {}
    if (!pick && todo && todo.length > 0) {
      pick = todo[0]
      msg = '推奨実行順は未設定です。todo の先頭（ファイル名順）に基づき <strong>' + escapeHtml(pick.title) + '</strong> を推奨します。'
    }
    if (!pick) msg = 'todo が空です。INDEX.md または inbox を確認してください。'
  }
  const actions = [{ label: '閉じる', value: null }]
  if (pick) {
    actions.push({ label: 'このチケットを開く', value: 'open', class: 'primary' })
    if (pick.lane !== 'doing' && pick.lane !== 'review') {
      actions.push({ label: 'doing に移動して開く', value: 'move', class: 'primary' })
    }
  }
  const choice = await modal({
    title: '次の一手',
    body: '<p>' + msg + '</p>' + (pick ? '<p><code style="font-size:10px">' + escapeHtml(pick.file) + '</code></p>' : ''),
    actions,
  })
  if (!choice || !pick) return
  if (choice === 'open') {
    await selectTicket(pick.lane, pick.file)
  } else if (choice === 'move') {
    await doMove(pick.lane, pick.file, 'doing')
  }
}

function extractRecommendedOrder(indexMd) {
  const lines = indexMd.split(/\r?\n/)
  let inSection = false
  const ids = []
  for (const line of lines) {
    if (/^##\s+推奨実行順/.test(line)) { inSection = true; continue }
    if (inSection && /^##\s/.test(line)) break
    if (inSection) {
      const m = line.match(/\x60([^\x60]+)\x60/)
      if (m) ids.push(m[1])
    }
  }
  return ids
}

async function migrateDialog() {
  const proj = state.projects.find(p => (p.id || p.name) === state.activeProject)
  if (!proj || proj.layout !== 'legacy') return
  const ok = await modal({
    title: '新構造へ移行',
    body: '<p>プロジェクト <code>' + escapeHtml(proj.name) + '</code> を新構造に移行します。</p>',
    actions: [
      { label: 'キャンセル', value: null },
      { label: '移行する', value: true, class: 'primary' },
    ],
  })
  if (!ok) return
  try {
    await api.migrate(state.activeProject)
    toast('移行しました', 'ok')
    await loadProjects()
    await selectProject(state.activeProject)
  } catch (e) {
    toast('移行失敗: ' + (e.error || e.message), 'err')
  }
}

// 詳細ビューのツールバーをセットアップ。
// init() から一回だけ呼ばれる。詳細ビューには textarea がないため、
// 各ボタンは対応するテキストをクリップボードにコピーして toast でフィードバックする。
// 「エディタで開く」→ ペーストの 2 ステップで使う想定。新規作成モーダルのボタン構成 (ID 生成を除く 6 ボタン) に揃えている。
function setupDetailToolbar() {
  const tb = $('#detail-toolbar')
  if (!tb) return
  // ボタン DOM を構築。表示テキストは新規作成モーダルと揃え、
  // title 属性だけ「クリップボードにコピーします」と明記。
  const buttons = [
    { act: 'today', label: '📅 今日',         hint: '今日の日付 (YYYY-MM-DD) をクリップボードにコピー' },
    { act: 'now',   label: '🕐 現在時刻',     hint: '現在時刻 (YYYY-MM-DD HH:MM) をクリップボードにコピー' },
    { act: 'tpl',   label: '📋 テンプレ',     hint: 'TICKET_TEMPLATE.md の内容をクリップボードにコピー' },
    { act: 'check', label: '✓ チェック行',     hint: '「- [ ] 」をクリップボードにコピー' },
    { act: 'log',   label: '⏱ ログ行',           hint: '作業ログ用の「YYYY-MM-DD (Claude セッション): 」をクリップボードにコピー' },
    { act: 'hr',    label: '─── 区切り',    hint: '区切り線 --- をクリップボードにコピー' },
  ]
  const hint = el('span', {
    style: 'font-size:10px;color:var(--muted);align-self:center;margin-right:4px',
    text: 'クリップボードにコピー → エディタで開く → ペースト',
  })
  tb.appendChild(hint)
  for (const b of buttons) {
    const btn = el('button', { type: 'button', 'data-act': b.act, text: b.label, title: b.hint })
    btn.addEventListener('click', e => {
      e.preventDefault()
      handleDetailToolbarClick(b.act)
    })
    tb.appendChild(btn)
  }
}

async function handleDetailToolbarClick(act) {
  let text = ''
  let label = ''
  if (act === 'today') {
    text = todayIso()
    label = '今日の日付'
  } else if (act === 'now') {
    text = nowIsoMinute()
    label = '現在時刻'
  } else if (act === 'tpl') {
    if (!state.activeProject) {
      toast('プロジェクトが選択されていません', 'err')
      return
    }
    try {
      const tpl = await api.getMeta(state.activeProject, 'template')
      text = tpl.content || ''
      label = 'テンプレート'
    } catch (e) {
      toast('テンプレートの取得に失敗しました', 'err')
      return
    }
  } else if (act === 'check') {
    text = '- [ ] '
    label = 'チェック行'
  } else if (act === 'log') {
    text = todayIso() + ' (Claude セッション): '
    label = 'ログ行'
  } else if (act === 'hr') {
    text = '\n---\n'
    label = '区切り線'
  } else {
    return
  }
  const ok = await copyToClipboard(text)
  if (ok) {
    toast(label + ' をクリップボードにコピーしました', 'ok')
  } else {
    toast('クリップボードへのコピーに失敗しました', 'err')
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]))
}

function toggleArchive() {
  state.showArchive = !state.showArchive
  $('#btn-toggle-archive').textContent = state.showArchive ? '📦 archive を隠す' : '📦 archive を表示'
  renderKanban()
}

async function archiveActiveTicket() {
  const t = state.activeTicket
  if (!t) return
  if (t.lane === 'archive') return
  const ok = await modal({
    title: 'アーカイブしますか？',
    body: '<p>以下のチケットを <code>archive/</code> へ退避します。</p>' +
          '<p><code>' + escapeHtml(t.file) + '</code></p>' +
          '<p>本文に <code>- archive元: ' + escapeHtml(t.lane) + '</code> が記録され、あとで元のレーンに戻せます。</p>',
    actions: [
      { label: 'キャンセル', value: null },
      { label: 'アーカイブ', value: true, class: 'primary' },
    ],
  })
  if (!ok) return
  try {
    const res = await api.archiveTicket(state.activeProject, t.lane, t.file, t.mtime)
    toast('アーカイブしました（元: ' + t.lane + '）', 'ok')
    state.activeTicket = null
    renderDetail()
    await loadTickets(state.activeProject)
  } catch (e) {
    toast('アーカイブ失敗: ' + (e.error || e.message), 'err')
  }
}

async function unarchiveActiveTicket() {
  const t = state.activeTicket
  if (!t) return
  if (t.lane !== 'archive') return
  if (!t.archivedFrom) {
    toast('archive元 メタが記録されていません', 'err')
    return
  }
  const ok = await modal({
    title: '元のレーンに戻しますか？',
    body: '<p><code>' + escapeHtml(t.file) + '</code> を <strong>' + escapeHtml(t.archivedFrom) + '</strong> に戻します。</p>',
    actions: [
      { label: 'キャンセル', value: null },
      { label: '戻す', value: true, class: 'primary' },
    ],
  })
  if (!ok) return
  try {
    const res = await api.unarchiveTicket(state.activeProject, t.file, t.mtime)
    toast(res.newLane + ' に戻しました', 'ok')
    await loadTickets(state.activeProject)
    await selectTicket(res.newLane, res.newFile)
  } catch (e) {
    toast('戻し失敗: ' + (e.error || e.message), 'err')
  }
}

function projectTicketsPath(projName, layout, rootPath) {
  const root = rootPath || (state.serverInfo ? state.serverInfo.root : '<root>')
  const platform = state.serverInfo ? state.serverInfo.platform : 'win32'
  const sep = platform === 'win32' ? '\\' : '/'
  if (layout === 'legacy') {
    return [root, projName].join(sep)
  }
  return [root, projName, 'tickets'].join(sep)
}

function formatAiStateTime(iso) {
  if (!iso) return '時刻不明'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = n => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
         ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

function isDormantAiState(iso) {
  if (!iso) return false
  const ts = new Date(iso).getTime()
  if (Number.isNaN(ts)) return false
  return (Date.now() - ts) >= 7 * 24 * 60 * 60 * 1000
}

function formatAiStateLine(aiState, selfAiName) {
  const name = aiState.aiName || 'unknown'
  const marks = []
  if (selfAiName && name === selfAiName) marks.push('自分')
  if (isDormantAiState(aiState.lastSeenAt)) marks.push('休眠')
  const label = marks.length ? name + ' (' + marks.join(', ') + ')' : name
  const ticket = aiState.lastTicket && aiState.lastTicket.lane && aiState.lastTicket.file
    ? aiState.lastTicket.lane + '/' + aiState.lastTicket.file
    : 'チケット記録なし'
  const action = aiState.lastAction || 'action不明'
  const seenAt = formatAiStateTime(aiState.lastSeenAt)
  return '- ' + label + ': ' + ticket + ' (' + action + ', ' + seenAt + ')'
}

async function buildAiSessionHistorySection(projectName) {
  try {
    const res = await api.aiStates(projectName)
    const list = Array.isArray(res.aiStates) ? res.aiStates.slice() : []
    if (!list.length) return ''
    list.sort((a, b) => {
      const at = a && a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0
      const bt = b && b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0
      return bt - at
    })
    const lines = list.map(s => formatAiStateLine(s, state.serverInfo && state.serverInfo.aiName)).filter(Boolean)
    if (!lines.length) return ''
    return ['## 直近のセッション履歴 (各 AI から)', ...lines, ''].join('\n')
  } catch (_) {
    return ''
  }
}

function buildCommonRulesSection(project) {
  const common = project && project.commonRules
  if (!common || !common.exists) return ''
  const sep = common.rulesPath && common.rulesPath.includes('/') ? '/' : '\\'
  const operationPath = common.rulesDir ? common.rulesDir + sep + 'AI_OPERATION.md' : ''
  const promptPath = common.rulesDir ? common.rulesDir + sep + 'prompts' + sep + 'initial_or_resume.md' : ''
  const lines = [
    '## 共通運用ルール',
    'プロジェクト固有ルールの前に、以下の共通ルールを読んでください。',
    '- ' + common.rulesPath,
  ]
  if (operationPath) lines.push('- ' + operationPath)
  if (promptPath) lines.push('- ' + promptPath)
  for (const doc of common.docs || []) lines.push('- ' + doc)
  lines.push('')
  return lines.join('\n')
}

function buildReviewPromptGuidance(ticket) {
  const lines = [
    '## review/ 返信確認ルール',
    '- review/ にチケットがある場合は、新規 todo 着手より先にユーザーの確認・返信待ちとして扱ってください。',
    '- review/ のチケットでは `## レビュー欄` を確認し、`### ユーザー返信欄` と `### 判定` を読む/更新してください。',
    '- 判定は `approved` / `needs_fix` / `rejected` のいずれかです。approved は done/、needs_fix は doing/、rejected は blocked/ または再設計へ進めます。',
    '- レビュー目的・観点・手段・チェック項目が不足している場合は、それ自体を指摘事項として残してください。',
  ]
  if (ticket && ticket.lane === 'review') {
    lines.push('- 今回指定されたチケットは review/ にあります。作業再開ではなく、レビュー返信確認として処理してください。')
  }
  lines.push('')
  return lines.join('\n')
}

async function buildExtensionRulesSection() {
  try {
    const res = await api.enterpriseFeatures()
    const features = Array.isArray(res.features) ? res.features : []
    const lines = ['## 有効な拡張機能ルール']
    for (const feature of features) {
      const guidance = feature && feature.aiGuidance
      if (!guidance || (!guidance.rulesPath && !(Array.isArray(guidance.docs) && guidance.docs.length))) continue
      lines.push(`### ${feature.id} (${feature.tier})`)
      lines.push('この拡張機能の運用ルールも併せて読んでください。')
      if (guidance.rulesPath) lines.push('- ' + guidance.rulesPath)
      for (const doc of guidance.docs || []) lines.push('- ' + doc)
    }
    if (lines.length === 1) return ''
    lines.push('')
    return lines.join('\n')
  } catch (_) {
    return ''
  }
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function assistantPromptMatch(ticket, prompts) {
  if (!ticket || !prompts || !prompts.triggers) return null
  const target = [
    ticket.file || '',
    ticket.title || '',
    ticket.content || '',
  ].join('\n')
  for (const [key, words] of Object.entries(prompts.triggers || {})) {
    for (const word of words || []) {
      const w = String(word || '').trim()
      if (!w) continue
      const asciiWord = /^[A-Za-z0-9_]+$/.test(w)
      const pattern = asciiWord
        ? new RegExp('(^|[^A-Za-z0-9_])' + escapeRegExp(w) + '([^A-Za-z0-9_]|$)', 'i')
        : new RegExp(escapeRegExp(w), 'i')
      if (pattern.test(target)) return { key, word: w }
    }
  }
  return null
}

function assistantPromptMap() {
  const prompts = state.assistantPrompts
  const map = new Map()
  for (const item of (prompts && Array.isArray(prompts.prompts) ? prompts.prompts : [])) {
    if (item && item.id) map.set(item.id, item)
  }
  return map
}

function enabledAssistantPromptItems() {
  const prompts = state.assistantPrompts
  if (!prompts || prompts.enabled !== true) return []
  const items = Array.isArray(prompts.prompts) ? prompts.prompts : []
  const enabledIds = Array.isArray(prompts.enabledPromptIds) ? prompts.enabledPromptIds : []
  if (!enabledIds.length) return items
  const enabledSet = new Set(enabledIds)
  return items.filter(item => item && enabledSet.has(item.id))
}

function explicitAssistantPromptIds(ticket) {
  if (!ticket || !ticket.content) return []
  const match = String(ticket.content).match(/^\s*-\s*assistantPromptIds:\s*(.+)$/mi)
  if (!match) return []
  return match[1].split(/[,\s]+/).map(s => s.trim()).filter(Boolean)
}

function selectedAssistantPromptItems(ticket) {
  const prompts = state.assistantPrompts
  if (!prompts || prompts.enabled !== true) return []
  const map = assistantPromptMap()
  let ids = explicitAssistantPromptIds(ticket)
  const match = assistantPromptMatch(ticket, prompts)
  if (!ids.length && ticket && match && prompts.ticketPromptDefaults) {
    ids = Array.isArray(prompts.ticketPromptDefaults[match.key]) ? prompts.ticketPromptDefaults[match.key] : []
  }
  if (!ids.length && !ticket && Array.isArray(prompts.projectPromptIds)) {
    ids = prompts.projectPromptIds
  }
  return ids.map(id => map.get(id)).filter(Boolean)
}

function buildAssistantPromptsSection(ticket) {
  const prompts = state.assistantPrompts
  if (!prompts || prompts.enabled !== true) return ''
  const items = selectedAssistantPromptItems(ticket)
  if (!items.length) return ''

  const lines = [
    '## 開発補助プロンプト',
    '開発補助プロンプトがONです。既存の共通ルール・プロジェクト固有RULES・チケット本文は上書きせず、追加で読むべき開発指針として扱ってください。',
  ]
  const match = assistantPromptMatch(ticket, prompts)
  if (ticket) {
    const explicitIds = explicitAssistantPromptIds(ticket)
    if (explicitIds.length) {
      lines.push('このチケットで明示された補助プロンプトを読んでください。')
    } else if (match) {
      lines.push(`このチケットは補助プロンプトのトリガー \`${match.key}\`（検出語: \`${match.word}\`）に一致しています。`)
    }
  } else {
    lines.push('プロジェクト既定で有効な補助プロンプトを先に読んでください。')
  }
  for (const item of items) {
    const label = item.label || item.id
    const location = item.path || item.labelPath || ''
    lines.push('- ' + label + (location ? ': ' + location : '') + ' (`' + item.id + '`)')
  }
  lines.push('')
  return lines.join('\n')
}

function injectAssistantPromptIds(content, ids) {
  const cleanIds = Array.from(new Set((ids || []).map(id => String(id || '').trim()).filter(Boolean)))
  if (!cleanIds.length) {
    return content.replace(/^\s*-\s*assistantPromptIds:\s*.*\r?\n?/mi, '')
  }
  const line = '- assistantPromptIds: ' + cleanIds.join(', ')
  if (/^\s*-\s*assistantPromptIds:\s*.*$/mi.test(content)) {
    return content.replace(/^\s*-\s*assistantPromptIds:\s*.*$/mi, line)
  }
  if (/^# .+\r?\n/.test(content)) {
    return content.replace(/^(# .+\r?\n)/, '$1' + line + '\n')
  }
  return line + '\n' + content
}

async function assistantPromptDialogForActiveTicket() {
  const t = state.activeTicket
  if (!t) return
  const items = enabledAssistantPromptItems()
  if (!items.length) {
    toast('利用可能な補助プロンプトがありません', 'err')
    return
  }
  const explicitIds = explicitAssistantPromptIds(t)
  const checkedIds = new Set(explicitIds.length
    ? explicitIds
    : selectedAssistantPromptItems(t).map(item => item.id))
  const body = el('div', { class: 'assistant-prompt-picker' },
    el('div', { class: 'assistant-prompt-picker-title', text: 'このチケットに紐づける補助プロンプト' }),
    ...items.map(item => el('label', { class: 'assistant-prompt-option' },
      el('input', {
        type: 'checkbox',
        value: item.id,
        checked: checkedIds.has(item.id),
      }),
      el('span', { text: item.label || item.id }),
      el('code', { text: item.category || '' })
    ))
  )
  const ok = await modal({
    title: '補助プロンプト',
    body,
    actions: [
      { label: 'キャンセル', value: null },
      { label: '保存', value: true, class: 'primary' },
    ],
  })
  if (!ok) return
  const selectedIds = $all('.assistant-prompt-option input:checked', body).map(input => input.value)
  const content = injectAssistantPromptIds(t.content || '', selectedIds)
  try {
    const res = await api.writeTicket(state.activeProject, t.lane, t.file, content, t.mtime)
    t.content = content
    t.mtime = res.mtime
    renderDetail()
    await loadTickets(state.activeProject)
    toast('補助プロンプトを保存しました', 'ok')
  } catch (e) {
    toast('保存失敗: ' + (e.error || e.message), 'err')
  }
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (_) {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      return true
    } catch (e) {
      return false
    }
  }
}

async function copyResumePromptForProject() {
  if (!state.activeProject) return
  const proj = state.projects.find(p => (p.id || p.name) === state.activeProject)
  const projName = proj ? proj.name : state.activeProject
  const tp = projectTicketsPath(projName, proj ? proj.layout : 'new', proj && proj.rootPath)
  const commonRules = buildCommonRulesSection(proj)
  const extensionRules = await buildExtensionRulesSection()
  const assistantPrompts = buildAssistantPromptsSection()
  const aiHistory = await buildAiSessionHistorySection(state.activeProject)
  const prompt = [
    commonRules,
    extensionRules,
    assistantPrompts,
    buildReviewPromptGuidance(),
    tp + ' の RULES.md と INDEX.md を読んでください。',
    '初回／再開プロンプトとして、チケット状況を見て分岐します。',
    '',
    '手順:',
    '1. ブロックA: RULES.md、INDEX.md、AI_OPERATION.md で運用ルールと確認義務トリガーを把握',
    '2. ブロックB: review/、doing/、todo/、inbox/ の状況を確認',
    '3. review/ にチケットがあれば、ユーザーの返信確認・判定反映を優先。',
    '4. doing/ にチケットがあればそれを読んで作業再開。',
    '5. doing/ がなければ todo/ から次のチケットを選んで doing/ に移動して開始。',
    '   チケット自体がない相談なら、用件を整理して inbox/ または doing/ に起票してから進める。',
    '6. 作業対象が AI_OPERATION.md の確認義務トリガーに該当する場合は、関連実装も読む。',
    '7. 作業中に思いついたアイデア・課題は inbox/ に起票。',
    '   Claude提案・Claude推奨などラベルをタイトルまたは本文に明記。',
    '8. セッション終了時は作業ログのサマリ欄に成果を1行追加、',
    '   詳細ログに今回のやり取りを原文追記、引継ぎメモを 1-3 行で記載。',
    '',
    aiHistory
  ].join('\n')
  const ok = await copyToClipboard(prompt)
  if (ok) {
    toast('再開プロンプトをクリップボードにコピーしました', 'ok')
  } else {
    await modal({
      title: '手動でコピーしてください',
      body: '<textarea readonly style="width:100%;height:220px;font-size:11px;font-family:monospace">' + escapeHtml(prompt) + '</textarea>',
      actions: [{ label: '閉じる', value: null }],
    })
  }
}

async function copyResumePromptForActiveTicket() {
  const t = state.activeTicket
  if (!t) return
  const proj = state.projects.find(p => (p.id || p.name) === state.activeProject)
  const projName = proj ? proj.name : state.activeProject
  const tp = projectTicketsPath(projName, proj ? proj.layout : 'new', proj && proj.rootPath)
  const sep = state.serverInfo && state.serverInfo.platform !== 'win32' ? '/' : '\\'
  const ticketPath = [tp, t.lane, t.file].join(sep)
  const commonRules = buildCommonRulesSection(proj)
  const extensionRules = await buildExtensionRulesSection()
  const assistantPrompts = buildAssistantPromptsSection(t)
  const prompt = [
    commonRules,
    extensionRules,
    assistantPrompts,
    buildReviewPromptGuidance(t),
    tp + ' の RULES.md を読んだ後、以下のチケットを開いて作業を再開してください。',
    '',
    'チケット: ' + ticketPath,
    'タイトル: ' + (t.title || ''),
    '',
    '手順:',
    '1. RULES.md と AI_OPERATION.md で運用ルールと確認義務トリガーを把握',
    '2. 上記チケットを読んで現状を確認（作業ログのサマリ欄と引継ぎメモを中心に）',
    '3. このチケットが review/ の場合は、レビュー欄のユーザー返信と判定を確認し、approved/needs_fix/rejected に応じて処理',
    '4. review/ 以外の場合は、未完了の完了条件から作業を続行',
    '5. このチケットが todo のままなら doing/ へ移動してから開始',
    '6. 作業対象が AI_OPERATION.md の確認義務トリガーに該当する場合は、関連実装も読む',
    '7. セッション終了時はサマリ1行・詳細ログ原文・引継ぎメモを書き続ける',
    ''
  ].join('\n')
  const ok = await copyToClipboard(prompt)
  if (ok) {
    toast('チケットの再開プロンプトをクリップボードにコピーしました', 'ok')
  } else {
    await modal({
      title: '手動でコピーしてください',
      body: '<textarea readonly style="width:100%;height:220px;font-size:11px;font-family:monospace">' + escapeHtml(prompt) + '</textarea>',
      actions: [{ label: '閉じる', value: null }],
    })
  }
}

async function exportDialog() {
  if (!state.activeProject) return
  const form = el('div', {},
    el('label', { text: '形式' }),
    el('select', { id: 'exp-fmt', style: 'margin-bottom:10px' },
      el('option', { value: 'tsv', text: 'TSV（Excelで開く、BOM付き）' }),
      el('option', { value: 'json', text: 'JSON（タイムライン連携用）' })
    ),
    el('label', { text: '対象レーン' }),
    el('div', { style: 'font-size:11px; color: var(--muted); margin-bottom:4px' },
      'アクティブレーン（inbox/todo/doing/review/blocked/done）は常に含まれます。.trash は常に除外されます。'
    ),
    el('label', { style: 'display:flex; align-items:center; gap:6px; cursor:pointer' },
      el('input', { type: 'checkbox', id: 'exp-archive', checked: true, style: 'width:auto; margin-bottom:0' }),
      el('span', { text: 'archive レーンも含める' })
    ),
    el('div', { style: 'font-size:11px; color:var(--muted); margin-top:10px; padding-top:8px; border-top:1px solid var(--border)' },
      'done レーンで本文に完了日が無い場合は、ファイルの mtime を完了日として採用します。'
    )
  )
  const ok = await modal({
    title: 'チケット一覧をエクスポート',
    body: form,
    actions: [
      { label: 'キャンセル', value: null },
      { label: 'ダウンロード', value: true, class: 'primary' },
    ],
  })
  if (!ok) return
  const fmt = form.querySelector('#exp-fmt').value
  const includeArchive = form.querySelector('#exp-archive').checked
  const url = '/api/projects/' + encodeURIComponent(state.activeProject) +
              '/export?format=' + fmt + '&includeArchive=' + (includeArchive ? 'true' : 'false')
  const a = document.createElement('a')
  a.href = url
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  toast(fmt.toUpperCase() + ' でエクスポートしました', 'ok')
}

window.addEventListener('DOMContentLoaded', () => { init() })
