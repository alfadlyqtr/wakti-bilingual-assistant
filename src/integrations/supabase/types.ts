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
      event_invitees: {
        Row: {
          created_at: string | null
          email: string | null
          event_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          event_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          event_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_invitees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          created_at: string | null
          device_id: string | null
          event_id: string | null
          guest_name: string | null
          id: string
          ip_address: string | null
          response: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          device_id?: string | null
          event_id?: string | null
          guest_name?: string | null
          id?: string
          ip_address?: string | null
          response: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          device_id?: string | null
          event_id?: string | null
          guest_name?: string | null
          id?: string
          ip_address?: string | null
          response?: string
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
          button_style: string | null
          cover_image: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_time: string
          font_size: number | null
          id: string
          is_all_day: boolean | null
          is_public: boolean | null
          location: string | null
          location_link: string | null
          start_time: string
          text_color: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          background_color?: string | null
          background_gradient?: string | null
          button_style?: string | null
          cover_image?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_time: string
          font_size?: number | null
          id?: string
          is_all_day?: boolean | null
          is_public?: boolean | null
          location?: string | null
          location_link?: string | null
          start_time: string
          text_color?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          background_color?: string | null
          background_gradient?: string | null
          button_style?: string | null
          cover_image?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_time?: string
          font_size?: number | null
          id?: string
          is_all_day?: boolean | null
          is_public?: boolean | null
          location?: string | null
          location_link?: string | null
          start_time?: string
          text_color?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      voice_recordings: {
        Row: {
          attendees: string | null
          audio_url: string
          clean_audio: boolean | null
          created_at: string
          expires_at: string
          highlighted_timestamps: Json | null
          host: string | null
          id: string
          location: string | null
          summary: string | null
          summary_audio_url: string | null
          summary_language: string | null
          summary_voice: string | null
          title: string
          transcript: string | null
          type: string
        }
        Insert: {
          attendees?: string | null
          audio_url: string
          clean_audio?: boolean | null
          created_at?: string
          expires_at: string
          highlighted_timestamps?: Json | null
          host?: string | null
          id?: string
          location?: string | null
          summary?: string | null
          summary_audio_url?: string | null
          summary_language?: string | null
          summary_voice?: string | null
          title: string
          transcript?: string | null
          type: string
        }
        Update: {
          attendees?: string | null
          audio_url?: string
          clean_audio?: boolean | null
          created_at?: string
          expires_at?: string
          highlighted_timestamps?: Json | null
          host?: string | null
          id?: string
          location?: string | null
          summary?: string | null
          summary_audio_url?: string | null
          summary_language?: string | null
          summary_voice?: string | null
          title?: string
          transcript?: string | null
          type?: string
        }
        Relationships: []
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
