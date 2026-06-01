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

// docker-compose.ymlの存在チェック
function hasDockerCompose(projectDir) {
  return (
    fs.existsSync(path.join(projectDir, 'docker-compose.yml')) ||
    fs.existsSync(path.join(projectDir, 'docker-compose.yaml'))
  )
}

export async function handlePreviewLaneRoute({ req, res, pathname, method, projectId, helpers }) {
  const {
    sendJson,
    getProject,
    rootForProject,
    requireRootCapability,
    openSystemPath,
  } = helpers

  if (pathname.endsWith('/preview-lane/status') && method === 'GET') {
    const project = await getProject(projectId)
    if (!project) return sendJson(res, 404, { error: 'project not found' })

    const projectDir = project.projectDir
    if (!hasDockerCompose(projectDir)) {
      return sendJson(res, 200, {
        status: 'not_configured',
        containers: [],
        message: 'docker-compose.yml が見つかりません。'
      })
    }

    try {
      const dockerCmd = getDockerCommand()
      // docker compose ps --format json を実行してコンテナ状態を取得
      const { stdout } = await execFileAsync(dockerCmd, ['compose', 'ps', '--format', 'json'], {
        cwd: projectDir,
        windowsHide: true,
        timeout: 10000,
      })

      // docker compose ps の出力形式 (古いバージョンでは1行に複数のJSONオブジェクトがある場合と、配列になっている場合がある)
      const lines = stdout.trim().split('\n').filter(Boolean)
      const containers = []
      
      for (const line of lines) {
        try {
          // もし全体が配列のJSONで出力された場合
          if (line.startsWith('[')) {
            const arr = JSON.parse(line)
            containers.push(...arr)
          } else {
            containers.push(JSON.parse(line))
          }
        } catch (_) {
          // パース失敗時は生の文字列を無視するか、テキストとして扱う
        }
      }

      const isRunning = containers.some(c => 
        String(c.State || c.Status).toLowerCase().includes('running') || 
        String(c.State || c.Status).toLowerCase().includes('up')
      )

      return sendJson(res, 200, {
        status: isRunning ? 'running' : 'stopped',
        containers: containers.map(c => ({
          name: c.Name || c.Service || 'unknown',
          state: c.State || c.Status || 'unknown',
          ports: c.Publishers ? c.Publishers.map(p => `${p.URL}:${p.TargetPort}->${p.PublishedPort}`).join(', ') : (c.Ports || '')
        }))
      })
    } catch (e) {
      // dockerコマンド自体が失敗した場合（Docker未起動など）
      return sendJson(res, 200, {
        status: 'error',
        containers: [],
        error: e.message,
        message: 'Dockerが起動していないか、コマンドの実行に失敗しました。'
      })
    }
  }

  if (pathname.endsWith('/preview-lane/start') && method === 'POST') {
    const project = await getProject(projectId)
    if (!project) return sendJson(res, 404, { error: 'project not found' })

    const projectDir = project.projectDir
    if (!hasDockerCompose(projectDir)) {
      return sendJson(res, 400, { error: 'docker-compose.yml が存在しません。' })
    }

    try {
      const dockerCmd = getDockerCommand()
      // 非同期でバックグラウンド実行 (up -d)
      execFile(dockerCmd, ['compose', 'up', '-d'], {
        cwd: projectDir,
        windowsHide: true,
      }, (error, stdout, stderr) => {
        if (error) {
          helpers.logger.logErr(`[preview-lane] Start error on ${project.name}: ${error.message}`)
        } else {
          helpers.logger.log(`[preview-lane] Started environment for ${project.name}`)
        }
      })

      return sendJson(res, 200, { ok: true, message: 'コンテナを起動しています...' })
    } catch (e) {
      return sendJson(res, 500, { error: e.message })
    }
  }

  if (pathname.endsWith('/preview-lane/stop') && method === 'POST') {
    const project = await getProject(projectId)
    if (!project) return sendJson(res, 404, { error: 'project not found' })

    const projectDir = project.projectDir
    if (!hasDockerCompose(projectDir)) {
      return sendJson(res, 400, { error: 'docker-compose.yml が存在しません。' })
    }

    try {
      const dockerCmd = getDockerCommand()
      // 非同期で停止実行 (down)
      execFile(dockerCmd, ['compose', 'down'], {
        cwd: projectDir,
        windowsHide: true,
      }, (error, stdout, stderr) => {
        if (error) {
          helpers.logger.logErr(`[preview-lane] Stop error on ${project.name}: ${error.message}`)
        } else {
          helpers.logger.log(`[preview-lane] Stopped environment for ${project.name}`)
        }
      })

      return sendJson(res, 200, { ok: true, message: 'コンテナを停止しています...' })
    } catch (e) {
      return sendJson(res, 500, { error: e.message })
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
