import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_APP_SECRET = Deno.env.get("META_APP_SECRET")!;
const META_WEBHOOK_VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || "wakti_ig_verify_2026";

// Sentinel: flow is done, switch to AI free-chat
const FLOW_ENDED = "__FLOW_ENDED__";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface FlowNode {
  node_id: string;
  type: string;
  label: string | null;
  data: Record<string, unknown>;
}
interface FlowEdge {
  edge_id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle: string | null;
  label: string | null;
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function nextNodeIds(currentId: string, edges: FlowEdge[], handle?: string): string[] {
  return edges
    .filter(e => e.source_node_id === currentId && (!handle || !e.source_handle || e.source_handle === handle))
    .map(e => e.target_node_id);
}
function getNode(nodeId: string, nodes: FlowNode[]): FlowNode | undefined {
  return nodes.find(n => n.node_id === nodeId);
}

// â”€â”€â”€ Signature verification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function verifySignature(req: Request, body: string): Promise<boolean> {
  const signature = req.headers.get("x-hub-signature-256");
  if (!signature) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(META_APP_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hexSig = "sha256=" + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return hexSig === signature;
}

// â”€â”€â”€ Send IG message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function sendIGMessage(recipientId: string, text: string, accessToken: string): Promise<boolean> {
  const res = await fetch(`https://graph.instagram.com/v21.0/me/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text }, access_token: accessToken }),
  });
  const data = await res.json();
  console.log("[sendIG] instagram.com:", res.status, JSON.stringify(data).slice(0, 200));
  if (!data.error) return true;

  const res2 = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${accessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  });
  const data2 = await res2.json();
  console.log("[sendIG] fb fallback:", res2.status, JSON.stringify(data2).slice(0, 200));
  return !data2.error;
}

// â”€â”€â”€ Send IG quick replies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function sendIGQuickReplies(recipientId: string, prompt: string, options: string[], accessToken: string): Promise<boolean> {
  const quickReplies = options.slice(0, 13).map(opt => ({ content_type: "text", title: opt.slice(0, 20), payload: opt }));
  const res = await fetch(`https://graph.instagram.com/v21.0/me/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: prompt, quick_replies: quickReplies },
      access_token: accessToken,
    }),
  });
  const data = await res.json();
  console.log("[sendIGQR] status:", res.status, JSON.stringify(data).slice(0, 200));
  if (!data.error) return true;
  // Fallback: numbered list
  const plainText = prompt + "\n\n" + options.map((o, i) => `${i + 1}. ${o}`).join("\n");
  return await sendIGMessage(recipientId, plainText, accessToken);
}

// â”€â”€â”€ AI reply â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function generateAIReply(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  bot: Record<string, unknown>,
  conversationId: string,
  userMessage: string,
): Promise<string> {
  const systemPrompt = (bot.system_prompt as string) || "You are a helpful assistant.";
  const knowledgeBase = (bot.knowledge_base as string) || "";

  const { data: history } = await supabase
    .from("chatbot_messages")
    .select("sender_type, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(10);

  const messages = [
    { role: "system", content: `${systemPrompt}\n\nKnowledge Base:\n${knowledgeBase}\n\nYou are responding to Instagram DMs. Keep replies concise and friendly. Reply in the same language the user writes in.` },
    ...(history || []).reverse().map((m: Record<string, unknown>) => ({ role: m.sender_type === "ai" ? "assistant" : "user", content: m.content as string })),
    { role: "user", content: userMessage },
  ];

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) return (bot.welcome_message as string) || "Thanks for reaching out!";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: "gpt-4o-mini", messages, max_tokens: 500, temperature: 0.7 }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || "Thanks for your message!";
}

