"use client";

import React, { useEffect, useRef } from "react";

interface GameCardPreviewProps {
  gameId: string;
}

export default function GameCardPreview({ gameId }: GameCardPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let angle = 0;

    const render = () => {
      angle += 0.04;
      ctx.fillStyle = "#090d1a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (gameId === "boss-protocol") {
        // Rotating Boss Core
        ctx.fillStyle = "#a855f7";
        ctx.shadowColor = "#a855f7";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, 24, angle, angle + Math.PI);
        ctx.stroke();
      } else if (gameId === "void-runner") {
        // Warp Speed Lines
        ctx.strokeStyle = "rgba(0, 240, 255, 0.4)";
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 8; i++) {
          const x = (i * 20 + angle * 30) % canvas.width;
          const y = (i * 12) % canvas.height;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 15);
          ctx.stroke();
        }
      } else if (gameId === "cyber-heist") {
        // Scanning FOV Cone
        ctx.fillStyle = "rgba(16, 185, 129, 0.25)";
        ctx.beginPath();
        ctx.moveTo(20, 20);
        ctx.arc(20, 20, 65, angle - 0.4, angle + 0.4);
        ctx.closePath();
        ctx.fill();
      } else {
        // Default Pulsing Cyber Orb
        ctx.fillStyle = "#00f0ff";
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, 12 + Math.sin(angle) * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [gameId]);

  return (
    <canvas 
      ref={canvasRef} 
      width={140} 
      height={85} 
      className="rounded-xl border border-white/10 shadow-inner w-full object-cover" 
    />
  );
}
