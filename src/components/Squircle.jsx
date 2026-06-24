import React, { useMemo } from 'react';
import { getSvgPath } from 'figma-squircle';

export default function Squircle({
    children,
    cornerRadius = 20,
    cornerSmoothing = 0.6,
    backgroundColor = 'white',
    borderWidth = 1,
    borderColor = '#eff2f5',
    shadow = '0 2px 8px rgba(0,0,0,0.04)',
    className = '',
    style = {},
    width,
    height,
    clip = true
}) {
    // We use a ResizeObserver to responsive sizing, or just 100% width/height of container
    // However, SVG needs explicit paths.
    // For simplicity in this "sim" app, we'll assume the container defines the size, 
    // but generating a dynamic path for fluid responsiveness is tricky without a hook measuring size.
    // Let's implement a resize observer hook approach or simplest: 
    // Use a wrapper div that measures itself.

    const [size, setSize] = React.useState({ w: 0, h: 0 });
    const ref = React.useRef(null);

    React.useLayoutEffect(() => {
        if (!ref.current) return;
        const obs = new ResizeObserver(entries => {
            const entry = entries[0];
            if (entry) {
                setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
            }
        });
        obs.observe(ref.current);
        return () => obs.disconnect();
    }, []);

    const path = useMemo(() => {
        if (size.w === 0 || size.h === 0) return '';
        return getSvgPath({
            width: size.w,
            height: size.h,
            cornerRadius,
            cornerSmoothing,
        });
    }, [size.w, size.h, cornerRadius, cornerSmoothing]);

    return (
        <div ref={ref} className={className} style={{ position: 'relative', width: width || '100%', height: height || 'auto', ...style }}>
            {/* Background Layer */}
            <svg
                style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    zIndex: 0, overflow: 'visible', pointerEvents: 'none'
                }}
            >
                <path
                    d={path}
                    fill={backgroundColor}
                    stroke={borderColor}
                    strokeWidth={borderWidth}
                    style={{ filter: shadow ? `drop-shadow(${shadow})` : 'none' }}
                />
            </svg>

            {/* Content Layer - Clipped */}
            <div style={{ position: 'relative', zIndex: 1, height: '100%', clipPath: clip && path ? `path('${path}')` : 'none' }}>
                {children}
            </div>
        </div>
    );
}
