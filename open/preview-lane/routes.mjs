import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// 安全なコマンド実行のためのチェック
function getDockerCommand() {
  return process.platform === 'win32' ? 'docker.exe' : 'docker'
}

function firstExisting(paths) {
  return paths.find(p => fs.existsSync(p)) || null
}

// docker-compose.ymlの存在チェック
function findProjectComposeFile(projectDir) {
  return firstExisting([
    path.join(projectDir, 'docker-compose.yml'),
    path.join(projectDir, 'docker-compose.yaml'),
  ])
}

function hasDockerCompose(projectDir) {
  return !!findProjectComposeFile(projectDir)
}

function defaultPreviewHost(project) {
  const base = String(project.projectName || project.displayName || project.name || 'project')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'project'
  return `${base}.localhost`
}

function projectTemplateValues(project) {
  const host = defaultPreviewHost(project)
  return {
    projectId: host.replace(/\.localhost$/i, ''),
    projectHost: host,
  }
}

function expandProjectTemplate(value, project) {
  if (typeof value !== 'string') return ''
  const vars = projectTemplateValues(project)
  return value
    .replace(/<project-id>/g, vars.projectId)
    .replace(/\$\{IM_PROJECT_ID\}/g, vars.projectId)
    .replace(/<project-host>/g, vars.projectHost)
    .replace(/\$\{IM_HOST\}/g, vars.projectHost)
}

function normalizePreviewTarget(raw, fallbackId, project) {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || fallbackId || '').trim().replace(/[^A-Za-z0-9_-]/g, '-')
  const urlSource = typeof raw.url === 'string' ? raw.url : raw.urlTemplate
  const url = project ? expandProjectTemplate(urlSource, project).trim() : String(urlSource || '').trim()
  if (!id || !url) return null
  if (/^https?:\/\/0\.0\.0\.0(?::|\/|$)/i.test(url)) return null
  return {
    id,
    label: String(raw.label || id),
    url,
    kind: String(raw.kind || 'browser'),
    primary: raw.primary === true,
    expectedStatus: Number.isFinite(Number(raw.expectedStatus)) ? Number(raw.expectedStatus) : undefined,
  }
}

function normalizeCustomAction(raw, fallbackId) {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || fallbackId || '').trim().replace(/[^A-Za-z0-9_-]/g, '-')
  if (!id) return null
  const command = Array.isArray(raw.command)
    ? raw.command.map(v => String(v)).filter(Boolean)
    : []
  return {
    id,
    label: String(raw.label || id),
    description: typeof raw.description === 'string' ? raw.description : '',
    command,
    requiresConfirm: raw.requiresConfirm !== false,
  }
}

function fallbackPreviewTargets(project) {
  const host = defaultPreviewHost(project)
  return [{
    id: 'home',
    label: 'プレビュー',
    url: `http://${host}:8280/`,
    kind: 'browser',
    primary: true,
  }]
}

function previewTargetsFromEnvironment(project, env) {
  const rawTargets = env && Array.isArray(env.previewTargets) ? env.previewTargets : []
  const targets = rawTargets
    .map((t, i) => normalizePreviewTarget(t, `target-${i + 1}`, project))
    .filter(Boolean)

  if (!targets.length) return fallbackPreviewTargets(project)
  if (!targets.some(t => t.primary)) targets[0].primary = true
  return targets
}

async function readProjectDockerMetadata(project) {
  const full = path.join(project.projectDir, '_docker', 'environments.json')
  if (!fs.existsSync(full)) return null
  try {
    const raw = JSON.parse(await fsp.readFile(full, 'utf8'))
    if (!raw || typeof raw !== 'object') return null
    return raw
  } catch (_) {
    return null
  }
}

async function readJsonFile(full) {
  if (!fs.existsSync(full)) return null
  try {
    const raw = JSON.parse(await fsp.readFile(full, 'utf8'))
    return raw && typeof raw === 'object' ? raw : null
  } catch (_) {
    return null
  }
}

