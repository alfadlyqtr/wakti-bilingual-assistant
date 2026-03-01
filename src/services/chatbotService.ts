import { supabase } from '@/integrations/supabase/client';

// ============================================
// WAKTI AI ASSISTANT - CHATBOT SERVICE
// ============================================

export interface ChatbotBot {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
  platform: 'website' | 'instagram';
  purpose: 'leads' | 'support' | 'sales' | 'booking' | 'other' | null;
  primary_color: string;
  welcome_message: string;
  welcome_message_ar: string;
  system_prompt: string | null;
  knowledge_base: string | null;
  pre_chat_capture: boolean;
  pre_chat_fields: string[];
  quick_replies: Array<{ en: string; ar: string }>;
  is_active: boolean;
  wakti_project_id: string | null;
  instagram_page_id: string | null;
  instagram_access_token: string | null;
  instagram_business_account_id: string | null;
  instagram_page_name: string | null;
  embed_token: string;
  created_at: string;
  updated_at: string;
}

export interface FlowNode {
  id: string;
  bot_id: string;
  node_id: string;
  type: FlowNodeType;
  label: string | null;
  data: Record<string, any>;
  position_x: number;
  position_y: number;
  created_at: string;
}

export type FlowNodeType =
  | 'start'
  | 'message'
  | 'name'
  | 'email'
  | 'phone'
  | 'single_choice'
  | 'multiple_choice'
  | 'appointment'
  | 'rating'
  | 'ai_response'
  | 'live_chat'
  | 'end';

export interface FlowEdge {
  id: string;
  bot_id: string;
  edge_id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle: string | null;
  label: string | null;
  created_at: string;
}

export interface ChatbotConversation {
  id: string;
  bot_id: string;
  platform: string;
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_phone: string | null;
  visitor_meta: Record<string, any>;
  status: 'ai_handling' | 'human_takeover' | 'resolved';
  current_node_id: string | null;
  started_at: string;
  last_message_at: string;
}

export interface ChatbotMessage {
  id: string;
  conversation_id: string;
  sender_type: 'visitor' | 'ai' | 'human';
  content: string;
  metadata: Record<string, any>;
  created_at: string;
}

// Node type metadata for the "Add Component" menu
export const NODE_TYPE_META: Record<FlowNodeType, {
  label: string;
  labelAr: string;
  description: string;
  descriptionAr: string;
  icon: string;
  color: string;
  category: 'flow' | 'collect' | 'action';
}> = {
  start: {
    label: 'Start',
    labelAr: 'البداية',
    description: 'Entry point of the chatflow',
    descriptionAr: 'نقطة بداية المحادثة',
    icon: '▶️',
    color: '#22c55e',
    category: 'flow',
  },
  message: {
    label: 'Send Message',
    labelAr: 'إرسال رسالة',
    description: 'Send a text message to the visitor',
    descriptionAr: 'إرسال رسالة نصية للزائر',
    icon: '💬',
    color: '#060541',
    category: 'flow',
  },
  name: {
    label: 'Ask Name',
    labelAr: 'اسأل الاسم',
    description: "Ask for the user's name",
    descriptionAr: 'اسأل عن اسم المستخدم',
    icon: '👤',
    color: '#f59e0b',
    category: 'collect',
  },
  email: {
    label: 'Ask Email',
    labelAr: 'اسأل الإيميل',
    description: 'Ask for email address with validation',
    descriptionAr: 'اسأل عن البريد الإلكتروني مع التحقق',
    icon: '📧',
    color: '#f59e0b',
    category: 'collect',
  },
  phone: {
    label: 'Ask Phone',
    labelAr: 'اسأل الهاتف',
    description: 'Ask for phone number with validation',
    descriptionAr: 'اسأل عن رقم الهاتف مع التحقق',
    icon: '📱',
    color: '#f59e0b',
    category: 'collect',
  },
  single_choice: {
    label: 'Single Choice',
    labelAr: 'اختيار واحد',
    description: 'Choose one option and direct chatflow',
    descriptionAr: 'اختر خياراً واحداً وتوجيه المحادثة',
    icon: '☝️',
    color: '#060541',
    category: 'collect',
  },
  multiple_choice: {
    label: 'Multiple Choice',
    labelAr: 'اختيار متعدد',
    description: 'Choose multiple options (collect preferences)',
    descriptionAr: 'اختر عدة خيارات (جمع التفضيلات)',
    icon: '✅',
    color: '#0ea5e9',
    category: 'collect',
  },
  appointment: {
    label: 'Appointment',
    labelAr: 'حجز موعد',
    description: 'Book a date and time based on availability',
    descriptionAr: 'حجز تاريخ ووقت بناءً على التوفر',
    icon: '📅',
    color: '#10b981',
    category: 'action',
  },
  rating: {
    label: 'Rating',
    labelAr: 'تقييم',
    description: 'Ask users to rate an experience',
    descriptionAr: 'اطلب من المستخدمين تقييم التجربة',
    icon: '⭐',
    color: '#eab308',
    category: 'action',
  },
  ai_response: {
    label: 'AI Response',
    labelAr: 'رد الذكاء الاصطناعي',
    description: 'Let AI handle the conversation freely',
    descriptionAr: 'دع الذكاء الاصطناعي يتولى المحادثة',
    icon: '🤖',
    color: '#06b6d4',
    category: 'action',
  },
  live_chat: {
    label: 'Live Chat',
    labelAr: 'محادثة مباشرة',
    description: 'Transfer to human agent',
    descriptionAr: 'تحويل لموظف بشري',
    icon: '🧑‍💼',
    color: '#06b6d4',
    category: 'action',
  },
  end: {
    label: 'End',
    labelAr: 'النهاية',
    description: 'End the conversation with a message',
    descriptionAr: 'إنهاء المحادثة برسالة',
    icon: '🏁',
    color: '#ef4444',
    category: 'flow',
  },
};

