export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ai_chat_history: {
        Row: {
          action_result: Json | null
          action_taken: string | null
          browsing_data: Json | null
          browsing_used: boolean | null
          confidence_level: string | null
          content: string
          conversation_id: string
          created_at: string
          expires_at: string | null
          id: string
          input_type: string
          intent: string | null
          language: string
          metadata: Json | null
          quota_status: Json | null
          role: string
          user_id: string
        }
        Insert: {
          action_result?: Json | null
          action_taken?: string | null
          browsing_data?: Json | null
          browsing_used?: boolean | null
          confidence_level?: string | null
          content: string
          conversation_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          input_type?: string
          intent?: string | null
          language?: string
          metadata?: Json | null
          quota_status?: Json | null
          role: string
          user_id: string
        }
        Update: {
          action_result?: Json | null
          action_taken?: string | null
          browsing_data?: Json | null
          browsing_used?: boolean | null
          confidence_level?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          input_type?: string
          intent?: string | null
          language?: string
          metadata?: Json | null
          quota_status?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_history_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          last_message_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          last_message_at?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          last_message_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          created_at: string
          has_browsing: boolean
          id: string
          model_used: string
          month_year: string
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          has_browsing?: boolean
          id?: string
          model_used: string
          month_year?: string
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          has_browsing?: boolean
          id?: string
          model_used?: string
          month_year?: string
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: []
      }
      ai_user_knowledge: {
        Row: {
          communication_style: string | null
          created_at: string
          id: string
          interests: string[] | null
          main_use: string | null
          personal_note: string | null
          response_length: string | null
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          communication_style?: string | null
          created_at?: string
          id?: string
          interests?: string[] | null
          main_use?: string | null
          personal_note?: string | null
          response_length?: string | null
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          communication_style?: string | null
          created_at?: string
          id?: string
          interests?: string[] | null
          main_use?: string | null
          personal_note?: string | null
          response_length?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          record_id: string
          table_name: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          record_id: string
          table_name: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          record_id?: string
          table_name?: string
          user_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          contact_id: string
          created_at: string | null
          id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          id?: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_contacts_profiles"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          is_group: boolean | null
          last_message_at: string | null
          last_message_by: string | null
          last_message_text: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_group?: boolean | null
          last_message_at?: string | null
          last_message_by?: string | null
          last_message_text?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_group?: boolean | null
          last_message_at?: string | null
          last_message_by?: string | null
          last_message_text?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      event_rsvps: {
        Row: {
          created_at: string | null
          event_id: string | null
          guest_email: string | null
          guest_ip: string | null
          guest_name: string | null
          id: string
          is_wakti_user: boolean | null
          response: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          guest_email?: string | null
          guest_ip?: string | null
          guest_name?: string | null
          id?: string
          is_wakti_user?: boolean | null
          response: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          guest_email?: string | null
          guest_ip?: string | null
          guest_name?: string | null
          id?: string
          is_wakti_user?: boolean | null
          response?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          background_color: string | null
          background_gradient: string | null
          background_image: string | null
          button_style: string | null
          created_at: string | null
          description: string | null
          end_time: string
          font_size: number | null
          id: string
          is_all_day: boolean | null
          is_public: boolean | null
          location: string | null
          location_link: string | null
          organizer_id: string | null
          short_id: string | null
          start_time: string
          text_color: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          background_color?: string | null
          background_gradient?: string | null
          background_image?: string | null
          button_style?: string | null
          created_at?: string | null
          description?: string | null
          end_time: string
          font_size?: number | null
          id?: string
          is_all_day?: boolean | null
          is_public?: boolean | null
          location?: string | null
          location_link?: string | null
          organizer_id?: string | null
          short_id?: string | null
          start_time: string
          text_color?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          background_color?: string | null
          background_gradient?: string | null
          background_image?: string | null
          button_style?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string
          font_size?: number | null
          id?: string
          is_all_day?: boolean | null
          is_public?: boolean | null
          location?: string | null
          location_link?: string | null
          organizer_id?: string | null
          short_id?: string | null
          start_time?: string
          text_color?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          metadata: Json | null
          prompt: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          metadata?: Json | null
          prompt: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          metadata?: Json | null
          prompt?: string
          user_id?: string
        }
        Relationships: []
      }
      maw3d_events: {
        Row: {
          auto_delete_enabled: boolean
          background_type: string
          background_value: string
          created_at: string
          created_by: string
          description: string | null
          end_time: string | null
          event_date: string
          google_maps_link: string | null
          id: string
          image_blur: number
          is_all_day: boolean
          is_public: boolean
          language: string
          location: string | null
          organizer: string | null
          short_id: string | null
          show_attending_count: boolean
          start_time: string | null
          template_type: string | null
          text_style: Json
          title: string
          updated_at: string
        }
        Insert: {
          auto_delete_enabled?: boolean
          background_type?: string
          background_value?: string
          created_at?: string
          created_by: string
          description?: string | null
          end_time?: string | null
          event_date: string
          google_maps_link?: string | null
          id?: string
          image_blur?: number
          is_all_day?: boolean
          is_public?: boolean
          language?: string
          location?: string | null
          organizer?: string | null
          short_id?: string | null
          show_attending_count?: boolean
          start_time?: string | null
          template_type?: string | null
          text_style?: Json
          title: string
          updated_at?: string
        }
        Update: {
          auto_delete_enabled?: boolean
          background_type?: string
          background_value?: string
          created_at?: string
          created_by?: string
          description?: string | null
          end_time?: string | null
          event_date?: string
          google_maps_link?: string | null
          id?: string
          image_blur?: number
          is_all_day?: boolean
          is_public?: boolean
          language?: string
          location?: string | null
          organizer?: string | null
          short_id?: string | null
          show_attending_count?: boolean
          start_time?: string | null
          template_type?: string | null
          text_style?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      maw3d_invitations: {
        Row: {
          created_at: string
          event_id: string
          id: string
          invited_user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          invited_user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          invited_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maw3d_invitations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "maw3d_events"
            referencedColumns: ["id"]
          },
        ]
      }
      maw3d_rsvps: {
        Row: {
          created_at: string
          event_id: string
          guest_name: string
          id: string
          response: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          guest_name: string
          id?: string
          response: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          guest_name?: string
          id?: string
          response?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maw3d_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "maw3d_events"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          created_at: string
          file_size: number | null
          id: string
          is_read: boolean
          media_type: string | null
          media_url: string | null
          message_type: string
          recipient_id: string
          sender_id: string
          voice_duration: number | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          file_size?: number | null
          id?: string
          is_read?: boolean
          media_type?: string | null
          media_url?: string | null
          message_type: string
          recipient_id: string
          sender_id: string
          voice_duration?: number | null
        }
        Update: {
          content?: string | null
          created_at?: string
          file_size?: number | null
          id?: string
          is_read?: boolean
          media_type?: string | null
          media_url?: string | null
          message_type?: string
          recipient_id?: string
          sender_id?: string
          voice_duration?: number | null
        }
        Relationships: []
      }
      my_tasks: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_repeated: boolean
          is_shared: boolean
          priority: string
          short_id: string | null
          status: string
          subtasks: Json | null
          task_type: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_repeated?: boolean
          is_shared?: boolean
          priority?: string
          short_id?: string | null
          status?: string
          subtasks?: Json | null
          task_type?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_repeated?: boolean
          is_shared?: boolean
          priority?: string
          short_id?: string | null
          status?: string
          subtasks?: Json | null
          task_type?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_history: {
        Row: {
          body: string
          data: Json | null
          deep_link: string | null
          delivery_status: string
          id: string
          notification_type: string
          progressier_response: Json | null
          sent_at: string
          title: string
          user_id: string
        }
        Insert: {
          body: string
          data?: Json | null
          deep_link?: string | null
          delivery_status?: string
          id?: string
          notification_type: string
          progressier_response?: Json | null
          sent_at?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string
          data?: Json | null
          deep_link?: string | null
          delivery_status?: string
          id?: string
          notification_type?: string
          progressier_response?: Json | null
          sent_at?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_queue: {
        Row: {
          attempts: number | null
          body: string
          created_at: string
          data: Json | null
          deep_link: string | null
          id: string
          notification_type: string
          scheduled_for: string | null
          sent_at: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          attempts?: number | null
          body: string
          created_at?: string
          data?: Json | null
          deep_link?: string | null
          id?: string
          notification_type: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          attempts?: number | null
          body?: string
          created_at?: string
          data?: Json | null
          deep_link?: string | null
          id?: string
          notification_type?: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auto_approve_contacts: boolean | null
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          notification_preferences: Json | null
          settings: Json | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          auto_approve_contacts?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          notification_preferences?: Json | null
          settings?: Json | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          auto_approve_contacts?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          notification_preferences?: Json | null
          settings?: Json | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      shared_task_completions: {
        Row: {
          completed_at: string
          completed_by_name: string | null
          completed_by_user_id: string | null
          completion_type: string
          id: string
          subtask_index: number | null
          task_id: string
        }
        Insert: {
          completed_at?: string
          completed_by_name?: string | null
          completed_by_user_id?: string | null
          completion_type: string
          id?: string
          subtask_index?: number | null
          task_id: string
        }
        Update: {
          completed_at?: string
          completed_by_name?: string | null
          completed_by_user_id?: string | null
          completion_type?: string
          id?: string
          subtask_index?: number | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "my_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      subtasks: {
        Row: {
          created_at: string
          id: string
          is_completed: boolean
          task_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_completed?: boolean
          task_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_completed?: boolean
          task_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasjeel_records: {
        Row: {
          created_at: string | null
          duration: number | null
          id: string
          original_recording_path: string
          saved: boolean | null
          source_type: string | null
          summary: string | null
          summary_audio_path: string | null
          title: string | null
          transcription: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duration?: number | null
          id?: string
          original_recording_path: string
          saved?: boolean | null
          source_type?: string | null
          summary?: string | null
          summary_audio_path?: string | null
          title?: string | null
          transcription?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          duration?: number | null
          id?: string
          original_recording_path?: string
          saved?: boolean | null
          source_type?: string | null
          summary?: string | null
          summary_audio_path?: string | null
          title?: string | null
          transcription?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      task_shares: {
        Row: {
          created_at: string
          id: string
          shared_with: string
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          shared_with: string
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          shared_with?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_shares_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_recurring: boolean
          priority: string
          recurrence_pattern: string | null
          status: string
          subtask_group_title: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_recurring?: boolean
          priority?: string
          recurrence_pattern?: string | null
          status?: string
          subtask_group_title?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_recurring?: boolean
          priority?: string
          recurrence_pattern?: string | null
          status?: string
          subtask_group_title?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tr_reminders: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          due_time: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tr_shared_responses: {
        Row: {
          content: string | null
          created_at: string
          id: string
          is_completed: boolean | null
          response_type: string
          subtask_id: string | null
          task_id: string
          visitor_name: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean | null
          response_type: string
          subtask_id?: string | null
          task_id: string
          visitor_name: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean | null
          response_type?: string
          subtask_id?: string | null
          task_id?: string
          visitor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tr_shared_responses_subtask_id_fkey"
            columns: ["subtask_id"]
            isOneToOne: false
            referencedRelation: "tr_subtasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tr_shared_responses_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tr_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tr_subtasks: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          order_index: number
          task_id: string
          title: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          order_index?: number
          task_id: string
          title: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          order_index?: number
          task_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tr_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tr_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tr_task_comments: {
        Row: {
          commenter_name: string
          content: string
          created_at: string
          id: string
          parent_id: string | null
          session_id: string
          task_id: string
          updated_at: string
        }
        Insert: {
          commenter_name: string
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          session_id: string
          task_id: string
          updated_at?: string
        }
        Update: {
          commenter_name?: string
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          session_id?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_tr_task_comments_task_id"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tr_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tr_task_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tr_task_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      tr_tasks: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          due_time: string | null
          id: string
          is_shared: boolean
          priority: string
          share_link: string | null
          snoozed_until: string | null
          task_type: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          is_shared?: boolean
          priority?: string
          share_link?: string | null
          snoozed_until?: string | null
          task_type?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          is_shared?: boolean
          priority?: string
          share_link?: string | null
          snoozed_until?: string | null
          task_type?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_event_links: {
        Row: {
          added_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          added_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_event_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "maw3d_events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_push_subscriptions: {
        Row: {
          created_at: string
          device_info: Json | null
          id: string
          is_active: boolean
          progressier_user_id: string | null
          subscription_data: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          id?: string
          is_active?: boolean
          progressier_user_id?: string | null
          subscription_data?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          id?: string
          is_active?: boolean
          progressier_user_id?: string | null
          subscription_data?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_search_quotas: {
        Row: {
          created_at: string
          daily_count: number
          daily_date: string
          extra_advanced_searches: number | null
          extra_regular_searches: number | null
          extra_searches: number
          id: string
          monthly_date: string
          purchase_date: string | null
          regular_search_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_count?: number
          daily_date?: string
          extra_advanced_searches?: number | null
          extra_regular_searches?: number | null
          extra_searches?: number
          id?: string
          monthly_date?: string
          purchase_date?: string | null
          regular_search_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_count?: number
          daily_date?: string
          extra_advanced_searches?: number | null
          extra_regular_searches?: number | null
          extra_searches?: number
          id?: string
          monthly_date?: string
          purchase_date?: string | null
          regular_search_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_translation_quotas: {
        Row: {
          created_at: string
          daily_count: number
          daily_date: string
          extra_translations: number
          id: string
          purchase_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_count?: number
          daily_date?: string
          extra_translations?: number
          id?: string
          purchase_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_count?: number
          daily_date?: string
          extra_translations?: number
          id?: string
          purchase_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_voice_clones: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
          voice_id: string
          voice_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          voice_id: string
          voice_name: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          voice_id?: string
          voice_name?: string
        }
        Relationships: []
      }
      user_voice_usage: {
        Row: {
          characters_limit: number
          characters_used: number
          created_at: string
          extra_characters: number
          id: string
          purchase_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          characters_limit?: number
          characters_used?: number
          created_at?: string
          extra_characters?: number
          id?: string
          purchase_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          characters_limit?: number
          characters_used?: number
          created_at?: string
          extra_characters?: number
          id?: string
          purchase_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_update_storage_bucket: {
        Args: {
          p_bucket_id: string
          p_public?: boolean
          p_file_size_limit?: number
          p_allowed_mime_types?: string[]
        }
        Returns: Json
      }
      are_users_contacts: {
        Args: { user1: string; user2: string }
        Returns: boolean
      }
      can_users_message: {
        Args: { sender_id: string; recipient_id: string }
        Returns: boolean
      }
      check_browsing_quota: {
        Args: { p_user_id: string }
        Returns: number
      }
      cleanup_expired_ai_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_expired_chat_history: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_expired_maw3d_events: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_conversations: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_messages: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      format_timestamp: {
        Args: { ts: string }
        Returns: string
      }
      generate_event_short_id: {
        Args: { event_uuid: string }
        Returns: string
      }
      generate_maw3d_short_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_task_short_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_tr_share_link: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_or_create_user_quota: {
        Args: { p_user_id: string }
        Returns: {
          daily_count: number
          extra_translations: number
          purchase_date: string
        }[]
      }
      get_or_create_user_search_quota: {
        Args: { p_user_id: string }
        Returns: {
          daily_count: number
          extra_searches: number
          purchase_date: string
          regular_search_count: number
          extra_regular_searches: number
          extra_advanced_searches: number
        }[]
      }
      get_or_create_user_voice_quota: {
        Args: { p_user_id: string }
        Returns: {
          characters_used: number
          characters_limit: number
          extra_characters: number
          purchase_date: string
        }[]
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      increment_regular_search_usage: {
        Args: { p_user_id: string }
        Returns: {
          success: boolean
          regular_search_count: number
          extra_regular_searches: number
        }[]
      }
      increment_search_usage: {
        Args: { p_user_id: string }
        Returns: {
          success: boolean
          daily_count: number
          extra_advanced_searches: number
        }[]
      }
      increment_translation_usage: {
        Args: { p_user_id: string }
        Returns: {
          success: boolean
          daily_count: number
          extra_translations: number
        }[]
      }
      log_ai_usage: {
        Args: {
          p_user_id: string
          p_model_used: string
          p_has_browsing?: boolean
          p_tokens_used?: number
        }
        Returns: undefined
      }
      maintain_conversation_limit: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      mark_messages_as_read: {
        Args: { other_user_id: string }
        Returns: undefined
      }
      purchase_extra_advanced_searches: {
        Args: { p_user_id: string; p_count: number }
        Returns: {
          success: boolean
          new_extra_count: number
        }[]
      }
      purchase_extra_regular_searches: {
        Args: { p_user_id: string; p_count: number }
        Returns: {
          success: boolean
          new_extra_count: number
        }[]
      }
      purchase_extra_translations: {
        Args: { p_user_id: string; p_count: number }
        Returns: {
          success: boolean
          new_extra_count: number
        }[]
      }
      purchase_extra_voice_credits: {
        Args: { p_user_id: string; p_characters: number }
        Returns: {
          success: boolean
          new_extra_characters: number
        }[]
      }
      purchase_search_package: {
        Args: { p_user_id: string }
        Returns: {
          success: boolean
          new_extra_count: number
        }[]
      }
      queue_notification: {
        Args: {
          p_user_id: string
          p_notification_type: string
          p_title: string
          p_body: string
          p_data?: Json
          p_deep_link?: string
          p_scheduled_for?: string
        }
        Returns: string
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      update_overdue_tasks: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      user_can_access_task: {
        Args: { task_id: string }
        Returns: boolean
      }
      user_is_conversation_participant: {
        Args: { conversation_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
