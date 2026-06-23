import { spawn } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import http from 'node:http'
import { join } from 'node:path'

const rootDir = process.cwd()
const args = process.argv.slice(2)

if (args[0] === 'dev') {
  runDev().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
} else {
  runTauriCli(args)
}

function cleanEnv() {
  const env = { ...process.env }

  // 部分终端会注入 X11/XPC/宿主 bundle 变量，导致 macOS dev 二进制无法注册为可见 GUI app。
  for (const key of ['DISPLAY', 'XPC_FLAGS', 'XPC_SERVICE_NAME', '__CFBundleIdentifier']) {
    delete env[key]
  }

  return env
}

// Node 18.20+/20.12+ 起禁止在不带 shell 的情况下 spawn .cmd/.bat（CVE-2024-27980），
// 直接 spawn('npm.cmd') 会抛 EINVAL。npm/tauri 在 Windows 下都是 .cmd 包装。
// 但给 spawn 加 shell:true 又会触发 DEP0190 转义告警。折中：Windows 下需要走 .cmd 的
// 命令，显式包成 `cmd.exe /c <cmd> <args...>`，shell 保持 false，既不抛 EINVAL 也无告警。
// cargo / osascript 是真二进制，无需包装。
function normalizeSpawn(command, commandArgs) {
  if (process.platform === 'win32') {
    const base = command.replace(/^.*[\\/]/, '').toLowerCase()
    const needsCmdShim = /\.(cmd|bat)$/.test(base) || base === 'npm' || base === 'tauri'
    if (needsCmdShim) {
      return { command: process.env.ComSpec || 'cmd.exe', args: ['/c', command, ...commandArgs] }
    }
  }

  return { command, args: commandArgs }
}

function runTauriCli(tauriArgs) {
  const executable = process.platform === 'win32' ? 'tauri.cmd' : 'tauri'
  const localTauri = join(rootDir, 'node_modules', '.bin', executable)
  const command = existsSync(localTauri) ? localTauri : executable

  const { command: spawnCmd, args: spawnArgs } = normalizeSpawn(command, tauriArgs)

  const child = spawn(spawnCmd, spawnArgs, {
    env: cleanEnv(),
    stdio: 'inherit',
  })

  child.on('error', (error) => {
    console.error(error.message)
    process.exit(1)
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }

    process.exit(code ?? 1)
  })
}

async function runDev() {
  const env = cleanEnv()
  const { command: viteCmd, args: viteArgs } = normalizeSpawn(npmCommand(), [
    'run',
    'dev',
    '--',
    '--host',
    '127.0.0.1',
    '--port',
    '1420',
    '--strictPort',
  ])
  const vite = spawn(viteCmd, viteArgs, {
    cwd: rootDir,
    env,
    stdio: 'inherit',
  })

  let cargo = null
  let lastSnapshot = snapshotWatchedFiles()
  let poller = null
  let restartPending = false
  let restartTimer = null
  let shuttingDown = false

  const shutdown = (code) => {
    if (shuttingDown) {
      return
    }

    shuttingDown = true
    clearTimeout(restartTimer)
    clearInterval(poller)
    stopChild(cargo)
    stopChild(vite)
    process.exit(code)
  }

  const startCargo = () => {
    if (shuttingDown || cargo) {
      return
    }

    const { command: cargoCmd, args: cargoArgs } = normalizeSpawn('cargo', [
      'run',
      '--no-default-features',
      '--color',
      'always',
      '--',
    ])
    cargo = spawn(cargoCmd, cargoArgs, {
      cwd: join(rootDir, 'src-tauri'),
      env,
      stdio: 'inherit',
    })

    raiseMacosWindow()
    setTimeout(raiseMacosWindow, 1200)
    setTimeout(raiseMacosWindow, 2500)
    setTimeout(raiseMacosWindow, 5000)
    setTimeout(raiseMacosWindow, 8000)

    cargo.on('error', (error) => {
      console.error(error.message)
      shutdown(1)
    })

    cargo.on('exit', (code, signal) => {
      cargo = null

      if (shuttingDown) {
        return
      }

      if (restartPending) {
        restartPending = false
        restartTimer = setTimeout(startCargo, 150)
        return
      }

      if (signal) {
        shutdown(1)
        return
      }

      if (code === 0) {
        shutdown(0)
        return
      }

      console.error(`[tauri-dev] cargo run exited with code ${code}; waiting for src-tauri changes...`)
    })
  }

  const restartCargo = () => {
    if (shuttingDown) {
      return
    }

    restartPending = true

    if (cargo) {
      stopChild(cargo)
    } else {
      clearTimeout(restartTimer)
      restartTimer = setTimeout(startCargo, 150)
    }
  }

  vite.on('error', (error) => {
    console.error(error.message)
    shutdown(1)
  })

  vite.on('exit', (code, signal) => {
    if (shuttingDown) {
      return
    }

    console.error(`[tauri-dev] Vite exited${signal ? ` by signal ${signal}` : ` with code ${code}`}`)
    shutdown(code ?? 1)
  })

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => shutdown(signal === 'SIGINT' ? 130 : 143))
  }

  await waitForUrl('http://127.0.0.1:1420/')

  poller = setInterval(() => {
    const nextSnapshot = snapshotWatchedFiles()
    if (nextSnapshot === lastSnapshot) {
      return
    }

    lastSnapshot = nextSnapshot
    restartCargo()
  }, 1000)

  startCargo()
}

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm'
}

function stopChild(child) {
  if (!child || child.killed) {
    return
  }

  child.kill('SIGINT')
}

function raiseMacosWindow() {
  if (process.platform !== 'darwin') {
    return
  }

  const script = [
    'tell application "System Events"',
    'set targetProcesses to every process whose name is "inkwing" or name is "Inkwing"',
    'repeat with p in targetProcesses',
    'if (count of windows of p) > 0 then',
    'perform action "AXRaise" of window 1 of p',
    'set frontmost of p to true',
    'end if',
    'end repeat',
    'end tell',
  ]

  const child = spawn('osascript', script.flatMap((line) => ['-e', line]), {
    stdio: 'ignore',
  })

  child.on('error', () => {})
}

function waitForUrl(url) {
  const startedAt = Date.now()

  return new Promise((resolve, reject) => {
    const probe = () => {
      const request = http.get(url, (response) => {
        response.resume()

        if (response.statusCode && response.statusCode < 500) {
          resolve()
          return
        }

        retry()
      })

      request.on('error', retry)
      request.setTimeout(1000, () => {
        request.destroy()
        retry()
      })
    }

    const retry = () => {
      if (Date.now() - startedAt > 30000) {
        reject(new Error('[tauri-dev] timed out waiting for http://127.0.0.1:1420/'))
        return
      }

      setTimeout(probe, 250)
    }

    probe()
  })
}

function snapshotWatchedFiles() {
  const entries = []
  const roots = [
    join(rootDir, 'src-tauri', 'src'),
    join(rootDir, 'src-tauri', 'capabilities'),
    join(rootDir, 'src-tauri', 'Cargo.toml'),
    join(rootDir, 'src-tauri', 'tauri.conf.json'),
  ]

  for (const path of roots) {
    collectFileStats(path, entries)
  }

  return entries.sort().join('\n')
}

function collectFileStats(path, entries) {
  let stats

  try {
    stats = statSync(path)
  } catch {
    return
  }

  if (stats.isDirectory()) {
    for (const entry of readdirSync(path)) {
      collectFileStats(join(path, entry), entries)
    }

    return
  }

  entries.push(`${path}:${stats.mtimeMs}:${stats.size}`)
}
