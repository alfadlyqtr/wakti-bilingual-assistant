
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

console.log("🚀 WAKTI AI V2 BRAIN: Phase 4 - Advanced Integration & Automation");

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 WAKTI AI V2 BRAIN: Processing Phase 4 request");

    const requestBody = await req.json();
    console.log("🚀 WAKTI AI V2 BRAIN: Request body received:", requestBody);

    const {
      message,
      userId,
      language = 'en',
      conversationId = null,
      inputType = 'text',
      conversationHistory = [],
      confirmSearch = false,
      activeTrigger = 'chat',
      textGenParams = null,
      attachedFiles = [],
      calendarContext = null,
      userContext = null,
      enableAdvancedIntegration = true,
      enablePredictiveInsights = true,
      enableWorkflowAutomation = true,
      confirmTask = false,
      confirmReminder = false,
      pendingTaskData = null,
      pendingReminderData = null
    } = requestBody;

    // Handle task confirmation (when confirmTask is true)
    if (confirmTask && pendingTaskData) {
      console.log("🚀 WAKTI AI V2 BRAIN: Processing task confirmation");
      
      try {
        // Convert relative dates to actual dates and validate
        let actualDueDate = null;
        if (pendingTaskData.due_date) {
          actualDueDate = convertRelativeDate(pendingTaskData.due_date);
          console.log("🚀 WAKTI AI V2 BRAIN: Converted date:", pendingTaskData.due_date, "->", actualDueDate);
        }

        const taskToCreate = {
          title: pendingTaskData.title,
          description: pendingTaskData.description || '',
          user_id: userId,
          due_date: actualDueDate,
          priority: pendingTaskData.priority || 'normal',
          status: 'pending',
          task_type: pendingTaskData.task_type || 'one-time',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Remove due_time since it's not a column in the tasks table
        console.log("🚀 WAKTI AI V2 BRAIN: Creating task:", taskToCreate);

        const { data: createdTask, error: taskError } = await supabase
          .from('tasks')
          .insert([taskToCreate])
          .select()
          .single();

        if (taskError) {
          console.error("Task creation error:", taskError);
          throw new Error(`Failed to create task: ${taskError.message}`);
        }

        console.log("Task created successfully:", createdTask);

        // Create subtasks if they exist
        if (pendingTaskData.subtasks && pendingTaskData.subtasks.length > 0) {
          const subtasksToCreate = pendingTaskData.subtasks.map((subtask: string, index: number) => ({
            task_id: createdTask.id,
            title: subtask,
            completed: false,
            order_index: index,
            created_at: new Date().toISOString()
          }));

          const { error: subtaskError } = await supabase
            .from('subtasks')
            .insert(subtasksToCreate);

          if (subtaskError) {
            console.error("Subtask creation error:", subtaskError);
          } else {
            console.log("Subtasks created successfully");
          }
        }

        return new Response(JSON.stringify({
          response: language === 'ar' ? 'تم إنشاء المهمة بنجاح!' : 'Task created successfully!',
          conversationId: conversationId || generateConversationId(),
          intent: 'task_created',
          confidence: 'high',
          actionTaken: true,
          actionResult: { createdTask },
          success: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

      } catch (error) {
        console.error("Task creation failed:", error);
        return new Response(JSON.stringify({
          response: language === 'ar' ? 'فشل في إنشاء المهمة' : 'Failed to create task',
          error: error.message,
          success: false
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // Handle reminder confirmation (when confirmReminder is true)
    if (confirmReminder && pendingReminderData) {
      console.log("🚀 WAKTI AI V2 BRAIN: Processing reminder confirmation");
      
      try {
        let actualDueDate = null;
        if (pendingReminderData.due_date) {
          actualDueDate = convertRelativeDate(pendingReminderData.due_date);
          console.log("🚀 WAKTI AI V2 BRAIN: Converted reminder date:", pendingReminderData.due_date, "->", actualDueDate);
        }

        const reminderToCreate = {
          title: pendingReminderData.title,
          user_id: userId,
          due_date: actualDueDate,
          completed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { data: createdReminder, error: reminderError } = await supabase
          .from('reminders')
          .insert([reminderToCreate])
          .select()
          .single();

        if (reminderError) {
          console.error("Reminder creation error:", reminderError);
          throw new Error(`Failed to create reminder: ${reminderError.message}`);
        }

        console.log("Reminder created successfully:", createdReminder);

        return new Response(JSON.stringify({
          response: language === 'ar' ? 'تم إنشاء التذكير بنجاح!' : 'Reminder created successfully!',
          conversationId: conversationId || generateConversationId(),
          intent: 'reminder_created',
          confidence: 'high',
          actionTaken: true,
          actionResult: { createdReminder },
          success: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

      } catch (error) {
        console.error("Reminder creation failed:", error);
        return new Response(JSON.stringify({
          response: language === 'ar' ? 'فشل في إنشاء التذكير' : 'Failed to create reminder',
          error: error.message,
          success: false
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    if (!message || typeof message !== 'string' || message.trim() === '') {
      console.error("🚀 WAKTI AI V2 BRAIN: Invalid message field");
      return new Response(JSON.stringify({ 
        error: "Message is required and must be a non-empty string",
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!userId) {
      console.error("🚀 WAKTI AI V2 BRAIN: Missing userId");
      return new Response(JSON.stringify({ 
        error: "User ID is required",
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("🚀 WAKTI AI V2 BRAIN: Processing message for user:", userId);

    // Check for confirmation patterns first
    const confirmationPatterns = [
      /\b(go\s+ahead|yes|confirm|create\s+it|do\s+it|make\s+it)\b/i,
      /\b(go\s+ahead\s+(and\s+)?create)\b/i,
      /\b(create\s+the\s+task)\b/i,
      /\b(proceed)\b/i
    ];

    const isConfirmation = confirmationPatterns.some(pattern => pattern.test(message.toLowerCase()));

    if (isConfirmation && conversationHistory.length > 0) {
      console.log("🚀 WAKTI AI V2 BRAIN: Detected confirmation, looking for previous task request");
      
      // Look for the most recent task/reminder request in conversation history
      for (let i = conversationHistory.length - 1; i >= 0; i--) {
        const historyMessage = conversationHistory[i];
        if (historyMessage.role === 'user') {
          const taskData = extractTaskData(historyMessage.content);
          const reminderData = extractReminderData(historyMessage.content);
          
          if (taskData && taskData.title) {
            console.log("🚀 WAKTI AI V2 BRAIN: Found task in history, showing confirmation");
            // Convert dates for display
            const displayData = {
              ...taskData,
              due_date: taskData.due_date ? convertRelativeDate(taskData.due_date) : null
            };
            
            return new Response(JSON.stringify({
              response: `I'll create this task for you:\n\n**${displayData.title}**\n${displayData.subtasks?.length > 0 ? `\nSubtasks:\n${displayData.subtasks.map(s => `• ${s}`).join('\n')}` : ''}\n${displayData.due_date ? `Due: ${formatDateForDisplay(displayData.due_date)}` : ''}${taskData.due_time ? ` at ${taskData.due_time}` : ''}`,
              conversationId: conversationId || generateConversationId(),
              intent: 'task_confirmation',
              confidence: 'high',
              actionTaken: false,
              actionResult: null,
              needsConfirmation: true,
              pendingTaskData: displayData,
              success: true
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }
          
          if (reminderData && reminderData.title) {
            console.log("🚀 WAKTI AI V2 BRAIN: Found reminder in history, showing confirmation");
            const displayData = {
              ...reminderData,
              due_date: reminderData.due_date ? convertRelativeDate(reminderData.due_date) : null
            };
            
            return new Response(JSON.stringify({
              response: `I'll create this reminder for you:\n\n**${displayData.title}**\n${displayData.due_date ? `Date: ${formatDateForDisplay(displayData.due_date)}` : ''}${reminderData.due_time ? ` at ${reminderData.due_time}` : ''}`,
              conversationId: conversationId || generateConversationId(),
              intent: 'reminder_confirmation',
              confidence: 'high',
              actionTaken: false,
              actionResult: null,
              needsConfirmation: true,
              pendingReminderData: displayData,
              success: true
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }
        }
      }
    }

    // Check for task creation patterns
    const taskPatterns = [
      /\bcreate\s+(a\s+)?task/i,
      /\btask\s+due/i,
      /\bshopping\s+list/i,
      /\bsub\s+tasks/i,
      /\bnew\s+task/i,
      /\badd\s+task/i
    ];

    const isTaskCreation = taskPatterns.some(pattern => pattern.test(message.toLowerCase()));

    if (isTaskCreation) {
      console.log("🚀 WAKTI AI V2 BRAIN: Processing task creation request");
      const taskData = extractTaskData(message);
      
      if (taskData && taskData.title) {
        console.log("🚀 WAKTI AI V2 BRAIN: Task data extracted, showing confirmation");
        // Convert dates for display in confirmation
        const displayData = {
          ...taskData,
          due_date: taskData.due_date ? convertRelativeDate(taskData.due_date) : null
        };
        
        return new Response(JSON.stringify({
          response: `I'll create this task for you:\n\n**${displayData.title}**\n${displayData.subtasks?.length > 0 ? `\nSubtasks:\n${displayData.subtasks.map(s => `• ${s}`).join('\n')}` : ''}\n${displayData.due_date ? `Due: ${formatDateForDisplay(displayData.due_date)}` : ''}${taskData.due_time ? ` at ${taskData.due_time}` : ''}`,
          conversationId: conversationId || generateConversationId(),
          intent: 'task_creation',
          confidence: 'high',
          actionTaken: false,
          actionResult: null,
          needsConfirmation: true,
          pendingTaskData: displayData,
          success: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // Check for reminder creation patterns
    const reminderPatterns = [
      /\bcreate\s+(a\s+)?reminder/i,
      /\bremind\s+me/i,
      /\breminder\s+for/i,
      /\bset\s+reminder/i
    ];

    const isReminderCreation = reminderPatterns.some(pattern => pattern.test(message.toLowerCase()));

    if (isReminderCreation) {
      console.log("🚀 WAKTI AI V2 BRAIN: Processing reminder creation request");
      const reminderData = extractReminderData(message);
      
      if (reminderData && reminderData.title) {
        console.log("🚀 WAKTI AI V2 BRAIN: Reminder data extracted, showing confirmation");
        const displayData = {
          ...reminderData,
          due_date: reminderData.due_date ? convertRelativeDate(reminderData.due_date) : null
        };
        
        return new Response(JSON.stringify({
          response: `I'll create this reminder for you:\n\n**${displayData.title}**\n${displayData.due_date ? `Date: ${formatDateForDisplay(displayData.due_date)}` : ''}${reminderData.due_time ? ` at ${reminderData.due_time}` : ''}`,
          conversationId: conversationId || generateConversationId(),
          intent: 'reminder_creation',
          confidence: 'high',
          actionTaken: false,
          actionResult: null,
          needsConfirmation: true,
          pendingReminderData: displayData,
          success: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // Process with AI for general chat
    console.log("🤖 WAKTI AI V2 BRAIN: Processing with AI");
    const response = await processWithAdvancedAI(message, null, language, userContext, calendarContext);

    const result = {
      response,
      conversationId: conversationId || generateConversationId(),
      intent: 'general_chat',
      confidence: 'high',
      actionTaken: false,
      actionResult: null,
      success: true
    };

    console.log("🚀 WAKTI AI V2 BRAIN: Sending response:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🚀 WAKTI AI V2 BRAIN: ❌ Error:", error);
    
    const errorResponse = {
      error: error.message || 'Unknown error occurred',
      success: false
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

// Extract task data from message
function extractTaskData(message: string) {
  const lowerMessage = message.toLowerCase();
  
  let title = '';
  let subtasks = [];
  let due_date = null;
  let due_time = null;
  let priority = 'normal';

  // Extract shopping list format: "shopping list lulu"
  const shoppingMatch = message.match(/shopping\s+list\s+([^,\.\s]+)/i);
  if (shoppingMatch) {
    const location = shoppingMatch[1].trim();
    title = `Shopping at ${location.charAt(0).toUpperCase() + location.slice(1)}`;
  }

  // Extract title from "create a task" format
  const taskMatch = message.match(/create\s+(a\s+)?task\s+(.+?)(\s+due|\s+sub\s+tasks?|$)/i);
  if (taskMatch && !title) {
    title = taskMatch[2].trim();
  }

  // Extract subtasks from "sub tasks rice milk water"
  const subtaskMatch = message.match(/sub\s+tasks?\s+(.+?)(\s+due|$)/i);
  if (subtaskMatch) {
    const itemsText = subtaskMatch[1];
    subtasks = itemsText
      .split(/\s+(?:and\s+)?|,\s*|\s*&\s*/)
      .map(item => item.trim())
      .filter(item => item && item.length > 0)
      .slice(0, 10);
  }

  // Extract due date and time
  const dateTimePatterns = [
    /\bdue\s+(tomorrow)\s+(noon|morning|afternoon|evening)/i,
    /\bdue\s+(tomorrow)/i,
    /\b(tomorrow)\s+(noon)/i,
    /\b(noon)\b/i
  ];

  for (const pattern of dateTimePatterns) {
    const match = message.match(pattern);
    if (match) {
      if (match[1] && match[1].toLowerCase() === 'tomorrow') {
        due_date = 'tomorrow';
      }
      if (match[2] && match[2].toLowerCase() === 'noon') {
        due_time = '12:00 PM';
      } else if (match[1] && match[1].toLowerCase() === 'noon') {
        due_time = '12:00 PM';
      }
      break;
    }
  }

  // Default title if not found
  if (!title && (lowerMessage.includes('task') || lowerMessage.includes('shopping'))) {
    title = 'New Task';
  }

  if (!title) {
    return null;
  }

  return {
    title,
    description: '',
    subtasks,
    due_date,
    due_time,
    priority: priority as 'normal' | 'high' | 'urgent',
    task_type: 'one-time' as const
  };
}

// Extract reminder data from message
function extractReminderData(message: string) {
  const lowerMessage = message.toLowerCase();
  
  const reminderIndicators = ['remind me', 'reminder', 'create reminder'];
  if (!reminderIndicators.some(indicator => lowerMessage.includes(indicator))) {
    return null;
  }

  // Extract reminder title
  let title = 'New Reminder';
  const reminderMatch = message.match(/remind\s+me\s+(.+?)(\s+at|\s+on|\s+in|$)/i);
  if (reminderMatch) {
    title = reminderMatch[1].trim();
  }

  return {
    title,
    due_date: null,
    due_time: null
  };
}

// Convert relative dates to actual dates
function convertRelativeDate(dateString: string): string {
  const today = new Date();
  
  if (dateString.toLowerCase() === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  
  if (dateString.toLowerCase() === 'today') {
    return today.toISOString().split('T')[0];
  }
  
  // If it's already a valid date format, return as is
  const parsed = new Date(dateString);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  
  return dateString;
}

// Format date for display
function formatDateForDisplay(dateString: string): string {
  if (!dateString) return '';
  
  // Check if it's still a relative term
  if (dateString === 'tomorrow') {
    return 'Tomorrow';
  }
  if (dateString === 'today') {
    return 'Today';
  }
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString; // Return original if can't parse
    }
    
    // Check if it's tomorrow by comparing dates
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const dateStr = date.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    if (dateStr === todayStr) {
      return 'Today';
    } else if (dateStr === tomorrowStr) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString();
    }
  } catch {
    return dateString;
  }
}

// Real AI processing
async function processWithAdvancedAI(message: string, context: string | null, language: string = 'en', userContext: any = null, calendarContext: any = null) {
  try {
    let apiKey = DEEPSEEK_API_KEY;
    let apiUrl = 'https://api.deepseek.com/v1/chat/completions';
    let model = 'deepseek-chat';
    
    if (!apiKey) {
      apiKey = OPENAI_API_KEY;
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      model = 'gpt-4o-mini';
    }
    
    if (!apiKey) {
      throw new Error("No AI API key configured");
    }

    const systemPrompt = language === 'ar' 
      ? `أنت WAKTI، مساعد ذكي متقدم يتحدث العربية بطلاقة. تتخصص في المساعدة في إدارة المهام والأحداث والتذكيرات. كن ودوداً ومفيداً ومختصراً في إجاباتك.`
      : `You are WAKTI, an advanced AI assistant specializing in task management, events, and reminders. You help users create tasks, events, and reminders efficiently. Be friendly, helpful, and concise in your responses.`;
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];
    
    if (context) {
      messages.splice(1, 0, { role: 'assistant', content: `Context: ${context}` });
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });
    
    if (!response.ok) {
      throw new Error(`AI API failed: ${response.status}`);
    }
    
    const result = await response.json();
    return result.choices[0].message.content;
    
  } catch (error) {
    console.error("🤖 WAKTI AI V2 BRAIN: AI processing error:", error);
    
    return language === 'ar' 
      ? `أعتذر، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.`
      : `I'll help you create tasks, events, or reminders. To get started, could you please provide:

1. What would you like me to create? (Task/Event/Reminder)
2. Key details like:
   - Title/description
   - Date/time (or should I suggest optimal timing?)
   - Priority level if applicable
   - Any other relevant details

For example, you could say:
"Create a task to prepare quarterly report, due Friday afternoon, high priority"

Or:
"Schedule a dentist appointment, suggest times next week when I'm typically free"

How would you like to proceed? I can also suggest smart scheduling based on your typical productivity patterns if you'd like.`;
  }
}

function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
