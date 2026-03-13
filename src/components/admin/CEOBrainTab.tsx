import { useState, useEffect, useRef } from "react";
import { Brain, RefreshCw, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface BrainMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
}

type GeminiEntry = { role: string; parts: Array<{ text: string }> };

const DOTS = ["·", "· ·", "· · ·"];

export function CEOBrainTab() {
  const [messages, setMessages] = useState<BrainMsg[]>([
    { id: "welcome", role: "assistant", content: "Neural link active. Ask me about growth, revenue, churn, or look up any user." },
  ]);
  const [history, setHistory] = useState<GeminiEntry[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [frame, setFrame] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setInterval(() => setFrame((f) => (f + 1) % 3), 450);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isThinking) return;

    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: text }]);
    setInput("");
    setIsThinking(true);
    setIsFetching(false);

    const fetchTimer = setTimeout(() => setIsFetching(true), 800);

    try {
      const { data, error } = await supabase.functions.invoke("wakti-ceo-brain", {
        body: { message: text, history },
      });
      clearTimeout(fetchTimer);

      if (error) {
        // Try to extract the real body from the edge function response
        let detail = error.message;
        try {
          const ctx = (error as any).context;
          if (ctx) {
            const parsed = typeof ctx === "string" ? JSON.parse(ctx) : ctx;
            detail = parsed?.details || parsed?.error || error.message;
          }
        } catch { /* ignore */ }
        setMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: "assistant", content: `Error: ${detail}`, isError: true }]);
      } else if (data?.error) {
        setMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: "assistant", content: `${data.error}${data.details ? ` — ${data.details}` : ""}`, isError: true }]);
      } else {
        const reply: string = data?.reply ?? "No response.";
        setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: reply }]);
        setHistory((prev) => [
          ...prev,
          { role: "user", parts: [{ text }] },
          { role: "model", parts: [{ text: reply }] },
        ]);
      }
    } catch (err) {
      clearTimeout(fetchTimer);
      setMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: "assistant", content: `Network error: ${String(err)}`, isError: true }]);
    } finally {
      setIsThinking(false);
      setIsFetching(false);
    }
  };

  return (
    <Card className="bg-white/5 border-white/10 flex flex-col" style={{ height: "calc(100vh - 240px)", minHeight: "480px" }}>
      <CardHeader className="flex-shrink-0 border-b border-white/10 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center">
            <Brain className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <CardTitle className="text-white text-base">CEO Command Shell</CardTitle>
            <CardDescription className="text-cyan-400/60 text-xs">
              {isFetching ? "Querying database…" : "AI · Strategic Intelligence"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-cyan-500/20 text-cyan-100"
                    : msg.isError
                    ? "bg-red-500/10 text-red-300 border border-red-500/20"
                    : "bg-[#1a2332] text-white/90 border border-white/10"
                }`}
              >
                {msg.role === "assistant" && !msg.isError && (
                  <p className="text-[10px] text-cyan-400/60 font-semibold uppercase tracking-wider mb-1">Wakti Brain</p>
                )}
                {msg.content}
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1a2332] border border-cyan-500/20 w-fit">
                <span className={`w-2 h-2 rounded-full animate-pulse ${isFetching ? "bg-white/60" : "bg-cyan-400"}`} />
                <span className="text-cyan-300/70 text-sm font-mono">
                  {isFetching ? "Querying data" : "Thinking"}{DOTS[frame]}
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-white/10">
          <div className="flex items-center gap-2 bg-[#0e1520] border border-white/10 rounded-xl px-3 py-2 focus-within:border-cyan-500/40 transition-colors">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask about users, revenue, growth…"
              disabled={isThinking}
              className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isThinking}
              title="Send"
              className="w-8 h-8 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 flex items-center justify-center transition-colors disabled:opacity-30"
            >
              {isThinking
                ? <RefreshCw className="h-3.5 w-3.5 text-cyan-400 animate-spin" />
                : <Send className="h-3.5 w-3.5 text-cyan-400" />
              }
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
