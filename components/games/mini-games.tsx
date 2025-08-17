"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  Gamepad2, 
  Trophy, 
  Star, 
  Coins, 
  Timer, 
  Target,
  Zap,
  Brain,
  Shuffle
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"

interface Game {
  id: string
  name: string
  description: string
  icon: React.ComponentType<any>
  difficulty: 'easy' | 'medium' | 'hard'
  xpReward: number
  coinReward: number
  category: 'puzzle' | 'arcade' | 'strategy'
}

const games: Game[] = [
  {
    id: 'loop-matcher',
    name: 'Loop Matcher',
    description: 'Match similar loop patterns to score points',
    icon: Target,
    difficulty: 'easy',
    xpReward: 10,
    coinReward: 5,
    category: 'puzzle'
  },
  {
    id: 'branch-builder',
    name: 'Branch Builder',
    description: 'Build the longest loop tree in limited time',
    icon: Brain,
    difficulty: 'medium',
    xpReward: 20,
    coinReward: 10,
    category: 'strategy'
  },
  {
    id: 'code-runner',
    name: 'Code Runner',
    description: 'Fix code snippets as fast as possible',
    icon: Zap,
    difficulty: 'hard',
    xpReward: 30,
    coinReward: 15,
    category: 'arcade'
  },
  {
    id: 'memory-loops',
    name: 'Memory Loops',
    description: 'Remember and recreate loop sequences',
    icon: Shuffle,
    difficulty: 'medium',
    xpReward: 15,
    coinReward: 8,
    category: 'puzzle'
  }
]