// Purpose presets - pre-built flow templates
export const PURPOSE_TEMPLATES: Record<string, { nodes: Omit<FlowNode, 'id' | 'bot_id' | 'created_at'>[]; edges: Omit<FlowEdge, 'id' | 'bot_id' | 'created_at'>[] }> = {
  leads: {
    nodes: [
      { node_id: 'start-1', type: 'start', label: 'Start', data: {}, position_x: 0, position_y: 0 },
      { node_id: 'msg-1', type: 'message', label: 'Welcome', data: { text: 'Welcome! 👋 Let me help you get started.', textAr: 'مرحباً! 👋 دعني أساعدك للبدء.' }, position_x: 250, position_y: 0 },
      { node_id: 'name-1', type: 'name', label: 'Get Name', data: { prompt: "What's your name?", promptAr: 'ما اسمك؟' }, position_x: 500, position_y: 0 },
      { node_id: 'email-1', type: 'email', label: 'Get Email', data: { prompt: "What's your email?", promptAr: 'ما بريدك الإلكتروني؟' }, position_x: 750, position_y: 0 },
      { node_id: 'phone-1', type: 'phone', label: 'Get Phone', data: { prompt: "What's your phone number?", promptAr: 'ما رقم هاتفك؟' }, position_x: 1000, position_y: 0 },
      { node_id: 'end-1', type: 'end', label: 'Thank You', data: { text: "Thanks! We'll be in touch soon. 🎉", textAr: 'شكراً! سنتواصل معك قريباً. 🎉' }, position_x: 1250, position_y: 0 },
    ],
    edges: [
      { edge_id: 'e-1', source_node_id: 'start-1', target_node_id: 'msg-1', source_handle: null, label: null },
      { edge_id: 'e-2', source_node_id: 'msg-1', target_node_id: 'name-1', source_handle: null, label: null },
      { edge_id: 'e-3', source_node_id: 'name-1', target_node_id: 'email-1', source_handle: null, label: null },
      { edge_id: 'e-4', source_node_id: 'email-1', target_node_id: 'phone-1', source_handle: null, label: null },
      { edge_id: 'e-5', source_node_id: 'phone-1', target_node_id: 'end-1', source_handle: null, label: null },
    ],
  },
  support: {
    nodes: [
      { node_id: 'start-1', type: 'start', label: 'Start', data: {}, position_x: 0, position_y: 0 },
      { node_id: 'msg-1', type: 'message', label: 'Welcome', data: { text: 'Hi! How can I help you today? 😊', textAr: 'مرحباً! كيف يمكنني مساعدتك اليوم؟ 😊' }, position_x: 250, position_y: 0 },
      { node_id: 'ai-1', type: 'ai_response', label: 'AI Support', data: { instructions: 'Answer customer questions based on the knowledge base.' }, position_x: 500, position_y: 0 },
      { node_id: 'live-1', type: 'live_chat', label: 'Human Agent', data: { message: 'Connecting you to a team member...', messageAr: 'جاري توصيلك بأحد أعضاء الفريق...' }, position_x: 500, position_y: 200 },
    ],
    edges: [
      { edge_id: 'e-1', source_node_id: 'start-1', target_node_id: 'msg-1', source_handle: null, label: null },
      { edge_id: 'e-2', source_node_id: 'msg-1', target_node_id: 'ai-1', source_handle: null, label: null },
      { edge_id: 'e-3', source_node_id: 'ai-1', target_node_id: 'live-1', source_handle: 'escalate', label: 'Needs human' },
    ],
  },
  sales: {
    nodes: [
      { node_id: 'start-1', type: 'start', label: 'Start', data: {}, position_x: 0, position_y: 0 },
      { node_id: 'msg-1', type: 'message', label: 'Welcome', data: { text: 'Welcome! 🛍️ Looking for something special?', textAr: 'مرحباً! 🛍️ تبحث عن شيء مميز؟' }, position_x: 250, position_y: 0 },
      { node_id: 'choice-1', type: 'single_choice', label: 'Interest', data: { prompt: 'What are you interested in?', promptAr: 'بماذا تهتم؟', options: [{ en: 'Browse Products', ar: 'تصفح المنتجات' }, { en: 'Get a Quote', ar: 'احصل على عرض سعر' }, { en: 'Talk to Sales', ar: 'تحدث مع المبيعات' }] }, position_x: 500, position_y: 0 },
      { node_id: 'ai-1', type: 'ai_response', label: 'Product Help', data: { instructions: 'Help the customer find products and answer questions.' }, position_x: 750, position_y: -100 },
      { node_id: 'name-1', type: 'name', label: 'Get Name', data: { prompt: "Great! What's your name?", promptAr: 'ممتاز! ما اسمك؟' }, position_x: 750, position_y: 100 },
      { node_id: 'live-1', type: 'live_chat', label: 'Sales Team', data: {}, position_x: 750, position_y: 300 },
    ],
    edges: [
      { edge_id: 'e-1', source_node_id: 'start-1', target_node_id: 'msg-1', source_handle: null, label: null },
      { edge_id: 'e-2', source_node_id: 'msg-1', target_node_id: 'choice-1', source_handle: null, label: null },
      { edge_id: 'e-3', source_node_id: 'choice-1', target_node_id: 'ai-1', source_handle: 'option-0', label: 'Browse' },
      { edge_id: 'e-4', source_node_id: 'choice-1', target_node_id: 'name-1', source_handle: 'option-1', label: 'Quote' },
      { edge_id: 'e-5', source_node_id: 'choice-1', target_node_id: 'live-1', source_handle: 'option-2', label: 'Sales' },
    ],
  },
  booking: {
    nodes: [
      { node_id: 'start-1', type: 'start', label: 'Start', data: {}, position_x: 0, position_y: 0 },
      { node_id: 'msg-1', type: 'message', label: 'Welcome', data: { text: 'Welcome! 📅 Ready to book an appointment?', textAr: 'مرحباً! 📅 جاهز لحجز موعد؟' }, position_x: 250, position_y: 0 },
      { node_id: 'name-1', type: 'name', label: 'Get Name', data: {}, position_x: 500, position_y: 0 },
      { node_id: 'phone-1', type: 'phone', label: 'Get Phone', data: {}, position_x: 750, position_y: 0 },
      { node_id: 'appt-1', type: 'appointment', label: 'Pick Time', data: {}, position_x: 1000, position_y: 0 },
      { node_id: 'end-1', type: 'end', label: 'Confirmed', data: { text: "You're all set! See you then. ✅", textAr: 'تم الحجز! نراك قريباً. ✅' }, position_x: 1250, position_y: 0 },
    ],
    edges: [
      { edge_id: 'e-1', source_node_id: 'start-1', target_node_id: 'msg-1', source_handle: null, label: null },
      { edge_id: 'e-2', source_node_id: 'msg-1', target_node_id: 'name-1', source_handle: null, label: null },
      { edge_id: 'e-3', source_node_id: 'name-1', target_node_id: 'phone-1', source_handle: null, label: null },
      { edge_id: 'e-4', source_node_id: 'phone-1', target_node_id: 'appt-1', source_handle: null, label: null },
      { edge_id: 'e-5', source_node_id: 'appt-1', target_node_id: 'end-1', source_handle: null, label: null },
    ],
  },
  other: {
    nodes: [
      { node_id: 'start-1', type: 'start', label: 'Start', data: {}, position_x: 0, position_y: 0 },
      { node_id: 'msg-1', type: 'message', label: 'Welcome', data: { text: 'Hello! 👋 How can I assist you?', textAr: 'مرحباً! 👋 كيف يمكنني مساعدتك؟' }, position_x: 250, position_y: 0 },
      { node_id: 'ai-1', type: 'ai_response', label: 'AI Chat', data: {}, position_x: 500, position_y: 0 },
    ],
    edges: [
      { edge_id: 'e-1', source_node_id: 'start-1', target_node_id: 'msg-1', source_handle: null, label: null },
      { edge_id: 'e-2', source_node_id: 'msg-1', target_node_id: 'ai-1', source_handle: null, label: null },
    ],
  },
};

