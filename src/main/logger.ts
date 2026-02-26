/**
 * Main process logger: writes to console and to a rotating log file in userData/logs.
 * Use this so crashes and errors are visible in the terminal and persist in a file
 * you can open after the app exits (e.g. when switching tabs causes a crash).
 */

import { appendFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const
type LogLevel = (typeof LOG_LEVELS)[number]

let logDir: string | null = null
const LOG_FILE = 'locus.log'
const MAX_LOG_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB
const MAX_BACKUPS = 2

export function setLogDir(dir: string): void {
  logDir = dir
  const logsPath = join(logDir, 'logs')
  if (!existsSync(logsPath)) {
    try {
      mkdirSync(logsPath, { recursive: true })
    } catch (e) {
      console.error('[Locus logger] Failed to create logs dir:', e)
    }
  }
}

export function getLogPath(): string | null {
  if (!logDir) return null
  return join(logDir, 'logs', LOG_FILE)
}

function logFilePath(): string | null {
  if (!logDir) return null
  return join(logDir, 'logs', LOG_FILE)
}

function formatMessage(level: LogLevel, processLabel: string, message: string, detail?: unknown): string {
  const ts = new Date().toISOString()
  const detailStr = detail !== undefined && detail !== null ? ` ${JSON.stringify(detail)}` : ''
  return `[${ts}] [${level.toUpperCase()}] [${processLabel}] ${message}${detailStr}\n`
}

function appendToFile(line: string): void {
  const path = logFilePath()
  if (!path) return
  try {
    appendFileSync(path, line, 'utf-8')
  } catch (e) {
    console.error('[Locus logger] Failed to write to log file:', e)
  }
}

export function log(
  level: LogLevel,
  processLabel: string,
  message: string,
  detail?: unknown
): void {
  const line = formatMessage(level, processLabel, message, detail)
  if (level === 'error') {
    console.error(line.trim())
  } else if (level === 'warn') {
    console.warn(line.trim())
  } else {
    console.log(line.trim())
  }
  appendToFile(line)
}

export function logError(processLabel: string, message: string, err?: unknown): void {
  const stack = err instanceof Error ? err.stack : undefined
  const detail = err instanceof Error ? { name: err.name, message: err.message, stack } : err
  log('error', processLabel, message, detail ?? undefined)
  if (stack) appendToFile(`  ${stack}\n`)
}
