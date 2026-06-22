import { useState, useEffect, useRef } from "react";
import { useLiveEvents } from "../hooks/useLiveEvents.js";

const AGENT_COLORS = {
  Orchestrator: "#A78BFA",
  Scout: "#7DD3FC",
  Scribe: "#F472B6",
  Reach: "#E879F9",
  Dev: "#A78BFA",
};

function Eyebrow() {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-2 h-2 rounded-full bg-mint pulse-mint" />
      <div className="h-px flex-1 bg-white/10" />
      <span className="font-mono text-xs text-mint tracking-wider">4TIE</span>
      <div className="h-px flex-1 bg-white/10" />
      <span className="font-mono text-[10px] text-muted">v1.1</span>
    </div>
  );
}

function RadarDisplay({ agents }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const centerX = 70;
    const centerY = 70;
    const maxRadius = 62;

    let rotation = 0;

    const draw = () => {
      ctx.clearRect(0, 0, 140, 140);

      // Draw concentric circles
      [62, 46, 30, 14].forEach(radius => {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.stroke();
      });

      // Draw crosshairs
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(140, centerY);
      ctx.moveTo(centerX, 0);
      ctx.lineTo(centerX, 140);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.stroke();

      // Draw sweep line
      rotation += 0.02;
      const sweepX = centerX + Math.cos(rotation) * maxRadius;
      const sweepY = centerY + Math.sin(rotation) * maxRadius;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(sweepX, sweepY);
      ctx.strokeStyle = '#7DD3FC';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw sweep dot
      ctx.beginPath();
      ctx.arc(sweepX, sweepY, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#7DD3FC';
      ctx.fill();

      // Draw agent dots
      const totalResponses = agents.reduce((sum, agent) => sum + agent.responses, 0);
      agents.forEach((agent, index) => {
        const angle = (index / agents.length) * Math.PI * 2 - Math.PI / 2;
        const distance = (agent.responses / totalResponses) * maxRadius * 0.8;
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;

        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = AGENT_COLORS[agent.name] || '#A78BFA';
        ctx.fill();

        // Glow effect
        ctx.shadowColor = AGENT_COLORS[agent.name] || '#A78BFA';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      requestAnimationFrame(draw);
    };

    draw();
  }, [agents]);

  return (
    <svg viewBox="0 0 140 140" className="w-[180px] h-[180px]">
      <foreignObject x="0" y="0" width="140" height="140">
        <canvas ref={canvasRef} width={140} height={140} />
      </foreignObject>
    </svg>
  );
}

function CurrentDirective({ events }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (events.length === 0) return;

    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % events.length);
        setVisible(true);
      }, 300);
    }, 2600);

    return () => clearInterval(interval);
  }, [events.length]);

  const currentEvent = events[currentIndex];

  return (
    <div className="min-h-[60px]">
      <div className="font-mono text-[10px] text-muted mb-2">CURRENT DIRECTIVE</div>
      <div className={`font-mono text-[15px] text-cyan transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>
        {currentEvent ? `${currentEvent.agent} · ${currentEvent.task}` : 'Initializing...'}
      </div>
    </div>
  );
}

function ContextWindow({ agents }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (agents.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % agents.length);
    }, 2400);

    return () => clearInterval(interval);
  }, [agents.length]);

  const currentAgent = agents[currentIndex];
  
  if (!currentAgent) {
    return (
      <div>
        <div className="font-mono text-[10px] text-muted mb-3">CONTEXT WINDOW</div>
        <div className="text-muted text-sm">Loading agents...</div>
      </div>
    );
  }

  const totalResponses = agents.reduce((sum, agent) => sum + (agent.responses || 0), 0);
  const share = totalResponses > 0 ? (currentAgent.responses || 0) / totalResponses : 0;
  const filledSegments = Math.round(share * 16);

  return (
    <div>
      <div className="font-mono text-[10px] text-muted mb-3">CONTEXT WINDOW</div>
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-sm font-medium" style={{ color: AGENT_COLORS[currentAgent.name] || '#A78BFA' }}>
          {currentAgent.name ? currentAgent.name.toUpperCase() : 'UNKNOWN'}
        </span>
        <span className="font-mono text-xs text-muted">{currentAgent.responses || 0} tasks</span>
      </div>
      <div className="flex gap-1 mb-2">
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            className="h-[5px] flex-1 rounded-sm transition-all duration-300"
            style={{
              backgroundColor: i < filledSegments ? (AGENT_COLORS[currentAgent.name] || '#A78BFA') : 'rgba(255,255,255,0.05)',
              animation: i < filledSegments ? `pulse 1.5s ease-in-out ${i * 0.1}s infinite` : 'none',
            }}
          />
        ))}
      </div>
      <div className="font-mono text-[10px] text-muted">{currentAgent.status || 'Unknown'}</div>
    </div>
  );
}

function OpsConsoleFooter({ stats }) {
  return (
    <div className="grid grid-cols-5 gap-2 mt-4">
      <div className="glass-card p-3 text-center">
        <div className="font-mono text-[10px] text-muted">QUEUE</div>
        <div className="font-mono text-lg">{stats.queue}</div>
      </div>
      <div className="glass-card p-3 text-center">
        <div className="font-mono text-[10px] text-muted">SESSIONS</div>
        <div className="font-mono text-lg">{stats.sessions}</div>
      </div>
      <div className="glass-card p-3 text-center">
        <div className="font-mono text-[10px] text-muted">ERRORS</div>
        <div className={`font-mono text-lg ${stats.errors > 0 ? 'text-red' : ''}`}>{stats.errors}</div>
      </div>
      <div className="glass-card p-3 text-center">
        <div className="font-mono text-[10px] text-muted">TODAY</div>
        <div className="font-mono text-lg">{stats.today}</div>
      </div>
      <div className="glass-card p-3 text-center">
        <div className="font-mono text-[10px] text-muted">UPTIME</div>
        <div className="font-mono text-lg">{stats.uptime}</div>
      </div>
    </div>
  );
}

function LiveOpsConsole({ agents, events, stats }) {
  return (
    <div className="glass-card p-6">
      <div className="grid grid-cols-[180px_1fr_1fr] gap-8">
        <RadarDisplay agents={agents} />
        <div>
          <CurrentDirective events={events} />
          <ContextWindow agents={agents} />
        </div>
        <div className="flex flex-col justify-center">
          <div className="font-mono text-[10px] text-muted mb-2">SYSTEM STATUS</div>
          <div className="space-y-2">
            {agents.map(agent => (
              <div key={agent.name} className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: AGENT_COLORS[agent.name] }}
                />
                <span className="font-mono text-xs">{agent.name}</span>
                <span className="font-mono text-[10px] text-muted ml-auto">{agent.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <OpsConsoleFooter stats={stats} />
    </div>
  );
}

function StatsStrip() {
  const [stats, setStats] = useState({
    integrity: 99.95,
    agentCalls: 1247,
    messages: 8432,
    tokensIn: '2.1M',
    cacheHits: 94.2,
  });

  useEffect(() => {
    // Fetch stats from backend
    fetch('/api/system/metrics')
      .then(res => res.json())
      .then(data => setStats(prev => data.metrics || prev))
      .catch(err => console.error('Failed to fetch metrics:', err));
  }, []);

  const statsArray = [
    { label: 'Integrity', value: `${stats.integrity.toFixed(2)}%`, color: 'mint', subtext: '5 of 5 responsive' },
    { label: 'Agent Calls', value: stats.agentCalls.toLocaleString(), color: 'cyan', subtext: '+12% from yesterday' },
    { label: 'Messages', value: stats.messages.toLocaleString(), color: 'violet-glow', subtext: '2.4k per hour' },
    { label: 'Tokens In', value: stats.tokensIn, color: 'gold', subtext: 'Avg 1.2k per msg' },
    { label: 'Cache Hits', value: `${stats.cacheHits}%`, color: 'pink', subtext: '8.2k saved calls' },
  ];

  return (
    <div className="grid grid-cols-5 gap-4 mb-6">
      {statsArray.map((stat) => (
        <div
          key={stat.label}
          className="glass-card p-4"
          style={{ borderTopColor: `var(--${stat.color})`, borderTopWidth: '2px' }}
        >
          <div className="font-mono text-[10px] text-muted mb-2">{stat.label}</div>
          <div
            className="font-medium"
            style={{ fontSize: 'clamp(24px, 2.4vw, 34px)', fontWeight: 500 }}
          >
            {stat.value}
          </div>
          <div className="font-mono text-[10px] text-muted mt-1">{stat.subtext}</div>
        </div>
      ))}
    </div>
  );
}

function Throughput() {
  const canvasRef = useRef(null);
  const [totalResponses, setTotalResponses] = useState(12478);
  const [mostActiveDay, setMostActiveDay] = useState('Monday');
  const [weeklyData, setWeeklyData] = useState([]);

  useEffect(() => {
    // Fetch throughput data from backend
    fetch('/api/system/throughput')
      .then(res => res.json())
      .then(data => {
        setTotalResponses(data.totalResponses || 12478);
        setMostActiveDay(data.mostActiveDay || 'Monday');
        setWeeklyData(data.weeklyData || Array.from({ length: 7 }, () => Math.random() * 0.8 + 0.1));
      })
      .catch(err => console.error('Failed to fetch throughput:', err));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Use real data or fallback to random data
      const data = weeklyData.length > 0 ? weeklyData : Array.from({ length: 7 }, () => Math.random() * 0.8 + 0.1);
      const maxVal = Math.max(...data, 0.1);

      // Create gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
      gradient.addColorStop(1, 'rgba(125, 211, 252, 0.1)');

      // Draw filled area
      ctx.beginPath();
      ctx.moveTo(0, height);
      data.forEach((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - (val / maxVal) * height * 0.8;
        ctx.lineTo(x, y);
      });
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw line
      ctx.beginPath();
      data.forEach((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - (val / maxVal) * height * 0.8;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw dot at rightmost point
      const lastX = width;
      const lastY = height - (data[data.length - 1] / maxVal) * height * 0.8;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#7DD3FC';
      ctx.fill();
      ctx.shadowColor = '#7DD3FC';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    draw();

    const interval = setInterval(() => {
      draw();
    }, 900);

    return () => clearInterval(interval);
  }, [weeklyData]);

  return (
    <div className="glass-card p-6">
      <div className="flex items-baseline gap-4 mb-4">
        <div
          className="font-bold text-cyan"
          style={{ fontSize: 'clamp(34px, 4vw, 56px)', fontWeight: 700 }}
        >
          {totalResponses.toLocaleString()}
        </div>
        <span className="text-muted text-[18px]">responses total</span>
      </div>
      <canvas ref={canvasRef} width={400} height={100} className="w-full mb-2" />
      <div className="font-mono text-[10px] text-mint">Most active: {mostActiveDay}</div>
    </div>
  );
}

function Activity({ events }) {
  const [displayEvents, setDisplayEvents] = useState([]);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  useEffect(() => {
    if (events.length === 0) return;

    const interval = setInterval(() => {
      setDisplayEvents(prev => {
        const newEvent = events[0];
        if (!newEvent) return prev;
        const updated = [newEvent, ...prev].slice(0, 8);
        return updated;
      });
    }, 2200);

    return () => clearInterval(interval);
  }, [events]);

  const formatTime = (timestamp) => {
    const diff = currentTime - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="glass-card p-6">
      <div className="font-mono text-[10px] text-muted mb-4">ACTIVITY FEED</div>
      <div className="space-y-3">
        {displayEvents.map((event, index) => (
          <div
            key={index}
            className="flex items-center gap-3 text-sm transition-all duration-300"
            style={{
              opacity: 1 - index * 0.1,
              transform: `translateY(${index * 2}px)`,
            }}
          >
            <span
              className="font-mono text-[10px] px-2 py-0.5 rounded"
              style={{
                backgroundColor: `${AGENT_COLORS[event.agent]}20`,
                color: AGENT_COLORS[event.agent],
              }}
            >
              {event.agent}
            </span>
            <span className="text-text/80 flex-1 truncate">{event.task}</span>
            <span className={`font-mono text-[10px] ${event.status === 'success' ? 'text-mint' : 'text-red'}`}>
              {event.status}
            </span>
            <span className="font-mono text-[10px] text-muted ml-auto">
              {formatTime(event.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OverviewTab() {
  const { events } = useLiveEvents();
  const [agents, setAgents] = useState([]);
  const [stats, setStats] = useState({
    queue: 0,
    sessions: 0,
    errors: 0,
    today: 0,
    uptime: '0h 0m'
  });

  useEffect(() => {
    // Fetch agent status from backend
    fetch('/api/agent/status')
      .then(res => res.json())
      .then(data => setAgents(data.agents || []))
      .catch(err => console.error('Failed to fetch agents:', err));

    // Fetch system stats from backend
    fetch('/api/system/stats')
      .then(res => res.json())
      .then(data => setStats(data.stats || {
        queue: 0,
        sessions: 0,
        errors: 0,
        today: 0,
        uptime: '0h 0m'
      }))
      .catch(err => console.error('Failed to fetch stats:', err));
  }, []);

  const displayEvents = events;

  return (
    <div className="space-y-6">
      <Eyebrow />
      <LiveOpsConsole agents={agents} events={displayEvents} stats={stats} />
      <StatsStrip />
      <div className="grid grid-cols-[1.2fr_1fr] gap-6">
        <Throughput />
        <Activity events={displayEvents} />
      </div>
    </div>
  );
}
