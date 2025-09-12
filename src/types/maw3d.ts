
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
  shadowColor?: string;
  preferred_theme?: 'dark' | 'light';
}

export interface BackgroundStyle {
  type: 'color' | 'gradient' | 'image' | 'ai';
  backgroundColor?: string;
  backgroundGradient?: string;
  backgroundImage?: string;
  imageBlur?: number;
}

// Event card styling (separate from text styling)
export interface EventStyleBackgroundGradient {
  from: string; // hex
  to: string;   // hex
  angle: number; // degrees
}

export interface EventStyleBackground {
  type: 'solid' | 'gradient';
  color?: string; // for solid
  gradient?: EventStyleBackgroundGradient; // for gradient
}

export interface EventStyleBorder {
  radius: number; // px
  width: number;  // px
  color: string;  // hex or rgba
  mode?: 'border' | 'outline' | 'inline'; // how to render the border stroke
}

export type EventStyleButtonPreset = 'glass' | 'solid' | 'outline';

export interface EventStyleSection {
  liquidGlass: boolean;
  background: EventStyleBackground;
  border: EventStyleBorder;
  buttonStyle: EventStyleButtonPreset;
  glassBlur?: number; // px
  glassTint?: string; // rgba or hex with alpha
  buttonBorder?: {
    radius: number; // px
    width: number;  // px
    color: string;  // hex/rgba
  };
  buttonColor?: string; // used when buttonStyle === 'solid'
}

export interface EventStyle {
  cardMode: 'full' | 'split';
  card: EventStyleSection;
  lowerSection?: EventStyleSection; // only used in split mode
  chips?: { enabled: boolean };
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
  event_style?: EventStyle;
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
  event_style?: EventStyle | null;
  // Optional audio fields
  audio_source?: string | null;
  audio_title?: string | null;
  audio_artist?: string | null;
  audio_preview_url?: string | null;
  audio_artwork_url?: string | null;
  audio_duration_sec?: number | null;
  audio_playback_mode?: 'autoplay' | 'tap' | null;
}

export interface Maw3dRsvp {
  id: string;
  event_id: string;
  user_id?: string | null;
  guest_name?: string;
  response: 'accepted' | 'declined';
  comment?: string | null;
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
