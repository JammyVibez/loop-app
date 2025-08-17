import { Theme3DConfig } from '../theme-engine'

export const sakuraBloomTheme: Theme3DConfig = {
  id: 'sakura-bloom',
  name: 'Sakura Bloom',
  category: 'nature',
  
  colors: {
    primary: '#ff69b4', // Cherry blossom pink
    secondary: '#ffc0cb', // Soft pink
    accent: '#98fb98', // Pale green
    background: '#faf0e6', // Linen white
    surface: '#fff8dc', // Cornsilk
    text: '#2f4f4f', // Dark slate gray
    shadow: 'rgba(255, 105, 180, 0.3)', // Pink shadow
    highlight: 'rgba(152, 251, 152, 0.2)', // Green highlight
    depth: 'rgba(255, 192, 203, 0.2)', // Soft pink depth
    glow: 'rgba(255, 105, 180, 0.6)' // Pink glow
  },
  
  effects3D: {
    cardDepth: 8,
    hoverLift: 12,
    shadowIntensity: 0.25,
    transitionDuration: '0.5s',
    easeFunction: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
    
    particles: {
      enabled: true,
      count: 40,
      color: '#ff69b4',
      size: 3,
      speed: 0.8
    },
    
    glow: {
      enabled: true,
      intensity: 0.4,
      color: '#ff69b4',
      blur: 15
    },
    
    parallax: {
      enabled: true,
      intensity: 0.08,
      layers: 3
    }
  },
  
  components: {
    loopCard: {
      background: 'linear-gradient(135deg, rgba(255, 248, 220, 0.95), rgba(250, 240, 230, 0.98))',
      border: '1px solid rgba(255, 105, 180, 0.25)',
      borderRadius: '20px',
      transform3D: 'translateZ(0)',
      boxShadow: '0 8px 25px rgba(255, 105, 180, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
      hoverTransform: 'translateY(-6px) rotateX(1deg) rotateY(1deg) scale(1.02)'
    },
    
    navigation: {
      background: 'linear-gradient(135deg, rgba(250, 240, 230, 0.98), rgba(255, 248, 220, 0.95))',
      backdropFilter: 'blur(15px) saturate(1.1)',
      border: '1px solid rgba(255, 105, 180, 0.2)',
      itemHover: 'rgba(255, 105, 180, 0.08)'
    },
    
    button: {
      primary: {
        background: 'linear-gradient(135deg, #ff69b4, #ff1493)',
        color: '#ffffff',
        boxShadow: '0 4px 15px rgba(255, 105, 180, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
        hoverTransform: 'translateY(-2px) scale(1.03)'
      },
      secondary: {
        background: 'rgba(255, 105, 180, 0.1)',
        color: '#ff69b4',
        boxShadow: '0 2px 10px rgba(255, 105, 180, 0.2), inset 0 1px 0 rgba(255, 105, 180, 0.1)',
        hoverTransform: 'translateY(-1px) scale(1.02)'
      }
    },
    
    profile: {
      avatar: {
        border: '3px solid rgba(255, 105, 180, 0.5)',
        boxShadow: '0 0 20px rgba(255, 105, 180, 0.4), 0 0 40px rgba(152, 251, 152, 0.2)',
        hoverTransform: 'scale(1.08) rotateZ(-3deg)'
      },
      banner: {
        background: 'linear-gradient(135deg, rgba(255, 105, 180, 0.25), rgba(255, 192, 203, 0.3), rgba(152, 251, 152, 0.2))',
        overlay: 'rgba(250, 240, 230, 0.2)',
        filter: 'blur(0.5px) brightness(1.05) saturate(1.1)'
      }
    },
    
    text: {
      heading: {
        color: '#ff69b4',
        textShadow: '0 0 10px rgba(255, 105, 180, 0.5), 0 1px 3px rgba(0, 0, 0, 0.1)',
        fontWeight: '700'
      },
      body: {
        color: '#2f4f4f',
        textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)'
      },
      accent: {
        color: '#98fb98',
        textShadow: '0 0 8px rgba(152, 251, 152, 0.6)',
        background: 'rgba(152, 251, 152, 0.1)'
      }
    }
  },
  
  animations: {
    fadeIn: 'fadeIn 0.8s ease-out',
    slideIn: 'slideIn 0.5s cubic-bezier(0.25, 0.1, 0.25, 1)',
    bounce: 'bounce 1s ease-in-out',
    pulse: 'pulse 3s ease-in-out infinite',
    rotate3D: 'rotate3D 1.5s ease-in-out',
    flip: 'flip 1s ease-in-out',
    morphing: 'morphing 4s ease-in-out infinite'
  },
  
  environment: {
    type: 'nature',
    config: {
      pattern: 'petals',
      colors: ['#ff69b4', '#ffc0cb', '#98fb98'],
      opacity: 0.08,
      animation: 'float',
      background: `
        radial-gradient(circle at 30% 80%, rgba(255, 105, 180, 0.12) 0%, transparent 50%),
        radial-gradient(circle at 70% 20%, rgba(255, 192, 203, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 50% 50%, rgba(152, 251, 152, 0.08) 0%, transparent 60%),
        linear-gradient(135deg, rgba(250, 240, 230, 1) 0%, rgba(255, 248, 220, 1) 100%)
      `
    }
  }
}

