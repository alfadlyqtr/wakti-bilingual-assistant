// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2, Bot, CheckCircle2, Star, ChevronLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { NODE_TYPE_META, FlowNodeType } from '@/services/chatbotService';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface BotConfig {
  id: string;
  name: string;
  welcome_message: string;
  primary_color: string;
  knowledge_base: string | null;
  system_prompt: string | null;
  embed_token: string;
}

interface FlowNode {
  node_id: string;
  type: FlowNodeType;
  label: string | null;
  data: Record<string, any>;
}

interface FlowEdge {
  edge_id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle: string | null;
  label: string | null;
}

interface Message {
  id: string;
  role: 'bot' | 'user';
  text: string;
  choices?: { label: string; nextNodeId?: string; handle?: string }[];
  inputType?: 'text' | 'email' | 'phone' | 'name' | 'rating';
  isTyping?: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function nextNodes(currentId: string, edges: FlowEdge[], handle?: string): string[] {
  return edges
    .filter(e => e.source_node_id === currentId && (!handle || !e.source_handle || e.source_handle === handle))
    .map(e => e.target_node_id);
}

function getNode(nodeId: string, nodes: FlowNode[]): FlowNode | undefined {
  return nodes.find(n => n.node_id === nodeId);
}

function uid() { return Math.random().toString(36).slice(2); }

// ─── AI call via Supabase function ─────────────────────────────────────────────
async function callAI(userMessage: string, botConfig: BotConfig, history: Message[]): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('chatbot-ai-reply', {
      body: {
        message: userMessage,
        botId: botConfig.id,
        systemPrompt: botConfig.system_prompt || '',
        knowledgeBase: botConfig.knowledge_base || '',
        history: history.slice(-10).map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.text })),
      },
    });
    if (error) throw error;
    return data?.reply || "I'm here to help! Could you tell me more?";
  } catch {
    return "I'm here to help! Could you tell me more?";
  }
}

// ─── Main Widget Component ─────────────────────────────────────────────────────
interface Props {
  token: string;
  onClose?: () => void;
  isPreview?: boolean;
  previewNodes?: FlowNode[];
  previewEdges?: FlowEdge[];
  previewBot?: BotConfig;
}

