
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

    // Define the system prompt based on the current mode
    const getSystemPrompt = (currentMode: string) => {
      const basePrompt = `You are WAKTI, an AI assistant specializing in ${currentMode} mode. `;
      
      switch (currentMode) {
        case "general":
          return basePrompt + `
            Provide helpful, conversational responses to general queries.
            If the user asks about creating tasks, events, reminders, or images, suggest switching to the appropriate mode.
            Task/Events/Reminders = assistant mode, Images = creative mode, Writing = writer mode.
            If suggesting a mode switch, specify which mode would be better and why.
          `;
        case "writer":
          return basePrompt + `
            Help with writing, editing, and language refinement.
            You excel at drafting emails, creating content, and refining text.
            If the user asks for something better suited to another mode, suggest switching.
          `;
        case "creative":
          return basePrompt + `
            Assist with creative content generation and ideas.
            You're especially good at image generation, storytelling, and creative concepts.
            For image generation requests, extract the image prompt clearly.
            Never mention third-party image generators. When creating images, use descriptions like "I've extracted the image details from your request".
          `;
        case "assistant":
          return basePrompt + `
            Focus on task management, planning, and organization.
            You excel at helping create tasks, events, and reminders.
            Try to extract structured data from user requests for these items.
            For tasks: extract title, description, priority, due date when possible.
            For events: extract title, description, start time, end time, location when possible.
            For reminders: extract title and due date when possible.
          `;
        default:
          return "You are WAKTI, a helpful AI assistant.";
      }
    };

    // Enhanced detection logic for mode switching with additional logging
    const detectBetterMode = (userText: string, currentMode: string) => {
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
        console.log("Detected image generation request, suggesting creative mode");
      }
      
      // Task creation - assistant mode
      else if (
        lowerText.includes("create task") ||
        lowerText.includes("add task") ||
        lowerText.includes("make task") ||
        lowerText.includes("create reminder") ||
        lowerText.includes("add reminder") ||
        lowerText.includes("remind me") ||
        lowerText.includes("schedule") ||
        lowerText.includes("create event") ||
        lowerText.includes("add event") ||
        lowerText.includes("calendar") ||
        lowerText.includes("add to my calendar") ||
        lowerText.includes("plan") ||
        lowerText.includes("meeting") ||
        lowerText.includes("appointment")
      ) {
        detectedMode = currentMode !== 'assistant' ? 'assistant' : null;
        console.log("Detected task/calendar related request, suggesting assistant mode");
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
        console.log("Detected writing related request, suggesting writer mode");
      }
      
      // Enhanced logging for the detected mode
      console.log(`Mode detection result - Current: ${currentMode}, Detected: ${detectedMode || 'none'}`);
      
      return detectedMode;
    };

    // Check for direct image generation request in creative mode
    const isImageRequest = text.toLowerCase().match(
      /(create|generate|make|draw|show me)( an?)? (image|picture|drawing|photo|visualization) (of|showing|with|depicting) (.*)/i
    );
    
    // If we're in creative mode and it's an image request, handle it directly
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

    // Check if a mode switch is recommended
    const suggestedMode = detectBetterMode(text, mode);
    console.log(`Current mode: ${mode}, Suggested mode: ${suggestedMode || 'none'}`);

    // If mode switch is suggested, return that instead of processing normally
    if (suggestedMode) {
      const response = {
        response: `You asked to: "${text}". This works better in ${suggestedMode} mode. Switching modes for you...`,
        suggestedMode: suggestedMode,
        originalPrompt: text, // Store the original prompt for the second step
        modeSwitchAction: {
          text: `Switch to ${suggestedMode} mode`,
          action: `switch_to_${suggestedMode}`,
          targetMode: suggestedMode
        }
      };
      
      console.log("Sending mode switch recommendation:", JSON.stringify(response));
      
      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // First try DeepSeek API
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
      
      // Fallback to OpenAI GPT-4o-mini
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

    // Extract detected intent and response content
    const responseContent = result.choices[0].message?.content || "";
    
    // Analyze the content for special intents (task creation, reminders, events)
    const intentAnalysis = analyzeForIntent(text, responseContent, mode);
    
    console.log("Intent analysis:", intentAnalysis);
    
    return new Response(
      JSON.stringify({
        response: responseContent,
        intent: intentAnalysis.intent,
        intentData: intentAnalysis.data,
        originalPrompt: text // Always send original prompt for reference
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
function analyzeForIntent(userText: string, aiResponse: string, mode: string) {
  const lowerText = userText.toLowerCase();
  
  // In assistant mode, we're much more likely to detect structured intents
  if (mode === 'assistant') {
    // Check for task creation intent
    if (lowerText.includes("task") || 
        lowerText.includes("to do") || 
        lowerText.includes("todo")) {
      return extractTaskData(userText, aiResponse);
    }
    
    // Check for reminder creation intent
    if (lowerText.includes("remind") || 
        lowerText.includes("reminder") || 
        lowerText.includes("don't forget")) {
      return extractReminderData(userText, aiResponse);
    }
    
    // Check for event creation intent
    if (lowerText.includes("event") || 
        lowerText.includes("appointment") || 
        lowerText.includes("schedule") ||
        lowerText.includes("meeting") ||
        lowerText.includes("calendar")) {
      return extractEventData(userText, aiResponse);
    }
  }
  
  // Check for image generation intent in any mode
  // Though this is better in creative mode
  if (lowerText.startsWith("/image") || 
      lowerText.includes("generate image") || 
      lowerText.includes("create image") ||
      lowerText.includes("draw") ||
      lowerText.includes("picture of")) {
    
    return {
      intent: "generate_image",
      data: {
        prompt: extractImagePrompt(userText)
      }
    };
  }
  
  // If no specific intent is detected
  return {
    intent: "general_chat",
    data: null
  };
}

// Extract image prompt from text
function extractImagePrompt(text: string): string {
  const lowerText = text.toLowerCase();
  
  if (lowerText.startsWith("/image")) {
    return text.substring(6).trim();
  }
  
  // Handle various image generation phrases
  const patterns = [
    "generate image of ", 
    "create image of ",
    "draw ",
    "create a picture of ",
    "make an image of ",
    "generate a picture of ",
    "show me a picture of ",
    "picture of ",
    "visualize "
  ];
  
  for (const pattern of patterns) {
    if (lowerText.includes(pattern)) {
      const startIndex = lowerText.indexOf(pattern) + pattern.length;
      return text.substring(startIndex).trim();
    }
  }
  
  // If no pattern matches, use the whole text but remove trigger words
  return text.replace(/generate image|create image|draw|picture/gi, '').trim();
}

// Extract task data from text
function extractTaskData(userText: string, aiResponse: string) {
  // Use regex to try to extract date information
  const dateRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-]?(\d{0,4})|(\d{1,2})(st|nd|rd|th)? (of )?(january|february|march|april|may|june|july|august|september|october|november|december)|tomorrow|today|next (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|this (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi;
  const dateMatch = userText.match(dateRegex);
  
  // Extract priority keywords
  const priorityRegex = /\b(high|medium|low|urgent|critical)\b priority/i;
  const priorityMatch = userText.match(priorityRegex);
  
  // Basic extraction logic - in real implementation this would be more sophisticated
  let title = userText.replace(/create task|new task|add task|make task|task/gi, "").trim();
  if (!title) title = "New task";
  
  // Try to clean up the title by removing date and priority information
  if (dateMatch) {
    dateMatch.forEach(date => {
      title = title.replace(date, "").trim();
    });
  }
  
  if (priorityMatch) {
    title = title.replace(priorityMatch[0], "").trim();
  }
  
  // Remove any multiple spaces
  title = title.replace(/\s+/g, " ").trim();
  
  return {
    intent: "create_task",
    data: {
      title: title,
      description: "",
      priority: priorityMatch ? priorityMatch[1].toLowerCase() : "medium",
      dueDate: dateMatch ? dateMatch[0] : null
    }
  };
}

// Extract reminder data from text
function extractReminderData(userText: string, aiResponse: string) {
  // Use regex to try to extract date information
  const dateRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-]?(\d{0,4})|(\d{1,2})(st|nd|rd|th)? (of )?(january|february|march|april|may|june|july|august|september|october|november|december)|tomorrow|today|next (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|this (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi;
  const dateMatch = userText.match(dateRegex);
  
  let title = userText.replace(/remind me|set reminder|create reminder|new reminder|reminder/gi, "").trim();
  if (!title) title = "New reminder";
  
  // Try to clean up the title by removing date information
  if (dateMatch) {
    dateMatch.forEach(date => {
      title = title.replace(date, "").trim();
    });
  }
  
  // Remove any multiple spaces
  title = title.replace(/\s+/g, " ").trim();
  
  return {
    intent: "create_reminder",
    data: {
      title: title,
      dueDate: dateMatch ? dateMatch[0] : null
    }
  };
}

// Extract event data from text
function extractEventData(userText: string, aiResponse: string) {
  // Use regex to try to extract date information
  const dateRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-]?(\d{0,4})|(\d{1,2})(st|nd|rd|th)? (of )?(january|february|march|april|may|june|july|august|september|october|november|december)|tomorrow|today|next (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|this (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi;
  const dateMatch = userText.match(dateRegex);
  
  // Try to extract time information
  const timeRegex = /(\d{1,2})(:)(\d{2})(\s?)(am|pm)?|(\d{1,2})(\s?)(am|pm)/gi;
  const timeMatch = userText.match(timeRegex);
  
  // Try to extract location
  const locationRegex = /at ([^,\.]+)/i;
  const locationMatch = userText.match(locationRegex);
  
  let title = userText.replace(/create event|new event|schedule event|event|meeting|appointment|schedule/gi, "").trim();
  if (!title) title = "New event";
  
  // Clean up title by removing date, time and location
  if (dateMatch) {
    dateMatch.forEach(date => {
      title = title.replace(date, "").trim();
    });
  }
  
  if (timeMatch) {
    timeMatch.forEach(time => {
      title = title.replace(time, "").trim();
    });
  }
  
  if (locationMatch) {
    title = title.replace(locationMatch[0], "").trim();
  }
  
  // Remove any multiple spaces
  title = title.replace(/\s+/g, " ").trim();
  
  return {
    intent: "create_event",
    data: {
      title: title,
      description: "",
      startTime: dateMatch ? dateMatch[0] : null,
      endTime: null,
      location: locationMatch ? locationMatch[1] : null
    }
  };
}
