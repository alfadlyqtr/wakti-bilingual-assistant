
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

export interface EventFormData {
  title: string;
  description?: string;
  location?: string;
  locationLink?: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  isPublic: boolean;
  rsvpEnabled: boolean;
  rsvpDeadline?: string;
  organizer?: string;
  textStyle: TextStyle;
  backgroundStyle: BackgroundStyle;
  enableShareableLink: boolean;
  showAttendingCount: boolean;
  autoDelete: boolean;
  autoDeleteHours: number;
  invitedContacts: string[];
}

export interface EventTemplate {
  id: string;
  name: string;
  preview: string;
  textStyle: TextStyle;
  backgroundStyle: BackgroundStyle;
}
