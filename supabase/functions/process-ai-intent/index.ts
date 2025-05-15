
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Define the system prompt based on the current mode
    const getSystemPrompt = (currentMode: string) => {
      const basePrompt = `You are WAKTI, an AI assistant specializing in ${currentMode} mode. `;
      
      switch (currentMode) {
        case "general":
          return basePrompt + "Provide helpful, conversational responses to general queries.";
        case "writer":
          return basePrompt + "Help with writing, editing, and language refinement.";
        case "creative":
          return basePrompt + "Assist with creative content generation and ideas.";
        case "assistant":
          return basePrompt + "Focus on task management, planning, and organization.";
        default:
          return "You are WAKTI, a helpful AI assistant.";
      }
    };

    // First try DeepSeek API
    let result;
    try {
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

      if (!deepseekResponse.ok) {
        throw new Error("DeepSeek API failed");
      }
    } catch (error) {
      console.log("DeepSeek API failed, falling back to OpenAI:", error.message);
      
      // Fallback to OpenAI GPT-4-mini
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
        throw new Error("Both DeepSeek and OpenAI APIs failed");
      }
    }

    // Extract detected intent and response content
    const responseContent = result.choices[0].message?.content || "";
    
    // Analyze the content for special intents (task creation, reminders, events)
    const intentAnalysis = analyzeForIntent(text, responseContent);
    
    return new Response(
      JSON.stringify({
        response: responseContent,
        intent: intentAnalysis.intent,
        intentData: intentAnalysis.data,
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

// Function to analyze text for specific intents
function analyzeForIntent(userText: string, aiResponse: string) {
  const lowerText = userText.toLowerCase();
  
  // Check for task creation intent
  if (lowerText.includes("create task") || 
      lowerText.includes("new task") || 
      lowerText.includes("add task") ||
      (lowerText.includes("task") && (lowerText.includes("make") || lowerText.includes("add")))) {
    return extractTaskData(userText, aiResponse);
  }
  
  // Check for reminder creation intent
  if (lowerText.includes("remind me") || 
      lowerText.includes("set reminder") || 
      lowerText.includes("create reminder") ||
      lowerText.includes("new reminder")) {
    return extractReminderData(userText, aiResponse);
  }
  
  // Check for event creation intent
  if (lowerText.includes("create event") || 
      lowerText.includes("new event") || 
      lowerText.includes("schedule event") ||
      (lowerText.includes("event") && (lowerText.includes("create") || lowerText.includes("add")))) {
    return extractEventData(userText, aiResponse);
  }
  
  // If no specific intent is detected
  return {
    intent: "general_chat",
    data: null
  };
}

// Extract task data from text
function extractTaskData(userText: string, aiResponse: string) {
  // Basic extraction logic - in real implementation this would be more sophisticated
  let title = userText.replace(/create task|new task|add task|make task|task/gi, "").trim();
  if (!title) title = "New task";
  
  return {
    intent: "create_task",
    data: {
      title: title,
      description: "",
      priority: "medium",
      dueDate: null
    }
  };
}

// Extract reminder data from text
function extractReminderData(userText: string, aiResponse: string) {
  let title = userText.replace(/remind me|set reminder|create reminder|new reminder|reminder/gi, "").trim();
  if (!title) title = "New reminder";
  
  return {
    intent: "create_reminder",
    data: {
      title: title,
      dueDate: null
    }
  };
}

// Extract event data from text
function extractEventData(userText: string, aiResponse: string) {
  let title = userText.replace(/create event|new event|schedule event|event/gi, "").trim();
  if (!title) title = "New event";
  
  return {
    intent: "create_event",
    data: {
      title: title,
      description: "",
      startTime: null,
      endTime: null,
      location: null
    }
  };
}
