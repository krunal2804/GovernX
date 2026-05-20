import React from 'react';

const GaugeChart = ({ percentage, small = false }) => {
    const strokeWidth = 30;
    const cx = 100;
    const cy = 100;
    // 0% -> -90deg, 100% -> 90deg
    const angle = -90 + (percentage / 100) * 180;

    return (
        <div style={{ textAlign: 'center', position: 'relative', width: '100%', maxWidth: '300px', margin: '0 auto' }}>
            <svg viewBox="0 0 200 120" style={{ width: '100%', overflow: 'visible' }}>
                <defs>
                    <filter id="shadow">
                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" />
                    </filter>
                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="25%" stopColor="#fca5a5" />
                        <stop offset="50%" stopColor="#fde047" />
                        <stop offset="75%" stopColor="#86efac" />
                        <stop offset="100%" stopColor="#22c55e" />
                    </linearGradient>
                </defs>

                {/* Background arc */}
                <path
                    d={`M ${cx - 80} ${cy} A 80 80 0 0 1 ${cx + 80} ${cy}`}
                    fill="none"
                    stroke="var(--bg-secondary)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                />

                {/* Colored progress arc */}
                <path
                    d={`M ${cx - 80} ${cy} A 80 80 0 0 1 ${cx + 80} ${cy}`}
                    fill="none"
                    stroke="url(#gaugeGradient)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (percentage / 100) * 251.2}
                    style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                />

                {/* Needle / Marker */}
                <g transform={`rotate(${angle} ${cx} ${cy})`} style={{ transition: 'transform 1s ease-out' }}>
                    <polygon points={`${cx - 5},${cy + 10} ${cx + 5},${cy + 10} ${cx},${cy - 85}`} fill="var(--text-primary)" filter="url(#shadow)" />
                    <circle cx={cx} cy={cy} r="8" fill="var(--text-primary)" />
                    <circle cx={cx} cy={cy} r="3" fill="var(--bg-primary)" />
                </g>
            </svg>

            {!small && (
                <div style={{ marginTop: '16px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-muted)' }}>Client Commitment</div>
                    <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                        {percentage.toFixed(0)}%
                    </div>
                </div>
            )}
        </div>
    );
};

export default GaugeChart;
