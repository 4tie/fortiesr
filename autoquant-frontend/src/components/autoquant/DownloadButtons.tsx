import { useNavigate } from '@tanstack/react-router'

export default function DownloadButtons() {
  const { runId } = useNavigate().state.location.params as { runId: string }

  const handleDownload = (filename: string) => {
    const url = `/api/auto-quant/runs/${runId}/download/${filename}`
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => handleDownload('strategy.py')}
        className="px-4 py-2 text-sm rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
      >
        Download Strategy
      </button>
      <button
        onClick={() => handleDownload('hyperopt.json')}
        className="px-4 py-2 text-sm rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
      >
        Download Hyperopt JSON
      </button>
      <button
        onClick={() => handleDownload('report.pdf')}
        className="px-4 py-2 text-sm rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
      >
        Download PDF Report
      </button>
    </div>
  )
}
