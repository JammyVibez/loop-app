export const dragonLordTheme = {
  id: 'dragon-lord',
  name: 'Dragon Lord',
  description: 'Embrace the power of dragons with fiery effects and majestic animations',
  category: 'premium',
  rarity: 'legendary',
  price: 800,
  
  // Color scheme
  colors: {
    primary: '#8B0000', // Dark red
    secondary: '#FFD700', // Gold
    accent: '#FF4500', // Orange red
    background: {
      start: '#1a0000',
      mid: '#2d0000',
      end: '#1a0000',
    },
    text: {
      primary: '#FFD700',
      secondary: '#FFA500',
      muted: '#CD853F',
    },
    border: '#8B0000',
    card: 'rgba(139, 0, 0, 0.1)',
  },

  // CSS Variables
  cssVariables: {
    '--theme-bg-start': '#1a0000',
    '--theme-bg-mid': '#2d0000',
    '--theme-bg-end': '#1a0000',
    '--theme-bg-dark-start': '#0a0000',
    '--theme-bg-dark-mid': '#1a0000',
    '--theme-bg-dark-end': '#0a0000',
    '--theme-primary': '#8B0000',
    '--theme-secondary': '#FFD700',
    '--theme-accent': '#FF4500',
    '--theme-text-primary': '#FFD700',
    '--theme-text-secondary': '#FFA500',
    '--theme-border': '#8B0000',
    '--theme-card': 'rgba(139, 0, 0, 0.1)',
  },

  // Particle effects
  particles: {
    enabled: true,
    type: 'dragon_fire',
    config: {
      count: 50,
      size: { min: 2, max: 8 },
      speed: { min: 1, max: 3 },
      colors: ['#FF4500', '#FFD700', '#8B0000'],
      shapes: ['flame', 'spark', 'ember'],
      gravity: 0.1,
      wind: 0.05,
    },
  },

  // Animations
  animations: {
    entrance: 'dragonRoar',
    hover: 'dragonGlow',
    click: 'dragonFlame',
    background: 'dragonBreath',
  },

  // Sound effects
  sounds: {
    enabled: true,
    effects: {
      hover: '/sounds/dragon/wing-flap.mp3',
      click: '/sounds/dragon/roar-short.mp3',
      notification: '/sounds/dragon/growl.mp3',
      background: '/sounds/dragon/cave-ambience.mp3',
    },
    volume: 0.3,
  },

  // Special effects
  specialEffects: {
    cursorTrail: {
      enabled: true,
      type: 'flame',
      particles: 15,
      colors: ['#FF4500', '#FFD700'],
    },
    borderGlow: {
      enabled: true,
      color: '#8B0000',
      intensity: 0.8,
      pulse: true,
    },
    backgroundPattern: {
      enabled: true,
      pattern: 'dragon_scales',
      opacity: 0.1,
    },
  },

  // Component styles
  components: {
    card: {
      background: 'linear-gradient(135deg, rgba(139, 0, 0, 0.1) 0%, rgba(255, 69, 0, 0.05) 100%)',
      border: '1px solid rgba(139, 0, 0, 0.3)',
      boxShadow: '0 4px 20px rgba(139, 0, 0, 0.2)',
      backdropFilter: 'blur(10px)',
    },
    button: {
      primary: {
        background: 'linear-gradient(135deg, #8B0000 0%, #FF4500 100%)',
        hover: 'linear-gradient(135deg, #A00000 0%, #FF6500 100%)',
        boxShadow: '0 4px 15px rgba(139, 0, 0, 0.4)',
      },
      secondary: {
        background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 69, 0, 0.1) 100%)',
        border: '1px solid #FFD700',
        color: '#FFD700',
      },
    },
    avatar: {
      border: '2px solid #FFD700',
      boxShadow: '0 0 20px rgba(255, 215, 0, 0.5)',
      glow: true,
    },
    input: {
      background: 'rgba(139, 0, 0, 0.05)',
      border: '1px solid rgba(139, 0, 0, 0.3)',
      focus: {
        border: '1px solid #FFD700',
        boxShadow: '0 0 10px rgba(255, 215, 0, 0.3)',
      },
    },
  },

  // Dragon-specific gifts
  gifts: [
    {
      id: 'baby_dragon',
      name: 'Baby Dragon',
      description: 'A cute baby dragon companion',
      price: 300,
      animation_url: '/gifts/dragons/baby-dragon.gif',
      static_url: '/gifts/dragons/baby-dragon.png',
      rarity: 'rare',
      effects: ['follows_cursor', 'breathing_animation'],
    },
    {
      id: 'dragon_egg',
      name: 'Dragon Egg',
      description: 'Mysterious dragon egg that hatches over time',
      price: 150,
      animation_url: '/gifts/dragons/dragon-egg.gif',
      static_url: '/gifts/dragons/dragon-egg.png',
      rarity: 'common',
      effects: ['glowing', 'hatching_timer'],
    },
    {
      id: 'fire_breath',
      name: 'Fire Breath',
      description: 'Breathe fire across your profile',
      price: 500,
      animation_url: '/gifts/dragons/fire-breath.gif',
      static_url: '/gifts/dragons/fire-breath.png',
      rarity: 'epic',
      effects: ['screen_fire', 'burn_effect'],
    },
    {
      id: 'dragon_wings',
      name: 'Dragon Wings',
      description: 'Majestic dragon wings for your avatar',
      price: 400,
      animation_url: '/gifts/dragons/dragon-wings.gif',
      static_url: '/gifts/dragons/dragon-wings.png',
      rarity: 'epic',
      effects: ['wing_flap', 'wind_particles'],
    },
    {
      id: 'ancient_dragon',
      name: 'Ancient Dragon',
      description: 'Legendary ancient dragon guardian',
      price: 1000,
      animation_url: '/gifts/dragons/ancient-dragon.gif',
      static_url: '/gifts/dragons/ancient-dragon.png',
      rarity: 'legendary',
      effects: ['screen_takeover', 'roar_sound', 'treasure_rain'],
    },
  ],

  // CSS animations
  keyframes: `
    @keyframes dragonRoar {
      0% { transform: scale(0.8) rotate(-5deg); opacity: 0; }
      50% { transform: scale(1.1) rotate(2deg); opacity: 0.8; }
      100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }

    @keyframes dragonGlow {
      0%, 100% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.3); }
      50% { box-shadow: 0 0 30px rgba(255, 215, 0, 0.6); }
    }

    @keyframes dragonFlame {
      0% { transform: scale(1); }
      25% { transform: scale(1.05); filter: hue-rotate(30deg); }
      50% { transform: scale(1.1); filter: hue-rotate(60deg); }
      75% { transform: scale(1.05); filter: hue-rotate(30deg); }
      100% { transform: scale(1); filter: hue-rotate(0deg); }
    }

    @keyframes dragonBreath {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    @keyframes flameParticle {
      0% { 
        transform: translateY(0) scale(1); 
        opacity: 1; 
      }
      100% { 
        transform: translateY(-100px) scale(0); 
        opacity: 0; 
      }
    }

    @keyframes dragonScale {
      0%, 100% { transform: scale(1) rotate(0deg); }
      25% { transform: scale(1.02) rotate(1deg); }
      50% { transform: scale(1.04) rotate(0deg); }
      75% { transform: scale(1.02) rotate(-1deg); }
    }
  `,

  // JavaScript effects
  effects: {
    init: () => {
      // Initialize dragon theme effects
      console.log('🐉 Dragon Lord theme activated!')
      
      // Add dragon cursor trail
      const addDragonTrail = (e: MouseEvent) => {
        const trail = document.createElement('div')
        trail.className = 'dragon-cursor-trail'
        trail.style.cssText = `
          position: fixed;
          left: ${e.clientX}px;
          top: ${e.clientY}px;
          width: 8px;
          height: 8px;
          background: radial-gradient(circle, #FF4500, #FFD700);
          border-radius: 50%;
          pointer-events: none;
          z-index: 9999;
          animation: flameParticle 1s ease-out forwards;
        `
        document.body.appendChild(trail)
        
        setTimeout(() => trail.remove(), 1000)
      }
      
      document.addEventListener('mousemove', addDragonTrail)
      
      // Add dragon roar on theme activation
      setTimeout(() => {
        const audio = new Audio('/sounds/dragon/roar-long.mp3')
        audio.volume = 0.2
        audio.play().catch(() => {}) // Ignore autoplay restrictions
      }, 500)
    },
    
    destroy: () => {
      // Clean up dragon theme effects
      console.log('🐉 Dragon Lord theme deactivated')
      document.removeEventListener('mousemove', () => {})
    },
  },

  // Theme metadata
  metadata: {
    author: 'Loop Team',
    version: '1.0.0',
    created: '2024-01-01',
    tags: ['dragon', 'fire', 'fantasy', 'premium', 'animated'],
    compatibility: ['desktop', 'mobile', 'tablet'],
    requirements: {
      premium: true,
      minVersion: '1.0.0',
    },
  },
}

export default dragonLordTheme
