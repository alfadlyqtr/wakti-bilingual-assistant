import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Instagram Webhook Edge Function
 * 
 * Handles:
 * 1. Meta webhook verification (GET with hub.challenge)
 * 2. Incoming Instagram DM events (POST)
 * 3. Routes messages to the bot engine and replies via Graph API
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_APP_SECRET = Deno.env.get("META_APP_SECRET")!;
const META_WEBHOOK_VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || "wakti_ig_verify_2026";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Verify webhook signature from Meta (X-Hub-Signature-256)
async function verifySignature(req: Request, body: string): Promise<boolean> {
  const signature = req.headers.get("x-hub-signature-256");
  if (!signature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(META_APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hexSig = "sha256=" + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return hexSig === signature;
}

// Send a message back via Instagram Graph API
async function sendIGMessage(recipientId: string, message: string, pageAccessToken: string): Promise<boolean> {
  const res = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${pageAccessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: message },
    }),
  });
  const data = await res.json();
  if (data.error) {
    console.error("Failed to send IG message:", data.error);
    return false;
  }
  return true;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ─── GET: Webhook Verification ───
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === META_WEBHOOK_VERIFY_TOKEN) {
      console.log("Webhook verified successfully");
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }

    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  // ─── POST: Incoming webhook events ───
  if (req.method === "POST") {
    const bodyText = await req.text();

    // Verify signature
    const isValid = await verifySignature(req, bodyText);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return new Response("Invalid signature", { status: 403, headers: corsHeaders });
    }

    const payload = JSON.parse(bodyText);
    console.log("Webhook payload:", JSON.stringify(payload).slice(0, 500));

    // Must respond 200 quickly to Meta (they retry on timeout)
    // Process asynchronously
    if (payload.object === "instagram") {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      for (const entry of payload.entry || []) {
        const igAccountId = entry.id; // The Instagram Business Account ID

        for (const msgEvent of entry.messaging || []) {
          const senderId = msgEvent.sender?.id;
          const messageText = msgEvent.message?.text;

          // Skip if no text message (could be attachment, read receipt, etc.)
          if (!senderId || !messageText) continue;

          // Skip echo messages (sent by our bot)
          if (msgEvent.message?.is_echo) continue;

          console.log(`IG DM from ${senderId}: ${messageText.slice(0, 100)}`);

          // Find which bot is connected to this IG account
          const { data: bot, error: botErr } = await supabase
            .from("chatbot_bots")
            .select("*")
            .eq("instagram_business_account_id", igAccountId)
            .eq("is_active", true)
            .single();

          if (botErr || !bot) {
            // Try matching by page_id as fallback
            const { data: botByPage } = await supabase
              .from("chatbot_bots")
              .select("*")
              .eq("instagram_page_id", igAccountId)
              .eq("is_active", true)
              .single();

            if (!botByPage) {
              console.warn(`No active bot found for IG account: ${igAccountId}`);
              continue;
            }

            // Use this bot
            await handleIncomingMessage(supabase, botByPage, senderId, messageText);
            continue;
          }

          await handleIncomingMessage(supabase, bot, senderId, messageText);
        }
      }
    }

    // Always respond 200 to Meta
    return new Response("EVENT_RECEIVED", { status: 200, headers: corsHeaders });
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});

// Handle an incoming DM and generate a bot reply
async function handleIncomingMessage(
  supabase: ReturnType<typeof createClient>,
  bot: Record<string, unknown>,
  senderId: string,
  messageText: string
) {
  const accessToken = bot.instagram_access_token as string;
  if (!accessToken) {
    console.error("Bot has no Instagram access token");
    return;
  }

  // Log the incoming message
  await supabase.from("chatbot_messages").insert({
    bot_id: bot.id,
    conversation_id: `ig-${senderId}`,
    role: "user",
    content: messageText,
    platform: "instagram",
    visitor_id: senderId,
  }).then(({ error }) => {
    if (error) console.error("Failed to log incoming message:", error);
  });

  // Generate bot reply
  // For now: use knowledge base + system prompt for a simple AI reply
  // Later: integrate with the full flow engine
  let reply = (bot.welcome_message as string) || "Thanks for your message! We'll get back to you shortly.";

  // If bot has a knowledge base or system prompt, try AI response
  if (bot.knowledge_base || bot.system_prompt) {
    try {
      reply = await generateAIReply(bot, messageText, senderId, supabase);
    } catch (err) {
      console.error("AI reply failed, using fallback:", err);
    }
  }

  // Send reply via Graph API
  const sent = await sendIGMessage(senderId, reply, accessToken);

  // Log the bot reply
  if (sent) {
    await supabase.from("chatbot_messages").insert({
      bot_id: bot.id,
      conversation_id: `ig-${senderId}`,
      role: "assistant",
      content: reply,
      platform: "instagram",
      visitor_id: senderId,
    }).then(({ error }) => {
      if (error) console.error("Failed to log bot reply:", error);
    });
  }
}

// Generate an AI reply using the bot's knowledge base and system prompt
async function generateAIReply(
  bot: Record<string, unknown>,
  userMessage: string,
  _senderId: string,
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  const systemPrompt = (bot.system_prompt as string) || "You are a helpful assistant.";
  const knowledgeBase = (bot.knowledge_base as string) || "";

  // Fetch recent conversation history for context
  const { data: history } = await supabase
    .from("chatbot_messages")
    .select("role, content")
    .eq("bot_id", bot.id)
    .eq("conversation_id", `ig-${_senderId}`)
    .order("created_at", { ascending: false })
    .limit(10);

  const messages = [
    {
      role: "system",
      content: `${systemPrompt}\n\nKnowledge Base:\n${knowledgeBase}\n\nYou are responding to Instagram DMs. Keep replies concise and friendly. Reply in the same language the user writes in.`,
    },
    // Add history in chronological order
    ...(history || []).reverse().map((m: Record<string, unknown>) => ({
      role: m.role as string,
      content: m.content as string,
    })),
    { role: "user", content: userMessage },
  ];

  // Use OpenAI via the existing pattern
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    return (bot.welcome_message as string) || "Thanks for reaching out! How can I help you?";
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || "Thanks for your message!";
}