export default function ChatbotWidget({ token, onClose, isPreview, previewNodes, previewEdges, previewBot }: Props) {
  const [bot, setBot] = useState<BotConfig | null>(previewBot || null);
  const [nodes, setNodes] = useState<FlowNode[]>(previewNodes || []);
  const [edges, setEdges] = useState<FlowEdge[]>(previewEdges || []);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [inputType, setInputType] = useState<Message['inputType']>('text');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isPreview);
  const [rating, setRating] = useState(0);
  const [finished, setFinished] = useState(false);
  const [collectedData, setCollectedData] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasStartedRef = useRef(false);

  // ── Load bot + flow ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isPreview && previewBot && previewNodes && previewEdges) {
      setBot(previewBot);
      setNodes(previewNodes);
      setEdges(previewEdges);
      return;
    }
    if (!token) return;
    loadBot();
  }, [token]);

  const loadBot = async () => {
    setLoading(true);
    try {
      const { data: botData } = await (supabase
        .from('chatbot_bots' as any)
        .select('*')
        .eq('embed_token', token)
        .eq('is_active', true)
        .single() as any);

      if (!botData) { setLoading(false); return; }
      setBot(botData);

      const [nodesRes, edgesRes] = await Promise.all([
        supabase.from('chatbot_flow_nodes' as any).select('*').eq('bot_id', botData.id) as any,
        supabase.from('chatbot_flow_edges' as any).select('*').eq('bot_id', botData.id) as any,
      ]);
      setNodes((nodesRes.data || []) as FlowNode[]);
      setEdges((edgesRes.data || []) as FlowEdge[]);
    } catch (err) {
      console.error('Failed to load bot:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Start conversation once flow loaded (run only once) ────────────────────
  useEffect(() => {
    if (bot && nodes.length > 0 && !hasStartedRef.current) {
      hasStartedRef.current = true;
      startFlow();
    }
  }, [bot, nodes, edges]);

  const startFlow = useCallback(async () => {
    if (!bot) return;
    setMessages([]);
    setFinished(false);
    setCollectedData({});

    // Create conversation record
    if (!isPreview && bot.id) {
      try {
        const { data: conv } = await (supabase
          .from('chatbot_conversations' as any)
          .insert({ bot_id: bot.id, platform: 'website', status: 'ai_handling' })
          .select()
          .single() as any);
        if (conv) setConversationId(conv.id);
      } catch { /* ok */ }
    }

    const startNode = nodes.find(n => n.type === 'start');
    if (startNode) {
      const nexts = nextNodes(startNode.node_id, edges);
      if (nexts.length > 0) {
        await processNode(nexts[0], nodes, edges, [], bot);
      }
    }
  }, [bot, nodes, edges, isPreview]);

  // ── Process a flow node ──────────────────────────────────────────────────────
  const processNode = async (
    nodeId: string,
    allNodes: FlowNode[],
    allEdges: FlowEdge[],
    currentMessages: Message[],
    botConfig: BotConfig,
  ) => {
    const node = getNode(nodeId, allNodes);
    if (!node) return;

    setCurrentNodeId(nodeId);

    // Add typing indicator
    const typingId = uid();
    setMessages(prev => [...prev, { id: typingId, role: 'bot', text: '', isTyping: true }]);
    await new Promise(r => setTimeout(r, 600 + Math.random() * 400));

    switch (node.type) {
      case 'message': {
        const text = node.data?.text || node.label || 'Hello!';
        const msg: Message = { id: uid(), role: 'bot', text };
        setMessages(prev => prev.filter(m => m.id !== typingId).concat(msg));
        const nexts = nextNodes(nodeId, allEdges);
        if (nexts.length > 0) {
          await processNode(nexts[0], allNodes, allEdges, [...currentMessages, msg], botConfig);
        } else {
          setFinished(true);
        }
        break;
      }

      case 'name':
      case 'email':
      case 'phone': {
        const prompt = node.data?.prompt || (
          node.type === 'name' ? "What's your name?" :
          node.type === 'email' ? "What's your email?" :
          "What's your phone number?"
        );
        const msg: Message = { id: uid(), role: 'bot', text: prompt, inputType: node.type };
        setMessages(prev => prev.filter(m => m.id !== typingId).concat(msg));
        setInputType(node.type as any);
        setWaitingForInput(true);
        break;
      }

      case 'single_choice':
      case 'multiple_choice': {
        const prompt = node.data?.prompt || 'Please choose an option:';
        const opts = (node.data?.options || []) as Array<{ en: string; ar?: string }>;
        const choices = opts.map((opt, i) => {
          const nexts = nextNodes(nodeId, allEdges, `option-${i}`);
          const fallback = nextNodes(nodeId, allEdges);
          return {
            label: typeof opt === 'string' ? opt : opt.en,
            nextNodeId: (nexts.length > 0 ? nexts[0] : fallback[0]) || undefined,
            handle: `option-${i}`,
          };
        });
        const msg: Message = { id: uid(), role: 'bot', text: prompt, choices };
        setMessages(prev => prev.filter(m => m.id !== typingId).concat(msg));
        setWaitingForInput(false);
        break;
      }

      case 'ai_response': {
        // Remove typing indicator
        setMessages(prev => prev.filter(m => m.id !== typingId));
        const lastUserMsg = [...currentMessages].reverse().find(m => m.role === 'user')?.text || '';

        // If no user message yet (first time reaching this node), just wait for input
        if (!lastUserMsg) {
          setInputType('text');
          setWaitingForInput(true);
          break;
        }

        // Otherwise call AI with user's message
        const instructions = node.data?.instructions || '';
        const systemForNode = instructions
          ? `${botConfig.system_prompt || ''}\n\nInstructions: ${instructions}`
          : botConfig.system_prompt || '';
        const tempBot = { ...botConfig, system_prompt: systemForNode };

        const replyText = await callAI(lastUserMsg, tempBot, currentMessages);
        const msg: Message = { id: uid(), role: 'bot', text: replyText };
        setMessages(prev => [...prev, msg]);
        setInputType('text');
        setWaitingForInput(true);

        // Save AI msg
        if (conversationId) {
          await (supabase.from('chatbot_messages' as any).insert({ conversation_id: conversationId, sender_type: 'ai', content: replyText }) as any);
        }
        break;
      }

      case 'rating': {
        const msg: Message = { id: uid(), role: 'bot', text: node.data?.prompt || 'How would you rate your experience?', inputType: 'rating' };
        setMessages(prev => prev.filter(m => m.id !== typingId).concat(msg));
        setWaitingForInput(true);
        break;
      }

      case 'live_chat': {
        const text = node.data?.message || 'Connecting you to a team member...';
        const msg: Message = { id: uid(), role: 'bot', text };
        setMessages(prev => prev.filter(m => m.id !== typingId).concat(msg));
        if (conversationId) {
          await (supabase.from('chatbot_conversations' as any).update({ status: 'human_takeover' }).eq('id', conversationId) as any);
        }
        setWaitingForInput(true);
        break;
      }

      case 'appointment': {
        const msg: Message = { id: uid(), role: 'bot', text: node.data?.prompt || 'Please provide your preferred date and time (e.g. March 5, 2pm):' };
        setMessages(prev => prev.filter(m => m.id !== typingId).concat(msg));
        setInputType('text');
        setWaitingForInput(true);
        break;
      }

      case 'end': {
        const text = node.data?.text || 'Thank you! Have a great day. 👋';
        const msg: Message = { id: uid(), role: 'bot', text };
        setMessages(prev => prev.filter(m => m.id !== typingId).concat(msg));
        setFinished(true);
        if (conversationId) {
          await (supabase.from('chatbot_conversations' as any).update({ status: 'resolved' }).eq('id', conversationId) as any);
        }
        break;
      }

      default: {
        setMessages(prev => prev.filter(m => m.id !== typingId));
        const nexts = nextNodes(nodeId, allEdges);
        if (nexts.length > 0) {
          await processNode(nexts[0], allNodes, allEdges, currentMessages, botConfig);
        }
      }
    }
  };

  // ── Handle user text input ───────────────────────────────────────────────────
  const handleSend = async () => {
    if (!inputValue.trim() || !bot || !currentNodeId) return;
    const text = inputValue.trim();
    setInputValue('');
    setWaitingForInput(false);

    const userMsg: Message = { id: uid(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);

    // Save to DB
    if (conversationId) {
      await (supabase.from('chatbot_messages' as any).insert({ conversation_id: conversationId, sender_type: 'visitor', content: text }) as any);
    }

    const currentNode = getNode(currentNodeId, nodes);
    if (!currentNode) return;

    // Update collected data for info-collection nodes
    if (['name', 'email', 'phone'].includes(currentNode.type)) {
      setCollectedData(prev => ({ ...prev, [currentNode.type]: text }));
      if (currentNode.type === 'email' && conversationId) {
        await (supabase.from('chatbot_conversations' as any).update({ visitor_email: text }).eq('id', conversationId) as any);
      }
      if (currentNode.type === 'name' && conversationId) {
        await (supabase.from('chatbot_conversations' as any).update({ visitor_name: text }).eq('id', conversationId) as any);
      }
      if (currentNode.type === 'phone' && conversationId) {
        await (supabase.from('chatbot_conversations' as any).update({ visitor_phone: text }).eq('id', conversationId) as any);
      }
    }

    const nexts = nextNodes(currentNodeId, edges);

    // AI response node: if no outgoing edge, loop — keep the AI responding
    if (currentNode.type === 'ai_response' && nexts.length === 0) {
      const allMsgs = [...messages, userMsg];
      // Show typing
      const typingId = uid();
      setMessages(prev => [...prev, { id: typingId, role: 'bot', text: '', isTyping: true }]);
      await new Promise(r => setTimeout(r, 600));
      const instructions = currentNode.data?.instructions || '';
      const systemForNode = instructions
        ? `${bot.system_prompt || ''}\n\nInstructions: ${instructions}`
        : bot.system_prompt || '';
      const tempBot = { ...bot, system_prompt: systemForNode };
      const replyText = await callAI(text, tempBot, allMsgs);
      const aiMsg: Message = { id: uid(), role: 'bot', text: replyText };
      setMessages(prev => prev.filter(m => m.id !== typingId).concat(aiMsg));
      setWaitingForInput(true);
      if (conversationId) {
        await (supabase.from('chatbot_messages' as any).insert({ conversation_id: conversationId, sender_type: 'ai', content: replyText }) as any);
      }
      return;
    }

    // live_chat node: human agent handles it — just echo the message, stay open
    if (currentNode.type === 'live_chat' && nexts.length === 0) {
      setWaitingForInput(true);
      return;
    }

    if (nexts.length > 0) {
      const allMsgs = messages.concat(userMsg);
      await processNode(nexts[0], nodes, edges, allMsgs, bot);
    } else {
      // Only end if we truly have nowhere to go and it's not a looping node
      if (!['ai_response', 'live_chat'].includes(currentNode.type)) {
        setFinished(true);
      } else {
        setWaitingForInput(true);
      }
    }
  };

  // ── Handle choice selection ──────────────────────────────────────────────────
  const handleChoice = async (choiceLabel: string, nextNodeId?: string) => {
    if (!bot) return;
    const userMsg: Message = { id: uid(), role: 'user', text: choiceLabel };
    setMessages(prev => {
      const withoutChoices = prev.map(m => ({ ...m, choices: undefined }));
      return [...withoutChoices, userMsg];
    });

    if (conversationId) {
      await (supabase.from('chatbot_messages' as any).insert({ conversation_id: conversationId, sender_type: 'visitor', content: choiceLabel }) as any);
    }

    if (nextNodeId) {
      const allMsgs = messages.concat(userMsg);
      await processNode(nextNodeId, nodes, edges, allMsgs, bot);
    } else {
      setFinished(true);
    }
  };

  // ── Handle star rating ───────────────────────────────────────────────────────
  const handleRating = async (stars: number) => {
    if (!bot || !currentNodeId) return;
    setRating(stars);
    const userMsg: Message = { id: uid(), role: 'user', text: '⭐'.repeat(stars) + ` (${stars}/5)` };
    setMessages(prev => [...prev, userMsg]);
    setWaitingForInput(false);

    const nexts = nextNodes(currentNodeId, edges);
    if (nexts.length > 0) {
      await processNode(nexts[0], nodes, edges, [...messages, userMsg], bot);
    } else {
      setFinished(true);
    }
  };

  // ── Auto scroll ──────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (waitingForInput) setTimeout(() => inputRef.current?.focus(), 100);
  }, [messages, waitingForInput]);

  const accentColor = bot?.primary_color || '#060541';

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: accentColor }} />
        <p className="text-sm text-muted-foreground">Loading bot...</p>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-3 px-6 text-center">
        <Bot className="h-12 w-12 text-muted-foreground/30" />
        <p className="font-semibold text-foreground">Bot not found</p>
        <p className="text-sm text-muted-foreground">This bot may be inactive or the link is incorrect.</p>
      </div>
    );
  }

  // Determine current node's inputType for placeholder
  const currentNode = currentNodeId ? getNode(currentNodeId, nodes) : null;
  const showRating = waitingForInput && currentNode?.type === 'rating';
  const showTextInput = waitingForInput && currentNode?.type !== 'rating';
  const placeholder =
    currentNode?.type === 'email' ? 'your@email.com' :
    currentNode?.type === 'phone' ? '+1 234 567 8900' :
    currentNode?.type === 'name' ? 'Your name...' :
    'Type your message...';

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0 shadow-sm"
        style={{ background: accentColor }}
      >
        {onClose && (
          <button onClick={onClose} title="Close" className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors mr-1">
            <ChevronLeft className="h-4 w-4 text-white" />
          </button>
        )}
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg shrink-0">
          🤖
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm truncate">{bot.name}</p>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-white/70 text-[10px]">Online now</p>
          </div>
        </div>
        {isPreview && (
          <span className="text-[9px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
            Preview
          </span>
        )}
      </div>

      {/* ── Messages ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {messages.map(msg => (
          <div key={msg.id}>
            {/* Bot message */}
            {msg.role === 'bot' && (
              <div className="flex items-end gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 mb-1"
                  style={{ background: accentColor }}
                >
                  🤖
                </div>
                <div className="max-w-[80%] space-y-2">
                  {msg.isTyping ? (
                    <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3">
                      <div className="flex gap-1 items-center h-4">
                        {[0, 1, 2].map(i => (
                          <div
                            key={i}
                            className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm">
                        <p className="text-sm text-zinc-800 dark:text-zinc-100 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      </div>

                      {/* Choice buttons */}
                      {msg.choices && msg.choices.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {msg.choices.map((c, i) => (
                            <button
                              key={i}
                              onClick={() => handleChoice(c.label, c.nextNodeId)}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all active:scale-95 hover:opacity-80"
                              style={{ borderColor: accentColor, color: accentColor }}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Rating */}
                      {msg.inputType === 'rating' && (
                        <div className="flex gap-1 mt-1">
                          {[1, 2, 3, 4, 5].map(s => (
                            <button
                              key={s}
                              onClick={() => handleRating(s)}
                              title={`Rate ${s} star${s > 1 ? 's' : ''}`}
                              className="p-1 transition-transform active:scale-110"
                            >
                              <Star
                                className="h-7 w-7 transition-colors"
                                fill={s <= rating ? accentColor : 'none'}
                                stroke={accentColor}
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* User message */}
            {msg.role === 'user' && (
              <div className="flex justify-end">
                <div
                  className="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-br-sm shadow-sm"
                  style={{ background: accentColor }}
                >
                  <p className="text-sm text-white leading-relaxed">{msg.text}</p>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Finished state */}
        {finished && (
          <div className="flex flex-col items-center py-4 gap-2">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: accentColor + '20' }}
            >
              <CheckCircle2 className="h-5 w-5" style={{ color: accentColor }} />
            </div>
            <p className="text-xs text-muted-foreground">Conversation ended</p>
            {isPreview && (
              <button
                onClick={() => { hasStartedRef.current = false; setMessages([]); setFinished(false); setCurrentNodeId(null); setWaitingForInput(false); setTimeout(() => startFlow(), 50); }}
                className="text-xs font-semibold underline mt-1"
                style={{ color: accentColor }}
              >
                Restart preview
              </button>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ──────────────────────────────────────────────── */}
      {!finished && (
        <div className="shrink-0 border-t border-zinc-100 dark:border-zinc-800">
          {showTextInput && (
            <div className="flex items-center gap-2 px-3 py-2.5">
              <input
                ref={inputRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder={placeholder}
                type={currentNode?.type === 'email' ? 'email' : currentNode?.type === 'phone' ? 'tel' : 'text'}
                className="flex-1 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-2 outline-none text-foreground placeholder:text-muted-foreground"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                title="Send"
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-95 disabled:opacity-40"
                style={{ background: accentColor }}
              >
                <Send className="h-4 w-4 text-white" />
              </button>
            </div>
          )}
          {!showTextInput && !showRating && !finished && (
            <div className="flex items-center justify-center py-2.5 px-3">
              <p className="text-[10px] text-muted-foreground">Select an option above to continue</p>
            </div>
          )}
          {/* Powered by */}
          <div className="text-center pb-2">
            <p className="text-[9px] text-zinc-400">
              Powered by <span className="font-bold text-zinc-500">Wakti AI</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
