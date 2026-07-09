import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { sendAIChatMessage } from '../lib/api'
import type { AIChatMessage } from '../lib/autoquant.types'

export const Route = createFileRoute('/runs/$runId/chat')({
  component: AIChat,
})

function AIChat() {
  const { runId } = Route.useParams()
  const [messages, setMessages] = useState<AIChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Load messages from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(`chat-${runId}`)
    if (stored) {
      setMessages(JSON.parse(stored))
    }
  }, [runId])

  // Save messages to localStorage when they change
  useEffect(() => {
    localStorage.setItem(`chat-${runId}`, JSON.stringify(messages))
  }, [messages, runId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: AIChatMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const stream = await sendAIChatMessage(runId, input)
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        assistantContent += decoder.decode(value, { stream: true })
        
        // Update the last message with partial content
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: assistantContent }]
          }
          return prev
        })
      }

      // Finalize the assistant message
      const assistantMessage: AIChatMessage = {
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date().toISOString(),
      }

      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant') {
          return prev
        }
        return [...prev, assistantMessage]
      })
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, there was an error processing your message.',
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 ? (
          <div className="text-center text-text-muted py-8">
            <p>Start a conversation about this run</p>
            <p className="text-sm mt-2">Ask about performance, parameters, or recommendations</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-4 ${
                  message.role === 'user'
                    ? 'bg-primary/20 text-primary'
                    : 'glass'
                }`}
              >
                <div className="prose prose-invert max-w-none text-sm">
                  {message.content}
                </div>
                <div className="text-[10px] text-text-muted mt-2">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="glass rounded-lg p-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this run..."
          className="flex-1 px-4 py-2 rounded-lg bg-background border border-border text-text focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-4 py-2 rounded-lg bg-primary text-background font-medium hover:bg-primary-dim transition-colors neon-ring-primary disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  )
}
