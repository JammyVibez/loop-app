export function canViewAchievementStats(input: {
  viewerId: string
  targetId: string
  profileActive: boolean
  blocked: boolean
  restricted: boolean
  isApprovedFollower: boolean
}): boolean {
  if (!input.profileActive || input.blocked) return false
  if (input.viewerId === input.targetId) return true
  if (!input.restricted) return true
  return input.isApprovedFollower
}
