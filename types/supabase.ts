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
      user_business_cards: {
        Row: {
          user_id: string
          first_name: string
          last_name: string | null
          email: string | null
          phone: string | null
          company_name: string | null
          job_title: string | null
          website: string | null
          logo_url: string | null
          profile_photo_url: string | null
          cover_photo_url: string | null
          department: string | null
          headline: string | null
          address: string | null
          social_links: Json | null
          template: string | null
          primary_color: string | null
          mosaic_palette_id: string | null
          mosaic_colors: Json | null
          professional_colors: Json | null
          fashion_colors: Json | null
          minimal_colors: Json | null
          clean_colors: Json | null
          logo_position: string | null
          photo_shape: string | null
          name_style: Json | null
          title_style: Json | null
          company_style: Json | null
          icon_style: Json | null
        }
        Insert: {
          user_id: string
          first_name: string
          last_name?: string | null
          email?: string | null
          phone?: string | null
          company_name?: string | null
          job_title?: string | null
          website?: string | null
          logo_url?: string | null
          profile_photo_url?: string | null
          cover_photo_url?: string | null
          department?: string | null
          headline?: string | null
          address?: string | null
          social_links?: Json | null
          template?: string | null
          primary_color?: string | null
          mosaic_palette_id?: string | null
          mosaic_colors?: Json | null
          professional_colors?: Json | null
          fashion_colors?: Json | null
          minimal_colors?: Json | null
          clean_colors?: Json | null
          logo_position?: string | null
          photo_shape?: string | null
          name_style?: Json | null
          title_style?: Json | null
          company_style?: Json | null
          icon_style?: Json | null
        }
        Update: {
          user_id?: string
          first_name?: string
          last_name?: string | null
          email?: string | null
          phone?: string | null
          company_name?: string | null
          job_title?: string | null
          website?: string | null
          logo_url?: string | null
          profile_photo_url?: string | null
          cover_photo_url?: string | null
          department?: string | null
          headline?: string | null
          address?: string | null
          social_links?: Json | null
          template?: string | null
          primary_color?: string | null
          mosaic_palette_id?: string | null
          mosaic_colors?: Json | null
          professional_colors?: Json | null
          fashion_colors?: Json | null
          minimal_colors?: Json | null
          clean_colors?: Json | null
          logo_position?: string | null
          photo_shape?: string | null
          name_style?: Json | null
          title_style?: Json | null
          company_style?: Json | null
          icon_style?: Json | null
        }
        Relationships: []
      }
    }
  }
}