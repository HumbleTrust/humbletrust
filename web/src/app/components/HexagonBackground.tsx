import { motion } from "motion/react";

export function HexagonBackground() {
  const hexagons = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    size: Math.random() * 100 + 80,
    x: Math.random() * 100,
    y: Math.random() * 100,
    delay: Math.random() * 2,
    duration: Math.random() * 10 + 15,
  }));

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="neon-green-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#00FF41", stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: "#00FF41", stopOpacity: 0 }} />
          </linearGradient>
          <linearGradient id="neon-purple-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#B026FF", stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: "#B026FF", stopOpacity: 0 }} />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {hexagons.map((hex) => {
          const points = generateHexagonPoints(hex.size);
          const gradient = hex.id % 2 === 0 ? "url(#neon-green-grad)" : "url(#neon-purple-grad)";
          const strokeColor = hex.id % 2 === 0 ? "#00FF41" : "#B026FF";

          return (
            <motion.g
              key={hex.id}
              initial={{ opacity: 0 }}
              animate={{
                opacity: [0.1, 0.4, 0.1],
                x: [0, Math.sin(hex.id) * 20, 0],
                y: [0, Math.cos(hex.id) * 20, 0],
              }}
              transition={{
                duration: hex.duration,
                delay: hex.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <polygon
                points={points}
                fill={gradient}
                stroke={strokeColor}
                strokeWidth="1"
                opacity="0.2"
                filter="url(#glow)"
                transform={`translate(${hex.x}% ${hex.y}%)`}
              />
            </motion.g>
          );
        })}

        {/* Grid lines */}
        {Array.from({ length: 20 }, (_, i) => (
          <motion.line
            key={`h-${i}`}
            x1="0"
            y1={`${i * 5}%`}
            x2="100%"
            y2={`${i * 5}%`}
            stroke="rgba(0, 255, 65, 0.05)"
            strokeWidth="1"
            animate={{
              opacity: [0.05, 0.15, 0.05],
            }}
            transition={{
              duration: 4,
              delay: i * 0.1,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}

        {Array.from({ length: 20 }, (_, i) => (
          <motion.line
            key={`v-${i}`}
            x1={`${i * 5}%`}
            y1="0"
            x2={`${i * 5}%`}
            y2="100%"
            stroke="rgba(176, 38, 255, 0.05)"
            strokeWidth="1"
            animate={{
              opacity: [0.05, 0.15, 0.05],
            }}
            transition={{
              duration: 4,
              delay: i * 0.1,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </svg>
    </div>
  );
}

function generateHexagonPoints(size: number): string {
  const points: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const x = size * Math.cos(angle);
    const y = size * Math.sin(angle);
    points.push([x, y]);
  }
  return points.map((p) => p.join(",")).join(" ");
}
