import { Theme3DConfig } from '../theme-engine'

export const neonGenesisTheme: Theme3DConfig = {
  id: 'neon-genesis-evangelion',
  name: 'Neon Genesis Evangelion',
  category: 'anime',
  
  colors: {
    primary: '#ff6b35', // EVA Unit-02 orange
    secondary: '#8a2be2', // EVA Unit-01 purple
    accent: '#00ff41', // AT Field green
    background: '#0a0a0a', // Deep black void
    surface: '#1a1a2e', // Dark purple surface
    text: '#ffffff', // White text
    shadow: 'rgba(255, 107, 53, 0.4)', // Orange shadow
    highlight: 'rgba(0, 255, 65, 0.3)', // Green highlight
    depth: 'rgba(138, 43, 226, 0.2)', // Purple depth
    glow: 'rgba(255, 107, 53, 0.7)' // Orange glow
  },
  
  effects3D: {
    cardDepth: 14,
    hoverLift: 18,
    shadowIntensity: 0.5,
    transitionDuration: '0.45s',
    easeFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    
    particles: {
      enabled: true,
      count: 60,
      color: '#ff6b35',
      size: 4,
      speed: 1.2
    },
    
    glow: {
      enabled: true,
      intensity: 0.7,
      color: '#ff6b35',
      blur: 28
    },
    
    parallax: {
      enabled: true,
      intensity: 0.18,
      layers: 6
    }
  },
  
  components: {
    loopCard: {
      background: 'linear-gradient(135deg, rgba(26, 26, 46, 0.92), rgba(10, 10, 10, 0.96))',
      border: '2px solid rgba(255, 107, 53, 0.35)',
      borderRadius: '12px',
      transform3D: 'translateZ(0)',
      boxShadow: '0 14px 45px rgba(255, 107, 53, 0.25), inset 0 1px 0 rgba(0, 255, 65, 0.1)',
      hoverTransform: 'translateY(-10px) rotateX(4deg) rotateY(4deg) scale(1.04)'
    },
    
    navigation: {
      background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.96), rgba(26, 26, 46, 0.92))',
      backdropFilter: 'blur(22px) saturate(1.2)',
      border: '1px solid rgba(255, 107, 53, 0.25)',
      itemHover: 'rgba(255, 107, 53, 0.12)'
    },
    
    button: {
      primary: {
        background: 'linear-gradient(135deg, #ff6b35, #ff8c42)',
        color: '#000000',
        boxShadow: '0 7px 22px rgba(255, 107, 53, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
        hoverTransform: 'translateY(-4px) scale(1.06)'
      },
      secondary: {
        background: 'rgba(255, 107, 53, 0.18)',
        color: '#ff6b35',
        boxShadow: '0 5px 16px rgba(255, 107, 53, 0.35), inset 0 1px 0 rgba(255, 107, 53, 0.15)',
        hoverTransform: 'translateY(-3px) scale(1.04)'
      }
    },
    
    profile: {
      avatar: {
        border: '4px solid rgba(255, 107, 53, 0.65)',
        boxShadow: '0 0 35px rgba(255, 107, 53, 0.6), 0 0 70px rgba(138, 43, 226, 0.3)',
        hoverTransform: 'scale(1.12) rotateZ(15deg)'
      },
      banner: {
        background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.35), rgba(138, 43, 226, 0.4), rgba(0, 255, 65, 0.25))',
        overlay: 'rgba(10, 10, 10, 0.35)',
        filter: 'blur(1.2px) contrast(1.15) saturate(1.4)'
      }
    },
    
    text: {
      heading: {
        color: '#ff6b35',
        textShadow: '0 0 18px rgba(255, 107, 53, 0.8), 0 3px 6px rgba(0, 0, 0, 0.6)',
        fontWeight: '900'
      },
      body: {
        color: '#f0f0f0',
        textShadow: '0 1px 4px rgba(0, 0, 0, 0.5)'
      },
      accent: {
        color: '#00ff41',
        textShadow: '0 0 14px rgba(0, 255, 65, 0.8)',
        background: 'rgba(0, 255, 65, 0.08)'
      }
    }
  },
  
  animations: {
    fadeIn: 'fadeIn 0.7s ease-out',
    slideIn: 'slideIn 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    bounce: 'bounce 0.9s ease-in-out',
    pulse: 'pulse 2.8s ease-in-out infinite',
    rotate3D: 'rotate3D 1.4s ease-in-out',
    flip: 'flip 0.9s ease-in-out',
    morphing: 'morphing 3.5s ease-in-out infinite'
  },
  
  environment: {
    type: 'abstract',
    config: {
      pattern: 'hexagonal',
      colors: ['#ff6b35', '#8a2be2', '#00ff41'],
      opacity: 0.12,
      animation: 'drift',
      background: `
        radial-gradient(circle at 25% 75%, rgba(255, 107, 53, 0.18) 0%, transparent 45%),
        radial-gradient(circle at 75% 25%, rgba(138, 43, 226, 0.15) 0%, transparent 45%),
        radial-gradient(circle at 50% 50%, rgba(0, 255, 65, 0.08) 0%, transparent 60%),
        linear-gradient(135deg, rgba(10, 10, 10, 1) 0%, rgba(26, 26, 46, 1) 100%)
      `
    }
  }
}

