import path from 'node:path'

function resolveMaybePath(value, fallback, baseDir) {
  const raw = typeof value === 'string' && value.trim() ? value.trim() : fallback
  if (!path.isAbsolute(raw)) return path.resolve(baseDir, raw)
  return path.resolve(raw)
}

export function normalizeSharedConfig(config = {}, appRoot = process.cwd()) {
  const shared = config.shared && typeof config.shared === 'object' ? config.shared : {}
  const sharedRoot = resolveMaybePath(
    shared.root || config.sharedRoot,
    path.join(appRoot, '_share'),
    appRoot,
  )
  const dockerRoot = resolveMaybePath(
    shared.dockerRoot || config.sharedDockerRoot,
    path.join(sharedRoot, 'docker'),
    appRoot,
  )
  const traefikRoot = resolveMaybePath(
    shared.traefikRoot || config.sharedTraefikRoot,
    path.join(sharedRoot, 'traefik'),
    appRoot,
  )
  return {
    root: sharedRoot,
    dockerRoot,
    traefikRoot,
  }
}

export function makeProjectSharedDockerPolicy() {
  return {
    sharedDefinition: 'issue-manager-config',
    referenceMode: 'sharedEnvironmentId',
    note: '共有Docker/Traefikの実体パスはプロジェクトではなく、issue_manager の config.shared から解決する。',
  }
}
