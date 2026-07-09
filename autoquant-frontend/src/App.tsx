import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Link, Outlet, createRootRoute } from '@tanstack/react-router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

export const Route = createRootRoute({
  component: () => (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background text-text font-display">
        <nav className="glass border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link to="/" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/20 neon-ring-primary flex items-center justify-center">
                  <span className="text-primary font-bold">AQ</span>
                </div>
                <span className="text-xl font-bold neon-glow-primary">AutoQuant</span>
              </Link>
              <div className="flex items-center gap-4">
                <Link
                  to="/"
                  className="text-sm text-text-muted hover:text-primary transition-colors"
                  activeProps={{ className: 'text-primary' }}
                >
                  Runs
                </Link>
                <Link
                  to="/runs/new"
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors neon-ring-primary"
                >
                  New Run
                </Link>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Outlet />
        </main>
      </div>
    </QueryClientProvider>
  ),
})
