export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_activity_logs: {
        Row: {
          action: string
          admin_user_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_activity_logs_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_messages: {
        Row: {
          admin_id: string
          content: string
          created_at: string
          id: string
          is_read: boolean | null
          recipient_id: string
          subject: string
        }
        Insert: {
          admin_id: string
          content: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          recipient_id: string
          subject: string
        }
        Update: {
          admin_id?: string
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          recipient_id?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_messages_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_sessions: {
        Row: {
          admin_user_id: string | null
          created_at: string | null
          expires_at: string
          id: string
          ip_address: string | null
          session_token: string
          user_agent: string | null
        }
        Insert: {
          admin_user_id?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          session_token: string
          user_agent?: string | null
        }
        Update: {
          admin_user_id?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          session_token?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_sessions_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          last_login_at: string | null
          password_hash: string
          permissions: Json | null
          role: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          password_hash: string
          permissions?: Json | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          password_hash?: string
          permissions?: Json | null
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
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
      ai_conversation_summaries: {
        Row: {
          compressed_summary: string | null
          context_tokens: number | null
          conversation_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          last_message_date: string
          message_count: number
          messages_since_summary: number | null
          summary_text: string
          summary_version: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          compressed_summary?: string | null
          context_tokens?: number | null
          conversation_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_message_date?: string
          message_count?: number
          messages_since_summary?: number | null
          summary_text: string
          summary_version?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          compressed_summary?: string | null
          context_tokens?: number | null
          conversation_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_message_date?: string
          message_count?: number
          messages_since_summary?: number | null
          summary_text?: string
          summary_version?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversation_summaries_conversation_id_fkey"
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
      ai_quota_management: {
        Row: {
          chat_characters_used: number
          created_at: string
          id: string
          image_prompts_used: number
          search_characters_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          chat_characters_used?: number
          created_at?: string
          id?: string
          image_prompts_used?: number
          search_characters_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          chat_characters_used?: number
          created_at?: string
          id?: string
          image_prompts_used?: number
          search_characters_used?: number
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
          ai_tone: string | null
          auto_enable: boolean | null
          communication_style: string | null
          created_at: string
          id: string
          interests: string[] | null
          main_use: string | null
          nickname: string | null
          personal_note: string | null
          reply_style: string | null
          response_length: string | null
          role: string | null
          traits: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_tone?: string | null
          auto_enable?: boolean | null
          communication_style?: string | null
          created_at?: string
          id?: string
          interests?: string[] | null
          main_use?: string | null
          nickname?: string | null
          personal_note?: string | null
          reply_style?: string | null
          response_length?: string | null
          role?: string | null
          traits?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_tone?: string | null
          auto_enable?: boolean | null
          communication_style?: string | null
          created_at?: string
          id?: string
          interests?: string[] | null
          main_use?: string | null
          nickname?: string | null
          personal_note?: string | null
          reply_style?: string | null
          response_length?: string | null
          role?: string | null
          traits?: string[] | null
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
      contact_submissions: {
        Row: {
          admin_response: string | null
          created_at: string | null
          email: string
          id: string
          message: string
          name: string
          responded_at: string | null
          responded_by: string | null
          status: string | null
          subject: string | null
          submission_type: string
          updated_at: string | null
        }
        Insert: {
          admin_response?: string | null
          created_at?: string | null
          email: string
          id?: string
          message: string
          name: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string | null
          subject?: string | null
          submission_type?: string
          updated_at?: string | null
        }
        Update: {
          admin_response?: string | null
          created_at?: string | null
          email?: string
          id?: string
          message?: string
          name?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string | null
          subject?: string | null
          submission_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_submissions_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          contact_id: string
          created_at: string | null
          id: string
          is_favorite: boolean
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          id?: string
          is_favorite?: boolean
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          id?: string
          is_favorite?: boolean
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
      ludo_game_players: {
        Row: {
          created_at: string
          id: string
          is_ready: boolean
          last_seen: string
          player_color: string
          player_name: string
          player_type: string
          room_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_ready?: boolean
          last_seen?: string
          player_color: string
          player_name: string
          player_type?: string
          room_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_ready?: boolean
          last_seen?: string
          player_color?: string
          player_name?: string
          player_type?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ludo_game_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "ludo_game_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      ludo_game_rooms: {
        Row: {
          created_at: string
          current_players: number
          game_mode: string
          game_state: Json
          host_user_id: string
          id: string
          max_players: number
          room_code: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_players?: number
          game_mode?: string
          game_state?: Json
          host_user_id: string
          id?: string
          max_players?: number
          room_code: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_players?: number
          game_mode?: string
          game_state?: Json
          host_user_id?: string
          id?: string
          max_players?: number
          room_code?: string
          status?: string
          updated_at?: string
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
          comment: string | null
          created_at: string
          event_id: string
          guest_name: string
          id: string
          response: string
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          event_id: string
          guest_name: string
          id?: string
          response: string
          user_id?: string | null
        }
        Update: {
          comment?: string | null
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
      pending_fawran_payments: {
        Row: {
          account_created_at: string | null
          amount: number
          created_at: string
          duplicate_detected: boolean | null
          email: string
          id: string
          payment_reference_number: string | null
          plan_type: string
          review_notes: string | null
          reviewed_at: string | null
          screenshot_hash: string | null
          screenshot_url: string
          sender_alias: string | null
          status: string
          submitted_at: string
          tampering_detected: boolean | null
          time_validation_passed: boolean | null
          transaction_reference_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_created_at?: string | null
          amount: number
          created_at?: string
          duplicate_detected?: boolean | null
          email: string
          id?: string
          payment_reference_number?: string | null
          plan_type: string
          review_notes?: string | null
          reviewed_at?: string | null
          screenshot_hash?: string | null
          screenshot_url: string
          sender_alias?: string | null
          status?: string
          submitted_at?: string
          tampering_detected?: boolean | null
          time_validation_passed?: boolean | null
          transaction_reference_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_created_at?: string | null
          amount?: number
          created_at?: string
          duplicate_detected?: boolean | null
          email?: string
          id?: string
          payment_reference_number?: string | null
          plan_type?: string
          review_notes?: string | null
          reviewed_at?: string | null
          screenshot_hash?: string | null
          screenshot_url?: string
          sender_alias?: string | null
          status?: string
          submitted_at?: string
          tampering_detected?: boolean | null
          time_validation_passed?: boolean | null
          transaction_reference_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_pending_fawran_payments_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auto_approve_contacts: boolean | null
          avatar_url: string | null
          billing_start_date: string | null
          country: string | null
          country_code: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          email_confirmed: boolean | null
          fawran_payment_id: string | null
          first_name: string | null
          id: string
          is_logged_in: boolean | null
          is_subscribed: boolean | null
          is_suspended: boolean | null
          last_name: string | null
          next_billing_date: string | null
          notification_preferences: Json | null
          payment_method: string | null
          plan_name: string | null
          settings: Json | null
          subscription_status: string | null
          suspended_at: string | null
          suspended_by: string | null
          suspension_reason: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          auto_approve_contacts?: boolean | null
          avatar_url?: string | null
          billing_start_date?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          email_confirmed?: boolean | null
          fawran_payment_id?: string | null
          first_name?: string | null
          id: string
          is_logged_in?: boolean | null
          is_subscribed?: boolean | null
          is_suspended?: boolean | null
          last_name?: string | null
          next_billing_date?: string | null
          notification_preferences?: Json | null
          payment_method?: string | null
          plan_name?: string | null
          settings?: Json | null
          subscription_status?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          auto_approve_contacts?: boolean | null
          avatar_url?: string | null
          billing_start_date?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          email_confirmed?: boolean | null
          fawran_payment_id?: string | null
          first_name?: string | null
          id?: string
          is_logged_in?: boolean | null
          is_subscribed?: boolean | null
          is_suspended?: boolean | null
          last_name?: string | null
          next_billing_date?: string | null
          notification_preferences?: Json | null
          payment_method?: string | null
          plan_name?: string | null
          settings?: Json | null
          subscription_status?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_fawran_payment_id_fkey"
            columns: ["fawran_payment_id"]
            isOneToOne: false
            referencedRelation: "pending_fawran_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_suspended_by_fkey"
            columns: ["suspended_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      screenshot_hashes: {
        Row: {
          created_at: string
          id: string
          image_hash: string
          payment_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_hash: string
          payment_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_hash?: string
          payment_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "screenshot_hashes_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "pending_fawran_payments"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_amount: number
          billing_currency: string
          billing_cycle: string
          created_at: string | null
          fawran_payment_id: string | null
          gift_duration: string | null
          gift_given_by: string | null
          id: string
          is_gift: boolean | null
          next_billing_date: string
          payment_method: string | null
          plan_name: string
          start_date: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          billing_amount: number
          billing_currency?: string
          billing_cycle?: string
          created_at?: string | null
          fawran_payment_id?: string | null
          gift_duration?: string | null
          gift_given_by?: string | null
          id?: string
          is_gift?: boolean | null
          next_billing_date: string
          payment_method?: string | null
          plan_name: string
          start_date: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          billing_amount?: number
          billing_currency?: string
          billing_cycle?: string
          created_at?: string | null
          fawran_payment_id?: string | null
          gift_duration?: string | null
          gift_given_by?: string | null
          id?: string
          is_gift?: boolean | null
          next_billing_date?: string
          payment_method?: string | null
          plan_name?: string
          start_date?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_fawran_payment_id_fkey"
            columns: ["fawran_payment_id"]
            isOneToOne: false
            referencedRelation: "pending_fawran_payments"
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
      used_reference_numbers: {
        Row: {
          id: string
          payment_id: string | null
          reference_number: string
          transaction_reference: string | null
          updated_at: string | null
          used_at: string
          used_by: string
        }
        Insert: {
          id?: string
          payment_id?: string | null
          reference_number: string
          transaction_reference?: string | null
          updated_at?: string | null
          used_at?: string
          used_by: string
        }
        Update: {
          id?: string
          payment_id?: string | null
          reference_number?: string
          transaction_reference?: string | null
          updated_at?: string | null
          used_at?: string
          used_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "used_reference_numbers_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "pending_fawran_payments"
            referencedColumns: ["id"]
          },
        ]
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
      user_memory_context: {
        Row: {
          ai_nickname: string | null
          communication_style: string | null
          conversation_themes: string[] | null
          created_at: string | null
          current_projects: string | null
          custom_instructions: string | null
          id: string
          interaction_count: number | null
          last_interaction: string | null
          preferred_help_style: string | null
          preferred_nickname: string | null
          preferred_tone: string | null
          recent_achievements: string | null
          relationship_style: string | null
          reply_style: string | null
          updated_at: string | null
          user_expertise: string[] | null
          user_id: string
          working_patterns: string | null
        }
        Insert: {
          ai_nickname?: string | null
          communication_style?: string | null
          conversation_themes?: string[] | null
          created_at?: string | null
          current_projects?: string | null
          custom_instructions?: string | null
          id?: string
          interaction_count?: number | null
          last_interaction?: string | null
          preferred_help_style?: string | null
          preferred_nickname?: string | null
          preferred_tone?: string | null
          recent_achievements?: string | null
          relationship_style?: string | null
          reply_style?: string | null
          updated_at?: string | null
          user_expertise?: string[] | null
          user_id: string
          working_patterns?: string | null
        }
        Update: {
          ai_nickname?: string | null
          communication_style?: string | null
          conversation_themes?: string[] | null
          created_at?: string | null
          current_projects?: string | null
          custom_instructions?: string | null
          id?: string
          interaction_count?: number | null
          last_interaction?: string | null
          preferred_help_style?: string | null
          preferred_nickname?: string | null
          preferred_tone?: string | null
          recent_achievements?: string | null
          relationship_style?: string | null
          reply_style?: string | null
          updated_at?: string | null
          user_expertise?: string[] | null
          user_id?: string
          working_patterns?: string | null
        }
        Relationships: []
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
      user_sessions: {
        Row: {
          created_at: string
          device_info: string | null
          is_active: boolean | null
          session_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: string | null
          is_active?: boolean | null
          session_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: string | null
          is_active?: boolean | null
          session_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_voice_clones: {
        Row: {
          created_at: string
          elevenlabs_data: Json | null
          expires_at: string | null
          id: string
          last_used_at: string | null
          updated_at: string
          user_email: string | null
          user_id: string
          voice_description: string | null
          voice_id: string
          voice_name: string
        }
        Insert: {
          created_at?: string
          elevenlabs_data?: Json | null
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          updated_at?: string
          user_email?: string | null
          user_id: string
          voice_description?: string | null
          voice_id: string
          voice_name: string
        }
        Update: {
          created_at?: string
          elevenlabs_data?: Json | null
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          updated_at?: string
          user_email?: string | null
          user_id?: string
          voice_description?: string | null
          voice_id?: string
          voice_name?: string
        }
        Relationships: []
      }
      user_voice_translation_quotas: {
        Row: {
          created_at: string
          extra_translations: number
          id: string
          monthly_date: string
          purchase_date: string | null
          translation_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          extra_translations?: number
          id?: string
          monthly_date?: string
          purchase_date?: string | null
          translation_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          extra_translations?: number
          id?: string
          monthly_date?: string
          purchase_date?: string | null
          translation_count?: number
          updated_at?: string
          user_id?: string
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
          monthly_period: string | null
          monthly_reset_date: string | null
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
          monthly_period?: string | null
          monthly_reset_date?: string | null
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
          monthly_period?: string | null
          monthly_reset_date?: string | null
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
      admin_activate_subscription: {
        Args:
          | {
              p_user_id: string
              p_plan_name: string
              p_billing_amount?: number
              p_billing_currency?: string
              p_payment_method?: string
              p_fawran_payment_id?: string
              p_is_gift?: boolean
              p_gift_duration?: string
              p_gift_given_by?: string
            }
          | {
              p_user_id: string
              p_plan_name: string
              p_billing_amount?: number
              p_billing_currency?: string
              p_payment_method?: string
              p_paypal_subscription_id?: string
              p_fawran_payment_id?: string
            }
        Returns: boolean
      }
      admin_gift_translation_credits: {
        Args: { p_user_id: string; p_translations: number; p_admin_id: string }
        Returns: {
          success: boolean
          new_extra_translations: number
        }[]
      }
      admin_gift_voice_credits: {
        Args: { p_user_id: string; p_characters: number; p_admin_id: string }
        Returns: {
          success: boolean
          new_extra_characters: number
        }[]
      }
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
      authenticate_admin: {
        Args: { p_email: string; p_password: string }
        Returns: {
          admin_id: string
          session_token: string
          expires_at: string
        }[]
      }
      backfill_missing_profiles: {
        Args: Record<PropertyKey, never>
        Returns: number
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
      cleanup_expired_summaries: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_expired_voice_clones: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_conversation_summaries: {
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
      deactivate_expired_gift_subscriptions: {
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
      generate_room_code: {
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
      get_admin_dashboard_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_users: number
          active_subscriptions: number
          gift_subscriptions: number
          expiring_soon: number
          unsubscribed_users: number
          unconfirmed_accounts: number
          monthly_revenue: number
          new_users_this_month: number
          pending_messages: number
        }[]
      }
      get_current_user_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_fawran_payment_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_payments: number
          pending_payments: number
          approved_payments: number
          rejected_payments: number
          auto_approved_payments: number
          manual_reviewed_payments: number
          avg_processing_time_ms: number
          tampering_detected_count: number
          duplicate_detected_count: number
          time_validation_failed_count: number
        }[]
      }
      get_or_create_ai_quota: {
        Args: { input_user_id: string }
        Returns: {
          id: string
          user_id: string
          chat_characters_used: number
          chat_characters_limit: number
          created_at: string
          updated_at: string
        }[]
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
      get_or_create_voice_translation_quota: {
        Args: { p_user_id: string }
        Returns: {
          translation_count: number
          extra_translations: number
          purchase_date: string
        }[]
      }
      get_payment_method_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          payment_method: string
          user_count: number
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
      increment_voice_translation_usage: {
        Args: { p_user_id: string }
        Returns: {
          success: boolean
          translation_count: number
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
      process_expired_subscriptions: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      process_stuck_fawran_payments: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      process_translation_credits_purchase: {
        Args: { p_user_id: string; p_transaction_id: string; p_amount: number }
        Returns: boolean
      }
      process_voice_credits_purchase: {
        Args: { p_user_id: string; p_transaction_id: string; p_amount: number }
        Returns: boolean
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
      purchase_extra_voice_translations: {
        Args: { p_user_id: string; p_count: number }
        Returns: {
          success: boolean
          new_extra_count: number
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
      refresh_conversation_summary_if_needed: {
        Args: {
          p_user_id: string
          p_conversation_id: string
          p_current_message_count: number
        }
        Returns: boolean
      }
      reset_monthly_voice_quotas: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      resolve_duplicate_subscription: {
        Args: {
          p_user_email: string
          p_keep_payment_id: string
          p_refund_payment_id: string
        }
        Returns: Json
      }
      send_admin_message: {
        Args: {
          p_admin_id: string
          p_recipient_id: string
          p_subject: string
          p_content: string
        }
        Returns: string
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      setup_notification_cron_job: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      soft_delete_user: {
        Args: { p_user_id: string; p_admin_id: string }
        Returns: boolean
      }
      suspend_user: {
        Args: { p_user_id: string; p_admin_id: string; p_reason?: string }
        Returns: boolean
      }
      test_user_voice_quota_access: {
        Args: { p_user_id: string }
        Returns: Json
      }
      unsuspend_user: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      update_overdue_tasks: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_voice_activity: {
        Args: { p_voice_id: string }
        Returns: undefined
      }
      upsert_conversation_summary: {
        Args: {
          p_user_id: string
          p_conversation_id: string
          p_summary_text: string
          p_message_count: number
          p_compressed_summary?: string
          p_context_tokens?: number
        }
        Returns: {
          id: string
          summary_text: string
          compressed_summary: string
          message_count: number
          context_tokens: number
          created_at: string
          updated_at: string
        }[]
      }
      upsert_user_personalization: {
        Args: {
          p_user_id: string
          p_nickname?: string
          p_role?: string
          p_main_use?: string
          p_interests?: string[]
          p_ai_tone?: string
          p_reply_style?: string
          p_traits?: string[]
          p_communication_style?: string
          p_response_length?: string
          p_personal_note?: string
          p_auto_enable?: boolean
        }
        Returns: {
          id: string
          user_id: string
          nickname: string
          role: string
          main_use: string
          interests: string[]
          ai_tone: string
          reply_style: string
          traits: string[]
          communication_style: string
          response_length: string
          personal_note: string
          auto_enable: boolean
          created_at: string
          updated_at: string
        }[]
      }
      user_can_access_task: {
        Args: { task_id: string }
        Returns: boolean
      }
      user_is_conversation_participant: {
        Args: { conversation_id: string }
        Returns: boolean
      }
      validate_admin_session: {
        Args: { p_session_token: string }
        Returns: {
          admin_id: string
          email: string
          full_name: string
          role: string
          permissions: Json
        }[]
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
