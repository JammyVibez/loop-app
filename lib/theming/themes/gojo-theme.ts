import { Theme3DConfig } from '../theme-engine'

export const gojoTheme: Theme3DConfig = {
  id: 'gojo-satoru',
  name: 'Gojo Satoru',
  category: 'anime',
  
  colors: {
    primary: '#00d4ff', // Gojo's signature blue
    secondary: '#ff006e', // Cursed energy pink
    accent: '#ffffff', // Pure white like his hair
    background: '#0a0a0f', // Deep dark blue-black
    surface: '#1a1a2e', // Dark blue surface
    text: '#ffffff', // White text
    shadow: 'rgba(0, 212, 255, 0.4)', // Blue shadow
    highlight: 'rgba(255, 255, 255, 0.3)', // White highlight
    depth: 'rgba(0, 212, 255, 0.2)', // Blue depth
    glow: 'rgba(0, 212, 255, 0.8)' // Intense blue glow
  },
  
  effects3D: {
    cardDepth: 12,
    hoverLift: 16,
    shadowIntensity: 0.4,
    transitionDuration: '0.4s',
    easeFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    
    particles: {
      enabled: true,
      count: 80,
      color: '#00d4ff',
      size: 3,
      speed: 1.5
    },
    
    glow: {
      enabled: true,
      intensity: 0.8,
      color: '#00d4ff',
      blur: 25
    },
    
    parallax: {
      enabled: true,
      intensity: 0.15,
      layers: 4
    }
  },
  
  components: {
    loopCard: {
      background: 'linear-gradient(135deg, rgba(26, 26, 46, 0.9), rgba(10, 10, 15, 0.95))',
      border: '2px solid rgba(0, 212, 255, 0.3)',
      borderRadius: '16px',
      transform3D: 'translateZ(0)',
      boxShadow: '0 12px 40px rgba(0, 212, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      hoverTransform: 'translateY(-8px) rotateX(3deg) rotateY(3deg) scale(1.02)'
    },
    
    navigation: {
      background: 'linear-gradient(135deg, rgba(10, 10, 15, 0.95), rgba(26, 26, 46, 0.9))',
      backdropFilter: 'blur(25px)',
      border: '1px solid rgba(0, 212, 255, 0.2)',
      itemHover: 'rgba(0, 212, 255, 0.15)'
    },
    
    button: {
      primary: {
        background: 'linear-gradient(135deg, #00d4ff, #0099cc)',
        color: '#000000',
        boxShadow: '0 6px 20px rgba(0, 212, 255, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
        hoverTransform: 'translateY(-3px) scale(1.05)'
      },
      secondary: {
        background: 'rgba(0, 212, 255, 0.15)',
        color: '#00d4ff',
        boxShadow: '0 4px 12px rgba(0, 212, 255, 0.3), inset 0 1px 0 rgba(0, 212, 255, 0.1)',
        hoverTransform: 'translateY(-2px) scale(1.03)'
      }
    },
    
    profile: {
      avatar: {
        border: '4px solid rgba(0, 212, 255, 0.6)',
        boxShadow: '0 0 30px rgba(0, 212, 255, 0.5), inset 0 0 20px rgba(255, 255, 255, 0.1)',
        hoverTransform: 'scale(1.1) rotateZ(10deg)'
      },
      banner: {
        background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.4), rgba(255, 0, 110, 0.3), rgba(0, 212, 255, 0.2))',
        overlay: 'rgba(10, 10, 15, 0.3)',
        filter: 'blur(0.8px) brightness(1.1)'
      }
    },
    
    text: {
      heading: {
        color: '#ffffff',
        textShadow: '0 0 20px rgba(0, 212, 255, 0.8), 0 2px 4px rgba(0, 0, 0, 0.5)',
        fontWeight: '800'
      },
      body: {
        color: '#e0e6ed',
        textShadow: '0 1px 3px rgba(0, 0, 0, 0.4)'
      },
      accent: {
        color: '#00d4ff',
        textShadow: '0 0 15px rgba(0, 212, 255, 0.8)',
        background: 'rgba(0, 212, 255, 0.1)'
      }
    }
  },
  
  animations: {
    fadeIn: 'fadeIn 0.6s ease-out',
    slideIn: 'slideIn 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    bounce: 'bounce 0.8s ease-in-out',
    pulse: 'pulse 2.5s ease-in-out infinite',
    rotate3D: 'rotate3D 1.2s ease-in-out',
    flip: 'flip 0.8s ease-in-out',
    morphing: 'morphing 3s ease-in-out infinite'
  },
  
  environment: {
    type: 'particles',
    config: {
      count: 100,
      colors: ['#00d4ff', '#ffffff', '#ff006e'],
      sizes: [1, 2, 3],
      speeds: [0.5, 1, 1.5],
      background: `
        radial-gradient(circle at 20% 80%, rgba(0, 212, 255, 0.15) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(255, 0, 110, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 40% 40%, rgba(255, 255, 255, 0.05) 0%, transparent 50%),
        linear-gradient(135deg, rgba(10, 10, 15, 1) 0%, rgba(26, 26, 46, 1) 100%)
      `
    }
  }
}