async function readSharedCatalog(sharedConfig) {
  if (!sharedConfig || !sharedConfig.dockerRoot) return null
  const catalogPath = path.join(sharedConfig.dockerRoot, 'catalog.json')
  return readJsonFile(catalogPath)
}

async function readSharedEnvironment(sharedConfig, sharedEnvironmentId) {
  const id = sanitizeEnvironmentId(sharedEnvironmentId)
  if (!id || !sharedConfig || !sharedConfig.dockerRoot) return null
  const environmentPath = path.join(sharedConfig.dockerRoot, id, 'environment.json')
  if (!fs.existsSync(environmentPath)) return null
  try {
    const raw = JSON.parse(await fsp.readFile(environmentPath, 'utf8'))
    if (!raw || typeof raw !== 'object') return null
    return {
      ...raw,
      id: String(raw.id || id),
      source: 'shared',
      sharedEnvironmentId: id,
    }
  } catch (_) {
    return null
  }
}

async function sharedEnvironmentCandidates(project, sharedConfig) {
  const catalog = await readSharedCatalog(sharedConfig)
  const items = catalog && Array.isArray(catalog.environments) ? catalog.environments : []
  const detailed = await Promise.all(items.map(async (entry) => {
    const id = sanitizeEnvironmentId(entry && entry.id)
    if (!id) return null
    const shared = await readSharedEnvironment(sharedConfig, id)
    const merged = { ...(shared || {}), ...entry }
    return {
      id,
      name: String(merged.name || id),
      source: 'shared-candidate',
      purpose: typeof merged.purpose === 'string' ? merged.purpose : undefined,
      description: typeof merged.description === 'string' ? merged.description : undefined,
      sharedEnvironmentId: id,
      composeFile: typeof merged.composeFile === 'string' ? merged.composeFile : undefined,
      dockerfile: typeof merged.dockerfile === 'string' ? merged.dockerfile : undefined,
      image: typeof merged.image === 'string' ? merged.image : undefined,
      shareableAcrossProjects: merged.shareableAcrossProjects !== false,
      requiresProjectBuild: merged.requiresProjectBuild === true,
      weight: typeof merged.weight === 'string' ? merged.weight : (merged.cost && typeof merged.cost.weight === 'string' ? merged.cost.weight : undefined),
      cost: merged.cost && typeof merged.cost === 'object' ? merged.cost : undefined,
      safety: merged.safety && typeof merged.safety === 'object' ? merged.safety : undefined,
      traefik: merged.traefik && typeof merged.traefik === 'object' ? merged.traefik : undefined,
      previewTargets: previewTargetsFromEnvironment(project, merged),
    }
  }))
  return detailed.filter(Boolean)
}

async function mergeSharedEnvironment(sharedConfig, env) {
  if (!env || String(env.source || '') !== 'shared') return env
  const sharedId = String(env.sharedEnvironmentId || env.environmentId || env.id || '').trim()
  const shared = await readSharedEnvironment(sharedConfig, sharedId)
  if (!shared) return env
  return {
    ...shared,
    ...env,
    source: 'shared',
    sharedEnvironmentId: shared.sharedEnvironmentId || sharedId,
    previewTargets: Array.isArray(env.previewTargets) && env.previewTargets.length
      ? env.previewTargets
      : shared.previewTargets,
    customActions: Array.isArray(env.customActions) && env.customActions.length
      ? env.customActions
      : shared.customActions,
  }
}

function selectEnvironmentMetadata(meta) {
  if (!meta || !Array.isArray(meta.environments)) return null
  const wanted = String(meta.defaultEnvironment || 'default')
  return meta.environments.find(e => String(e && e.id) === wanted) || meta.environments[0] || null
}

function findEnvironmentMetadata(meta, envId) {
  if (!meta || !Array.isArray(meta.environments)) return null
  const wanted = String(envId || '').trim()
  return meta.environments.find(e => String(e && e.id) === wanted) || null
}

