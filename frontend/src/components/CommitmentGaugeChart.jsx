import React from 'react';

export default function CommitmentGaugeChart({ percentage, small = false }) {
    const strokeWidth = 30;
    const cx = 100;
    const cy = 100;
    const safePercentage = Number.isFinite(Number(percentage)) ? Number(percentage) : 0;
    const angle = -90 + (safePercentage / 100) * 180;

    return (
        <div style={{ textAlign: 'center', position: 'relative', width: '100%', maxWidth: small ? '220px' : '300px', margin: '0 auto' }}>
            <svg viewBox="0 0 200 120" style={{ width: '100%', overflow: 'visible' }}>
                <defs>
                    <filter id="commitment-gauge-shadow">
                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" />
                    </filter>
                </defs>
                <path d="M 20 100 A 80 80 0 0 1 35.28 53.04" fill="none" stroke="#ef4444" strokeWidth={strokeWidth} />
                <path d="M 35.28 53.04 A 80 80 0 0 1 75.28 23.92" fill="none" stroke="#fca5a5" strokeWidth={strokeWidth} />
                <path d="M 75.28 23.92 A 80 80 0 0 1 124.72 23.92" fill="none" stroke="#fde047" strokeWidth={strokeWidth} />
                <path d="M 124.72 23.92 A 80 80 0 0 1 164.72 53.04" fill="none" stroke="#86efac" strokeWidth={strokeWidth} />
                <path d="M 164.72 53.04 A 80 80 0 0 1 180 100" fill="none" stroke="#22c55e" strokeWidth={strokeWidth} />

                <g stroke={small ? "var(--bg-secondary)" : "#ffffff"} strokeWidth="3">
                    <line x1="100" y1="100" x2="20" y2="100" transform="rotate(36, 100, 100)" />
                    <line x1="100" y1="100" x2="20" y2="100" transform="rotate(72, 100, 100)" />
                    <line x1="100" y1="100" x2="20" y2="100" transform="rotate(108, 100, 100)" />
                    <line x1="100" y1="100" x2="20" y2="100" transform="rotate(144, 100, 100)" />
                </g>
                <circle cx="100" cy="100" r="64" fill={small ? "var(--bg-secondary)" : "#ffffff"} />

                <g transform={`rotate(${angle}, ${cx}, ${cy})`} style={{ transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                    <polygon points="96,100 104,100 100,25" fill="#475569" filter="url(#commitment-gauge-shadow)" />
                    <circle cx="100" cy="100" r="10" fill="#334155" filter="url(#commitment-gauge-shadow)" />
                    <circle cx="98" cy="98" r="3" fill="rgba(255,255,255,0.4)" />
                </g>
            </svg>
            {!small && (
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-secondary)', marginTop: '10px' }}>
                    Client Commitment : <span style={{ color: 'var(--text-primary)' }}>{safePercentage.toFixed(0)}%</span>
                </div>
            )}
            {small && (
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {safePercentage.toFixed(0)}%
                </div>
            )}
        </div>
    );
}