// Gojo-specific CSS animations and effects
export const gojoThemeCSS = `
  /* Gojo Theme Specific Styles */
  .theme-gojo-satoru {
    --gojo-blue: #00d4ff;
    --gojo-pink: #ff006e;
    --gojo-white: #ffffff;
    --gojo-dark: #0a0a0f;
  }

  .theme-gojo-satoru .infinity-effect {
    position: relative;
    overflow: hidden;
  }

  .theme-gojo-satoru .infinity-effect::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: conic-gradient(
      from 0deg,
      transparent,
      var(--gojo-blue),
      transparent,
      var(--gojo-pink),
      transparent
    );
    animation: infinityRotate 4s linear infinite;
    opacity: 0.3;
  }

  .theme-gojo-satoru .six-eyes-glow {
    box-shadow: 
      0 0 20px var(--gojo-blue),
      0 0 40px var(--gojo-blue),
      0 0 60px var(--gojo-blue),
      inset 0 0 20px rgba(255, 255, 255, 0.1);
    animation: sixEyesGlow 3s ease-in-out infinite alternate;
  }

  .theme-gojo-satoru .cursed-energy {
    background: linear-gradient(
      45deg,
      var(--gojo-blue) 0%,
      var(--gojo-pink) 50%,
      var(--gojo-blue) 100%
    );
    background-size: 200% 200%;
    animation: cursedEnergyFlow 2s ease-in-out infinite;
  }

  .theme-gojo-satoru .domain-expansion {
    position: relative;
    background: radial-gradient(
      circle,
      rgba(0, 212, 255, 0.1) 0%,
      rgba(255, 0, 110, 0.05) 50%,
      transparent 100%
    );
    animation: domainPulse 4s ease-in-out infinite;
  }

  @keyframes infinityRotate {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @keyframes sixEyesGlow {
    0% { 
      box-shadow: 
        0 0 20px var(--gojo-blue),
        0 0 40px var(--gojo-blue),
        inset 0 0 20px rgba(255, 255, 255, 0.1);
    }
    100% { 
      box-shadow: 
        0 0 30px var(--gojo-blue),
        0 0 60px var(--gojo-blue),
        0 0 90px var(--gojo-blue),
        inset 0 0 30px rgba(255, 255, 255, 0.2);
    }
  }

  @keyframes cursedEnergyFlow {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  @keyframes domainPulse {
    0%, 100% { 
      transform: scale(1);
      opacity: 0.8;
    }
    50% { 
      transform: scale(1.05);
      opacity: 1;
    }
  }

  /* Gojo-specific particle effects */
  .theme-gojo-satoru .particle {
    background: var(--gojo-blue);
    box-shadow: 0 0 10px var(--gojo-blue);
  }

  .theme-gojo-satoru .particle:nth-child(3n) {
    background: var(--gojo-pink);
    box-shadow: 0 0 10px var(--gojo-pink);
  }

  .theme-gojo-satoru .particle:nth-child(5n) {
    background: var(--gojo-white);
    box-shadow: 0 0 8px var(--gojo-white);
  }

  /* Enhanced hover effects for Gojo theme */
  .theme-gojo-satoru .card-3d:hover {
    box-shadow: 
      0 20px 60px rgba(0, 212, 255, 0.3),
      0 0 40px rgba(0, 212, 255, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  .theme-gojo-satoru .btn-3d:hover {
    box-shadow: 
      0 8px 30px rgba(0, 212, 255, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }

  /* Gojo theme scrollbar */
  .theme-gojo-satoru ::-webkit-scrollbar-thumb {
    background: linear-gradient(45deg, var(--gojo-blue), var(--gojo-pink));
    box-shadow: 0 0 10px var(--gojo-blue);
  }
`
