import React, { useEffect, useRef } from 'react';

const GRAVITY = 0.07;
const DRAG = 0.965;
const SPARK_COLORS = ['#f8fafc', '#fee2e2', '#dbeafe', '#fde68a'];

class Spark {
    constructor(x, y, vMag = 8) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * vMag + 1.5;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = Math.random() * 0.7 + 0.35;
        this.color = SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)];
        this.size = Math.random() * 2 + 0.75;
        this.history = [{ x, y }];
        this.decay = Math.random() * 0.01 + 0.018;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= DRAG;
        this.vy *= DRAG;
        this.vy += GRAVITY;
        this.life -= this.decay;
        this.history.push({ x: this.x, y: this.y });
        if (this.history.length > 5) this.history.shift();
    }

    draw(ctx) {
        const alpha = Math.max(0, this.life);
        ctx.beginPath();
        ctx.moveTo(this.history[0].x, this.history[0].y);
        for (let i = 1; i < this.history.length; i++) {
            ctx.lineTo(this.history[i].x, this.history[i].y);
        }
        ctx.strokeStyle = `rgba(248, 250, 252, ${alpha * 0.8})`;
        ctx.lineWidth = this.size * 0.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = alpha;
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

export default function SparklerEffect({ onClose }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let width = 0;
        let height = 0;
        let particles = [];
        let animationFrame;
        let lastMouseX = 0;
        let lastMouseY = 0;

        const resize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resize);
        resize();

        if (reduceMotion) {
            const timer = setTimeout(onClose, 3000);
            return () => {
                window.removeEventListener('resize', resize);
                clearTimeout(timer);
            };
        }

        const spawnBurst = (x, y, count = 24, vMag = 8) => {
            for (let i = 0; i < count; i++) {
                particles.push(new Spark(x, y, vMag));
            }
        };

        const loop = () => {
            ctx.clearRect(0, 0, width, height);
            ctx.globalCompositeOperation = 'lighter';

            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.update();
                p.draw(ctx);
                if (p.life <= 0) particles.splice(i, 1);
            }

            animationFrame = requestAnimationFrame(loop);
        };

        const handleMove = (e) => {
            const x = e.touches ? e.touches[0].clientX : e.clientX;
            const y = e.touches ? e.touches[0].clientY : e.clientY;
            const dist = Math.hypot(x - lastMouseX, y - lastMouseY);

            if (dist > 10) {
                spawnBurst(x, y, 3, 2.5);
                lastMouseX = x;
                lastMouseY = y;
            }
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('touchmove', handleMove);

        setTimeout(() => spawnBurst(width * 0.5, height * 0.45, 90, 11), 100);
        setTimeout(() => spawnBurst(width * 0.25, height * 0.32, 50, 9), 420);
        setTimeout(() => spawnBurst(width * 0.75, height * 0.32, 50, 9), 620);

        loop();

        const timer = setTimeout(onClose, 6000);

        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('touchmove', handleMove);
            cancelAnimationFrame(animationFrame);
            clearTimeout(timer);
        };
    }, [onClose]);

    return (
        <div
            className="sparkler-overlay"
            onClick={onClose}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && onClose()}
        >
            <canvas ref={canvasRef} className="sparkler-canvas" />
            <div className="sparkler-title" aria-hidden="true">USA</div>
            <style>{`
                .sparkler-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 9999;
                    cursor: pointer;
                    background: rgba(15, 23, 42, 0.94);
                }
                .sparkler-canvas {
                    position: absolute;
                    inset: 0;
                    display: block;
                }
                .sparkler-title {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 1;
                    color: #f8fafc;
                    font-family: var(--font-family);
                    font-size: 8rem;
                    font-weight: 900;
                    line-height: 1;
                    letter-spacing: 0;
                    text-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
                    pointer-events: none;
                }
                @media (max-width: 640px) {
                    .sparkler-title { font-size: 4rem; }
                }
            `}</style>
        </div>
    );
}