// Sakura Bloom-specific CSS animations and effects
export const sakuraBloomThemeCSS = `
  /* Sakura Bloom Theme Specific Styles */
  .theme-sakura-bloom {
    --sakura-pink: #ff69b4;
    --sakura-soft: #ffc0cb;
    --sakura-green: #98fb98;
    --sakura-light: #faf0e6;
    --sakura-surface: #fff8dc;
  }

  .theme-sakura-bloom .petal-fall {
    position: relative;
    overflow: hidden;
  }

  .theme-sakura-bloom .petal-fall::before {
    content: '';
    position: absolute;
    top: -100%;
    left: 0;
    width: 100%;
    height: 200%;
    background-image: 
      radial-gradient(circle at 20% 20%, var(--sakura-pink) 2px, transparent 2px),
      radial-gradient(circle at 60% 40%, var(--sakura-soft) 1.5px, transparent 1.5px),
      radial-gradient(circle at 80% 80%, var(--sakura-pink) 2.5px, transparent 2.5px);
    background-size: 50px 50px, 30px 30px, 70px 70px;
    animation: petalFall 8s linear infinite;
    opacity: 0.6;
  }

  .theme-sakura-bloom .cherry-blossom {
    position: relative;
    background: radial-gradient(
      circle,
      rgba(255, 105, 180, 0.1) 0%,
      rgba(255, 192, 203, 0.08) 40%,
      transparent 70%
    );
    animation: blossomSway 4s ease-in-out infinite;
  }

  .theme-sakura-bloom .spring-breeze {
    background: linear-gradient(
      45deg,
      rgba(255, 105, 180, 0.05) 0%,
      rgba(152, 251, 152, 0.05) 50%,
      rgba(255, 192, 203, 0.05) 100%
    );
    background-size: 200% 200%;
    animation: springBreeze 6s ease-in-out infinite;
  }

  .theme-sakura-bloom .zen-ripple {
    position: relative;
    overflow: hidden;
  }

  .theme-sakura-bloom .zen-ripple::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    border: 1px solid rgba(255, 105, 180, 0.3);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    animation: zenRipple 3s ease-out infinite;
  }

  .theme-sakura-bloom .soft-glow {
    box-shadow: 
      0 0 15px rgba(255, 105, 180, 0.3),
      0 0 30px rgba(255, 192, 203, 0.2),
      inset 0 0 15px rgba(255, 255, 255, 0.5);
    animation: softGlow 3s ease-in-out infinite alternate;
  }

  .theme-sakura-bloom .bamboo-pattern {
    background-image: 
      linear-gradient(90deg, rgba(152, 251, 152, 0.1) 1px, transparent 1px),
      linear-gradient(180deg, rgba(152, 251, 152, 0.1) 1px, transparent 1px);
    background-size: 15px 15px;
    animation: bambooSway 5s ease-in-out infinite;
  }

  .theme-sakura-bloom .morning-dew {
    position: relative;
  }

  .theme-sakura-bloom .morning-dew::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.3) 0%,
      transparent 30%,
      transparent 70%,
      rgba(255, 255, 255, 0.2) 100%
    );
    animation: morningDew 4s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes petalFall {
    0% { 
      top: -100%;
      transform: rotate(0deg);
    }
    100% { 
      top: 100%;
      transform: rotate(360deg);
    }
  }

  @keyframes blossomSway {
    0%, 100% { 
      transform: rotate(0deg) scale(1);
    }
    25% { 
      transform: rotate(1deg) scale(1.02);
    }
    75% { 
      transform: rotate(-1deg) scale(0.98);
    }
  }

  @keyframes springBreeze {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  @keyframes zenRipple {
    0% { 
      width: 0;
      height: 0;
      opacity: 1;
    }
    100% { 
      width: 100px;
      height: 100px;
      opacity: 0;
    }
  }

  @keyframes softGlow {
    0% { 
      box-shadow: 
        0 0 15px rgba(255, 105, 180, 0.3),
        0 0 30px rgba(255, 192, 203, 0.2),
        inset 0 0 15px rgba(255, 255, 255, 0.5);
    }
    100% { 
      box-shadow: 
        0 0 25px rgba(255, 105, 180, 0.5),
        0 0 50px rgba(255, 192, 203, 0.3),
        inset 0 0 25px rgba(255, 255, 255, 0.7);
    }
  }

  @keyframes bambooSway {
    0%, 100% { 
      background-position: 0 0;
      opacity: 0.8;
    }
    50% { 
      background-position: 5px 5px;
      opacity: 1;
    }
  }

  @keyframes morningDew {
    0%, 100% { 
      opacity: 0.3;
      transform: scale(1);
    }
    50% { 
      opacity: 0.6;
      transform: scale(1.05);
    }
  }

  /* Sakura-specific particle effects */
  .theme-sakura-bloom .particle {
    background: var(--sakura-pink);
    box-shadow: 0 0 8px var(--sakura-pink);
    border-radius: 50% 0 50% 0;
  }

  .theme-sakura-bloom .particle:nth-child(3n) {
    background: var(--sakura-soft);
    box-shadow: 0 0 6px var(--sakura-soft);
  }

  .theme-sakura-bloom .particle:nth-child(5n) {
    background: var(--sakura-green);
    box-shadow: 0 0 5px var(--sakura-green);
    border-radius: 50%;
  }

  /* Enhanced hover effects for Sakura theme */
  .theme-sakura-bloom .card-3d:hover {
    box-shadow: 
      0 15px 40px rgba(255, 105, 180, 0.2),
      0 0 30px rgba(255, 105, 180, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
    border-color: rgba(255, 105, 180, 0.4);
  }

  .theme-sakura-bloom .btn-3d:hover {
    box-shadow: 
      0 6px 20px rgba(255, 105, 180, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.6);
  }

  /* Sakura theme scrollbar */
  .theme-sakura-bloom ::-webkit-scrollbar-thumb {
    background: linear-gradient(45deg, var(--sakura-pink), var(--sakura-soft));
    box-shadow: 0 0 8px var(--sakura-pink);
  }

  .theme-sakura-bloom ::-webkit-scrollbar-track {
    background: rgba(255, 105, 180, 0.05);
  }

  /* Sakura loading animation */
  .theme-sakura-bloom .loader-3d::before {
    border-top-color: var(--sakura-pink);
    box-shadow: 0 0 12px var(--sakura-pink);
  }

  .theme-sakura-bloom .loader-3d::after {
    border-top-color: var(--sakura-soft);
    box-shadow: 0 0 12px var(--sakura-soft);
  }

  /* Light theme adjustments */
  .theme-sakura-bloom {
    color-scheme: light;
  }

  .theme-sakura-bloom .text-3d-glow {
    text-shadow: 0 0 8px rgba(255, 105, 180, 0.4);
  }
`
