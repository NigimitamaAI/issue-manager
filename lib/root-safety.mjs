import os from 'node:os'
import path from 'node:path'

function norm(p) {
  return path.resolve(String(p || '')).replace(/[\\/]+$/, '').toLowerCase()
}

function sameOrInside(parent, child) {
  const p = norm(parent)
  const c = norm(child)
  if (!p || !c) return false
  if (p === c) return true
  const rel = path.relative(p, c)
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel)
}

function isFsRoot(rootPath) {
  const parsed = path.parse(path.resolve(rootPath))
  return norm(parsed.root) === norm(rootPath)
}

function commonWindowsDirs() {
  if (process.platform !== 'win32') return []
  const drive = (process.env.SystemDrive || 'C:').replace(/[\\/]+$/, '')
  return [
    process.env.WINDIR,
    process.env.SystemRoot,
    `${drive}\\Program Files`,
    `${drive}\\Program Files (x86)`,
    `${drive}\\ProgramData`,
  ].filter(Boolean)
}

function commonUserDirs(home) {
  if (!home) return []
  const parsedHome = path.parse(path.resolve(home))
  const userContainer = path.dirname(path.resolve(home))
  return [
    userContainer && userContainer !== parsedHome.root ? userContainer : '',
    home,
    path.join(home, 'Desktop'),
    path.join(home, 'Documents'),
    path.join(home, 'Downloads'),
    path.join(home, 'Pictures'),
    path.join(home, 'Videos'),
    path.join(home, 'Music'),
  ]
}

function looksLikeCloudSyncRoot(rootPath) {
  const parts = path.resolve(rootPath).split(/[\\/]+/).map(s => s.toLowerCase())
  return parts.some(part =>
    part === 'onedrive' ||
    part.startsWith('onedrive - ') ||
    part === 'dropbox' ||
    part === 'google drive' ||
    part === 'icloud drive' ||
    part === 'icloudrive'
  )
}

export function assessRootSafety(rootPath) {
  const resolved = path.resolve(String(rootPath || ''))
  if (!resolved) {
    return { level: 'blocked', code: 'empty', message: 'root path is empty' }
  }

  if (isFsRoot(resolved)) {
    return {
      level: 'blocked',
      code: 'filesystem_root',
      message: 'ドライブ直下やファイルシステム root は広すぎるため登録できません。専用の作業フォルダを指定してください。',
    }
  }

  for (const dir of commonWindowsDirs()) {
    if (sameOrInside(dir, resolved)) {
      return {
        level: 'blocked',
        code: 'system_directory',
        message: 'OS / Program Files / ProgramData 配下は登録できません。専用の作業フォルダを指定してください。',
      }
    }
  }

  for (const dir of commonUserDirs(os.homedir())) {
    if (norm(dir) === norm(resolved)) {
      return {
        level: 'blocked',
        code: 'user_profile',
        message: 'ユーザープロファイルや Desktop/Documents/Downloads 全体は広すぎるため登録できません。配下に専用フォルダを作って指定してください。',
      }
    }
  }

  if (looksLikeCloudSyncRoot(resolved)) {
    return {
      level: 'warning',
      code: 'cloud_sync',
      message: '同期フォルダ配下です。大量変更や同期競合を避けるため、専用サブフォルダだけを root にする運用を推奨します。',
    }
  }

  return { level: 'ok', code: 'ok', message: '' }
}

export function isRootBlocked(rootPath) {
  return assessRootSafety(rootPath).level === 'blocked'
}
