import React from 'react';
import styles from './DecorativeSVG.module.css';

const DecorativeSVG = () => {
  return (
    <div className={styles.svgContainer} aria-hidden="true">
      {/* Primary curved layer */}
      <svg 
        className={styles.svgLayer1}
        viewBox="0 0 1440 800" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <path 
          d="M0 400C320 280 640 320 960 400C1280 480 1440 440 1440 400V800H0V400Z" 
          fill="url(#gradient1)"
          opacity="0.15"
        />
        <defs>
          <linearGradient id="gradient1" x1="0" y1="0" x2="1440" y2="800">
            <stop offset="0%" stopColor="#d4af37" />
            <stop offset="100%" stopColor="#8b7355" />
          </linearGradient>
        </defs>
      </svg>

      {/* Secondary geometric layer */}
      <svg 
        className={styles.svgLayer2}
        viewBox="0 0 1440 800" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <path 
          d="M0 600C360 520 720 580 1080 600C1260 610 1440 590 1440 590V0H0V600Z" 
          fill="url(#gradient2)"
          opacity="0.08"
        />
        <defs>
          <linearGradient id="gradient2" x1="0" y1="800" x2="1440" y2="0">
            <stop offset="0%" stopColor="#1a2332" />
            <stop offset="100%" stopColor="#2a3645" />
          </linearGradient>
        </defs>
      </svg>

      {/* Abstract geometric shapes */}
      <svg 
        className={styles.svgLayer3}
        viewBox="0 0 1440 800" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <rect 
          x="1100" 
          y="100" 
          width="250" 
          height="250" 
          fill="none"
          stroke="#d4af37"
          strokeWidth="1"
          opacity="0.2"
          transform="rotate(45 1225 225)"
        />
        <circle 
          cx="200" 
          cy="650" 
          r="120" 
          fill="none"
          stroke="#d4af37"
          strokeWidth="1"
          opacity="0.15"
        />
        <polygon 
          points="800,50 950,200 800,350 650,200" 
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
          opacity="0.3"
        />
      </svg>

      {/* Subtle texture overlay */}
      <svg 
        className={styles.svgLayer4}
        viewBox="0 0 1440 800" 
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="rgba(255,255,255,0.05)" />
          </pattern>
        </defs>
        <rect width="1440" height="800" fill="url(#dots)" />
      </svg>
    </div>
  );
};

export default DecorativeSVG;