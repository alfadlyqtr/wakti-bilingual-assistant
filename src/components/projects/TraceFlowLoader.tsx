export const TraceFlowLoader = () => {
  return (
    <div className="main-container">
      <svg className="loader" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="traceGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00ccff" stopOpacity="0" />
            <stop offset="50%" stopColor="#00ccff" stopOpacity="1" />
            <stop offset="100%" stopColor="#00ccff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="traceGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff00cc" stopOpacity="0" />
            <stop offset="50%" stopColor="#ff00cc" stopOpacity="1" />
            <stop offset="100%" stopColor="#ff00cc" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="traceGradient3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00ff88" stopOpacity="0" />
            <stop offset="50%" stopColor="#00ff88" stopOpacity="1" />
            <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="traceGradient4" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffcc00" stopOpacity="0" />
            <stop offset="50%" stopColor="#ffcc00" stopOpacity="1" />
            <stop offset="100%" stopColor="#ffcc00" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        <g id="grid">
          {[0, 50, 100, 150, 200, 250, 300].map((y) => (
            <line key={`h-${y}`} className="grid-line" x1="0" y1={y} x2="400" y2={y} />
          ))}
          {[0, 50, 100, 150, 200, 250, 300, 350, 400].map((x) => (
            <line key={`v-${x}`} className="grid-line" x1={x} y1="0" x2={x} y2="300" />
          ))}
        </g>

        {/* Browser frame */}
        <g id="browser">
          <rect className="browser-frame" x="100" y="60" width="200" height="150" rx="8" ry="8" />
          <rect className="browser-top" x="100" y="60" width="200" height="25" rx="8" ry="8" />
          <rect x="100" y="77" width="200" height="8" fill="#111" />
          
          {/* Browser dots */}
          <circle cx="115" cy="72" r="5" fill="#ff5f57" />
          <circle cx="130" cy="72" r="5" fill="#febc2e" />
          <circle cx="145" cy="72" r="5" fill="#28c840" />
          
          {/* Loading text */}
          <text className="loading-text" x="170" y="76">Loading...</text>

          {/* Skeleton elements */}
          <rect className="skeleton" x="115" y="95" width="170" height="12" rx="4" ry="4" />
          <rect className="skeleton" x="115" y="115" width="120" height="10" rx="4" ry="4" style={{ animationDelay: '0.2s' }} />
          <rect className="skeleton" x="115" y="133" width="150" height="10" rx="4" ry="4" style={{ animationDelay: '0.4s' }} />
          <rect className="skeleton" x="115" y="155" width="170" height="40" rx="4" ry="4" style={{ animationDelay: '0.6s' }} />
        </g>

        {/* Trace flow paths - flowing INTO the browser */}
        <path className="trace-flow" d="M 0,150 H 100" />
        <path className="trace-flow" d="M 400,120 H 300" />
        <path className="trace-flow" d="M 200,0 V 60" />
        <path className="trace-flow" d="M 200,300 V 210" />
      </svg>

      <style>{`
        .main-container {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100%;
          width: 100%;
          overflow: hidden;
        }

        .loader {
          width: 100%;
          height: 100%;
        }

        #browser {
          overflow: hidden;
        }

        .grid-line {
          stroke: #222;
          stroke-width: 0.5;
        }

        .browser-frame {
          fill: #111;
          stroke: #666;
          stroke-width: 1;
          filter: drop-shadow(0 0 10px rgba(0, 0, 0, 0.9));
        }

        .browser-top {
          fill: #1a1a1a;
        }

        .loading-text {
          font-family: Haettenschweiler, sans-serif;
          font-size: 14px;
          fill: #e4e4e4;
        }

        .skeleton {
          fill: #2d2d2d;
          rx: 4;
          ry: 4;
          animation: pulse 1.8s ease-in-out infinite;
          filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.02));
        }

        @keyframes pulse {
          0% { fill: #2d2d2d; }
          50% { fill: #505050; }
          100% { fill: #2d2d2d; }
        }

        .trace-flow {
          stroke-width: 1;
          fill: none;
          stroke-dasharray: 120 600;
          stroke-dashoffset: 720;
          animation: flow 5s linear infinite;
          opacity: 0.95;
          stroke-linejoin: round;
          filter: drop-shadow(0 0 8px currentColor) blur(0.5px);
          color: #00ccff;
        }

        .trace-flow:nth-child(1) {
          stroke: url(#traceGradient1);
        }
        .trace-flow:nth-child(2) {
          stroke: url(#traceGradient2);
        }
        .trace-flow:nth-child(3) {
          stroke: url(#traceGradient3);
        }
        .trace-flow:nth-child(4) {
          stroke: url(#traceGradient4);
        }

        @keyframes flow {
          from { stroke-dashoffset: 720; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
};
