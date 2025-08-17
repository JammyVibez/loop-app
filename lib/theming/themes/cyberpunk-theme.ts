import { Theme3DConfig } from '../theme-engine'

export const cyberpunkTheme: Theme3DConfig = {
  id: 'cyberpunk-2077',
  name: 'Cyberpunk 2077',
  category: 'gaming',
  
  colors: {
    primary: '#fcee09', // Cyberpunk yellow
    secondary: '#ff003c', // Neon red
    accent: '#00f5ff', // Electric cyan
    background: '#0d0208', // Deep black
    surface: '#1a0e13', // Dark red-black
    text: '#f7f7f2', // Off-white
    shadow: 'rgba(252, 238, 9, 0.4)', // Yellow shadow
    highlight: 'rgba(0, 245, 255, 0.3)', // Cyan highlight
    depth: 'rgba(255, 0, 60, 0.2)', // Red depth
    glow: 'rgba(252, 238, 9, 0.8)' // Intense yellow glow
  },
  
  effects3D: {
    cardDepth: 10,
    hoverLift: 14,
    shadowIntensity: 0.5,
    transitionDuration: '0.35s',
    easeFunction: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    
    particles: {
      enabled: true,
      count: 120,
      color: '#fcee09',
      size: 2,
      speed: 2
    },
    
    glow: {
      enabled: true,
      intensity: 0.9,
      color: '#fcee09',
      blur: 30
    },
    
    parallax: {
      enabled: true,
      intensity: 0.2,
      layers: 5
    }
  },
  
  components: {
    loopCard: {
      background: 'linear-gradient(135deg, rgba(26, 14, 19, 0.95), rgba(13, 2, 8, 0.98))',
      border: '1px solid rgba(252, 238, 9, 0.4)',
      borderRadius: '8px',
      transform3D: 'translateZ(0)',
      boxShadow: '0 10px 35px rgba(252, 238, 9, 0.15), inset 0 1px 0 rgba(0, 245, 255, 0.1)',
      hoverTransform: 'translateY(-6px) rotateX(2deg) rotateY(2deg) scale(1.03)'
    },
    
    navigation: {
      background: 'linear-gradient(135deg, rgba(13, 2, 8, 0.98), rgba(26, 14, 19, 0.95))',
      backdropFilter: 'blur(20px) saturate(1.5)',
      border: '1px solid rgba(252, 238, 9, 0.3)',
      itemHover: 'rgba(252, 238, 9, 0.1)'
    },
    
    button: {
      primary: {
        background: 'linear-gradient(135deg, #fcee09, #ffaa00)',
        color: '#0d0208',
        boxShadow: '0 5px 18px rgba(252, 238, 9, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
        hoverTransform: 'translateY(-3px) scale(1.08)'
      },
      secondary: {
        background: 'rgba(252, 238, 9, 0.12)',
        color: '#fcee09',
        boxShadow: '0 3px 15px rgba(252, 238, 9, 0.3), inset 0 1px 0 rgba(252, 238, 9, 0.2)',
        hoverTransform: 'translateY(-2px) scale(1.05)'
      }
    },
    
    profile: {
      avatar: {
        border: '3px solid rgba(252, 238, 9, 0.7)',
        boxShadow: '0 0 25px rgba(252, 238, 9, 0.6), 0 0 50px rgba(255, 0, 60, 0.3)',
        hoverTransform: 'scale(1.15) rotateZ(-5deg)'
      },
      banner: {
        background: 'linear-gradient(135deg, rgba(252, 238, 9, 0.3), rgba(255, 0, 60, 0.4), rgba(0, 245, 255, 0.2))',
        overlay: 'rgba(13, 2, 8, 0.4)',
        filter: 'blur(1px) contrast(1.2) saturate(1.3)'
      }
    },
    
    text: {
      heading: {
        color: '#fcee09',
        textShadow: '0 0 15px rgba(252, 238, 9, 0.8), 0 2px 4px rgba(0, 0, 0, 0.6)',
        fontWeight: '900'
      },
      body: {
        color: '#f7f7f2',
        textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)'
      },
      accent: {
        color: '#00f5ff',
        textShadow: '0 0 12px rgba(0, 245, 255, 0.8)',
        background: 'rgba(0, 245, 255, 0.08)'
      }
    }
  },
  
  animations: {
    fadeIn: 'fadeIn 0.5s ease-out',
    slideIn: 'slideIn 0.35s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    bounce: 'bounce 0.7s ease-in-out',
    pulse: 'pulse 2s ease-in-out infinite',
    rotate3D: 'rotate3D 1s ease-in-out',
    flip: 'flip 0.7s ease-in-out',
    morphing: 'morphing 2.5s ease-in-out infinite'
  },
  
  environment: {
    type: 'geometric',
    config: {
      pattern: 'circuit',
      colors: ['#fcee09', '#ff003c', '#00f5ff'],
      opacity: 0.1,
      animation: 'pulse',
      background: `
        linear-gradient(45deg, rgba(252, 238, 9, 0.03) 0%, transparent 25%),
        linear-gradient(-45deg, rgba(255, 0, 60, 0.03) 0%, transparent 25%),
        linear-gradient(90deg, rgba(0, 245, 255, 0.02) 0%, transparent 50%),
        radial-gradient(circle at 30% 70%, rgba(252, 238, 9, 0.08) 0%, transparent 40%),
        radial-gradient(circle at 70% 30%, rgba(255, 0, 60, 0.06) 0%, transparent 40%),
        linear-gradient(135deg, rgba(13, 2, 8, 1) 0%, rgba(26, 14, 19, 1) 100%)
      `
    }
  }
}

