export type FeedbackCategory = "general" | "suggestion" | "bug"

export type CreateFeedbackPayload = {
  category: FeedbackCategory
  message: string
}

export type Feedback = {
  id: string
  category: FeedbackCategory
  message: string
  created_at: string
}
