// ============================================================================
// ENTITY TYPES
// Core business entity types
// ============================================================================

import type { BaseEntity, UserOwnedEntity, ISOTimestamp, Priority, Status } from './common';

/**
 * User profile
 */
export interface Profile extends BaseEntity {
  user_id: string;
  email: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  language: string | null;
  country: string | null;
  city: string | null;
  is_subscribed: boolean | null;
  subscription_status: string | null;
  plan_name: string | null;
  settings: Record<string, unknown> | null;
}

/**
 * Project entity
 */
export interface Project extends UserOwnedEntity {
  name: string;
  slug: string | null;
  description: string | null;
  template: string | null;
  is_public: boolean;
  is_published: boolean;
  published_url: string | null;
  thumbnail_url: string | null;
  files_count: number;
  last_published_at: ISOTimestamp | null;
}

/**
 * Project file
 */
export interface ProjectFile extends BaseEntity {
  project_id: string;
  path: string;
  content: string;
  file_type: string | null;
  size_bytes: number | null;
}

/**
 * Task entity
 */
export interface Task extends UserOwnedEntity {
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: Priority;
  due_date: string | null;
  due_time: string | null;
  completed_at: ISOTimestamp | null;
  is_recurring: boolean;
  recurrence_pattern: string | null;
  parent_task_id: string | null;
  tags: string[];
  assignee_id: string | null;
  share_link: string | null;
}

/**
 * Subtask entity
 */
export interface Subtask extends BaseEntity {
  task_id: string;
  title: string;
  is_completed: boolean;
  order_index: number;
}

/**
 * Event entity
 */
export interface Event extends UserOwnedEntity {
  title: string;
  description: string | null;
  start_time: ISOTimestamp;
  end_time: ISOTimestamp;
  is_all_day: boolean;
  location: string | null;
  location_link: string | null;
  is_public: boolean;
  short_id: string | null;
  organizer_id: string | null;
}

/**
 * Reminder entity
 */
export interface Reminder extends UserOwnedEntity {
  title: string;
  scheduled_at: ISOTimestamp;
  is_recurring: boolean;
  recurrence_pattern: string | null;
  is_sent: boolean;
  sent_at: ISOTimestamp | null;
}

/**
 * Contact entity
 */
export interface Contact extends BaseEntity {
  user_id: string;
  contact_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  is_favorite: boolean;
  contact_profile?: Profile;
}

/**
 * Message entity
 */
export interface Message extends BaseEntity {
  sender_id: string;
  recipient_id: string;
  content: string | null;
  message_type: 'text' | 'voice' | 'image' | 'file';
  media_url: string | null;
  media_type: string | null;
  voice_duration: number | null;
  is_read: boolean;
  is_saved: boolean;
}

/**
 * Conversation entity
 */
export interface Conversation extends BaseEntity {
  is_group: boolean;
  last_message_at: ISOTimestamp | null;
  last_message_text: string | null;
  last_message_by: string | null;
  participants?: ConversationParticipant[];
}

/**
 * Conversation participant
 */
export interface ConversationParticipant extends BaseEntity {
  conversation_id: string;
  user_id: string;
  joined_at: ISOTimestamp;
  profile?: Profile;
}

/**
 * AI conversation
 */
export interface AIConversation extends UserOwnedEntity {
  title: string;
  last_message_at: ISOTimestamp;
  expires_at: ISOTimestamp | null;
}

/**
 * AI chat message
 */
export interface AIChatMessage extends BaseEntity {
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  input_type: string;
  language: string;
  intent: string | null;
  action_taken: string | null;
  action_result: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Notification entity
 */
export interface Notification extends BaseEntity {
  user_id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  data: Record<string, unknown> | null;
  deep_link: string | null;
}

/**
 * Journal day entry
 */
export interface JournalDay extends UserOwnedEntity {
  date: string;
  mood_value: number | null;
  morning_reflection: string | null;
  evening_reflection: string | null;
  gratitude_1: string | null;
  gratitude_2: string | null;
  gratitude_3: string | null;
  tags: string[];
  note: string | null;
}