// Cyberpunk-specific CSS animations and effects
export const cyberpunkThemeCSS = `
  /* Cyberpunk Theme Specific Styles */
  .theme-cyberpunk-2077 {
    --cyber-yellow: #fcee09;
    --cyber-red: #ff003c;
    --cyber-cyan: #00f5ff;
    --cyber-dark: #0d0208;
    --cyber-surface: #1a0e13;
  }

  .theme-cyberpunk-2077 .glitch-effect {
    position: relative;
    overflow: hidden;
  }

  .theme-cyberpunk-2077 .glitch-effect::before,
  .theme-cyberpunk-2077 .glitch-effect::after {
    content: attr(data-text);
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: inherit;
  }

  .theme-cyberpunk-2077 .glitch-effect::before {
    animation: glitch1 2s infinite;
    color: var(--cyber-red);
    z-index: -1;
  }

  .theme-cyberpunk-2077 .glitch-effect::after {
    animation: glitch2 2s infinite;
    color: var(--cyber-cyan);
    z-index: -2;
  }

  .theme-cyberpunk-2077 .neon-border {
    border: 2px solid var(--cyber-yellow);
    box-shadow: 
      0 0 10px var(--cyber-yellow),
      inset 0 0 10px rgba(252, 238, 9, 0.1);
    animation: neonPulse 3s ease-in-out infinite alternate;
  }

  .theme-cyberpunk-2077 .circuit-pattern {
    background-image: 
      linear-gradient(90deg, var(--cyber-yellow) 1px, transparent 1px),
      linear-gradient(180deg, var(--cyber-yellow) 1px, transparent 1px);
    background-size: 20px 20px;
    opacity: 0.1;
    animation: circuitFlow 4s linear infinite;
  }

  .theme-cyberpunk-2077 .hologram-effect {
    background: linear-gradient(
      45deg,
      transparent 30%,
      rgba(0, 245, 255, 0.1) 50%,
      transparent 70%
    );
    background-size: 200% 200%;
    animation: hologramScan 3s ease-in-out infinite;
  }

  .theme-cyberpunk-2077 .data-stream {
    position: relative;
    overflow: hidden;
  }

  .theme-cyberpunk-2077 .data-stream::before {
    content: '';
    position: absolute;
    top: -100%;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      180deg,
      transparent 0%,
      var(--cyber-cyan) 50%,
      transparent 100%
    );
    animation: dataFlow 2s ease-in-out infinite;
    opacity: 0.3;
  }

  @keyframes glitch1 {
    0%, 100% { transform: translate(0); }
    20% { transform: translate(-2px, 2px); }
    40% { transform: translate(-2px, -2px); }
    60% { transform: translate(2px, 2px); }
    80% { transform: translate(2px, -2px); }
  }

  @keyframes glitch2 {
    0%, 100% { transform: translate(0); }
    20% { transform: translate(2px, -2px); }
    40% { transform: translate(2px, 2px); }
    60% { transform: translate(-2px, -2px); }
    80% { transform: translate(-2px, 2px); }
  }

  @keyframes neonPulse {
    0% { 
      box-shadow: 
        0 0 10px var(--cyber-yellow),
        inset 0 0 10px rgba(252, 238, 9, 0.1);
    }
    100% { 
      box-shadow: 
        0 0 20px var(--cyber-yellow),
        0 0 30px var(--cyber-yellow),
        inset 0 0 20px rgba(252, 238, 9, 0.2);
    }
  }

  @keyframes circuitFlow {
    0% { background-position: 0 0; }
    100% { background-position: 20px 20px; }
  }

  @keyframes hologramScan {
    0% { background-position: -200% -200%; }
    100% { background-position: 200% 200%; }
  }

  @keyframes dataFlow {
    0% { top: -100%; opacity: 0; }
    50% { opacity: 0.3; }
    100% { top: 100%; opacity: 0; }
  }

  /* Cyberpunk-specific particle effects */
  .theme-cyberpunk-2077 .particle {
    background: var(--cyber-yellow);
    box-shadow: 0 0 8px var(--cyber-yellow);
  }

  .theme-cyberpunk-2077 .particle:nth-child(3n) {
    background: var(--cyber-red);
    box-shadow: 0 0 8px var(--cyber-red);
  }

  .theme-cyberpunk-2077 .particle:nth-child(5n) {
    background: var(--cyber-cyan);
    box-shadow: 0 0 8px var(--cyber-cyan);
  }

  /* Enhanced hover effects for Cyberpunk theme */
  .theme-cyberpunk-2077 .card-3d:hover {
    box-shadow: 
      0 15px 50px rgba(252, 238, 9, 0.25),
      0 0 30px rgba(252, 238, 9, 0.4),
      inset 0 1px 0 rgba(0, 245, 255, 0.2);
    border-color: rgba(252, 238, 9, 0.6);
  }

  .theme-cyberpunk-2077 .btn-3d:hover {
    box-shadow: 
      0 6px 25px rgba(252, 238, 9, 0.6),
      inset 0 1px 0 rgba(255, 255, 255, 0.4);
  }

  /* Cyberpunk theme scrollbar */
  .theme-cyberpunk-2077 ::-webkit-scrollbar-thumb {
    background: linear-gradient(45deg, var(--cyber-yellow), var(--cyber-red));
    box-shadow: 0 0 8px var(--cyber-yellow);
  }

  .theme-cyberpunk-2077 ::-webkit-scrollbar-track {
    background: rgba(252, 238, 9, 0.05);
  }

  /* Cyberpunk loading animation */
  .theme-cyberpunk-2077 .loader-3d::before {
    border-top-color: var(--cyber-yellow);
    box-shadow: 0 0 15px var(--cyber-yellow);
  }

  .theme-cyberpunk-2077 .loader-3d::after {
    border-top-color: var(--cyber-red);
    box-shadow: 0 0 15px var(--cyber-red);
  }
`
