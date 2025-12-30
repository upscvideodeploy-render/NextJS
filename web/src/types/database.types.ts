// Minimal Database Types for UPSC PrepX-AI
// Auto-generated types will replace this once Supabase CLI is properly configured

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          created_at?: string
          updated_at?: string
        }
      }
      user_profiles: {
        Row: {
          id: string
          user_id: string
          full_name: string | null
          avatar_url: string | null
          role: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          full_name?: string | null
          avatar_url?: string | null
          role?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          full_name?: string | null
          avatar_url?: string | null
          role?: string
          created_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          plan_id: string
          status: string
          trial_end_date: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan_id: string
          status: string
          trial_end_date?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          plan_id?: string
          status?: string
          trial_end_date?: string | null
          created_at?: string
        }
      }
      jobs: {
        Row: {
          id: string
          job_type: string
          priority: string
          status: string
          payload: Json
          user_id: string | null
          created_at: string
          started_at: string | null
          completed_at: string | null
          error_message: string | null
          result_url: string | null
        }
        Insert: {
          id?: string
          job_type: string
          priority?: string
          status?: string
          payload: Json
          user_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          job_type?: string
          priority?: string
          status?: string
          payload?: Json
          user_id?: string | null
          started_at?: string | null
          completed_at?: string | null
          error_message?: string | null
          result_url?: string | null
        }
      }
      user_answers: {
        Row: {
          id: string
          user_id: string
          question_id: string
          question_text: string
          user_answer: string
          word_count: number
          time_taken: number
          score: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          question_id: string
          question_text: string
          user_answer: string
          word_count: number
          time_taken: number
          score?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          score?: number | null
        }
      }
      user_essays: {
        Row: {
          id: string
          user_id: string
          title: string
          content: string
          category: string
          word_count: number
          score: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          content: string
          category: string
          word_count?: number
          score?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          content?: string
          score?: number | null
        }
      }
      answer_submissions: {
        Row: {
          id: string
          user_id: string
          question_id: string
          question_text: string
          answer_text: string
          word_count: number
          time_taken_seconds: number
          evaluation_status: string
          submitted_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          question_id: string
          question_text: string
          answer_text: string
          word_count: number
          time_taken_seconds?: number
          evaluation_status?: string
          submitted_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          evaluation_status?: string
        }
      }
      practice_questions: {
        Row: {
          id: string
          question_text: string
          question_type: string
          gs_paper: string | null
          difficulty: string | null
          word_limit: number | null
          time_limit_minutes: number | null
          options: Json | null
          correct_answer: number | null
          explanation: string | null
          created_at: string
        }
        Insert: {
          id?: string
          question_text: string
          question_type: string
          gs_paper?: string | null
          difficulty?: string | null
          word_limit?: number | null
          time_limit_minutes?: number | null
          options?: Json | null
          correct_answer?: number | null
          explanation?: string | null
          created_at?: string
        }
        Update: {
          question_text?: string
          difficulty?: string | null
          options?: Json | null
          correct_answer?: number | null
          explanation?: string | null
        }
      }
      // Story 8.6: AI Generated Questions
      generated_questions: {
        Row: {
          id: string
          user_id: string
          topic: string
          syllabus_node_id: string | null
          question_text: string
          question_type: 'mcq' | 'mains_150' | 'mains_250' | 'essay'
          difficulty: 'easy' | 'medium' | 'hard'
          options_json: Json | null
          model_answer: string
          key_points: string[] | null
          source_context: string | null
          generation_metadata: Json | null
          quality_score: number | null
          is_reviewed: boolean
          is_public: boolean
          view_count: number
          practice_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          topic: string
          syllabus_node_id?: string | null
          question_text: string
          question_type: 'mcq' | 'mains_150' | 'mains_250' | 'essay'
          difficulty: 'easy' | 'medium' | 'hard'
          options_json?: Json | null
          model_answer: string
          key_points?: string[] | null
          source_context?: string | null
          generation_metadata?: Json | null
          quality_score?: number | null
          is_reviewed?: boolean
          is_public?: boolean
          view_count?: number
          practice_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          topic?: string
          question_text?: string
          model_answer?: string
          quality_score?: number | null
          is_reviewed?: boolean
          is_public?: boolean
          view_count?: number
          practice_count?: number
        }
      }
      // Story 8.6: Question Generation Logs
      question_generation_logs: {
        Row: {
          id: string
          user_id: string
          question_count: number
          question_type: string
          topic: string
          generation_date: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          question_count: number
          question_type: string
          topic: string
          generation_date?: string
          created_at?: string
        }
        Update: {
          question_count?: number
        }
      }
      // Story 8.7: Question Options (MCQ Distractors)
      question_options: {
        Row: {
          id: string
          question_id: string
          question_source: 'generated' | 'pyq'
          option_letter: 'A' | 'B' | 'C' | 'D'
          option_text: string
          is_correct: boolean
          explanation: string | null
          distractor_type: 'common_mistake' | 'partial_truth' | 'related_concept' | 'factual_error' | 'date_error' | null
          quality_score: number
          times_selected: number
          times_shown: number
          is_reviewed: boolean
          reviewed_by: string | null
          reviewed_at: string | null
          generation_metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          question_id: string
          question_source: 'generated' | 'pyq'
          option_letter: 'A' | 'B' | 'C' | 'D'
          option_text: string
          is_correct?: boolean
          explanation?: string | null
          distractor_type?: 'common_mistake' | 'partial_truth' | 'related_concept' | 'factual_error' | 'date_error' | null
          quality_score?: number
          times_selected?: number
          times_shown?: number
          is_reviewed?: boolean
          reviewed_by?: string | null
          generation_metadata?: Json | null
        }
        Update: {
          option_text?: string
          explanation?: string | null
          quality_score?: number
          is_reviewed?: boolean
          reviewed_by?: string | null
          reviewed_at?: string | null
        }
      }
      // Story 8.7: Question Attempts
      question_attempts: {
        Row: {
          id: string
          user_id: string
          question_id: string
          question_source: 'generated' | 'pyq'
          selected_option: 'A' | 'B' | 'C' | 'D'
          is_correct: boolean
          time_taken_seconds: number | null
          shuffled_order: string[] | null
          difficulty_at_attempt: 'easy' | 'medium' | 'hard'  // Story 8.8
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          question_id: string
          question_source: 'generated' | 'pyq'
          selected_option: 'A' | 'B' | 'C' | 'D'
          is_correct: boolean
          time_taken_seconds?: number | null
          shuffled_order?: string[] | null
          difficulty_at_attempt: 'easy' | 'medium' | 'hard'  // Story 8.8
          created_at?: string
        }
        Update: {
          is_correct?: boolean
        }
      }
      // Story 8.8: User Difficulty Stats
      user_difficulty_stats: {
        Row: {
          id: string
          user_id: string
          difficulty_level: 'easy' | 'medium' | 'hard'
          total_attempts: number
          correct_attempts: number
          success_rate: number
          avg_time_seconds: number
          last_updated: string
        }
        Insert: {
          id?: string
          user_id: string
          difficulty_level: 'easy' | 'medium' | 'hard'
          total_attempts?: number
          correct_attempts?: number
          success_rate?: number
          avg_time_seconds?: number
          last_updated?: string
        }
        Update: {
          total_attempts?: number
          correct_attempts?: number
          success_rate?: number
          avg_time_seconds?: number
          last_updated?: string
        }
      }
      // Story 8.8: Difficulty Badges
      difficulty_badges: {
        Row: {
          id: string
          user_id: string
          badge_type: string
          earned_at: string
          metadata: Json | null
        }
        Insert: {
          id?: string
          user_id: string
          badge_type: string
          earned_at?: string
          metadata?: Json | null
        }
        Update: {
          metadata?: Json | null
        }
      }
      // Story 8.8: Badge Definitions
      badge_definitions: {
        Row: {
          badge_type: string
          name: string
          description: string
          icon: string
          requirement_count: number
          difficulty_level: string | null
          category: 'mastery' | 'streak' | 'accuracy'
        }
        Insert: {
          badge_type: string
          name: string
          description: string
          icon: string
          requirement_count: number
          difficulty_level?: string | null
          category: 'mastery' | 'streak' | 'accuracy'
        }
        Update: {
          name?: string
          description?: string
          icon?: string
          requirement_count?: number
        }
      }
      // Story 8.9: Practice Sessions
      practice_sessions: {
        Row: {
          id: string
          user_id: string
          session_type: 'pyq_practice' | 'generated_practice' | 'mixed'
          session_config: Json
          questions: string[]
          answers: Json
          question_times: Json
          score: number | null
          accuracy: number | null
          time_taken_seconds: number | null
          status: 'active' | 'paused' | 'completed' | 'abandoned'
          current_question_index: number
          weak_topics: string[] | null
          paused_at: string | null
          total_paused_seconds: number
          started_at: string
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          session_type: 'pyq_practice' | 'generated_practice' | 'mixed'
          session_config: Json
          questions: string[]
          answers?: Json
          question_times?: Json
          score?: number | null
          accuracy?: number | null
          time_taken_seconds?: number | null
          status?: 'active' | 'paused' | 'completed' | 'abandoned'
          current_question_index?: number
          weak_topics?: string[] | null
          paused_at?: string | null
          total_paused_seconds?: number
          started_at?: string
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          session_config?: Json
          answers?: Json
          question_times?: Json
          score?: number | null
          accuracy?: number | null
          time_taken_seconds?: number | null
          status?: 'active' | 'paused' | 'completed' | 'abandoned'
          current_question_index?: number
          weak_topics?: string[] | null
          paused_at?: string | null
          total_paused_seconds?: number
          completed_at?: string | null
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
