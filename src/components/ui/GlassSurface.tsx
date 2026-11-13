import type { CSSProperties, ReactNode } from "react";

export type GlassIntensity = "subtle" | "standard" | "elevated" | "dense";

interface GlassSurfaceProps {
  children: ReactNode;
  intensity?: GlassIntensity;
  as?: "div" | "section" | "header" | "aside" | "nav" | "main";
  className?: string;
  plateClassName?: string;
  style?: CSSProperties;
  withPlate?: boolean;
}

export function GlassSurface({
  children,
  intensity = "standard",
  as: Component = "div",
  className = "",
  plateClassName = "",
  style,
  withPlate = true,
}: GlassSurfaceProps) {
  return (
    <Component
      className={`glass-surface ${className}`.trim()}
      data-intensity={intensity}
      style={style}
    >
      {withPlate ? (
        <div className={`glass-plate ${plateClassName}`.trim()}>{children}</div>
      ) : (
        children
      )}
    </Component>
  );
}