// Neon Genesis-specific CSS animations and effects
export const neonGenesisThemeCSS = `
  /* Neon Genesis Theme Specific Styles */
  .theme-neon-genesis-evangelion {
    --eva-orange: #ff6b35;
    --eva-purple: #8a2be2;
    --eva-green: #00ff41;
    --eva-dark: #0a0a0a;
  }

  .theme-neon-genesis-evangelion .at-field-effect {
    position: relative;
    overflow: hidden;
  }

  .theme-neon-genesis-evangelion .at-field-effect::before {
    content: '';
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    background: linear-gradient(
      45deg,
      var(--eva-green),
      transparent,
      var(--eva-green),
      transparent,
      var(--eva-green)
    );
    background-size: 20px 20px;
    animation: atFieldPulse 3s ease-in-out infinite;
    opacity: 0.6;
    z-index: -1;
  }

  .theme-neon-genesis-evangelion .eva-unit-glow {
    box-shadow: 
      0 0 25px var(--eva-orange),
      0 0 50px var(--eva-orange),
      0 0 75px var(--eva-purple),
      inset 0 0 25px rgba(255, 255, 255, 0.1);
    animation: evaUnitGlow 4s ease-in-out infinite alternate;
  }

  .theme-neon-genesis-evangelion .lcl-fluid {
    background: radial-gradient(
      ellipse at center,
      rgba(255, 107, 53, 0.2) 0%,
      rgba(138, 43, 226, 0.15) 40%,
      rgba(0, 255, 65, 0.1) 70%,
      transparent 100%
    );
    animation: lclFlow 5s ease-in-out infinite;
  }

  .theme-neon-genesis-evangelion .angel-pattern {
    position: relative;
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 10px,
      rgba(255, 107, 53, 0.05) 10px,
      rgba(255, 107, 53, 0.05) 20px
    );
    animation: angelDrift 6s linear infinite;
  }

  .theme-neon-genesis-evangelion .entry-plug {
    background: linear-gradient(
      180deg,
      rgba(255, 107, 53, 0.1) 0%,
      rgba(138, 43, 226, 0.08) 50%,
      rgba(0, 255, 65, 0.06) 100%
    );
    border: 1px solid rgba(255, 107, 53, 0.3);
    animation: entryPlugHum 3s ease-in-out infinite;
  }

  .theme-neon-genesis-evangelion .nerv-logo {
    position: relative;
  }

  .theme-neon-genesis-evangelion .nerv-logo::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100%;
    height: 100%;
    background: conic-gradient(
      from 0deg,
      var(--eva-orange),
      var(--eva-purple),
      var(--eva-green),
      var(--eva-orange)
    );
    transform: translate(-50%, -50%);
    animation: nervRotate 8s linear infinite;
    opacity: 0.2;
    z-index: -1;
  }

  @keyframes atFieldPulse {
    0%, 100% { 
      opacity: 0.6;
      background-size: 20px 20px;
    }
    50% { 
      opacity: 0.9;
      background-size: 25px 25px;
    }
  }

  @keyframes evaUnitGlow {
    0% { 
      box-shadow: 
        0 0 25px var(--eva-orange),
        0 0 50px var(--eva-orange),
        inset 0 0 25px rgba(255, 255, 255, 0.1);
    }
    100% { 
      box-shadow: 
        0 0 35px var(--eva-orange),
        0 0 70px var(--eva-orange),
        0 0 105px var(--eva-purple),
        inset 0 0 35px rgba(255, 255, 255, 0.2);
    }
  }

  @keyframes lclFlow {
    0%, 100% { 
      transform: scale(1) rotate(0deg);
      opacity: 0.8;
    }
    33% { 
      transform: scale(1.1) rotate(120deg);
      opacity: 1;
    }
    66% { 
      transform: scale(0.9) rotate(240deg);
      opacity: 0.9;
    }
  }

  @keyframes angelDrift {
    0% { background-position: 0 0; }
    100% { background-position: 40px 40px; }
  }

  @keyframes entryPlugHum {
    0%, 100% { 
      border-color: rgba(255, 107, 53, 0.3);
      box-shadow: 0 0 10px rgba(255, 107, 53, 0.2);
    }
    50% { 
      border-color: rgba(255, 107, 53, 0.6);
      box-shadow: 0 0 20px rgba(255, 107, 53, 0.4);
    }
  }

  @keyframes nervRotate {
    0% { transform: translate(-50%, -50%) rotate(0deg); }
    100% { transform: translate(-50%, -50%) rotate(360deg); }
  }

  /* Neon Genesis-specific particle effects */
  .theme-neon-genesis-evangelion .particle {
    background: var(--eva-orange);
    box-shadow: 0 0 12px var(--eva-orange);
  }

  .theme-neon-genesis-evangelion .particle:nth-child(3n) {
    background: var(--eva-purple);
    box-shadow: 0 0 12px var(--eva-purple);
  }

  .theme-neon-genesis-evangelion .particle:nth-child(5n) {
    background: var(--eva-green);
    box-shadow: 0 0 10px var(--eva-green);
  }

  /* Enhanced hover effects for Neon Genesis theme */
  .theme-neon-genesis-evangelion .card-3d:hover {
    box-shadow: 
      0 25px 70px rgba(255, 107, 53, 0.35),
      0 0 50px rgba(255, 107, 53, 0.5),
      inset 0 1px 0 rgba(0, 255, 65, 0.2);
    border-color: rgba(255, 107, 53, 0.7);
  }

  .theme-neon-genesis-evangelion .btn-3d:hover {
    box-shadow: 
      0 10px 35px rgba(255, 107, 53, 0.6),
      inset 0 1px 0 rgba(255, 255, 255, 0.4);
  }

  /* Neon Genesis theme scrollbar */
  .theme-neon-genesis-evangelion ::-webkit-scrollbar-thumb {
    background: linear-gradient(45deg, var(--eva-orange), var(--eva-purple));
    box-shadow: 0 0 12px var(--eva-orange);
  }

  .theme-neon-genesis-evangelion ::-webkit-scrollbar-track {
    background: rgba(255, 107, 53, 0.08);
  }

  /* Neon Genesis loading animation */
  .theme-neon-genesis-evangelion .loader-3d::before {
    border-top-color: var(--eva-orange);
    box-shadow: 0 0 18px var(--eva-orange);
  }

  .theme-neon-genesis-evangelion .loader-3d::after {
    border-top-color: var(--eva-purple);
    box-shadow: 0 0 18px var(--eva-purple);
  }
`
