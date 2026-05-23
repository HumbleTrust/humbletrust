"use client";
import { useRef, useEffect } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  pulseOffset: number;
}

export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Spawn particles
    const COUNT = 160;
    particlesRef.current = Array.from({ length: COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.5 + 0.1,
      pulseOffset: Math.random() * Math.PI * 2,
    }));

    const mousemove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", mousemove);

    let frame = 0;
    const THRESHOLD = 120;
    const PRIMARY = [0, 255, 178];

    const tick = () => {
      animRef.current = requestAnimationFrame(tick);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;

      const particles = particlesRef.current;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Drift
        p.x += p.vx;
        p.y += p.vy;

        // Wrap
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        // Pulse opacity
        const pulse = Math.sin(frame * 0.02 + p.pulseOffset) * 0.2 + 0.8;

        // Mouse repel
        const dx = p.x - mx;
        const dy = p.y - my;
        const distMouse = Math.sqrt(dx * dx + dy * dy);
        if (distMouse < 80) {
          const force = (80 - distMouse) / 80 * 0.5;
          p.x += (dx / distMouse) * force;
          p.y += (dy / distMouse) * force;
        }

        // Draw node
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${PRIMARY[0]},${PRIMARY[1]},${PRIMARY[2]},${p.opacity * pulse})`;
        ctx.fill();

        // Draw connections
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const ex = p.x - q.x;
          const ey = p.y - q.y;
          const dist = Math.sqrt(ex * ex + ey * ey);
          if (dist < THRESHOLD) {
            const alpha = (1 - dist / THRESHOLD) * 0.15;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(${PRIMARY[0]},${PRIMARY[1]},${PRIMARY[2]},${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    };

    tick();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", mousemove);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}
