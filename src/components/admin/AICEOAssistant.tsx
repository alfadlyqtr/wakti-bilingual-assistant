import { useState, useRef, useEffect } from "react";
import { Brain, Send, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
  ts: Date;
}

// Chat history format Gemini expects
interface GeminiPart {
  text: string;
}
interface GeminiHistoryEntry {
  role: string;
  parts: GeminiPart[];
}

const THINKING_DOTS = ["·", "· ·", "· · ·"];

function ThinkingAnimation({ isFetching }: { isFetching: boolean }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setFrame((f) => (f + 1) % THINKING_DOTS.length), 450);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0c1828] border border-cyan-500/15 w-fit">
      <span
        className={`w-2 h-2 rounded-full animate-pulse transition-colors duration-500 ${
          isFetching ? "bg-white/60" : "bg-cyan-400"
        }`}
      />
      <span className="text-cyan-300/70 text-sm font-mono tracking-widest">
        {isFetching ? "Querying data" : "Thinking"}{THINKING_DOTS[frame]}
      </span>
    </div>
  );
}

export function AICEOAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Neural link active. Ask me about growth, revenue, churn, or look up any user.",
      ts: new Date(),
    },
  ]);
  // Gemini-format chat history (excludes the welcome message)
  const [geminiHistory, setGeminiHistory] = useState<GeminiHistoryEntry[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        inputRef.current?.focus();
      }, 80);
    }
  }, [isOpen, messages.length]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isThinking) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      ts: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsThinking(true);
    setIsFetching(false);

    // Brief delay then mark as "fetching data" (tool calling phase)
    const fetchTimer = setTimeout(() => setIsFetching(true), 800);

    try {
      const { data, error } = await supabase.functions.invoke("wakti-ceo-brain", {
        body: {
          message: text,
          history: geminiHistory,
        },
      });

      clearTimeout(fetchTimer);

      if (error) {
        const errMsg: Message = {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "The Brain is offline. Could not reach the intelligence engine. Check Supabase function logs.",
          isError: true,
          ts: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } else if (data?.error) {
        const errMsg: Message = {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `Access denied: ${data.error}`,
          isError: true,
          ts: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } else {
        const reply = data?.reply ?? "No response received.";
        const assistantMsg: Message = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: reply,
          ts: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);

        // Update Gemini history for follow-up questions
        setGeminiHistory((prev) => [
          ...prev,
          { role: "user", parts: [{ text }] },
          { role: "model", parts: [{ text: reply }] },
        ]);
      }
    } catch (err) {
      clearTimeout(fetchTimer);
      const errMsg: Message = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "Brain offline — network error. Please try again.",
        isError: true,
        ts: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsThinking(false);
      setIsFetching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Trigger pill button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        aria-label="CEO Brain"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
          isOpen
            ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
            : "bg-[#0e1119] border-white/20 text-white/70 hover:border-cyan-400/50 hover:text-cyan-300"
        }`}
      >
        <Brain className="h-3.5 w-3.5" />
        <span>CEO Brain</span>
        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
          isFetching ? "bg-white/60" : "bg-cyan-400"
        }`} />
      </button>

      {/* Modal */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[199] bg-black/60"
            onClick={() => setIsOpen(false)}
          />

          {/* Dialog box — absolute dead center */}
          <div className="fixed inset-0 z-[200] pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md max-h-[80vh] flex flex-col rounded-2xl overflow-hidden border border-cyan-500/30 bg-[#0d1117] shadow-2xl pointer-events-auto">

              {/* Header */}
              <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#080b10]">
                <Brain className="h-5 w-5 text-cyan-400" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">CEO Brain</p>
                  <p className="text-[10px] text-cyan-400/60">
                    {isFetching ? "Querying data…" : "AI · Strategic Intelligence"}
                  </p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Messages — scrollable middle */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}>
                    <div className={`max-w-[85%] rounded-xl px-3 py-2.5 text-sm leading-relaxed border ${msg.role === "user" ? "bg-cyan-600/20 border-cyan-500/30 text-cyan-100" : msg.isError ? "bg-red-500/15 border-red-500/30 text-red-200" : "bg-[#1a2332] border-white/10 text-white/90"}`}>
                      {msg.role === "assistant" && !msg.isError && (
                        <p className="text-[10px] text-cyan-400/70 font-semibold uppercase tracking-wider mb-1">Wakti Brain</p>
                      )}
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isThinking && (
                  <div className="flex justify-start">
                    <ThinkingAnimation isFetching={isFetching} />
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input — pinned to bottom */}
              <div className="flex-shrink-0 px-4 py-3 border-t border-white/10 bg-[#080b10]">
                <div className="flex items-center gap-2 bg-[#0e1520] border border-white/10 rounded-xl px-3 py-2 focus-within:border-cyan-500/40 transition-colors">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about users, revenue, growth…"
                    disabled={isThinking}
                    className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isThinking}
                    className="w-7 h-7 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 flex items-center justify-center transition-colors disabled:opacity-30"
                  >
                    {isThinking
                      ? <Loader2 className="h-3.5 w-3.5 text-cyan-400 animate-spin" />
                      : <Send className="h-3.5 w-3.5 text-cyan-400" />
                    }
                  </button>
                </div>
              </div>

            </div>
          </div>
        </>
      )}
    </>
  );
}
