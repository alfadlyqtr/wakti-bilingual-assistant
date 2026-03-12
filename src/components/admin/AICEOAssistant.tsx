import { useState, useRef, useEffect } from "react";
import { Brain, Send, Loader2, Sparkles, ChevronDown, AlertCircle } from "lucide-react";
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
      {/* ── Floating Trigger Button ── */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Open CEO AI Assistant"
        className={`
          relative w-9 h-9 rounded-full flex items-center justify-center
          border transition-all duration-300
          ${isOpen
            ? "bg-cyan-500/20 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.4)]"
            : "bg-[#0e1119] border-white/15 hover:border-cyan-500/40 hover:shadow-[0_0_16px_rgba(6,182,212,0.2)]"
          }
        `}
      >
        <Brain className={`h-4 w-4 transition-colors ${isOpen ? "text-cyan-400" : "text-white/50"}`} />
        {/* Pulse dot: cyan normally, white/silver when fetching data */}
        <span
          className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full animate-pulse transition-colors duration-500 ${
            isFetching ? "bg-white/70" : "bg-cyan-400"
          }`}
        />
      </button>

      {/* ── Panel ── */}
      {isOpen && (
        <div
          className="
            fixed bottom-24 right-4 z-[200]
            w-[calc(100vw-2rem)] sm:w-[380px]
            flex flex-col
            rounded-2xl border border-cyan-500/20 bg-[#080b10]
            shadow-[0_0_60px_rgba(6,182,212,0.12),0_8px_40px_rgba(0,0,0,0.7)]
            overflow-hidden
          "
          style={{ maxHeight: "70vh" }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-[#0a0e18] flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/15 flex items-center justify-center flex-shrink-0">
              <Brain className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-none">CEO Command Shell</p>
              <p className="text-[10px] text-cyan-400/60 mt-0.5 flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5" />
                {isFetching ? "Querying database…" : "AI · Strategic Intelligence"}
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close assistant"
              className="text-white/25 hover:text-white/60 transition-colors"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`
                    max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap
                    ${msg.role === "user"
                      ? "bg-cyan-500/15 border border-cyan-500/20 text-cyan-50"
                      : msg.isError
                        ? "bg-red-500/10 border border-red-500/20 text-red-300"
                        : "bg-[#0c1828] border border-white/5 text-white/75"
                    }
                  `}
                >
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1.5 mb-1">
                      {msg.isError
                        ? <AlertCircle className="h-2.5 w-2.5 text-red-400/60" />
                        : <Brain className="h-2.5 w-2.5 text-cyan-400/60" />
                      }
                      <span className={`text-[9px] uppercase tracking-widest ${msg.isError ? "text-red-400/50" : "text-cyan-400/50"}`}>
                        {msg.isError ? "System" : "Wakti Intelligence"}
                      </span>
                    </div>
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

          {/* Input */}
          <div className="px-3 py-3 border-t border-white/5 bg-[#0a0e18] flex-shrink-0">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0e1520] px-3 py-2 focus-within:border-cyan-500/40 transition-colors">
              <Brain className="h-3.5 w-3.5 text-cyan-400/40 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about growth, revenue, churn…"
                disabled={isThinking}
                className="flex-1 bg-transparent text-sm text-white placeholder-white/20 outline-none disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isThinking}
                aria-label="Send message"
                className="flex-shrink-0 w-7 h-7 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 flex items-center justify-center transition-colors disabled:opacity-30"
              >
                {isThinking ? (
                  <Loader2 className="h-3.5 w-3.5 text-cyan-400 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5 text-cyan-400" />
                )}
              </button>
            </div>
            <p className="text-[9px] text-white/15 text-center mt-1.5">
              Press Enter · Follow-up questions supported
            </p>
          </div>
        </div>
      )}
    </>
  );
}