// â”€â”€â”€ Process a single flow node â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Returns:
//   nextNodeId = string  â†’ auto-advance to this node (no user input needed)
//   nextNodeId = null    â†’ waiting for user input on SAME node (stay)
//   nextNodeId = FLOW_ENDED â†’ flow is completely done
async function processFlowNode(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  bot: Record<string, unknown>,
  conversationId: string,
  senderId: string,
  node: FlowNode,
  nodes: FlowNode[],
  edges: FlowEdge[],
  userMessage: string,
  collectedData: Record<string, string>,
): Promise<{ nextNodeId: string | null; waitingForInput: boolean; updatedCollectedData: Record<string, string> }> {
  const accessToken = bot.instagram_access_token as string;

  const resolveVars = (text: string) =>
    (text || "")
      .replace(/\{\{name\}\}/gi, collectedData.name || "")
      .replace(/\{\{email\}\}/gi, collectedData.email || "")
      .replace(/\{\{phone\}\}/gi, collectedData.phone || "");

  switch (node.type) {
    case "start": {
      const nexts = nextNodeIds(node.node_id, edges);
      // start has no outgoing edges = flow is empty, end immediately
      if (nexts.length === 0) return { nextNodeId: FLOW_ENDED, waitingForInput: false, updatedCollectedData: collectedData };
      return { nextNodeId: nexts[0], waitingForInput: false, updatedCollectedData: collectedData };
    }

    case "message": {
      const text = resolveVars((node.data?.text as string) || node.label || "Hello!");
      await sendIGMessage(senderId, text, accessToken);
      await supabase.from("chatbot_messages").insert({ conversation_id: conversationId, sender_type: "ai", content: text });
      const nexts = nextNodeIds(node.node_id, edges);
      // No outgoing edge = flow ends here
      return { nextNodeId: nexts.length > 0 ? nexts[0] : FLOW_ENDED, waitingForInput: false, updatedCollectedData: collectedData };
    }

    case "name":
    case "email":
    case "phone": {
      if (!userMessage) {
        // First visit: send the prompt, wait for user
        const defaultPrompt = node.type === "name" ? "What's your name?" : node.type === "email" ? "What's your email?" : "What's your phone number?";
        const prompt = resolveVars((node.data?.text as string) || (node.data?.prompt as string) || defaultPrompt);
        await sendIGMessage(senderId, prompt, accessToken);
        await supabase.from("chatbot_messages").insert({ conversation_id: conversationId, sender_type: "ai", content: prompt });
        return { nextNodeId: null, waitingForInput: true, updatedCollectedData: collectedData };
      }
      // User replied: save and advance
      const updated = { ...collectedData, [node.type]: userMessage };
      if (node.type === "name") await supabase.from("chatbot_conversations").update({ visitor_name: userMessage }).eq("id", conversationId);
      if (node.type === "email") await supabase.from("chatbot_conversations").update({ visitor_email: userMessage }).eq("id", conversationId);
      if (node.type === "phone") await supabase.from("chatbot_conversations").update({ visitor_phone: userMessage }).eq("id", conversationId);
      const nexts = nextNodeIds(node.node_id, edges);
      // No outgoing edge = flow ends here after collecting data
      return { nextNodeId: nexts.length > 0 ? nexts[0] : FLOW_ENDED, waitingForInput: false, updatedCollectedData: updated };
    }

    case "single_choice":
    case "multiple_choice": {
      const opts = (node.data?.options as Array<{ en: string; ar?: string }>) || [];
      const optLabels = opts.map(o => (typeof o === "string" ? o : o.en));

      if (!userMessage) {
        const prompt = resolveVars((node.data?.text as string) || (node.data?.prompt as string) || "Please choose an option:");
        await sendIGQuickReplies(senderId, prompt, optLabels, accessToken);
        const logged = prompt + "\n" + optLabels.map((o, i) => `${i + 1}. ${o}`).join("\n");
        await supabase.from("chatbot_messages").insert({ conversation_id: conversationId, sender_type: "ai", content: logged });
        return { nextNodeId: null, waitingForInput: true, updatedCollectedData: collectedData };
      }

      // Match user reply to an option
      const lowerMsg = userMessage.toLowerCase().trim();
      let matchedIndex = optLabels.findIndex(o => o.toLowerCase().trim() === lowerMsg);
      if (matchedIndex === -1) {
        const num = parseInt(lowerMsg, 10);
        if (!isNaN(num) && num >= 1 && num <= optLabels.length) matchedIndex = num - 1;
      }
      if (matchedIndex === -1) {
        matchedIndex = optLabels.findIndex(o => lowerMsg.includes(o.toLowerCase().trim()) || o.toLowerCase().trim().includes(lowerMsg));
      }

      if (matchedIndex >= 0) {
        const nexts = nextNodeIds(node.node_id, edges, `option-${matchedIndex}`);
        const fallback = nextNodeIds(node.node_id, edges);
        const nextId = nexts[0] || fallback[0] || null;
        return { nextNodeId: nextId || FLOW_ENDED, waitingForInput: false, updatedCollectedData: collectedData };
      } else {
        // No match â€” re-prompt
        const prompt = resolveVars((node.data?.text as string) || "Please choose one of the options:");
        await sendIGQuickReplies(senderId, prompt, optLabels, accessToken);
        await supabase.from("chatbot_messages").insert({ conversation_id: conversationId, sender_type: "ai", content: prompt });
        return { nextNodeId: null, waitingForInput: true, updatedCollectedData: collectedData };
      }
    }

    case "ai_response": {
      const instructions = (node.data?.instructions as string) || "";
      const botWithInstructions = instructions
        ? { ...bot, system_prompt: `${bot.system_prompt || ""}\n\nInstructions: ${instructions}` }
        : bot;
      const reply = await generateAIReply(supabase, botWithInstructions, conversationId, userMessage || "Hello");
      await sendIGMessage(senderId, reply, accessToken);
      await supabase.from("chatbot_messages").insert({ conversation_id: conversationId, sender_type: "ai", content: reply });
      // ai_response always stays on itself (loops intentionally â€” it's a free-chat node)
      return { nextNodeId: node.node_id, waitingForInput: true, updatedCollectedData: collectedData };
    }

    case "live_chat": {
      const text = resolveVars((node.data?.message as string) || "Connecting you to a team member...");
      await sendIGMessage(senderId, text, accessToken);
      await supabase.from("chatbot_messages").insert({ conversation_id: conversationId, sender_type: "ai", content: text });
      await supabase.from("chatbot_conversations").update({ status: "human_takeover" }).eq("id", conversationId);
      // live_chat stays open for human agent
      return { nextNodeId: node.node_id, waitingForInput: true, updatedCollectedData: collectedData };
    }

    case "appointment": {
      if (!userMessage) {
        const prompt = resolveVars((node.data?.prompt as string) || "Please provide your preferred date and time:");
        await sendIGMessage(senderId, prompt, accessToken);
        await supabase.from("chatbot_messages").insert({ conversation_id: conversationId, sender_type: "ai", content: prompt });
        return { nextNodeId: null, waitingForInput: true, updatedCollectedData: collectedData };
      }
      const nexts = nextNodeIds(node.node_id, edges);
      return { nextNodeId: nexts.length > 0 ? nexts[0] : FLOW_ENDED, waitingForInput: false, updatedCollectedData: collectedData };
    }

    case "rating": {
      if (!userMessage) {
        const prompt = resolveVars((node.data?.prompt as string) || "How would you rate your experience? (1-5)");
        await sendIGMessage(senderId, prompt, accessToken);
        await supabase.from("chatbot_messages").insert({ conversation_id: conversationId, sender_type: "ai", content: prompt });
        return { nextNodeId: null, waitingForInput: true, updatedCollectedData: collectedData };
      }
      const nexts = nextNodeIds(node.node_id, edges);
      return { nextNodeId: nexts.length > 0 ? nexts[0] : FLOW_ENDED, waitingForInput: false, updatedCollectedData: collectedData };
    }

    case "end": {
      const text = resolveVars((node.data?.text as string) || "Thank you! Have a great day. ðŸ‘‹");
      await sendIGMessage(senderId, text, accessToken);
      await supabase.from("chatbot_messages").insert({ conversation_id: conversationId, sender_type: "ai", content: text });
      await supabase.from("chatbot_conversations").update({ status: "resolved" }).eq("id", conversationId);
      return { nextNodeId: FLOW_ENDED, waitingForInput: false, updatedCollectedData: collectedData };
    }

    default: {
      const nexts = nextNodeIds(node.node_id, edges);
      return { nextNodeId: nexts.length > 0 ? nexts[0] : FLOW_ENDED, waitingForInput: false, updatedCollectedData: collectedData };
    }
  }
}

