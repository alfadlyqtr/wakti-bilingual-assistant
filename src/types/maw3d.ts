
export interface Maw3dEvent {
  id: string;
  created_by: string;
  title: string;
  description?: string;
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
  template_type?: string;
  short_id?: string;
  created_at: string;
  updated_at: string;
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

export interface EventTemplate {
  id: string;
  name: string;
  title: string;
  description: string;
  background_type: 'color' | 'gradient' | 'image';
  background_value: string;
  text_style: TextStyle;
}

export interface CreateEventFormData {
  title: string;
  description: string;
  event_date: string;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  location: string;
  google_maps_link: string;
  is_public: boolean;
  background_type: 'color' | 'gradient' | 'image' | 'ai';
  background_value: string;
  ai_prompt?: string;
  text_style: TextStyle;
  template_type?: string;
  invited_contacts: string[];
}
