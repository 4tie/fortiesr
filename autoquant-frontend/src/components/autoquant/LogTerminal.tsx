import { useState, useRef, useEffect } from 'react'
import type { LogEntry, LogLevel } from '../../lib/autoquant.types'

interface LogTerminalProps {
  logs: LogEntry[]
}

export default function LogTerminal({ logs }: LogTerminalProps) {
  const [filter, setFilter] = useState<LogLevel | 'all'>('all')
  const [search, setSearch] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  const filteredLogs = logs.filter(log => {
    if (filter !== 'all' && log.level !== filter) return false
    if (search && !log.message.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case 'error': return 'text-destructive'
      case 'warn': return 'text-warning'
      case 'info': return 'text-primary'
      case 'debug': return 'text-text-muted'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as LogLevel | 'all')}
          className="px-3 py-1.5 text-sm rounded-lg bg-background border border-border text-text focus:border-primary focus:ring-1 focus:ring-primary outline-none"
        >
          <option value="all">All Levels</option>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
        </select>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search logs..."
          className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-background border border-border text-text focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono"
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary"
          />
          Auto-scroll
        </label>
      </div>

      <div
        ref={containerRef}
        className="h-64 overflow-y-auto rounded-lg bg-background border border-border p-4 font-mono text-xs space-y-1"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-text-muted text-center py-8">No logs to display</div>
        ) : (
          filteredLogs.map((log, index) => (
            <div key={index} className="flex gap-2">
              <span className="text-text-muted shrink-0">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className={`shrink-0 uppercase ${getLevelColor(log.level)}`}>
                [{log.level}]
              </span>
              <span className="flex-1 break-words">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