function sanitizeEnvironmentId(envId) {
  const id = String(envId || '').trim()
  return /^[A-Za-z0-9_-]+$/.test(id) ? id : ''
}

function isInsideOrSame(parent, child) {
  const p = path.resolve(parent)
  const c = path.resolve(child)
  const rel = path.relative(p, c)
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel))
}

async function previewTargetsForProject(project, sharedConfig) {
  const meta = await readProjectDockerMetadata(project)
  const env = await mergeSharedEnvironment(sharedConfig, selectEnvironmentMetadata(meta))
  return previewTargetsFromEnvironment(project, env)
}

function environmentSummaryFromMetadata(project, env, meta) {
  if (!env) {
    const composeFile = findProjectComposeFile(project.projectDir)
    return {
      id: 'default',
      name: 'default',
      source: composeFile ? 'project-compose' : 'not_configured',
      composeFile: composeFile ? path.basename(composeFile) : undefined,
      previewTargets: fallbackPreviewTargets(project),
      customActions: [],
      default: true,
    }
  }
  return {
    id: String(env.id || 'default'),
    name: String(env.name || env.id || 'default'),
    purpose: typeof env.purpose === 'string' ? env.purpose : undefined,
    description: typeof env.description === 'string' ? env.description : undefined,
    source: String(env.source || 'project-compose'),
    sharedEnvironmentId: typeof env.sharedEnvironmentId === 'string' ? env.sharedEnvironmentId : undefined,
    composeFile: typeof env.composeFile === 'string' ? env.composeFile : undefined,
    dockerfile: typeof env.dockerfile === 'string' ? env.dockerfile : undefined,
    image: typeof env.image === 'string' ? env.image : undefined,
    shareableAcrossProjects: env.shareableAcrossProjects === true,
    requiresProjectBuild: env.requiresProjectBuild === true,
    cost: env.cost && typeof env.cost === 'object' ? env.cost : undefined,
    safety: env.safety && typeof env.safety === 'object' ? env.safety : undefined,
    traefik: env.traefik && typeof env.traefik === 'object' ? env.traefik : undefined,
    customActions: Array.isArray(env.customActions)
      ? env.customActions.map((a, i) => normalizeCustomAction(a, `action-${i + 1}`)).filter(Boolean)
      : [],
    previewTargets: previewTargetsFromEnvironment(project, env),
    default: String(env.id || 'default') === String(meta && meta.defaultEnvironment || 'default'),
  }
}

async function dockerEnvironmentSummary(project, sharedConfig) {
  const meta = await readProjectDockerMetadata(project)
  const env = await mergeSharedEnvironment(sharedConfig, selectEnvironmentMetadata(meta))
  return environmentSummaryFromMetadata(project, env, meta)
}

async function dockerEnvironmentSummaryById(project, envId, sharedConfig) {
  const environments = await dockerEnvironmentsForProject(project, sharedConfig)
  const env = environments.find(e => e.id === envId)
  if (env) return env
  return null
}

async function dockerEnvironmentsForProject(project, sharedConfig) {
  const meta = await readProjectDockerMetadata(project)
  const environments = []

  if (hasDockerCompose(project.projectDir)) {
    environments.push(environmentSummaryFromMetadata(project, null, meta))
  }

  const dockerDir = path.join(project.projectDir, '_docker')
  if (fs.existsSync(dockerDir)) {
    const entries = await fsp.readdir(dockerDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const id = sanitizeEnvironmentId(entry.name)
      if (!id) continue
      const envDir = path.join(dockerDir, id)
      const composeFile = firstExisting([
        path.join(envDir, 'docker-compose.yml'),
        path.join(envDir, 'docker-compose.yaml'),
      ])
      if (!composeFile) continue
      const envMeta = await readJsonFile(path.join(envDir, 'environment.json')) || {}
      environments.push(environmentSummaryFromMetadata(project, {
        ...envMeta,
        id,
        name: envMeta.name || id,
        source: envMeta.source || 'project-compose',
        composeFile: path.join(id, path.basename(composeFile)),
      }, meta))
    }
  }

  if (meta && Array.isArray(meta.environments) && meta.environments.length) {
    const merged = await Promise.all(meta.environments.map(env => mergeSharedEnvironment(sharedConfig, env)))
    environments.push(...merged
      .map(env => environmentSummaryFromMetadata(project, env, meta))
      .filter(env => env && env.id))
  }

  const byId = new Map()
  for (const env of environments) {
    if (!env || !env.id) continue
    byId.set(env.id, { ...(byId.get(env.id) || {}), ...env })
  }
  return [...byId.values()]
}

