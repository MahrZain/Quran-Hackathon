export type ChatResponse = {
  ai_reply: string
  updated_streak_count: number
}

export type StreakResponse = {
  ok: boolean
  updated_streak_count: number
  message: string
}

export type TokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
}

export type UserMe = {
  id: number
  email: string
}
