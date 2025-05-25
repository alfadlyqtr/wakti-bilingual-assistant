export interface Maw3dEvent {
  id: string;
  title: string;
  description?: string;
  organizer?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  is_all_day: boolean;
  location?: string;
  google_maps_link?: string;
  is_public: boolean;
  background_type: 'color' | 'gradient' | 'image' | 'ai';
  background_value: string;
  text_style: TextStyle;
  created_by: string;
  created_at: string;
  updated_at: string;
  short_id?: string;
  template_type?: string;
  show_attending_count?: boolean;
}

export interface CreateEventFormData {
  title: string;
  description: string;
  organizer: string;
  event_date: string;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  location: string;
  google_maps_link: string;
  is_public: boolean;
  background_type: 'color' | 'gradient' | 'image' | 'ai';
  background_value: string;
  text_style: TextStyle;
  invited_contacts: string[];
  template_type?: string;
  show_attending_count?: boolean;
}

export interface TextStyle {
  fontSize: number;
  fontFamily: string;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  hasShadow: boolean;
  alignment: 'left' | 'center' | 'right';
  color: string;
}

export interface EventTemplate {
  id: string;
  name: string;
  title: string;
  description: string;
  organizer: string;
  background_type: 'color' | 'gradient' | 'image' | 'ai';
  background_value: string;
  text_style: TextStyle;
}

export interface Maw3dRsvp {
  id: string;
  event_id: string;
  user_id?: string;
  guest_name?: string;
  response: 'accepted' | 'declined';
  created_at: string;
}

export interface Maw3dInvitation {
  id: string;
  event_id: string;
  invited_user_id: string;
  created_at: string;
}