function resolveComposeForEnvironment(project, environment, sharedConfig) {
  if (!environment || environment.source === 'not_configured') return null
  if (environment.source === 'shared') {
    const sharedId = sanitizeEnvironmentId(environment.sharedEnvironmentId || environment.id)
    if (!sharedId || !sharedConfig || !sharedConfig.dockerRoot) return null
    const composeFile = path.resolve(sharedConfig.dockerRoot, sharedId, environment.composeFile || 'docker-compose.yml')
    const envDir = path.resolve(sharedConfig.dockerRoot, sharedId)
    if (!isInsideOrSame(envDir, composeFile)) return null
    if (!fs.existsSync(composeFile)) return null
    return {
      cwd: path.dirname(composeFile),
      argsPrefix: ['compose', '-f', composeFile],
      env: {
        COMPOSE_PROJECT_NAME: `${String(project.id || project.name).replace(/[^A-Za-z0-9_-]/g, '-')}-${sharedId}`,
        IM_PROJECT_ID: String(project.projectName || project.displayName || project.name || 'project').replace(/[^A-Za-z0-9_-]/g, '-'),
        IM_HOST: defaultPreviewHost(project),
        IM_PROJECT_DIR: project.projectDir,
      },
    }
  }
  if (environment.composeFile) {
    const fromDockerDir = path.resolve(project.projectDir, '_docker', environment.composeFile)
    const fromProjectDir = path.resolve(project.projectDir, environment.composeFile)
    const composeFile = fs.existsSync(fromDockerDir) ? fromDockerDir : fromProjectDir
    if (!fs.existsSync(composeFile)) return null
    if (!isInsideOrSame(project.projectDir, composeFile)) return null
    return {
      cwd: path.dirname(composeFile),
      argsPrefix: ['compose', '-f', composeFile],
    }
  }
  const composeFile = findProjectComposeFile(project.projectDir)
  if (!composeFile) return null
  return {
    cwd: project.projectDir,
    argsPrefix: ['compose', '-f', composeFile],
  }
}

function parseComposePs(stdout) {
  const lines = stdout.trim().split('\n').filter(Boolean)
  const containers = []

  for (const line of lines) {
    try {
      if (line.startsWith('[')) {
        const arr = JSON.parse(line)
        containers.push(...arr)
      } else {
        containers.push(JSON.parse(line))
      }
    } catch (_) {}
  }
  return containers
}

function containersJson(containers) {
  return containers.map(c => ({
    name: c.Name || c.Service || 'unknown',
    state: c.State || c.Status || 'unknown',
    ports: c.Publishers ? c.Publishers.map(p => `${p.URL}:${p.TargetPort}->${p.PublishedPort}`).join(', ') : (c.Ports || '')
  }))
}

function isContainersRunning(containers) {
  return containers.some(c =>
    String(c.State || c.Status).toLowerCase().includes('running') ||
    String(c.State || c.Status).toLowerCase().includes('up')
  )
}

