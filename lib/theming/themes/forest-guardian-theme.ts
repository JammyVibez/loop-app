export const forestGuardianTheme = {
  id: 'forest-guardian',
  name: 'Forest Guardian',
  description: 'Connect with nature through mystical forest magic and growing trees',
  category: 'premium',
  rarity: 'epic',
  price: 600,
  
  // Color scheme
  colors: {
    primary: '#228B22', // Forest green
    secondary: '#8FBC8F', // Dark sea green
    accent: '#32CD32', // Lime green
    background: {
      start: '#0a1a0a',
      mid: '#1a2d1a',
      end: '#0a1a0a',
    },
    text: {
      primary: '#90EE90',
      secondary: '#98FB98',
      muted: '#8FBC8F',
    },
    border: '#228B22',
    card: 'rgba(34, 139, 34, 0.1)',
  },

  // CSS Variables
  cssVariables: {
    '--theme-bg-start': '#0a1a0a',
    '--theme-bg-mid': '#1a2d1a',
    '--theme-bg-end': '#0a1a0a',
    '--theme-bg-dark-start': '#050f05',
    '--theme-bg-dark-mid': '#0f1a0f',
    '--theme-bg-dark-end': '#050f05',
    '--theme-primary': '#228B22',
    '--theme-secondary': '#8FBC8F',
    '--theme-accent': '#32CD32',
    '--theme-text-primary': '#90EE90',
    '--theme-text-secondary': '#98FB98',
    '--theme-border': '#228B22',
    '--theme-card': 'rgba(34, 139, 34, 0.1)',
  },

  // Particle effects
  particles: {
    enabled: true,
    type: 'nature_magic',
    config: {
      count: 40,
      size: { min: 1, max: 6 },
      speed: { min: 0.5, max: 2 },
      colors: ['#32CD32', '#90EE90', '#228B22', '#8FBC8F'],
      shapes: ['leaf', 'petal', 'sparkle', 'seed'],
      gravity: -0.05, // Float upward
      wind: 0.1,
      seasonal: true, // Changes with seasons
    },
  },

  // Animations
  animations: {
    entrance: 'treeGrowth',
    hover: 'leafRustle',
    click: 'branchSway',
    background: 'forestBreeze',
  },

  // Sound effects
  sounds: {
    enabled: true,
    effects: {
      hover: '/sounds/forest/leaf-rustle.mp3',
      click: '/sounds/forest/branch-creak.mp3',
      notification: '/sounds/forest/bird-chirp.mp3',
      background: '/sounds/forest/forest-ambience.mp3',
    },
    volume: 0.25,
  },

  // Special effects
  specialEffects: {
    cursorTrail: {
      enabled: true,
      type: 'leaves',
      particles: 12,
      colors: ['#32CD32', '#90EE90'],
    },
    borderGlow: {
      enabled: true,
      color: '#228B22',
      intensity: 0.6,
      pulse: true,
    },
    backgroundPattern: {
      enabled: true,
      pattern: 'tree_bark',
      opacity: 0.08,
    },
    seasonalEffects: {
      enabled: true,
      spring: { particles: 'flowers', colors: ['#FFB6C1', '#98FB98'] },
      summer: { particles: 'leaves', colors: ['#32CD32', '#90EE90'] },
      autumn: { particles: 'falling_leaves', colors: ['#FF8C00', '#DAA520'] },
      winter: { particles: 'snowflakes', colors: ['#F0F8FF', '#E6E6FA'] },
    },
  },

  // Component styles
  components: {
    card: {
      background: 'linear-gradient(135deg, rgba(34, 139, 34, 0.1) 0%, rgba(50, 205, 50, 0.05) 100%)',
      border: '1px solid rgba(34, 139, 34, 0.3)',
      boxShadow: '0 4px 20px rgba(34, 139, 34, 0.15)',
      backdropFilter: 'blur(10px)',
    },
    button: {
      primary: {
        background: 'linear-gradient(135deg, #228B22 0%, #32CD32 100%)',
        hover: 'linear-gradient(135deg, #2E8B57 0%, #3CB371 100%)',
        boxShadow: '0 4px 15px rgba(34, 139, 34, 0.3)',
      },
      secondary: {
        background: 'linear-gradient(135deg, rgba(144, 238, 144, 0.1) 0%, rgba(50, 205, 50, 0.1) 100%)',
        border: '1px solid #90EE90',
        color: '#90EE90',
      },
    },
    avatar: {
      border: '2px solid #90EE90',
      boxShadow: '0 0 20px rgba(144, 238, 144, 0.4)',
      glow: true,
    },
    input: {
      background: 'rgba(34, 139, 34, 0.05)',
      border: '1px solid rgba(34, 139, 34, 0.3)',
      focus: {
        border: '1px solid #90EE90',
        boxShadow: '0 0 10px rgba(144, 238, 144, 0.3)',
      },
    },
  },

  // Forest-specific gifts
  gifts: [
    {
      id: 'growing_tree',
      name: 'Growing Tree',
      description: 'A magical tree that grows on your profile',
      price: 250,
      animation_url: '/gifts/forest/growing-tree.gif',
      static_url: '/gifts/forest/growing-tree.png',
      rarity: 'rare',
      effects: ['growth_animation', 'seasonal_changes'],
    },
    {
      id: 'forest_sprite',
      name: 'Forest Sprite',
      description: 'A playful forest sprite companion',
      price: 200,
      animation_url: '/gifts/forest/forest-sprite.gif',
      static_url: '/gifts/forest/forest-sprite.png',
      rarity: 'rare',
      effects: ['flying_animation', 'sparkle_trail'],
    },
    {
      id: 'flower_bloom',
      name: 'Flower Bloom',
      description: 'Beautiful flowers that bloom across your profile',
      price: 150,
      animation_url: '/gifts/forest/flower-bloom.gif',
      static_url: '/gifts/forest/flower-bloom.png',
      rarity: 'common',
      effects: ['blooming_animation', 'petal_fall'],
    },
    {
      id: 'ancient_oak',
      name: 'Ancient Oak',
      description: 'Majestic ancient oak tree guardian',
      price: 500,
      animation_url: '/gifts/forest/ancient-oak.gif',
      static_url: '/gifts/forest/ancient-oak.png',
      rarity: 'epic',
      effects: ['wisdom_aura', 'bird_nests', 'seasonal_foliage'],
    },
    {
      id: 'nature_crown',
      name: 'Nature Crown',
      description: 'Crown of leaves and flowers for your avatar',
      price: 300,
      animation_url: '/gifts/forest/nature-crown.gif',
      static_url: '/gifts/forest/nature-crown.png',
      rarity: 'epic',
      effects: ['leaf_crown', 'flower_petals', 'nature_blessing'],
    },
    {
      id: 'world_tree',
      name: 'World Tree',
      description: 'Legendary world tree that connects all life',
      price: 800,
      animation_url: '/gifts/forest/world-tree.gif',
      static_url: '/gifts/forest/world-tree.png',
      rarity: 'legendary',
      effects: ['screen_takeover', 'life_energy', 'cosmic_connection'],
    },
  ],

  // CSS animations
  keyframes: `
    @keyframes treeGrowth {
      0% { 
        transform: scale(0) translateY(20px); 
        opacity: 0; 
      }
      50% { 
        transform: scale(0.8) translateY(10px); 
        opacity: 0.7; 
      }
      100% { 
        transform: scale(1) translateY(0); 
        opacity: 1; 
      }
    }

    @keyframes leafRustle {
      0%, 100% { 
        transform: rotate(0deg); 
        box-shadow: 0 0 15px rgba(144, 238, 144, 0.3); 
      }
      25% { 
        transform: rotate(1deg); 
        box-shadow: 0 0 20px rgba(144, 238, 144, 0.4); 
      }
      75% { 
        transform: rotate(-1deg); 
        box-shadow: 0 0 20px rgba(144, 238, 144, 0.4); 
      }
    }

    @keyframes branchSway {
      0% { transform: rotate(0deg) scale(1); }
      25% { transform: rotate(2deg) scale(1.02); }
      50% { transform: rotate(0deg) scale(1.04); }
      75% { transform: rotate(-2deg) scale(1.02); }
      100% { transform: rotate(0deg) scale(1); }
    }

    @keyframes forestBreeze {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    @keyframes leafFall {
      0% { 
        transform: translateY(-10px) rotate(0deg); 
        opacity: 1; 
      }
      100% { 
        transform: translateY(100px) rotate(360deg); 
        opacity: 0; 
      }
    }

    @keyframes flowerBloom {
      0% { 
        transform: scale(0) rotate(-90deg); 
        opacity: 0; 
      }
      50% { 
        transform: scale(0.8) rotate(-45deg); 
        opacity: 0.8; 
      }
      100% { 
        transform: scale(1) rotate(0deg); 
        opacity: 1; 
      }
    }

    @keyframes natureGlow {
      0%, 100% { 
        filter: brightness(1) hue-rotate(0deg); 
      }
      50% { 
        filter: brightness(1.2) hue-rotate(10deg); 
      }
    }
  `,

  // JavaScript effects
  effects: {
    init: () => {
      console.log('🌳 Forest Guardian theme activated!')
      
      // Add leaf trail cursor effect
      const addLeafTrail = (e: MouseEvent) => {
        if (Math.random() > 0.7) { // Only sometimes add leaves
          const leaf = document.createElement('div')
          leaf.className = 'leaf-cursor-trail'
          leaf.style.cssText = `
            position: fixed;
            left: ${e.clientX - 5}px;
            top: ${e.clientY - 5}px;
            width: 10px;
            height: 10px;
            background: radial-gradient(circle, #32CD32, #90EE90);
            border-radius: 50% 0;
            pointer-events: none;
            z-index: 9999;
            animation: leafFall 2s ease-out forwards;
            transform-origin: center;
          `
          document.body.appendChild(leaf)
          
          setTimeout(() => leaf.remove(), 2000)
        }
      }
      
      document.addEventListener('mousemove', addLeafTrail)
      
      // Add seasonal particle effects
      const createSeasonalParticles = () => {
        const month = new Date().getMonth()
        let particleType = 'leaf'
        let colors = ['#32CD32', '#90EE90']
        
        if (month >= 2 && month <= 4) { // Spring
          particleType = 'flower'
          colors = ['#FFB6C1', '#98FB98']
        } else if (month >= 5 && month <= 7) { // Summer
          particleType = 'leaf'
          colors = ['#32CD32', '#90EE90']
        } else if (month >= 8 && month <= 10) { // Autumn
          particleType = 'falling_leaf'
          colors = ['#FF8C00', '#DAA520']
        } else { // Winter
          particleType = 'snowflake'
          colors = ['#F0F8FF', '#E6E6FA']
        }
        
        // Create particles periodically
        setInterval(() => {
          if (Math.random() > 0.8) {
            const particle = document.createElement('div')
            particle.style.cssText = `
              position: fixed;
              left: ${Math.random() * window.innerWidth}px;
              top: -10px;
              width: ${Math.random() * 6 + 2}px;
              height: ${Math.random() * 6 + 2}px;
              background: ${colors[Math.floor(Math.random() * colors.length)]};
              border-radius: ${particleType === 'snowflake' ? '50%' : '50% 0'};
              pointer-events: none;
              z-index: 1;
              animation: leafFall ${Math.random() * 3 + 2}s linear forwards;
            `
            document.body.appendChild(particle)
            
            setTimeout(() => particle.remove(), 5000)
          }
        }, 3000)
      }
      
      createSeasonalParticles()
      
      // Add nature sounds
      setTimeout(() => {
        const audio = new Audio('/sounds/forest/forest-welcome.mp3')
        audio.volume = 0.15
        audio.play().catch(() => {})
      }, 1000)
    },
    
    destroy: () => {
      console.log('🌳 Forest Guardian theme deactivated')
      document.removeEventListener('mousemove', () => {})
    },
  },

  // Theme metadata
  metadata: {
    author: 'Loop Team',
    version: '1.0.0',
    created: '2024-01-01',
    tags: ['nature', 'forest', 'trees', 'peaceful', 'seasonal'],
    compatibility: ['desktop', 'mobile', 'tablet'],
    requirements: {
      premium: true,
      minVersion: '1.0.0',
    },
    seasonal: true,
    environmentalImpact: 'This theme supports reforestation efforts',
  },
}

export default forestGuardianTheme