// ============================================
// CRUD OPERATIONS
// ============================================

export const ChatbotService = {
  // --- BOTS ---
  async listBots(userId: string): Promise<ChatbotBot[]> {
    const { data, error } = await (supabase
      .from('chatbot_bots' as any)
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }) as any);
    if (error) throw error;
    return (data || []) as ChatbotBot[];
  },

  async getBot(botId: string): Promise<ChatbotBot | null> {
    const { data, error } = await (supabase
      .from('chatbot_bots' as any)
      .select('*')
      .eq('id', botId)
      .single() as any);
    if (error) return null;
    return data as ChatbotBot;
  },

  async createBot(bot: Partial<ChatbotBot>): Promise<ChatbotBot> {
    const { data, error } = await (supabase
      .from('chatbot_bots' as any)
      .insert(bot)
      .select()
      .single() as any);
    if (error) throw error;
    return data as ChatbotBot;
  },

  async updateBot(botId: string, updates: Partial<ChatbotBot>): Promise<void> {
    const { error } = await (supabase
      .from('chatbot_bots' as any)
      .update(updates)
      .eq('id', botId) as any);
    if (error) throw error;
  },

  async deleteBot(botId: string): Promise<void> {
    const { error } = await (supabase
      .from('chatbot_bots' as any)
      .delete()
      .eq('id', botId) as any);
    if (error) throw error;
  },

  // --- FLOW ---
  async getFlow(botId: string): Promise<{ nodes: FlowNode[]; edges: FlowEdge[] }> {
    const [nodesRes, edgesRes] = await Promise.all([
      supabase.from('chatbot_flow_nodes' as any).select('*').eq('bot_id', botId) as any,
      supabase.from('chatbot_flow_edges' as any).select('*').eq('bot_id', botId) as any,
    ]);
    return {
      nodes: (nodesRes.data || []) as FlowNode[],
      edges: (edgesRes.data || []) as FlowEdge[],
    };
  },

  async saveFlow(botId: string, nodes: Omit<FlowNode, 'id' | 'created_at'>[], edges: Omit<FlowEdge, 'id' | 'created_at'>[]): Promise<void> {
    // Delete existing flow first
    await Promise.all([
      supabase.from('chatbot_flow_nodes' as any).delete().eq('bot_id', botId),
      supabase.from('chatbot_flow_edges' as any).delete().eq('bot_id', botId),
    ]);

    // Insert new flow
    if (nodes.length > 0) {
      const { error: nodesErr } = await (supabase
        .from('chatbot_flow_nodes' as any)
        .insert(nodes.map(n => ({ ...n, bot_id: botId }))) as any);
      if (nodesErr) throw nodesErr;
    }
    if (edges.length > 0) {
      const { error: edgesErr } = await (supabase
        .from('chatbot_flow_edges' as any)
        .insert(edges.map(e => ({ ...e, bot_id: botId }))) as any);
      if (edgesErr) throw edgesErr;
    }
  },

  // --- CONVERSATIONS ---
  async listConversations(botId: string): Promise<ChatbotConversation[]> {
    const { data, error } = await (supabase
      .from('chatbot_conversations' as any)
      .select('*')
      .eq('bot_id', botId)
      .order('last_message_at', { ascending: false }) as any);
    if (error) throw error;
    return (data || []) as ChatbotConversation[];
  },

  async getMessages(conversationId: string): Promise<ChatbotMessage[]> {
    const { data, error } = await (supabase
      .from('chatbot_messages' as any)
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }) as any);
    if (error) throw error;
    return (data || []) as ChatbotMessage[];
  },
};