async function composeStatus(project, environment, sharedConfig) {
  const compose = resolveComposeForEnvironment(project, environment, sharedConfig)
  if (!compose) {
    return {
      status: 'not_configured',
      containers: [],
      message: 'docker-compose.yml が見つかりません。',
    }
  }
  const dockerCmd = getDockerCommand()
  const { stdout } = await execFileAsync(dockerCmd, [...compose.argsPrefix, 'ps', '--format', 'json'], {
    cwd: compose.cwd,
    env: compose.env ? { ...process.env, ...compose.env } : process.env,
    windowsHide: true,
    timeout: 10000,
  })
  const containers = parseComposePs(stdout)
  return {
    status: isContainersRunning(containers) ? 'running' : 'stopped',
    containers: containersJson(containers),
  }
}

function runComposeDetached(project, environment, action, logger, sharedConfig) {
  const compose = resolveComposeForEnvironment(project, environment, sharedConfig)
  if (!compose) {
    const e = new Error('docker-compose.yml が存在しません。')
    e.status = 400
    throw e
  }

  const dockerCmd = getDockerCommand()
  const actionArgs = action === 'start'
    ? ['up', '-d']
    : action === 'stop'
      ? ['down']
      : action === 'restart'
        ? ['restart']
        : action === 'build'
          ? ['build']
          : null
  if (!actionArgs) {
    const e = new Error('unsupported docker action')
    e.status = 400
    throw e
  }

  execFile(dockerCmd, [...compose.argsPrefix, ...actionArgs], {
    cwd: compose.cwd,
    env: compose.env ? { ...process.env, ...compose.env } : process.env,
    windowsHide: true,
  }, (error) => {
    if (error) {
      logger.logErr(`[preview-lane] ${action} error on ${project.name}/${environment.id}: ${error.message}`)
    } else {
      logger.log(`[preview-lane] ${action} requested for ${project.name}/${environment.id}`)
    }
  })
}

async function resolveProjectEnvironment(getProject, projectId, rawEnvId, sharedConfig) {
  const project = await getProject(projectId)
  if (!project) return { errorStatus: 404, error: 'project not found' }

  const envId = sanitizeEnvironmentId(rawEnvId)
  if (!envId) return { errorStatus: 400, error: 'invalid environment id' }

  const environment = await dockerEnvironmentSummaryById(project, envId, sharedConfig)
  if (!environment) return { errorStatus: 404, error: 'environment not found' }
  return { project, environment }
}

