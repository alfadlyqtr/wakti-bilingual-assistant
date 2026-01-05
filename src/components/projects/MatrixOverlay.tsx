import { useEffect, useState } from 'react';

interface MatrixOverlayProps {
  isVisible: boolean;
}

export const MatrixOverlay = ({ isVisible }: MatrixOverlayProps) => {
  const [columns, setColumns] = useState<number[]>([]);

  useEffect(() => {
    // Generate column indices based on container width
    const numColumns = 50;
    setColumns(Array.from({ length: numColumns }, (_, i) => i));
  }, []);

  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden" style={{ backgroundColor: 'rgba(0, 0, 0, 0.55)' }}>
      {/* Matrix Rain Effect */}
      <div className="matrix-container">
        <div className="matrix-pattern">
          {columns.map((i) => (
            <div key={i} className="matrix-column" />
          ))}
        </div>
      </div>
      
      {/* Center Loading Text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-emerald-400 text-sm font-mono tracking-wider animate-pulse">
            APPLYING CHANGES...
          </p>
        </div>
      </div>

      <style>{`
        .matrix-container {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }

        .matrix-pattern {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .matrix-column {
          position: absolute;
          top: -100%;
          width: 20px;
          height: 100%;
          font-size: 14px;
          line-height: 16px;
          font-weight: bold;
          animation: fall linear infinite;
          white-space: nowrap;
        }

        .matrix-column::before {
          content: "WAKTIأبجدهوزABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789حطيكلمنسعفصقرشتثخذضظغ";
          position: absolute;
          top: 0;
          left: 0;
          background: linear-gradient(
            to bottom,
            #ffffff 0%,
            #ffffff 5%,
            #10b981 10%,
            #10b981 20%,
            #059669 30%,
            #047857 40%,
            #065f46 50%,
            #064e3b 60%,
            #022c22 70%,
            rgba(16, 185, 129, 0.5) 80%,
            transparent 100%
          );
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          writing-mode: vertical-lr;
          letter-spacing: 2px;
        }

        .matrix-column:nth-child(1) { left: 0%; animation-delay: -2.5s; animation-duration: 3s; }
        .matrix-column:nth-child(2) { left: 2%; animation-delay: -3.2s; animation-duration: 4s; }
        .matrix-column:nth-child(3) { left: 4%; animation-delay: -1.8s; animation-duration: 2.5s; }
        .matrix-column:nth-child(4) { left: 6%; animation-delay: -2.9s; animation-duration: 3.5s; }
        .matrix-column:nth-child(5) { left: 8%; animation-delay: -1.5s; animation-duration: 3s; }
        .matrix-column:nth-child(6) { left: 10%; animation-delay: -3.8s; animation-duration: 4.5s; }
        .matrix-column:nth-child(7) { left: 12%; animation-delay: -2.1s; animation-duration: 2.8s; }
        .matrix-column:nth-child(8) { left: 14%; animation-delay: -2.7s; animation-duration: 3.2s; }
        .matrix-column:nth-child(9) { left: 16%; animation-delay: -3.4s; animation-duration: 3.8s; }
        .matrix-column:nth-child(10) { left: 18%; animation-delay: -1.9s; animation-duration: 2.7s; }
        .matrix-column:nth-child(11) { left: 20%; animation-delay: -3.6s; animation-duration: 4.2s; }
        .matrix-column:nth-child(12) { left: 22%; animation-delay: -2.3s; animation-duration: 3.1s; }
        .matrix-column:nth-child(13) { left: 24%; animation-delay: -3.1s; animation-duration: 3.6s; }
        .matrix-column:nth-child(14) { left: 26%; animation-delay: -2.6s; animation-duration: 2.9s; }
        .matrix-column:nth-child(15) { left: 28%; animation-delay: -3.7s; animation-duration: 4.1s; }
        .matrix-column:nth-child(16) { left: 30%; animation-delay: -2.8s; animation-duration: 3.3s; }
        .matrix-column:nth-child(17) { left: 32%; animation-delay: -3.3s; animation-duration: 3.7s; }
        .matrix-column:nth-child(18) { left: 34%; animation-delay: -2.2s; animation-duration: 2.6s; }
        .matrix-column:nth-child(19) { left: 36%; animation-delay: -3.9s; animation-duration: 4.3s; }
        .matrix-column:nth-child(20) { left: 38%; animation-delay: -2.4s; animation-duration: 3.4s; }
        .matrix-column:nth-child(21) { left: 40%; animation-delay: -1.7s; animation-duration: 2.4s; }
        .matrix-column:nth-child(22) { left: 42%; animation-delay: -3.5s; animation-duration: 3.9s; }
        .matrix-column:nth-child(23) { left: 44%; animation-delay: -2s; animation-duration: 3s; }
        .matrix-column:nth-child(24) { left: 46%; animation-delay: -4s; animation-duration: 4.4s; }
        .matrix-column:nth-child(25) { left: 48%; animation-delay: -1.6s; animation-duration: 2.3s; }
        .matrix-column:nth-child(26) { left: 50%; animation-delay: -3s; animation-duration: 3.5s; }
        .matrix-column:nth-child(27) { left: 52%; animation-delay: -3.8s; animation-duration: 4s; }
        .matrix-column:nth-child(28) { left: 54%; animation-delay: -2.5s; animation-duration: 2.8s; }
        .matrix-column:nth-child(29) { left: 56%; animation-delay: -3.2s; animation-duration: 3.6s; }
        .matrix-column:nth-child(30) { left: 58%; animation-delay: -2.7s; animation-duration: 3.2s; }
        .matrix-column:nth-child(31) { left: 60%; animation-delay: -1.8s; animation-duration: 2.7s; }
        .matrix-column:nth-child(32) { left: 62%; animation-delay: -3.6s; animation-duration: 4.1s; }
        .matrix-column:nth-child(33) { left: 64%; animation-delay: -2.1s; animation-duration: 3.1s; }
        .matrix-column:nth-child(34) { left: 66%; animation-delay: -3.4s; animation-duration: 3.7s; }
        .matrix-column:nth-child(35) { left: 68%; animation-delay: -2.8s; animation-duration: 2.9s; }
        .matrix-column:nth-child(36) { left: 70%; animation-delay: -3.7s; animation-duration: 4.2s; }
        .matrix-column:nth-child(37) { left: 72%; animation-delay: -2.3s; animation-duration: 3.3s; }
        .matrix-column:nth-child(38) { left: 74%; animation-delay: -1.9s; animation-duration: 2.5s; }
        .matrix-column:nth-child(39) { left: 76%; animation-delay: -3.5s; animation-duration: 3.8s; }
        .matrix-column:nth-child(40) { left: 78%; animation-delay: -2.6s; animation-duration: 3.4s; }
        .matrix-column:nth-child(41) { left: 80%; animation-delay: -2.9s; animation-duration: 3s; }
        .matrix-column:nth-child(42) { left: 82%; animation-delay: -3.1s; animation-duration: 4s; }
        .matrix-column:nth-child(43) { left: 84%; animation-delay: -1.5s; animation-duration: 2.5s; }
        .matrix-column:nth-child(44) { left: 86%; animation-delay: -3.3s; animation-duration: 3.5s; }
        .matrix-column:nth-child(45) { left: 88%; animation-delay: -2s; animation-duration: 3s; }
        .matrix-column:nth-child(46) { left: 90%; animation-delay: -3.9s; animation-duration: 4.5s; }
        .matrix-column:nth-child(47) { left: 92%; animation-delay: -2.4s; animation-duration: 2.8s; }
        .matrix-column:nth-child(48) { left: 94%; animation-delay: -3s; animation-duration: 3.2s; }
        .matrix-column:nth-child(49) { left: 96%; animation-delay: -3.6s; animation-duration: 3.8s; }
        .matrix-column:nth-child(50) { left: 98%; animation-delay: -2.2s; animation-duration: 2.7s; }

        .matrix-column:nth-child(odd)::before {
          content: "WAKTIأبجدهوزحطيكلمنسعفصقرشتثخذضظغ0123456789";
        }

        .matrix-column:nth-child(even)::before {
          content: "ABCDEFGHIJKLMNOPQRSTUVWXYZواكتيWAKTI0987654321";
        }

        .matrix-column:nth-child(3n)::before {
          content: "وَاكْتِيWAKTIأبجدABCDEFGHIJKLMNOPQRSTUVWXYZ123456789";
        }

        .matrix-column:nth-child(5n)::before {
          content: "WAKTIواكتي!@#$%ABCDEFGHIJKLMNOPQRSTUVWXYZأبجدهوزحطيكلمن";
        }

        @keyframes fall {
          0% {
            transform: translateY(-10%);
            opacity: 1;
          }
          100% {
            transform: translateY(200%);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};
