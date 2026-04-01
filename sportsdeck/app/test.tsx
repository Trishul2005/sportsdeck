import React, { useEffect, useMemo, useRef } from "react";

export type AnimatedGradientBackgroundProps = {
  className?: string;
  style?: React.CSSProperties;
  colors?: string[];
  speed?: number;
  blur?: number;
  grainOpacity?: number;
  intensity?: number;
  scale?: number;
  borderRadius?: number | string;
  children?: React.ReactNode;
};

/**
 * AnimatedGradientBackground
 *
 * A reusable TSX background component inspired by Framer-style animated gradient / warp backgrounds.
 * It uses layered radial gradients plus animated transforms for a smooth, premium feel.
 *
 * Usage:
 * <AnimatedGradientBackground>
 *   <YourContent />
 * </AnimatedGradientBackground>
 */
export default function AnimatedGradientBackground({
  className = "",
  style,
  colors = ["#7C3AED", "#06B6D4", "#3B82F6", "#EC4899"],
  speed = 18,
  blur = 70,
  grainOpacity = 0.08,
  intensity = 1,
  scale = 1.15,
  borderRadius = 24,
  children,
}: AnimatedGradientBackgroundProps) {
  const idRef = useRef(`ag-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    const styleId = `${idRef.current}-styles`;
    if (document.getElementById(styleId)) return;

    const el = document.createElement("style");
    el.id = styleId;
    el.innerHTML = `
      @keyframes ag-float-1 {
        0% { transform: translate3d(-12%, -8%, 0) scale(1.0) rotate(0deg); }
        25% { transform: translate3d(8%, -12%, 0) scale(1.15) rotate(25deg); }
        50% { transform: translate3d(12%, 10%, 0) scale(0.98) rotate(70deg); }
        75% { transform: translate3d(-10%, 14%, 0) scale(1.12) rotate(110deg); }
        100% { transform: translate3d(-12%, -8%, 0) scale(1.0) rotate(180deg); }
      }

      @keyframes ag-float-2 {
        0% { transform: translate3d(12%, 10%, 0) scale(1.08) rotate(0deg); }
        25% { transform: translate3d(-8%, 14%, 0) scale(0.94) rotate(-30deg); }
        50% { transform: translate3d(-15%, -12%, 0) scale(1.1) rotate(-75deg); }
        75% { transform: translate3d(10%, -8%, 0) scale(1.02) rotate(-120deg); }
        100% { transform: translate3d(12%, 10%, 0) scale(1.08) rotate(-180deg); }
      }

      @keyframes ag-float-3 {
        0% { transform: translate3d(0%, 0%, 0) scale(1.12); }
        25% { transform: translate3d(10%, -6%, 0) scale(0.96); }
        50% { transform: translate3d(-8%, 12%, 0) scale(1.08); }
        75% { transform: translate3d(6%, 8%, 0) scale(1.0); }
        100% { transform: translate3d(0%, 0%, 0) scale(1.12); }
      }

      @keyframes ag-pan {
        0% { transform: translate3d(-2%, -2%, 0) scale(1.05); }
        50% { transform: translate3d(2%, 2%, 0) scale(1.1); }
        100% { transform: translate3d(-2%, -2%, 0) scale(1.05); }
      }

      @keyframes ag-grain {
        0%, 100% { transform: translate(0, 0); }
        10% { transform: translate(-1%, -1%); }
        20% { transform: translate(1%, 1%); }
        30% { transform: translate(-2%, 1%); }
        40% { transform: translate(2%, -1%); }
        50% { transform: translate(-1%, 2%); }
        60% { transform: translate(1%, -2%); }
        70% { transform: translate(2%, 1%); }
        80% { transform: translate(-2%, -1%); }
        90% { transform: translate(1%, 2%); }
      }
    `;

    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, []);

  const [c1, c2, c3, c4] = useMemo(() => {
    const fallback = ["#7C3AED", "#06B6D4", "#3B82F6", "#EC4899"];
    const merged = [...colors, ...fallback].slice(0, 4);
    return merged as [string, string, string, string];
  }, [colors]);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius,
        isolation: "isolate",
        background:
          "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.12), transparent 30%), linear-gradient(135deg, rgba(10,10,20,0.95), rgba(15,15,30,0.92))",
        ...style,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: "-20%",
          transform: `scale(${scale})`,
          filter: `blur(${blur}px) saturate(140%)`,
          animation: `ag-pan ${speed * 1.3}s ease-in-out infinite`,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: "48%",
            height: "48%",
            left: "-6%",
            top: "-8%",
            borderRadius: "999px",
            background: `radial-gradient(circle at 30% 30%, ${c1}, transparent 70%)`,
            mixBlendMode: "screen",
            opacity: 0.9 * intensity,
            animation: `ag-float-1 ${speed}s ease-in-out infinite alternate`,
          }}
        />

        <div
          style={{
            position: "absolute",
            width: "52%",
            height: "52%",
            right: "-10%",
            top: "-4%",
            borderRadius: "999px",
            background: `radial-gradient(circle at 50% 50%, ${c2}, transparent 68%)`,
            mixBlendMode: "screen",
            opacity: 0.85 * intensity,
            animation: `ag-float-2 ${speed * 1.2}s ease-in-out infinite alternate`,
          }}
        />

        <div
          style={{
            position: "absolute",
            width: "58%",
            height: "58%",
            left: "18%",
            bottom: "-18%",
            borderRadius: "999px",
            background: `radial-gradient(circle at 50% 50%, ${c3}, transparent 70%)`,
            mixBlendMode: "screen",
            opacity: 0.78 * intensity,
            animation: `ag-float-3 ${speed * 0.95}s ease-in-out infinite alternate`,
          }}
        />

        <div
          style={{
            position: "absolute",
            width: "46%",
            height: "46%",
            right: "12%",
            bottom: "-10%",
            borderRadius: "999px",
            background: `radial-gradient(circle at 50% 50%, ${c4}, transparent 70%)`,
            mixBlendMode: "screen",
            opacity: 0.72 * intensity,
            animation: `ag-float-1 ${speed * 1.4}s ease-in-out infinite alternate-reverse`,
          }}
        />
      </div>

      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(circle at 50% 50%, rgba(255,255,255,0.08), transparent 45%),
            linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.01) 35%, rgba(0,0,0,0.08) 100%)
          `,
          mixBlendMode: "soft-light",
          pointerEvents: "none",
        }}
      />

      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: "-50%",
          opacity: grainOpacity,
          pointerEvents: "none",
          animation: "ag-grain 0.9s steps(2) infinite",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}
