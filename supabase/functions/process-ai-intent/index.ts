
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Processing AI intent request");
    const { text, mode, userId } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: "Text input is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Enhanced task detection patterns
    const taskPatterns = [
      // Shopping patterns
      /\b(go\s+)?(shopping|shop)\s+(at|to|in)\s+([^,\.]+)/i,
      /\b(buy|purchase|get|pick\s+up)\s+(.+)/i,
      /\bneed\s+to\s+(go|buy|get|shop|visit|pick\s+up)/i,
      /\bhave\s+to\s+(go|buy|get|shop|visit|pick\s+up)/i,
      /\bmust\s+(go|buy|get|shop|visit|pick\s+up)/i,
      // General task patterns
      /\b(create|add|make|new)\s+task/i,
      /\btask\s+(to|for)/i,
      /\bto\s+do\s+list/i,
      /\btodo/i
    ];

    // Check if this is a task creation request
    const isTaskRequest = taskPatterns.some(pattern => pattern.test(text));
    
    if (isTaskRequest) {
      console.log("Detected task creation request");
      
      // Extract task details
      const taskData = extractEnhancedTaskData(text);
      
      // Check if we need to ask for clarification
      if (!taskData.dueDate || !taskData.priority) {
        const clarificationQuestions = generateClarificationQuestions(taskData, text);
        
        return new Response(
          JSON.stringify({
            response: clarificationQuestions.message,
            intent: "clarify_task",
            intentData: {
              partialTask: taskData,
              missingFields: clarificationQuestions.missingFields,
              originalText: text
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // If we have enough info, return parsed task for confirmation
      return new Response(
        JSON.stringify({
          response: `I've prepared a task for you to review:\n\n**${taskData.title}**\n${taskData.subtasks.length > 0 ? `\nSubtasks:\n${taskData.subtasks.map(s => `• ${s}`).join('\n')}` : ''}\n\nPlease confirm if you'd like me to create this task.`,
          intent: "parse_task",
          intentData: {
            pendingTask: taskData
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for direct image generation request in creative mode
    const isImageRequest = text.toLowerCase().match(
      /(create|generate|make|draw|show me)( an?)? (image|picture|drawing|photo|visualization) (of|showing|with|depicting) (.*)/i
    );
    
    if (mode === 'creative' && isImageRequest) {
      const imagePrompt = isImageRequest[5] || text;
      console.log("Direct image generation request detected in creative mode:", imagePrompt);
      
      return new Response(
        JSON.stringify({ 
          response: `Here's the image prompt extracted for your request:\n\n***${imagePrompt}***\n\n*Note: Image will be generated based on this description.*`,
          intent: "generate_image",
          intentData: { prompt: imagePrompt },
          originalPrompt: text
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enhanced mode detection
    const suggestedMode = detectBetterMode(text, mode);
    console.log(`Current mode: ${mode}, Suggested mode: ${suggestedMode || 'none'}`);

    if (suggestedMode) {
      const getModeName = (mode: string): string => {
        switch(mode) {
          case "general": return "Chat";
          case "writer": return "Writer";
          case "creative": return "Creative";
          case "assistant": return "Assistant";
          default: return mode.charAt(0).toUpperCase() + mode.slice(1);
        }
      };
      
      const modeSwitchAction = {
        text: `Switch to ${getModeName(suggestedMode)} mode`,
        action: `switch_to_${suggestedMode}`,
        targetMode: suggestedMode,
        autoTrigger: true
      };
      
      const switchMessage = `You asked to: "${text}"\nThis works better in ${getModeName(suggestedMode)} mode. Switching now...`;
      
      const response = {
        response: switchMessage,
        suggestedMode: suggestedMode,
        originalPrompt: text,
        modeSwitchAction: modeSwitchAction,
        echoOriginalPrompt: true
      };
      
      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process with AI if no special intent detected
    let result;
    try {
      if (!DEEPSEEK_API_KEY) {
        throw new Error("DeepSeek API key not configured");
      }
      
      console.log("Calling DeepSeek API");
      const deepseekResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: getSystemPrompt(mode || "general") },
            { role: "user", content: text }
          ],
          temperature: 0.7,
        }),
      });

      result = await deepseekResponse.json();
      console.log("DeepSeek response status:", deepseekResponse.status);

      if (!deepseekResponse.ok) {
        throw new Error(`DeepSeek API failed: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      console.log("DeepSeek API failed, falling back to OpenAI:", error.message);
      
      if (!OPENAI_API_KEY) {
        throw new Error("OpenAI API key not configured for fallback");
      }
      
      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: getSystemPrompt(mode || "general") },
            { role: "user", content: text }
          ],
          temperature: 0.7,
        }),
      });

      result = await openaiResponse.json();
      
      if (!openaiResponse.ok) {
        throw new Error(`Both DeepSeek and OpenAI APIs failed: ${JSON.stringify(result)}`);
      }
      
      console.log("OpenAI fallback successful");
    }

    const responseContent = result.choices[0].message?.content || "";
    
    return new Response(
      JSON.stringify({
        response: responseContent,
        intent: "general_chat",
        originalPrompt: text
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error in process-ai-intent function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

// Enhanced task data extraction
function extractEnhancedTaskData(text: string) {
  const lowerText = text.toLowerCase();
  
  // Extract title
  let title = "";
  const shoppingMatch = text.match(/\b(go\s+)?(shopping|shop)\s+(at|to|in)\s+([^,\.]+)/i);
  if (shoppingMatch) {
    const location = shoppingMatch[4].trim();
    title = `Shopping at ${location}`;
  } else {
    // Generic task title extraction
    title = text.replace(/\b(create|add|make|new)\s+task\s*/i, "").trim();
    if (!title) title = "New task";
  }
  
  // Extract subtasks from shopping lists
  const subtasks: string[] = [];
  
  // Look for "buy/get/purchase" followed by items
  const buyMatch = text.match(/\b(buy|get|purchase|pick\s+up)\s+(.+)/i);
  if (buyMatch) {
    const itemsText = buyMatch[2];
    // Parse natural language lists: "milk and rice and bread" or "milk, rice, bread"
    const items = itemsText
      .split(/\s+and\s+|,\s*|\s*&\s*/)
      .map(item => item.trim())
      .filter(item => item && !item.match(/\b(at|to|in|from|for|on|when|where|why|how)\b/i))
      .slice(0, 10); // Limit to 10 subtasks
    
    subtasks.push(...items);
  }
  
  // Extract due date
  const dateRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-]?(\d{0,4})|(\d{1,2})(st|nd|rd|th)? (of )?(january|february|march|april|may|june|july|august|september|october|november|december)|tomorrow|today|next (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|this (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi;
  const dateMatch = text.match(dateRegex);
  
  // Extract priority
  const priorityRegex = /\b(high|medium|low|urgent|critical)\b\s*priority/i;
  const priorityMatch = text.match(priorityRegex);
  
  // Determine priority based on context
  let priority = "normal";
  if (priorityMatch) {
    priority = priorityMatch[1].toLowerCase();
  } else if (lowerText.includes("urgent") || lowerText.includes("asap") || lowerText.includes("immediately")) {
    priority = "urgent";
  } else if (lowerText.includes("important") || lowerText.includes("soon")) {
    priority = "high";
  }
  
  return {
    title: title,
    description: "",
    subtasks: subtasks,
    due_date: dateMatch ? dateMatch[0] : null,
    due_time: null,
    priority: priority as 'normal' | 'high' | 'urgent',
    task_type: 'one-time' as const
  };
}

// Generate clarification questions for missing task details
function generateClarificationQuestions(taskData: any, originalText: string) {
  const missingFields = [];
  let questions = [];
  
  if (!taskData.due_date) {
    missingFields.push('due_date');
    if (taskData.title.toLowerCase().includes('shopping')) {
      questions.push("When would you like to go shopping?");
    } else {
      questions.push("When would you like to complete this task?");
    }
  }
  
  if (!taskData.priority || taskData.priority === 'normal') {
    missingFields.push('priority');
    questions.push("What priority should this task have? (normal, high, urgent)");
  }
  
  const questionText = questions.length > 0 
    ? `I've prepared a task: **${taskData.title}**${taskData.subtasks.length > 0 ? `\n\nSubtasks:\n${taskData.subtasks.map((s: string) => `• ${s}`).join('\n')}` : ''}\n\nTo complete the setup, I need to know:\n• ${questions.join('\n• ')}\n\nPlease provide this information so I can create the task for you.`
    : `Task ready: **${taskData.title}**${taskData.subtasks.length > 0 ? `\n\nSubtasks:\n${taskData.subtasks.map((s: string) => `• ${s}`).join('\n')}` : ''}`;
  
  return {
    message: questionText,
    missingFields: missingFields
  };
}

// Enhanced mode detection
function detectBetterMode(userText: string, currentMode: string) {
  const lowerText = userText.toLowerCase();
  let detectedMode = null;
  
  // Image generation - creative mode
  if (
    lowerText.startsWith("/image") ||
    lowerText.includes("generate image") ||
    lowerText.includes("create image") ||
    lowerText.includes("draw") ||
    lowerText.includes("create a picture") ||
    lowerText.includes("make an image") ||
    lowerText.includes("generate a picture") ||
    lowerText.includes("show me a picture") ||
    lowerText.includes("visualize") ||
    lowerText.includes("picture of")
  ) {
    detectedMode = currentMode !== 'creative' ? 'creative' : null;
  }
  
  // Task creation - assistant mode
  else if (
    lowerText.includes("create task") ||
    lowerText.includes("add task") ||
    lowerText.includes("make task") ||
    lowerText.includes("shopping") ||
    lowerText.includes("buy") ||
    lowerText.includes("purchase") ||
    lowerText.includes("get") ||
    lowerText.includes("pick up") ||
    lowerText.includes("create reminder") ||
    lowerText.includes("add reminder") ||
    lowerText.includes("remind me") ||
    lowerText.includes("schedule") ||
    lowerText.includes("create event") ||
    lowerText.includes("add event") ||
    lowerText.includes("calendar") ||
    lowerText.includes("plan") ||
    lowerText.includes("meeting") ||
    lowerText.includes("appointment")
  ) {
    detectedMode = currentMode !== 'assistant' ? 'assistant' : null;
  }
  
  // Writing assistance - writer mode
  else if (
    lowerText.includes("write") ||
    lowerText.includes("draft") ||
    lowerText.includes("compose") ||
    lowerText.includes("email") ||
    lowerText.includes("letter") ||
    lowerText.includes("essay") ||
    lowerText.includes("poem") ||
    lowerText.includes("story") ||
    lowerText.includes("message") ||
    lowerText.includes("edit") ||
    lowerText.includes("text") ||
    lowerText.includes("summarize") ||
    lowerText.includes("rewrite")
  ) {
    detectedMode = currentMode !== 'writer' ? 'writer' : null;
  }
  
  return detectedMode;
}

// System prompt based on mode
function getSystemPrompt(currentMode: string) {
  const basePrompt = `You are WAKTI, an AI assistant specializing in ${currentMode} mode. `;
  
  switch (currentMode) {
    case "general":
      return basePrompt + `
        Provide helpful, conversational responses to general queries.
        If the user asks about creating tasks, events, reminders, or images, suggest switching to the appropriate mode.
        Task/Events/Reminders = assistant mode, Images = creative mode, Writing = writer mode.
      `;
    case "writer":
      return basePrompt + `
        Help with writing, editing, and language refinement.
        You excel at drafting emails, creating content, and refining text.
      `;
    case "creative":
      return basePrompt + `
        Assist with creative content generation and ideas.
        You're especially good at image generation, storytelling, and creative concepts.
        For image generation requests, extract the image prompt clearly.
      `;
    case "assistant":
      return basePrompt + `
        Focus on task management, planning, and organization.
        You excel at helping create tasks, events, and reminders.
        Try to extract structured data from user requests for these items.
      `;
    default:
      return "You are WAKTI, a helpful AI assistant.";
  }
}