// â”€â”€â”€ Main flow runner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function runFlow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  bot: Record<string, unknown>,
  conv: Record<string, unknown>,
  nodes: FlowNode[],
  edges: FlowEdge[],
  senderId: string,
  userMessage: string,
) {
  const conversationId = conv.id as string;
  let currentNodeId = conv.current_node_id as string | null;
  const collectedData: Record<string, string> = {
    name: (conv.visitor_name as string) || "",
    email: (conv.visitor_email as string) || "",
    phone: (conv.visitor_phone as string) || "",
  };

  // Log user message
  await supabase.from("chatbot_messages").insert({ conversation_id: conversationId, sender_type: "visitor", content: userMessage });
  await supabase.from("chatbot_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);

  // â”€â”€â”€ CASE 1: Flow already ended â€” switch to free AI chat â”€â”€â”€
  if (currentNodeId === FLOW_ENDED) {
    console.log("[flow] Flow ended, using free AI chat");
    const accessToken = bot.instagram_access_token as string;
    if (bot.knowledge_base || bot.system_prompt) {
      try {
        const reply = await generateAIReply(supabase, bot, conversationId, userMessage);
        await sendIGMessage(senderId, reply, accessToken);
        await supabase.from("chatbot_messages").insert({ conversation_id: conversationId, sender_type: "ai", content: reply });
      } catch (err) {
        console.error("[flow] AI reply error:", err);
      }
    }
    return;
  }

  // â”€â”€â”€ CASE 2: No current node â€” start the flow from scratch â”€â”€â”€
  if (!currentNodeId) {
    if (nodes.length === 0) {
      // No flow at all â€” pure AI mode
      console.log("[flow] No flow nodes, pure AI mode");
      const accessToken = bot.instagram_access_token as string;
      const reply = await generateAIReply(supabase, bot, conversationId, userMessage);
      await sendIGMessage(senderId, reply, accessToken);
      await supabase.from("chatbot_messages").insert({ conversation_id: conversationId, sender_type: "ai", content: reply });
      return;
    }
    const startNode = nodes.find(n => n.type === "start");
    if (startNode) {
      const nexts = nextNodeIds(startNode.node_id, edges);
      currentNodeId = nexts[0] || null;
      console.log("[flow] Starting flow, first real node:", currentNodeId);
    }
    if (!currentNodeId) {
      console.log("[flow] No start node or no edges from start");
      return;
    }
  }

  // â”€â”€â”€ CASE 3: Has a current node â€” run flow â”€â”€â”€
  let nodeId: string | null = currentNodeId;
  let msgToProcess = userMessage; // Pass user's message to the current node
  let updatedData = { ...collectedData };
  let iterations = 0;

  while (nodeId && nodeId !== FLOW_ENDED && iterations < 20) {
    iterations++;
    const node = getNode(nodeId, nodes);
    if (!node) {
      console.log("[flow] Node not found:", nodeId, "â€” ending flow");
      nodeId = FLOW_ENDED;
      break;
    }

    console.log(`[flow] Node: ${nodeId} (${node.type}) | msg: "${msgToProcess.slice(0, 50)}"`);

    const result = await processFlowNode(
      supabase, bot, conversationId, senderId,
      node, nodes, edges,
      msgToProcess, updatedData,
    );

    updatedData = result.updatedCollectedData;
    console.log(`[flow] â†’ next: ${result.nextNodeId} | waiting: ${result.waitingForInput}`);

    if (result.nextNodeId === FLOW_ENDED) {
      // Flow completed â€” save FLOW_ENDED so next messages go to free AI
      await supabase.from("chatbot_conversations")
        .update({ current_node_id: FLOW_ENDED, last_message_at: new Date().toISOString() })
        .eq("id", conversationId);
      console.log("[flow] Flow complete, saved FLOW_ENDED");
      return;
    }

    if (result.waitingForInput || result.nextNodeId === null) {
      // Waiting for user input â€” save position on SAME node so next message continues here
      const saveNodeId = result.nextNodeId === null ? nodeId : result.nextNodeId;
      await supabase.from("chatbot_conversations")
        .update({ current_node_id: saveNodeId, last_message_at: new Date().toISOString() })
        .eq("id", conversationId);
      console.log("[flow] Waiting for input, saved node:", saveNodeId);
      return;
    }

    // Auto-advance: move to next node, no user message needed
    nodeId = result.nextNodeId;
    msgToProcess = ""; // No user message for auto-advance
  }

  // If we exited the loop without ending cleanly, save where we are
  if (nodeId && nodeId !== FLOW_ENDED) {
    await supabase.from("chatbot_conversations")
      .update({ current_node_id: nodeId, last_message_at: new Date().toISOString() })
      .eq("id", conversationId);
  }
}

// â”€â”€â”€ HTTP Handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === META_WEBHOOK_VERIFY_TOKEN) return new Response(challenge, { status: 200, headers: corsHeaders });
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  if (req.method === "POST") {
    const bodyText = await req.text();
    if (!await verifySignature(req, bodyText)) {
      console.error("[webhook] Invalid signature");
      return new Response("Invalid signature", { status: 403, headers: corsHeaders });
    }

    let payload: Record<string, unknown>;
    try { payload = JSON.parse(bodyText); }
    catch { return new Response("EVENT_RECEIVED", { status: 200, headers: corsHeaders }); }

    if (payload.object === "instagram") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) as any;

      for (const entry of (payload.entry as Record<string, unknown>[]) || []) {
        const igAccountId = String(entry.id);

        for (const msgEvent of (entry.messaging as Record<string, unknown>[]) || []) {
          const sender = msgEvent.sender as Record<string, unknown>;
          const messageObj = msgEvent.message as Record<string, unknown>;
          const senderId = String(sender?.id || "");
          const messageText = (messageObj?.text as string) || "";

          if (!senderId || !messageText || messageObj?.is_echo) continue;
          console.log(`[webhook] DM: ${senderId} â†’ "${messageText.slice(0, 80)}"`);

          // Find bot
          let bot = null;
          const { data: b1 } = await supabase.from("chatbot_bots").select("*").eq("instagram_business_account_id", igAccountId).eq("is_active", true).single();
          if (b1) bot = b1;
          if (!bot) { const { data: b2 } = await supabase.from("chatbot_bots").select("*").eq("instagram_page_id", igAccountId).eq("is_active", true).single(); if (b2) bot = b2; }
          if (!bot) { const { data: b3 } = await supabase.from("chatbot_bots").select("*").not("instagram_page_id", "is", null).eq("is_active", true).limit(1).single(); if (b3) { console.log("[webhook] fallback bot"); bot = b3; } }
          if (!bot) { console.warn("[webhook] No bot for", igAccountId); continue; }

          // Load flow
          const [nodesRes, edgesRes] = await Promise.all([
            supabase.from("chatbot_flow_nodes").select("*").eq("bot_id", bot.id),
            supabase.from("chatbot_flow_edges").select("*").eq("bot_id", bot.id),
          ]);
          const nodes: FlowNode[] = nodesRes.data || [];
          const edges: FlowEdge[] = edgesRes.data || [];

          // Find or create conversation (only reuse open/active ones, not resolved)
          let conv = null;
          const { data: existingConv } = await supabase
            .from("chatbot_conversations")
            .select("*")
            .eq("bot_id", bot.id)
            .eq("platform", "instagram")
            .eq("instagram_sender_id", senderId)
            .not("status", "eq", "resolved")
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingConv) {
            conv = existingConv;
          } else {
            const { data: newConv, error: convErr } = await supabase
              .from("chatbot_conversations")
              .insert({
                bot_id: bot.id, platform: "instagram", visitor_name: null, instagram_sender_id: senderId,
                visitor_meta: { instagram_sender_id: senderId }, status: "ai_handling",
                current_node_id: null, started_at: new Date().toISOString(), last_message_at: new Date().toISOString(),
              })
              .select("*").single();
            if (convErr) { console.error("[webhook] Conv error:", convErr); continue; }
            conv = newConv;
          }

          await runFlow(supabase, bot, conv, nodes, edges, senderId, messageText);
        }
      }
    }

    return new Response("EVENT_RECEIVED", { status: 200, headers: corsHeaders });
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});