export async function handlePreviewLaneRoute({ req, res, pathname, method, projectId, helpers }) {
  const {
    sendJson,
    getProject,
    rootForProject,
    requireRootCapability,
    openSystemPath,
    shared,
  } = helpers

  if (pathname.endsWith('/preview-lane/environments') && method === 'GET') {
    const project = await getProject(projectId)
    if (!project) return sendJson(res, 404, { error: 'project not found' })

    const environments = await dockerEnvironmentsForProject(project, shared)
    return sendJson(res, 200, {
      projectId: project.id,
      defaultEnvironment: environments.find(e => e.default)?.id || environments[0]?.id || null,
      environments,
      sharedEnvironmentCandidates: await sharedEnvironmentCandidates(project, shared),
    })
  }

  {
    const m = pathname.match(/\/preview-lane\/environments\/([^/]+)\/(status|start|stop|restart|build)$/)
    if (m) {
      const action = m[2]
      if ((action === 'status' && method !== 'GET') || (action !== 'status' && method !== 'POST')) return false

      const resolved = await resolveProjectEnvironment(getProject, projectId, decodeURIComponent(m[1]), shared)
      if (resolved.errorStatus) return sendJson(res, resolved.errorStatus, { error: resolved.error })
      const { project, environment } = resolved

      try {
        if (action === 'status') {
          const result = await composeStatus(project, environment, shared)
          return sendJson(res, 200, {
            ...result,
            environment,
            previewTargets: environment.previewTargets || fallbackPreviewTargets(project),
          })
        }

        runComposeDetached(project, environment, action, helpers.logger, shared)
        return sendJson(res, 200, {
          ok: true,
          environment,
          message: action === 'start'
            ? 'コンテナを起動しています...'
            : action === 'stop'
              ? 'コンテナを停止しています...'
              : action === 'restart'
                ? 'コンテナを再起動しています...'
                : 'イメージをビルドしています...',
        })
      } catch (e) {
        if (action === 'status') {
          return sendJson(res, 200, {
            status: 'error',
            containers: [],
            environment,
            previewTargets: environment.previewTargets || fallbackPreviewTargets(project),
            error: e.message,
            message: 'Dockerが起動していないか、コマンドの実行に失敗しました。'
          })
        }
        return sendJson(res, e.status || 500, { error: e.message })
      }
    }
  }

  if (pathname.endsWith('/preview-lane/status') && method === 'GET') {
    const project = await getProject(projectId)
    if (!project) return sendJson(res, 404, { error: 'project not found' })

    const previewTargets = await previewTargetsForProject(project, shared)
    const environment = await dockerEnvironmentSummary(project, shared)
    try {
      const result = await composeStatus(project, environment, shared)
      return sendJson(res, 200, {
        ...result,
        environment,
        previewTargets,
      })
    } catch (e) {
      // dockerコマンド自体が失敗した場合（Docker未起動など）
      return sendJson(res, 200, {
        status: 'error',
        containers: [],
        environment,
        previewTargets,
        error: e.message,
        message: 'Dockerが起動していないか、コマンドの実行に失敗しました。'
      })
    }
  }

  if (pathname.endsWith('/preview-lane/start') && method === 'POST') {
    const project = await getProject(projectId)
    if (!project) return sendJson(res, 404, { error: 'project not found' })

    try {
      const environment = await dockerEnvironmentSummary(project, shared)
      runComposeDetached(project, environment, 'start', helpers.logger, shared)
      return sendJson(res, 200, { ok: true, message: 'コンテナを起動しています...' })
    } catch (e) {
      return sendJson(res, e.status || 500, { error: e.message })
    }
  }

  if (pathname.endsWith('/preview-lane/stop') && method === 'POST') {
    const project = await getProject(projectId)
    if (!project) return sendJson(res, 404, { error: 'project not found' })

    try {
      const environment = await dockerEnvironmentSummary(project, shared)
      runComposeDetached(project, environment, 'stop', helpers.logger, shared)
      return sendJson(res, 200, { ok: true, message: 'コンテナを停止しています...' })
    } catch (e) {
      return sendJson(res, e.status || 500, { error: e.message })
    }
  }

  if (pathname.endsWith('/preview-lane/restart') && method === 'POST') {
    const project = await getProject(projectId)
    if (!project) return sendJson(res, 404, { error: 'project not found' })

    try {
      const environment = await dockerEnvironmentSummary(project, shared)
      runComposeDetached(project, environment, 'restart', helpers.logger, shared)
      return sendJson(res, 200, { ok: true, message: 'コンテナを再起動しています...' })
    } catch (e) {
      return sendJson(res, e.status || 500, { error: e.message })
    }
  }

  if (pathname.endsWith('/preview-lane/build') && method === 'POST') {
    const project = await getProject(projectId)
    if (!project) return sendJson(res, 404, { error: 'project not found' })

    try {
      const environment = await dockerEnvironmentSummary(project, shared)
      runComposeDetached(project, environment, 'build', helpers.logger, shared)
      return sendJson(res, 200, { ok: true, message: 'イメージをビルドしています...' })
    } catch (e) {
      return sendJson(res, e.status || 500, { error: e.message })
    }
  }

  if (pathname.endsWith('/preview-lane/open-folder') && method === 'POST') {
    const project = await getProject(projectId)
    if (!project) return sendJson(res, 404, { error: 'project not found' })

    const capErr = requireRootCapability(rootForProject(project), 'openExternal')
    if (capErr) return sendJson(res, capErr.status, { error: capErr.error })

    try {
      await openSystemPath(project.projectDir)
      return sendJson(res, 200, { ok: true, opened: project.projectDir })
    } catch (e) {
      return sendJson(res, 500, { error: e.message })
    }
  }

  return false
}