// Simple Loop Matcher Game Component
function LoopMatcherGame({ onGameEnd }: { onGameEnd: (score: number) => void }) {
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(30)
  const [gameActive, setGameActive] = useState(false)
  const [currentPattern, setCurrentPattern] = useState<string[]>([])
  const [targetPattern, setTargetPattern] = useState<string[]>([])

  const patterns = ['🔵', '🟢', '🔴', '🟡', '🟣']

  const generatePattern = () => {
    const length = Math.floor(Math.random() * 3) + 3
    return Array.from({ length }, () => patterns[Math.floor(Math.random() * patterns.length)])
  }

  const startGame = () => {
    setGameActive(true)
    setScore(0)
    setTimeLeft(30)
    setTargetPattern(generatePattern())
    setCurrentPattern([])
  }

  const addToPattern = (symbol: string) => {
    if (!gameActive) return
    
    const newPattern = [...currentPattern, symbol]
    setCurrentPattern(newPattern)

    if (newPattern.length === targetPattern.length) {
      if (JSON.stringify(newPattern) === JSON.stringify(targetPattern)) {
        setScore(prev => prev + 10)
        setTargetPattern(generatePattern())
        setCurrentPattern([])
      } else {
        setCurrentPattern([])
      }
    }
  }

  useEffect(() => {
    if (gameActive && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0) {
      setGameActive(false)
      onGameEnd(score)
    }
  }, [gameActive, timeLeft, score, onGameEnd])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="outline">Score: {score}</Badge>
          <Badge variant="outline">Time: {timeLeft}s</Badge>
        </div>
        {!gameActive && (
          <Button onClick={startGame} className="bg-purple-600 hover:bg-purple-700">
            {score > 0 ? 'Play Again' : 'Start Game'}
          </Button>
        )}
      </div>

      {gameActive && (
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Match this pattern:</p>
            <div className="flex justify-center gap-2 mb-4">
              {targetPattern.map((symbol, index) => (
                <div key={index} className="text-2xl p-2 bg-gray-100 rounded">
                  {symbol}
                </div>
              ))}
            </div>
            
            <p className="text-sm text-gray-600 mb-2">Your pattern:</p>
            <div className="flex justify-center gap-2 mb-4 min-h-[60px]">
              {currentPattern.map((symbol, index) => (
                <div key={index} className="text-2xl p-2 bg-blue-100 rounded">
                  {symbol}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center gap-2">
            {patterns.map((symbol) => (
              <Button
                key={symbol}
                onClick={() => addToPattern(symbol)}
                variant="outline"
                className="text-2xl p-4"
              >
                {symbol}
              </Button>
            ))}
          </div>
        </div>
      )}

      {!gameActive && score > 0 && (
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <Trophy className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
          <p className="font-semibold">Game Over!</p>
          <p className="text-sm text-gray-600">Final Score: {score}</p>
        </div>
      )}
    </div>
  )
}

export function MiniGames() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [userStats, setUserStats] = useState({
    totalXP: 0,
    totalCoins: 0,
    gamesPlayed: 0,
    highScores: {} as Record<string, number>
  })

  const handleGameEnd = async (score: number) => {
    if (!selectedGame || !user) return

    try {
      // Calculate rewards based on score
      const xpEarned = Math.floor((score / 10) * selectedGame.xpReward)
      const coinsEarned = Math.floor((score / 10) * selectedGame.coinReward)

      // Update user stats (in a real app, this would be an API call)
      setUserStats(prev => ({
        ...prev,
        totalXP: prev.totalXP + xpEarned,
        totalCoins: prev.totalCoins + coinsEarned,
        gamesPlayed: prev.gamesPlayed + 1,
        highScores: {
          ...prev.highScores,
          [selectedGame.id]: Math.max(prev.highScores[selectedGame.id] || 0, score)
        }
      }))

      toast({
        title: "Game Complete!",
        description: `You earned ${xpEarned} XP and ${coinsEarned} coins!`,
      })
    } catch (error) {
      console.error('Error saving game results:', error)
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'hard': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'puzzle': return Brain
      case 'arcade': return Zap
      case 'strategy': return Target
      default: return Gamepad2
    }
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Gamepad2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Login Required</h3>
          <p className="text-gray-600">Please log in to play games and earn rewards.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* User Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Your Gaming Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{userStats.totalXP}</div>
              <div className="text-sm text-gray-600">Total XP</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{userStats.totalCoins}</div>
              <div className="text-sm text-gray-600">Coins Earned</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{userStats.gamesPlayed}</div>
              <div className="text-sm text-gray-600">Games Played</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {Object.keys(userStats.highScores).length}
              </div>
              <div className="text-sm text-gray-600">Games Unlocked</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Game Selection or Active Game */}
      {selectedGame ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <selectedGame.icon className="w-5 h-5" />
                {selectedGame.name}
              </CardTitle>
              <Button 
                variant="outline" 
                onClick={() => setSelectedGame(null)}
              >
                Back to Games
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {selectedGame.id === 'loop-matcher' ? (
              <LoopMatcherGame onGameEnd={handleGameEnd} />
            ) : (
              <div className="text-center py-8">
                <Gamepad2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Coming Soon!</h3>
                <p className="text-gray-600">This game is under development.</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {games.map((game) => {
            const CategoryIcon = getCategoryIcon(game.category)
            const highScore = userStats.highScores[game.id] || 0
            
            return (
              <Card key={game.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <game.icon className="w-5 h-5" />
                      {game.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <CategoryIcon className="w-4 h-4 text-gray-500" />
                      <Badge className={getDifficultyColor(game.difficulty)}>
                        {game.difficulty}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-600">{game.description}</p>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-purple-500" />
                        <span>{game.xpReward} XP</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Coins className="w-4 h-4 text-yellow-500" />
                        <span>{game.coinReward} Coins</span>
                      </div>
                    </div>
                    {highScore > 0 && (
                      <div className="flex items-center gap-1">
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        <span>Best: {highScore}</span>
                      </div>
                    )}
                  </div>

                  <Button 
                    onClick={() => setSelectedGame(game)}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                    disabled={game.id !== 'loop-matcher'} // Only loop-matcher is implemented
                  >
                    {game.id === 'loop-matcher' ? 'Play Now' : 'Coming Soon'}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Global Leaderboard</h3>
            <p className="text-gray-600">Coming soon! Compete with other players worldwide.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
