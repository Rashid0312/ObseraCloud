import React from 'react';

interface EyeLogoProps {
    variant?: 'light' | 'dark';
    className?: string;
    width?: number | string;
    height?: number | string;
}

export function EyeLogo({ variant = 'light', className, width = 120, height = 120 }: EyeLogoProps) {
    const isDark = variant === 'dark';

    return (
        <svg
            width={width}
            height={height}
            viewBox="20 20 80 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <defs>
                <linearGradient id={`eyeGradient-${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ea5a8c" />
                    <stop offset="100%" stopColor="#fca33e" />
                </linearGradient>
                <filter id={`eyeGlow-${variant}`}>
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Eye outline - observation */}
            <path
                d="M 60 35 Q 85 50 95 60 Q 85 70 60 85 Q 35 70 25 60 Q 35 50 60 35 Z"
                stroke={isDark ? '#160e1b' : `url(#eyeGradient-${variant})`}
                strokeWidth="2.5"
                fill="none"
                filter={isDark ? 'none' : `url(#eyeGlow-${variant})`}
            />

            {/* Cloud shape inside the iris - literally "cloud in eye" */}
            <g opacity={isDark ? '1' : '0.9'}>
                {/* Main cloud body */}
                <ellipse cx="52" cy="62" rx="8" ry="6" fill={isDark ? '#160e1b' : '#ea5a8c'} />
                <ellipse cx="60" cy="59" rx="7" ry="7" fill={isDark ? '#160e1b' : '#f87f65'} />
                <ellipse cx="68" cy="62" rx="8" ry="6" fill={isDark ? '#160e1b' : '#fca33e'} />
                {/* Cloud base */}
                <rect x="48" y="62" width="24" height="6" rx="2" fill={isDark ? '#160e1b' : '#f87f65'} />
            </g>

            {/* Pupil/lens focus on cloud */}
            <circle
                cx="60"
                cy="60"
                r="20"
                stroke={isDark ? '#160e1b' : `url(#eyeGradient-${variant})`}
                strokeWidth="1.5"
                fill="none"
                opacity={isDark ? '0.6' : '0.4'}
            />

            {/* Focus reticle */}
            <g opacity={isDark ? '0.5' : '0.3'} stroke={isDark ? '#160e1b' : '#ea5a8c'} strokeWidth="1.5" strokeLinecap="round">
                <line x1="60" y1="45" x2="60" y2="48" />
                <line x1="60" y1="72" x2="60" y2="75" />
                <line x1="45" y1="60" x2="48" y2="60" />
                <line x1="72" y1="60" x2="75" y2="60" />
            </g>


        </svg>
    );
}
