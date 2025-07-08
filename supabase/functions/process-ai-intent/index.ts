import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

console.log("🎯 TASK CREATION ROUTER: Restored DeepSeek-powered task parsing");

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🎯 PROCESSING AI INTENT: Task creation analysis");
    const { text, mode, userId, conversationHistory } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: "Text input is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // PHASE 2 FIX: Enhanced explicit task detection
    const explicitTaskPatterns = {
      en: [
        /^(please\s+)?(create|make|add|new)\s+(a\s+)?task\s*:?\s*(.{10,})/i,
        /^(can\s+you\s+)?(create|make|add)\s+(a\s+)?task\s+(for|about|to|that)\s+(.{10,})/i,
        /^(i\s+need\s+)?(a\s+)?(new\s+)?task\s+(for|about|to|that)\s+(.{10,})/i,
        /^task\s*:\s*(.{10,})/i,
        /^add\s+task\s*:?\s*(.{10,})/i,
      ],
      ar: [
        /^(من\s+فضلك\s+)?(أنشئ|اعمل|أضف|مهمة\s+جديدة)\s*(مهمة)?\s*:?\s*(.{10,})/i,
        /^(هل\s+يمكنك\s+)?(إنشاء|عمل|إضافة)\s+(مهمة)\s+(لـ|حول|من\s+أجل|بخصوص)\s+(.{10,})/i,
        /^(أحتاج\s+)?(إلى\s+)?(مهمة\s+جديدة)\s+(لـ|حول|من\s+أجل|بخصوص)\s+(.{10,})/i,
        /^مهمة\s*:\s*(.{10,})/i,
        /^أضف\s+مهمة\s*:?\s*(.{10,})/i,
      ]
    };

    const explicitReminderPatterns = {
      en: [
        /^(please\s+)?(create|make|add|set)\s+(a\s+)?reminder\s*:?\s*(.{10,})/i,
        /^(remind\s+me\s+)(to\s+|about\s+|that\s+)(.{10,})/i,
        /^(can\s+you\s+)?(remind\s+me|set\s+a\s+reminder)\s+(to\s+|about\s+|that\s+)(.{10,})/i,
        /^reminder\s*:\s*(.{10,})/i,
        /^set\s+reminder\s*:?\s*(.{10,})/i,
      ],
      ar: [
        /^(من\s+فضلك\s+)?(أنشئ|اعمل|أضف|اضبط)\s+(تذكير)\s*:?\s*(.{10,})/i,
        /^(ذكرني\s+)(أن\s+|بـ\s*|أنني\s+)(.{10,})/i,
        /^(هل\s+يمكنك\s+)?(تذكيري|ضبط\s+تذكير)\s+(أن\s+|بـ\s*|أنني\s+)(.{10,})/i,
        /^تذكير\s*:\s*(.{10,})/i,
        /^اضبط\s+تذكير\s*:?\s*(.{10,})/i,
      ]
    };

    // Check for task confirmation first (go ahead, create, confirm)
    const confirmationPatterns = [
      /\b(go\s+ahead|yes|confirm|create\s+it|do\s+it|make\s+it)\b/i,
      /\b(go\s+ahead\s+(and\s+)?create)\b/i,
      /\b(create\s+the\s+task)\b/i
    ];

    const isConfirmation = confirmationPatterns.some(pattern => pattern.test(text));

    if (isConfirmation && conversationHistory && conversationHistory.length > 0) {
      console.log("✅ TASK CONFIRMATION: Looking for previous task request");
      
      // Look for the most recent task creation request in conversation history
      for (let i = conversationHistory.length - 1; i >= 0; i--) {
        const message = conversationHistory[i];
        if (message.role === 'user') {
          const taskAnalysis = await analyzeTaskCreationIntent(message.content);
          if (taskAnalysis.isTask && taskAnalysis.taskData) {
            console.log("✅ FOUND PREVIOUS TASK REQUEST: Creating confirmation");
            
            return new Response(
              JSON.stringify({
                response: `I'll create this task for you:\n\n**${taskAnalysis.taskData.title}**\n${taskAnalysis.taskData.subtasks && taskAnalysis.taskData.subtasks.length > 0 ? `\nSubtasks:\n${taskAnalysis.taskData.subtasks.map(s => `• ${s}`).join('\n')}` : ''}\n${taskAnalysis.taskData.due_date ? `Due: ${taskAnalysis.taskData.due_date}` : ''}\n${taskAnalysis.taskData.due_time ? ` at ${taskAnalysis.taskData.due_time}` : ''}\n\nPlease confirm if you'd like me to create this task.`,
                intent: "parse_task",
                intentData: {
                  pendingTask: taskAnalysis.taskData
                }
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
    }

    // PHASE 2 FIX: Check for explicit task patterns
    const taskPatterns = explicitTaskPatterns.en.concat(explicitTaskPatterns.ar);
    const reminderPatterns = explicitReminderPatterns.en.concat(explicitReminderPatterns.ar);
    
    let isExplicitTaskRequest = false;
    let isExplicitReminderRequest = false;
    let taskContent = '';
    let reminderContent = '';

    // Check explicit task requests
    for (const pattern of taskPatterns) {
      const match = text.match(pattern);
      if (match) {
        taskContent = match[match.length - 1]?.trim();
        if (taskContent && taskContent.length >= 10) {
          isExplicitTaskRequest = true;
          console.log("✅ EXPLICIT TASK REQUEST DETECTED:", taskContent.substring(0, 50) + '...');
          break;
        }
      }
    }

    // Check explicit reminder requests
    if (!isExplicitTaskRequest) {
      for (const pattern of reminderPatterns) {
        const match = text.match(pattern);
        if (match) {
          reminderContent = match[match.length - 1]?.trim();
          if (reminderContent && reminderContent.length >= 10) {
            isExplicitReminderRequest = true;
            console.log("✅ EXPLICIT REMINDER REQUEST DETECTED:", reminderContent.substring(0, 50) + '...');
            break;
          }
        }
      }
    }
    
    if (isExplicitTaskRequest || isExplicitReminderRequest) {
      console.log("🎯 EXPLICIT REQUEST DETECTED: Using DeepSeek for structured parsing");
      
      const taskAnalysis = await analyzeTaskCreationIntent(text);
      
      if (taskAnalysis.isTask && taskAnalysis.taskData) {
        // Check if we need to ask for clarification
        if (!taskAnalysis.taskData.due_date || !taskAnalysis.taskData.priority) {
          const clarificationQuestions = generateClarificationQuestions(taskAnalysis.taskData, text);
          
          return new Response(
            JSON.stringify({
              response: clarificationQuestions.message,
              intent: "clarify_task",
              intentData: {
                partialTask: taskAnalysis.taskData,
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
            response: `I've prepared a task for you to review:\n\n**${taskAnalysis.taskData.title}**\n${taskAnalysis.taskData.subtasks && taskAnalysis.taskData.subtasks.length > 0 ? `\nSubtasks:\n${taskAnalysis.taskData.subtasks.map(s => `• ${s}`).join('\n')}` : ''}\n\nPlease confirm if you'd like me to create this task.`,
            intent: "parse_task",
            intentData: {
              pendingTask: taskAnalysis.taskData
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check for direct image generation request in creative mode
    const isImageRequest = text.toLowerCase().match(
      /(create|generate|make|draw|show me)( an?)? (image|picture|drawing|photo|visualization) (of|showing|with|depicting) (.*)/i
    );
    
    if (mode === 'creative' && isImageRequest) {
      const imagePrompt = isImageRequest[5] || text;
      console.log("🎨 DIRECT IMAGE GENERATION REQUEST:", imagePrompt);
      
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

    // PHASE 2 FIX: Only process with AI if no explicit task/reminder request detected
    console.log("💬 GENERAL CHAT: Processing with DeepSeek for general responses");

    let result;
    try {
      if (!DEEPSEEK_API_KEY) {
        throw new Error("DeepSeek API key not configured");
      }
      
      console.log("🤖 CALLING DEEPSEEK API");
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

// PHASE 2 FIX: Enhanced task analysis using DeepSeek
async function analyzeTaskCreationIntent(text: string) {
  console.log("🎯 DEEPSEEK TASK ANALYSIS: Parsing task details");
  
  if (!DEEPSEEK_API_KEY) {
    console.error("❌ DEEPSEEK API KEY missing");
    return { isTask: false, taskData: null };
  }

  try {
    const analysisPrompt = `Analyze this text for task creation. Extract structured data if this is a task request:

Text: "${text}"

If this is a task creation request, respond with JSON:
{
  "isTask": true,
  "taskData": {
    "title": "main task title",
    "description": "optional description", 
    "due_date": "YYYY-MM-DD or null",
    "due_time": "HH:MM or null",
    "priority": "normal|high|urgent",
    "subtasks": ["subtask1", "subtask2"] // array of strings
  }
}

If NOT a task request, respond: {"isTask": false, "taskData": null}

Rules:
- Only return isTask: true for explicit task creation requests
- Extract subtasks from numbered lists, bullet points, or "steps"
- Infer reasonable priority (normal by default)
- Parse dates/times if mentioned
- Keep titles concise but descriptive`;

    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You are a task analysis expert. Always respond with valid JSON." },
          { role: "user", content: analysisPrompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek analysis failed: ${response.status}`);
    }

    const result = await response.json();
    const analysisText = result.choices[0].message?.content || "";
    
    try {
      const analysis = JSON.parse(analysisText);
      console.log("✅ DEEPSEEK ANALYSIS RESULT:", analysis);
      return analysis;
    } catch (parseError) {
      console.error("❌ FAILED TO PARSE DEEPSEEK ANALYSIS:", analysisText);
      return { isTask: false, taskData: null };
    }
    
  } catch (error) {
    console.error("❌ DEEPSEEK TASK ANALYSIS ERROR:", error);
    return { isTask: false, taskData: null };
  }
}

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
    ? `I've prepared a task: **${taskData.title}**${taskData.subtasks && taskData.subtasks.length > 0 ? `\n\nSubtasks:\n${taskData.subtasks.map((s: string) => `• ${s}`).join('\n')}` : ''}\n\nTo complete the setup, I need to know:\n• ${questions.join('\n• ')}\n\nPlease provide this information so I can create the task for you.`
    : `Task ready: **${taskData.title}**${taskData.subtasks && taskData.subtasks.length > 0 ? `\n\nSubtasks:\n${taskData.subtasks.map((s: string) => `• ${s}`).join('\n')}` : ''}`;
  
  return {
    message: questionText,
    missingFields: missingFields
  };
}

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
  
  // Task creation - assistant mode (more specific)
  else if (
    lowerText.includes("create task") ||
    lowerText.includes("add task") ||
    lowerText.includes("make task") ||
    lowerText.includes("new task") ||
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
