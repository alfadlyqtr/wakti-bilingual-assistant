import { useState, useEffect, useRef } from "react";
import { Gift, Search, Plus, Mic, Music, X, Loader2, Zap, ArrowUpRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";

interface UserQuota {
  id: string;
  email: string;
  full_name: string;
  voice_characters_used: number;
  voice_characters_limit: number;
  voice_extra_characters: number;
  is_subscribed: boolean;
  subscription_status: string;
}

interface MusicUsage {
  generated: number;
  extra_generations: number;
  base_limit: number;
  total_limit: number;
}

function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function AdminQuotas() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<UserQuota[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const [selectedUser, setSelectedUser] = useState<UserQuota | null>(null);
  const [featureType, setFeatureType] = useState<"voice" | "music">("voice");
  const [voiceUsageMonth, setVoiceUsageMonth] = useState(currentYearMonth);
  const [musicUsageMonth, setMusicUsageMonth] = useState(currentYearMonth);
  const [musicUsage, setMusicUsage] = useState<MusicUsage | null>(null);
  const [isMusicLoading, setIsMusicLoading] = useState(false);

  const [quotaAmount, setQuotaAmount] = useState("");
  const [isGifting, setIsGifting] = useState(false);
  const [giftDone, setGiftDone] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Debounced search ──
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      runSearch(searchTerm.trim());
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm]);

  // ── Fetch music usage whenever featureType/selectedUser/month changes ──
  useEffect(() => {
    if (featureType !== "music" || !selectedUser) {
      setMusicUsage(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsMusicLoading(true);
      try {
        const { data, error } = await (supabase as any).rpc(
          "admin_get_music_generations_monthly",
          { p_user_id: selectedUser.id, p_month: musicUsageMonth }
        );
        if (!cancelled) {
          setMusicUsage(
            error ? { generated: 0, extra_generations: 0, base_limit: 5, total_limit: 5 } : (data as MusicUsage)
          );
        }
      } catch {
        if (!cancelled)
          setMusicUsage({ generated: 0, extra_generations: 0, base_limit: 5, total_limit: 5 });
      } finally {
        if (!cancelled) setIsMusicLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [featureType, selectedUser?.id, musicUsageMonth]);

  const runSearch = async (term: string) => {
    setIsSearching(true);
    setHasSearched(true);
    try {
      const { data: quotasData, error } = await (supabase as any).rpc(
        "admin_get_voice_quotas",
        { p_user_id: null }
      );
      if (error) throw error;

      const lower = term.toLowerCase();
      const matched = (quotasData || []).filter(
        (row: any) =>
          (row.email || "").toLowerCase().includes(lower) ||
          (row.display_name || "").toLowerCase().includes(lower)
      );

      const currentMonth = currentYearMonth();
      const results: UserQuota[] = await Promise.all(
        matched.slice(0, 8).map(async (row: any) => {
          let extra = row.gift_extra || 0;
          try {
            const { data: vm } = await (supabase as any).rpc(
              "admin_get_voice_characters_monthly",
              { p_user_id: row.user_id, p_month: currentMonth }
            );
            if (vm) extra = vm.extra_characters || 0;
          } catch { /* ignore */ }
          return {
            id: row.user_id,
            email: row.email || "No email",
            full_name: row.display_name || "No name",
            voice_characters_used: row.used || 0,
            voice_characters_limit: row.base_limit || 0,
            voice_extra_characters: extra,
            is_subscribed: !!row.is_subscribed,
            subscription_status: row.subscription_status || "inactive",
          };
        })
      );

      setSearchResults(results);
    } catch {
      toast.error("Search failed. Please try again.");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const selectUser = (user: UserQuota) => {
    setSelectedUser(user);
    setQuotaAmount("");
    setGiftDone(false);
  };

  const clearSelection = () => {
    setSelectedUser(null);
    setQuotaAmount("");
    setGiftDone(false);
  };

  const giftQuota = async () => {
    if (!selectedUser || !quotaAmount) {
      toast.error("Select a user and enter an amount");
      return;
    }
    const amount = parseInt(quotaAmount);
    if (isNaN(amount) || amount === 0) {
      toast.error("Enter a non-zero amount");
      return;
    }

    setIsGifting(true);
    setGiftDone(false);
    try {
      let err: any = null;
      if (featureType === "music") {
        const { error } = await (supabase as any).rpc("admin_adjust_music_generations", {
          p_user_id: selectedUser.id,
          p_month: musicUsageMonth,
          p_delta: amount,
          p_reason: amount > 0 ? "Admin gifted music generations" : "Admin revoked music generations",
        });
        err = error;
      } else {
        const { error } = await (supabase as any).rpc("admin_adjust_voice_characters", {
          p_user_id: selectedUser.id,
          p_month: voiceUsageMonth,
          p_delta: amount,
          p_reason:
            amount > 0
              ? "Admin gifted voice characters (monthly)"
              : "Admin revoked voice characters (monthly)",
        });
        err = error;
      }
      if (err) throw err;

      // Refresh the selected user's voice quota inline
      if (featureType === "voice") {
        try {
          const { data: vd } = await (supabase as any).rpc("admin_get_voice_characters_monthly", {
            p_user_id: selectedUser.id,
            p_month: voiceUsageMonth,
          });
          if (vd) {
            const updated = { ...selectedUser, voice_extra_characters: vd.extra_characters || 0 };
            setSelectedUser(updated);
            setSearchResults((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
          }
        } catch { /* silent */ }
      }
      // Refresh music usage
      if (featureType === "music") {
        try {
          const { data: mu } = await (supabase as any).rpc("admin_get_music_generations_monthly", {
            p_user_id: selectedUser.id,
            p_month: musicUsageMonth,
          });
          setMusicUsage(mu as MusicUsage);
        } catch { /* silent */ }
      }

      toast.success(
        amount > 0
          ? `Gifted ${amount} ${featureType === "music" ? "generations" : "characters"} to ${selectedUser.email}`
          : `Revoked ${Math.abs(amount)} from ${selectedUser.email}`
      );
      setQuotaAmount("");
      setGiftDone(true);
    } catch {
      toast.error("Failed to apply quota change");
    } finally {
      setIsGifting(false);
    }
  };

  // ── Derived values for selected user ──
  const voiceTotalLimit = selectedUser
    ? selectedUser.voice_characters_limit + selectedUser.voice_extra_characters
    : 0;
  const voicePct =
    voiceTotalLimit > 0 ? Math.min((selectedUser!.voice_characters_used / voiceTotalLimit) * 100, 100) : 0;
  const musicPct =
    musicUsage && musicUsage.total_limit > 0
      ? Math.min((musicUsage.generated / musicUsage.total_limit) * 100, 100)
      : 0;

  return (
    <div className="bg-[#0c0f14] text-white/90 min-h-screen">
      <AdminHeader
        title="Quota Gifter"
        subtitle="Search → Select → Gift"
        icon={<Gift className="h-5 w-5 text-white/50" />}
      />

      <div className="max-w-[860px] mx-auto px-4 sm:px-6 py-6 pb-28 space-y-5">

        {/* ── HERO SEARCH BAR ── */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
            {isSearching ? (
              <Loader2 className="h-5 w-5 text-violet-400 animate-spin" />
            ) : (
              <Search className="h-5 w-5 text-white/30" />
            )}
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by email or name…"
            className="w-full h-14 rounded-2xl border border-white/10 bg-[#0e1119] pl-12 pr-12 text-base text-white placeholder-white/25 outline-none focus:border-violet-500/50 focus:ring-0 transition-colors duration-200 shadow-[0_0_40px_rgba(139,92,246,0.05)]"
          />
          {searchTerm && (
            <button
              onClick={() => { setSearchTerm(""); setSelectedUser(null); setSearchResults([]); setHasSearched(false); }}
              aria-label="Clear search"
              className="absolute inset-y-0 right-4 flex items-center text-white/30 hover:text-white/60 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* ── EMPTY STATE (no search yet) ── */}
        {!hasSearched && !selectedUser && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Gift className="h-8 w-8 text-violet-400" />
            </div>
            <p className="text-white/40 text-sm max-w-xs">
              Type a user's email or name above to load their quota data and gift credits.
            </p>
          </div>
        )}

        {/* ── SEARCH RESULTS ── */}
        {hasSearched && !selectedUser && (
          <div className="space-y-2">
            {searchResults.length === 0 && !isSearching && (
              <div className="text-center py-10 text-white/30 text-sm">No users matched that search.</div>
            )}
            {searchResults.map((user) => (
              <button
                key={user.id}
                onClick={() => selectUser(user)}
                className="w-full flex items-center gap-4 rounded-2xl border border-white/8 bg-[#0e1119] px-4 py-3 hover:border-violet-500/30 hover:bg-[#12151f] transition-all duration-200 text-left group"
              >
                <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-violet-300">
                  {(user.full_name || user.email).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/90 truncate">{user.full_name || "—"}</p>
                  <p className="text-xs text-white/40 truncate">{user.email}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${user.is_subscribed ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-white/10 text-white/30"}`}>
                    {user.is_subscribed ? "Pro" : "Free"}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-white/20 group-hover:text-violet-400 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── SELECTED USER PANEL ── */}
        {selectedUser && (
          <div className="space-y-4">

            {/* User identity strip */}
            <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-[#0e1119] px-4 py-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center text-sm font-semibold text-violet-300 flex-shrink-0">
                {(selectedUser.full_name || selectedUser.email).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{selectedUser.full_name || "—"}</p>
                <p className="text-xs text-white/40 truncate">{selectedUser.email}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 ${selectedUser.is_subscribed ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-white/10 text-white/30"}`}>
                {selectedUser.is_subscribed ? "Pro" : "Free"}
              </span>
              <button onClick={clearSelection} aria-label="Clear selected user" className="text-white/25 hover:text-white/60 transition-colors flex-shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Usage bars — bento pair */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

              {/* Voice bar */}
              <div className="relative rounded-2xl border border-white/8 bg-[#0e1119] p-4 overflow-hidden">
                <div className="pointer-events-none absolute -top-6 -left-6 w-28 h-28 rounded-full bg-blue-500/8 blur-2xl" />
                <div className="flex items-center gap-2 mb-3">
                  <Mic className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-xs font-medium text-white/50 uppercase tracking-widest">Voice</span>
                  <span className="ml-auto text-[11px] text-white/30">{voiceUsageMonth}</span>
                </div>
                <p className="text-2xl font-bold text-white mb-1">
                  {selectedUser.voice_characters_used.toLocaleString()}
                  <span className="text-sm font-normal text-white/30 ml-1">/ {voiceTotalLimit.toLocaleString()} chars</span>
                </p>
                <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden mt-2">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-sky-400 transition-all duration-500"
                    style={{ width: `${voicePct}%` }}
                  />
                </div>
                {selectedUser.voice_extra_characters > 0 && (
                  <p className="text-[11px] text-violet-400 mt-1.5">
                    +{selectedUser.voice_extra_characters.toLocaleString()} gifted credits active
                  </p>
                )}
              </div>

              {/* Music bar */}
              <div className="relative rounded-2xl border border-white/8 bg-[#0e1119] p-4 overflow-hidden">
                <div className="pointer-events-none absolute -bottom-6 -right-6 w-28 h-28 rounded-full bg-violet-500/8 blur-2xl" />
                <div className="flex items-center gap-2 mb-3">
                  <Music className="h-3.5 w-3.5 text-violet-400" />
                  <span className="text-xs font-medium text-white/50 uppercase tracking-widest">Music</span>
                  <span className="ml-auto text-[11px] text-white/30">{musicUsageMonth}</span>
                </div>
                {isMusicLoading ? (
                  <div className="flex items-center gap-2 text-white/30 text-sm py-3">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : musicUsage ? (
                  <>
                    <p className="text-2xl font-bold text-white mb-1">
                      {musicUsage.generated}
                      <span className="text-sm font-normal text-white/30 ml-1">/ {musicUsage.total_limit} songs</span>
                    </p>
                    <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden mt-2">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-400 transition-all duration-500"
                        style={{ width: `${musicPct}%` }}
                      />
                    </div>
                    {musicUsage.extra_generations > 0 && (
                      <p className="text-[11px] text-violet-400 mt-1.5">
                        +{musicUsage.extra_generations} gifted generations active
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-white/25 text-sm py-3">Select Music type to load</p>
                )}
              </div>
            </div>

            {/* ── GIFT CARD — the star ── */}
            <div className="relative rounded-2xl border border-violet-500/25 bg-[#0e1119] p-5 overflow-hidden
                            shadow-[0_0_50px_rgba(139,92,246,0.08)]">
              <div className="pointer-events-none absolute -top-10 -right-10 w-48 h-48 rounded-full bg-violet-500/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-blue-500/8 blur-3xl" />

              {/* Card header */}
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <Gift className="h-4 w-4 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Gift Credits</p>
                  <p className="text-[11px] text-white/40">
                    {selectedUser.email}
                  </p>
                </div>
                {giftDone && (
                  <div className="ml-auto flex items-center gap-1 text-emerald-400 text-xs">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Applied
                  </div>
                )}
              </div>

              {/* Feature toggle + Month */}
              <div className="flex flex-wrap gap-3 mb-4">
                <div className="flex rounded-xl border border-white/8 overflow-hidden">
                  <button
                    onClick={() => setFeatureType("voice")}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${featureType === "voice" ? "bg-blue-500/20 text-blue-300" : "text-white/40 hover:text-white/60"}`}
                  >
                    <Mic className="h-3 w-3" /> Voice
                  </button>
                  <button
                    onClick={() => setFeatureType("music")}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${featureType === "music" ? "bg-violet-500/20 text-violet-300" : "text-white/40 hover:text-white/60"}`}
                  >
                    <Music className="h-3 w-3" /> Music
                  </button>
                </div>

                <Input
                  type="month"
                  value={featureType === "music" ? musicUsageMonth : voiceUsageMonth}
                  onChange={(e) =>
                    featureType === "music"
                      ? setMusicUsageMonth(e.target.value)
                      : setVoiceUsageMonth(e.target.value)
                  }
                  className="h-9 w-36 rounded-xl border-white/10 bg-white/5 text-xs text-white/70 px-3 focus:border-violet-500/50"
                />
              </div>

              {/* Amount row */}
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Label className="text-[11px] text-white/40 uppercase tracking-widest mb-1.5 block">
                    {featureType === "music" ? "Generations (+ to gift, − to revoke)" : "Characters (+ to gift, − to revoke)"}
                  </Label>
                  <div className="relative">
                    <Zap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400/60" />
                    <Input
                      type="number"
                      placeholder={featureType === "music" ? "e.g. 5" : "e.g. 5000"}
                      value={quotaAmount}
                      onChange={(e) => { setQuotaAmount(e.target.value); setGiftDone(false); }}
                      className="pl-9 h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder-white/20 focus:border-violet-500/50 text-sm"
                    />
                  </div>
                </div>
                <Button
                  onClick={giftQuota}
                  disabled={!quotaAmount || isGifting}
                  className="h-11 px-6 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm border-0 shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_28px_rgba(139,92,246,0.5)] transition-all duration-200 disabled:opacity-40 disabled:shadow-none"
                >
                  {isGifting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1.5" />
                      Apply
                    </>
                  )}
                </Button>
              </div>
            </div>

          </div>
        )}

      </div>

      <AdminMobileNav />
    </div>
  );
}
