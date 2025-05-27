
export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  alignment: 'left' | 'center' | 'right';
  hasShadow: boolean;
  shadowIntensity?: number;
}

export interface BackgroundStyle {
  type: 'color' | 'gradient' | 'image' | 'ai';
  backgroundColor?: string;
  backgroundGradient?: string;
  backgroundImage?: string;
  imageBlur?: number;
}

// Updated EventFormData to match database structure
export interface EventFormData {
  title: string;
  description?: string;
  location?: string;
  google_maps_link?: string;
  organizer?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  is_all_day: boolean;
  is_public: boolean;
  show_attending_count: boolean;
  auto_delete_enabled: boolean;
  background_type: 'color' | 'gradient' | 'image' | 'ai';
  background_value: string;
  text_style: TextStyle;
  template_type?: string | null;
  invited_contacts: string[];
  image_blur: number;
}

export interface CreateEventFormData {
  title: string;
  description?: string;
  location?: string;
  google_maps_link?: string;
  organizer?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  is_all_day: boolean;
  is_public: boolean;
  show_attending_count: boolean;
  auto_delete_enabled: boolean;
  background_type: 'color' | 'gradient' | 'image' | 'ai';
  background_value: string;
  text_style: TextStyle;
  template_type?: string | null;
  invited_contacts: string[];
  image_blur: number;
}

export interface Maw3dEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  google_maps_link?: string;
  organizer?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  is_all_day: boolean;
  is_public: boolean;
  show_attending_count: boolean;
  auto_delete_enabled: boolean;
  background_type: 'color' | 'gradient' | 'image' | 'ai';
  background_value: string;
  text_style: TextStyle;
  template_type?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  short_id?: string | null;
  language?: string;
  image_blur: number;
}

export interface Maw3dRsvp {
  id: string;
  event_id: string;
  user_id?: string | null;
  guest_name?: string;
  response: 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
}

export interface EventTemplate {
  id: string;
  name: string;
  preview: string;
  title: string;
  description: string;
  organizer: string;
  background_type: 'color' | 'gradient' | 'image' | 'ai';
  background_value: string;
  text_style: TextStyle;
}
