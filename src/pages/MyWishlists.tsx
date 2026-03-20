import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Gift, Link2, ImageIcon, Sparkles, Trash2, Edit3, ChevronLeft,
  Globe, Users, Lock, Star, Check, X, Heart, ExternalLink, Package,
  ShoppingBag, ArrowLeft, ChevronRight, Loader2, GiftIcon, HandHeart
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type WishlistPrivacy = "public" | "contacts" | "private";
type ClaimStatus = "pending" | "approved" | "declined" | "unclaimed";

interface Wishlist {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  event_date?: string;
  privacy: WishlistPrivacy;
  allow_claims: boolean;
  auto_approve_claims: boolean;
  allow_sharing: boolean;
  created_at: string;
  item_count?: number;
}

interface WishlistItem {
  id: string;
  wishlist_id: string;
  title: string;
  description?: string;
  image_url?: string;
  product_url?: string;
  price?: number;
  currency?: string;
  priority: number;
  is_received: boolean;
  ai_extracted: boolean;
  created_at: string;
  claim?: { id: string; status: ClaimStatus; claimer_id: string } | null;
}

interface FriendWishlist extends Wishlist {
  owner: { username: string; display_name: string; avatar_url?: string };
}

// ─── Priority Labels ───────────────────────────────────────────────────────────
const priorityConfig = {
  1: { label: { en: "Nice to have", ar: "جميل لو وجد" }, color: "text-blue-500", stars: 1 },
  2: { label: { en: "Would like", ar: "أريده" }, color: "text-green-500", stars: 2 },
  3: { label: { en: "Really want", ar: "أريده فعلاً" }, color: "text-yellow-500", stars: 3 },
  4: { label: { en: "Really need", ar: "أحتاجه" }, color: "text-orange-500", stars: 4 },
  5: { label: { en: "Must have!", ar: "ضروري!" }, color: "text-red-500", stars: 5 },
};

// ─── Privacy config ────────────────────────────────────────────────────────────
const privacyConfig = {
  public: { icon: Globe, label: { en: "Public", ar: "عام" }, color: "text-blue-500" },
  contacts: { icon: Users, label: { en: "Contacts only", ar: "جهات الاتصال" }, color: "text-green-500" },
  private: { icon: Lock, label: { en: "Private", ar: "خاص" }, color: "text-gray-500" },
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function MyWishlists() {
  const { language } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAr = language === "ar";

  // View state: "my" | "friends" | "list-detail" | "friend-list-detail"
  const [view, setView] = useState<"my" | "friends" | "list-detail" | "friend-list-detail">("my");
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedFriendListId, setSelectedFriendListId] = useState<string | null>(null);

  // Dialogs
  const [showNewListDialog, setShowNewListDialog] = useState(false);
  const [showAddItemSheet, setShowAddItemSheet] = useState(false);
  const [showEditListDialog, setShowEditListDialog] = useState(false);
  const [editingList, setEditingList] = useState<Wishlist | null>(null);

  // New list form
  const [newListTitle, setNewListTitle] = useState("");
  const [newListDesc, setNewListDesc] = useState("");
  const [newListDate, setNewListDate] = useState("");
  const [newListPrivacy, setNewListPrivacy] = useState<WishlistPrivacy>("contacts");
  const [newListAllowClaims, setNewListAllowClaims] = useState(true);
  const [newListAutoApprove, setNewListAutoApprove] = useState(false);
  const [isCreatingList, setIsCreatingList] = useState(false);

  // Add item form
  const [itemMode, setItemMode] = useState<"manual" | "url" | "image">("manual");
  const [itemTitle, setItemTitle] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const [itemUrl, setItemUrl] = useState("");
  const [itemImageUrl, setItemImageUrl] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemPriority, setItemPriority] = useState(2);
  const [isExtractingAI, setIsExtractingAI] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);

  // ── Fetch my wishlists ──────────────────────────────────────────────────────
  const { data: myLists = [], isLoading: loadingMyLists } = useQuery({
    queryKey: ["wishlists", "mine", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("wishlists")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Count items per list
      const listsWithCount = await Promise.all(
        (data || []).map(async (list) => {
          const { count } = await supabase
            .from("wishlist_items")
            .select("id", { count: "exact", head: true })
            .eq("wishlist_id", list.id);
          return { ...list, item_count: count || 0 };
        })
      );
      return listsWithCount as Wishlist[];
    },
    enabled: !!user?.id,
  });

  // ── Fetch selected list items ───────────────────────────────────────────────
  const { data: listItems = [], isLoading: loadingItems } = useQuery({
    queryKey: ["wishlist-items", selectedListId],
    queryFn: async () => {
      if (!selectedListId) return [];
      const { data, error } = await supabase
        .from("wishlist_items")
        .select("*")
        .eq("wishlist_id", selectedListId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Check claims for each item
      const itemsWithClaims = await Promise.all(
        (data || []).map(async (item) => {
          const { data: claim } = await supabase
            .from("wishlist_claims")
            .select("id, status, claimer_id")
            .eq("item_id", item.id)
            .neq("status", "unclaimed")
            .neq("status", "declined")
            .maybeSingle();
          return { ...item, claim: claim || null };
        })
      );
      return itemsWithClaims as WishlistItem[];
    },
    enabled: !!selectedListId,
  });

  // ── Fetch friend wishlists ──────────────────────────────────────────────────
  const { data: friendLists = [], isLoading: loadingFriendLists } = useQuery({
    queryKey: ["wishlists", "friends", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // Get my contacts' IDs
      const { data: contacts } = await supabase
        .from("contacts")
        .select("contact_id")
        .eq("user_id", user.id);
      if (!contacts || contacts.length === 0) return [];
      const contactIds = contacts.map((c) => c.contact_id);
      // Get their non-private wishlists
      const { data: lists, error } = await supabase
        .from("wishlists")
        .select("*, profiles!user_id(username, display_name, avatar_url)")
        .in("user_id", contactIds)
        .neq("privacy", "private")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (lists || []).map((l: any) => ({
        ...l,
        owner: l.profiles || { username: "unknown", display_name: "" },
      })) as FriendWishlist[];
    },
    enabled: !!user?.id && view === "friends",
  });

  // ── Fetch friend list items ─────────────────────────────────────────────────
  const { data: friendListItems = [], isLoading: loadingFriendItems } = useQuery({
    queryKey: ["wishlist-items", selectedFriendListId, "friend"],
    queryFn: async () => {
      if (!selectedFriendListId) return [];
      const { data, error } = await supabase
        .from("wishlist_items")
        .select("*")
        .eq("wishlist_id", selectedFriendListId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const itemsWithClaims = await Promise.all(
        (data || []).map(async (item) => {
          const { data: claim } = await supabase
            .from("wishlist_claims")
            .select("id, status, claimer_id")
            .eq("item_id", item.id)
            .neq("status", "unclaimed")
            .neq("status", "declined")
            .maybeSingle();
          return { ...item, claim: claim || null };
        })
      );
      return itemsWithClaims as WishlistItem[];
    },
    enabled: !!selectedFriendListId,
  });

  // ── Create Wishlist ─────────────────────────────────────────────────────────
  const createListMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !newListTitle.trim()) return;
      const { error } = await supabase.from("wishlists").insert({
        user_id: user.id,
        title: newListTitle.trim(),
        description: newListDesc.trim() || null,
        event_date: newListDate || null,
        privacy: newListPrivacy,
        allow_claims: newListAllowClaims,
        auto_approve_claims: newListAutoApprove,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlists", "mine"] });
      toast.success(isAr ? "تم إنشاء القائمة!" : "Wishlist created!");
      setShowNewListDialog(false);
      setNewListTitle(""); setNewListDesc(""); setNewListDate("");
      setNewListPrivacy("contacts"); setNewListAllowClaims(true); setNewListAutoApprove(false);
    },
    onError: () => toast.error(isAr ? "حدث خطأ" : "Something went wrong"),
  });

  // ── Delete Wishlist ─────────────────────────────────────────────────────────
  const deleteListMutation = useMutation({
    mutationFn: async (listId: string) => {
      const { error } = await supabase.from("wishlists").delete().eq("id", listId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlists", "mine"] });
      toast.success(isAr ? "تم حذف القائمة" : "Wishlist deleted");
      setView("my"); setSelectedListId(null);
    },
  });

  // ── Add Item ────────────────────────────────────────────────────────────────
  const addItemMutation = useMutation({
    mutationFn: async () => {
      if (!selectedListId || !itemTitle.trim()) return;
      const { error } = await supabase.from("wishlist_items").insert({
        wishlist_id: selectedListId,
        user_id: user?.id,
        title: itemTitle.trim(),
        description: itemDesc.trim() || null,
        image_url: itemImageUrl.trim() || null,
        product_url: itemUrl.trim() || null,
        price: itemPrice ? parseFloat(itemPrice) : null,
        priority: itemPriority,
        ai_extracted: isExtractingAI,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist-items", selectedListId] });
      queryClient.invalidateQueries({ queryKey: ["wishlists", "mine"] });
      toast.success(isAr ? "تمت إضافة العنصر!" : "Item added!");
      setShowAddItemSheet(false);
      resetItemForm();
    },
    onError: () => toast.error(isAr ? "حدث خطأ" : "Something went wrong"),
  });

  // ── Delete Item ─────────────────────────────────────────────────────────────
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("wishlist_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist-items", selectedListId] });
      queryClient.invalidateQueries({ queryKey: ["wishlists", "mine"] });
      toast.success(isAr ? "تم الحذف" : "Item removed");
    },
  });

  // ── Mark as Received ────────────────────────────────────────────────────────
  const markReceivedMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("wishlist_items")
        .update({ is_received: true, received_at: new Date().toISOString() })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist-items", selectedListId] });
      toast.success(isAr ? "تم تحديده كمُستلَم 🎁" : "Marked as received! 🎁");
    },
  });

  // ── Claim Item (as a friend) ────────────────────────────────────────────────
  const claimItemMutation = useMutation({
    mutationFn: async ({ itemId, ownerId, autoApprove }: { itemId: string; ownerId: string; autoApprove: boolean }) => {
      const status = autoApprove ? "approved" : "pending";
      const { error } = await supabase.from("wishlist_claims").insert({
        item_id: itemId,
        wishlist_id: selectedFriendListId,
        claimer_id: user?.id,
        owner_id: ownerId,
        status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist-items", selectedFriendListId, "friend"] });
      toast.success(isAr ? "تم الحجز! ✅" : "Item claimed! ✅");
    },
    onError: () => toast.error(isAr ? "لا يمكن حجز هذا العنصر" : "Cannot claim this item"),
  });

  // ── Unclaim (as a friend) ───────────────────────────────────────────────────
  const unclaimMutation = useMutation({
    mutationFn: async (claimId: string) => {
      const { error } = await supabase.from("wishlist_claims")
        .update({ status: "unclaimed" })
        .eq("id", claimId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist-items", selectedFriendListId, "friend"] });
      toast.success(isAr ? "تم إلغاء الحجز" : "Claim removed");
    },
  });

  // ── AI Extract from URL ─────────────────────────────────────────────────────
  const handleAIExtractURL = async () => {
    if (!itemUrl.trim()) {
      toast.error(isAr ? "أدخل رابط المنتج" : "Enter a product URL");
      return;
    }
    setIsExtractingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke("wakti-ai-v2-brain-stream", {
        body: {
          messages: [{
            role: "user",
            content: `Extract product details from this URL: ${itemUrl}\n\nReturn ONLY a JSON object with keys: title, description, price (number only), image_url. No other text.`
          }],
          mode: "chat",
          stream: false,
        }
      });
      if (error) throw error;
      const raw = typeof data === "string" ? data : (data?.content || data?.text || "");
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0]);
        if (extracted.title) setItemTitle(extracted.title);
        if (extracted.description) setItemDesc(extracted.description);
        if (extracted.price) setItemPrice(String(extracted.price));
        if (extracted.image_url) setItemImageUrl(extracted.image_url);
        toast.success(isAr ? "تم استخراج التفاصيل ✨" : "Details extracted ✨");
      } else {
        toast.error(isAr ? "لم أتمكن من قراءة الرابط" : "Couldn't read the URL");
      }
    } catch {
      toast.error(isAr ? "حدث خطأ في الاستخراج" : "Extraction failed");
    } finally {
      setIsExtractingAI(false);
    }
  };

  // ── AI Generate Thank You ───────────────────────────────────────────────────
  const handleGenerateThankYou = async (claimerName: string, itemTitle: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("wakti-ai-v2-brain-stream", {
        body: {
          messages: [{
            role: "user",
            content: `Write a warm, short thank-you message (2-3 sentences) for receiving "${itemTitle}" from ${claimerName}. Be genuine and heartfelt. Return only the message text.`
          }],
          mode: "chat",
          stream: false,
        }
      });
      if (error) throw error;
      const msg = typeof data === "string" ? data : (data?.content || data?.text || "");
      return msg.trim();
    } catch {
      return isAr
        ? `شكراً جزيلاً على هديتك الجميلة! 🎁`
        : `Thank you so much for the wonderful gift! 🎁`;
    }
  };

  const resetItemForm = () => {
    setItemTitle(""); setItemDesc(""); setItemUrl(""); setItemImageUrl("");
    setItemPrice(""); setItemPriority(2); setItemMode("manual"); setIsExtractingAI(false);
  };

  const selectedList = myLists.find((l) => l.id === selectedListId);
  const selectedFriendList = friendLists.find((l) => l.id === selectedFriendListId) as FriendWishlist | undefined;

  // ── RENDER: Top nav tabs ────────────────────────────────────────────────────
  const renderTopTabs = () => (
    <div className="flex gap-2 mb-6">
      <button
        onClick={() => { setView("my"); setSelectedListId(null); }}
        className={cn(
          "flex-1 min-h-11 px-3 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]",
          view === "my" || view === "list-detail"
            ? "bg-[hsl(210,100%,55%)] text-white shadow"
            : "bg-muted text-muted-foreground"
        )}
      >
        <Gift className="h-4 w-4 inline mr-1.5" />
        {isAr ? "قوائمي" : "My Lists"}
      </button>
      <button
        onClick={() => { setView("friends"); setSelectedFriendListId(null); }}
        className={cn(
          "flex-1 min-h-11 px-3 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]",
          view === "friends" || view === "friend-list-detail"
            ? "bg-[hsl(210,100%,55%)] text-white shadow"
            : "bg-muted text-muted-foreground"
        )}
      >
        <HandHeart className="h-4 w-4 inline mr-1.5" />
        {isAr ? "أصدقائي" : "Friends"}
      </button>
    </div>
  );

  // ── RENDER: My Wishlists grid ───────────────────────────────────────────────
  const renderMyLists = () => (
    <div>
      {loadingMyLists ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : myLists.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <div className="text-6xl">🎁</div>
          <p className="text-lg font-semibold text-foreground">
            {isAr ? "لا توجد قوائم بعد" : "No wishlists yet"}
          </p>
          <p className="text-sm text-muted-foreground">
            {isAr ? "أنشئ قائمتك الأولى وشاركها مع أصدقائك" : "Create your first list and share it with friends"}
          </p>
          <Button onClick={() => setShowNewListDialog(true)} className="mt-2">
            <Plus className="h-4 w-4 mr-2" />
            {isAr ? "أنشئ قائمة" : "Create a List"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {myLists.map((list) => {
            const PrivacyIcon = privacyConfig[list.privacy].icon;
            return (
              <Card
                key={list.id}
                className="cursor-pointer transition-all active:scale-[0.98] border border-border/60 min-h-24 p-3"
                onClick={() => { setSelectedListId(list.id); setView("list-detail"); }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-base truncate">{list.title}</h3>
                      <PrivacyIcon className={cn("h-3.5 w-3.5 flex-shrink-0", privacyConfig[list.privacy].color)} />
                    </div>
                    {list.description && (
                      <p className="text-xs text-muted-foreground truncate">{list.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-muted-foreground">
                        {list.item_count} {isAr ? "عنصر" : "items"}
                      </span>
                      {list.event_date && (
                        <span className="text-xs text-muted-foreground">
                          📅 {new Date(list.event_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </div>
              </Card>
            );
          })}
          <Button
            variant="outline"
            className="w-full mt-2"
            onClick={() => setShowNewListDialog(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            {isAr ? "إنشاء قائمة جديدة" : "New Wishlist"}
          </Button>
        </div>
      )}
    </div>
  );

  // ── RENDER: List Detail (my items) ─────────────────────────────────────────
  const renderListDetail = () => {
    if (!selectedList) return null;
    const PrivacyIcon = privacyConfig[selectedList.privacy].icon;
    return (
      <div>
        {/* Back + Header */}
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => { setView("my"); setSelectedListId(null); }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg truncate">{selectedList.title}</h2>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <PrivacyIcon className={cn("h-3 w-3", privacyConfig[selectedList.privacy].color)} />
              {privacyConfig[selectedList.privacy].label[isAr ? "ar" : "en"]}
              {selectedList.allow_claims && (
                <span className="ml-1 text-green-500">• {isAr ? "الحجز مفعّل" : "Claims enabled"}</span>
              )}
            </div>
          </div>
          <Button
            variant="destructive"
            size="icon"
            className="h-8 w-8"
            onClick={() => deleteListMutation.mutate(selectedList.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Add Item Button */}
        <Button
          onClick={() => setShowAddItemSheet(true)}
          className="w-full mb-4 bg-gradient-to-r from-[hsl(210,100%,65%)] to-[hsl(195,100%,60%)] text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          {isAr ? "إضافة رغبة" : "Add a Wish"}
        </Button>

        {/* Items */}
        {loadingItems ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : listItems.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground">{isAr ? "القائمة فارغة — أضف رغبتك الأولى!" : "Empty list — add your first wish!"}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {listItems.map((item) => (
              <WishlistItemCard
                key={item.id}
                item={item}
                isOwner={true}
                isAr={isAr}
                onDelete={() => deleteItemMutation.mutate(item.id)}
                onMarkReceived={() => markReceivedMutation.mutate(item.id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── RENDER: Friend Wishlists ─────────────────────────────────────────────────
  const renderFriendLists = () => (
    <div>
      {loadingFriendLists ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : friendLists.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="text-5xl">👥</div>
          <p className="text-lg font-semibold">{isAr ? "لا توجد قوائم من الأصدقاء" : "No friend wishlists yet"}</p>
          <p className="text-sm text-muted-foreground">
            {isAr ? "سيظهر هنا قوائم أصدقائك عندما يشاركونها" : "Your friends' lists will appear here once they share them"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {friendLists.map((list) => {
            const fl = list as FriendWishlist;
            return (
              <Card
                key={list.id}
                className="cursor-pointer transition-all active:scale-[0.98] border border-border/60 min-h-24 p-3"
                onClick={() => { setSelectedFriendListId(list.id); setView("friend-list-detail"); }}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9 flex-shrink-0">
                    {fl.owner?.avatar_url && <AvatarImage src={fl.owner.avatar_url} />}
                    <AvatarFallback>{(fl.owner?.username || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs text-muted-foreground">@{fl.owner?.username}</span>
                    </div>
                    <h3 className="font-semibold text-base truncate">{list.title}</h3>
                    {list.description && (
                      <p className="text-xs text-muted-foreground truncate">{list.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      {list.event_date && (
                        <span className="text-xs text-muted-foreground">
                          📅 {new Date(list.event_date).toLocaleDateString()}
                        </span>
                      )}
                      {list.allow_claims && (
                        <span className="text-xs text-green-500">🎁 {isAr ? "يقبل الحجز" : "Claims open"}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── RENDER: Friend List Detail ──────────────────────────────────────────────
  const renderFriendListDetail = () => {
    if (!selectedFriendList) return null;
    const fl = selectedFriendList as FriendWishlist;
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => { setView("friends"); setSelectedFriendListId(null); }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-8 w-8">
            {fl.owner?.avatar_url && <AvatarImage src={fl.owner.avatar_url} />}
            <AvatarFallback>{(fl.owner?.username || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-base truncate">{selectedFriendList.title}</h2>
            <p className="text-xs text-muted-foreground">@{fl.owner?.username}</p>
          </div>
        </div>

        {loadingFriendItems ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : friendListItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{isAr ? "القائمة فارغة حتى الآن" : "List is empty for now"}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {friendListItems.map((item) => (
              <WishlistItemCard
                key={item.id}
                item={item}
                isOwner={false}
                isAr={isAr}
                allowClaims={selectedFriendList.allow_claims}
                currentUserId={user?.id}
                onClaim={() =>
                  claimItemMutation.mutate({
                    itemId: item.id,
                    ownerId: selectedFriendList.user_id,
                    autoApprove: selectedFriendList.auto_approve_claims,
                  })
                }
                onUnclaim={() => item.claim && unclaimMutation.mutate(item.claim.id)}
                onGenerateThankYou={() => handleGenerateThankYou(fl.owner?.display_name || fl.owner?.username || "friend", item.title)}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  // ─── WishlistItemCard Sub-component ───────────────────────────────────────────
  interface WishlistItemCardProps {
    item: WishlistItem;
    isOwner: boolean;
    isAr: boolean;
    allowClaims?: boolean;
    currentUserId?: string;
    onDelete?: () => void;
    onMarkReceived?: () => void;
    onClaim?: () => void;
    onUnclaim?: () => void;
    onGenerateThankYou?: () => Promise<string>;
  }

  function WishlistItemCard({
    item, isOwner, isAr, allowClaims = false,
    currentUserId, onDelete, onMarkReceived, onClaim, onUnclaim, onGenerateThankYou
  }: WishlistItemCardProps) {
    const [showThankYou, setShowThankYou] = useState(false);
    const [thankYouMsg, setThankYouMsg] = useState("");
    const [generatingTY, setGeneratingTY] = useState(false);

    const isMyClaim = item.claim?.claimer_id === currentUserId;
    const isClaimedByOther = item.claim && !isMyClaim && item.claim.status !== "unclaimed";
    const isClaimedByMe = isMyClaim && item.claim?.status !== "unclaimed";
    const pConfig = priorityConfig[item.priority as keyof typeof priorityConfig] || priorityConfig[2];

    const handleGenerateTY = async () => {
      if (!onGenerateThankYou) return;
      setGeneratingTY(true);
      const msg = await onGenerateThankYou();
      setThankYouMsg(msg);
      setGeneratingTY(false);
      setShowThankYou(true);
    };

    return (
      <Card className={cn(
        "border transition-all",
        item.is_received && "opacity-60",
        isClaimedByOther && "border-orange-400/40 bg-orange-500/5"
      )}>
        <CardContent className="p-3">
          <div className="flex gap-3">
            {/* Image */}
            {item.image_url && (
              <img
                src={item.image_url}
                alt={item.title}
                className="w-16 h-16 object-cover rounded-lg flex-shrink-0 border"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "font-semibold text-sm truncate",
                    item.is_received && "line-through text-muted-foreground"
                  )}>
                    {item.title}
                    {item.ai_extracted && (
                      <Sparkles className="h-3 w-3 inline ml-1 text-purple-500" />
                    )}
                  </p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={cn("text-xs font-medium", pConfig.color)}>
                      {"⭐".repeat(pConfig.stars)}
                    </span>
                    {item.price && (
                      <span className="text-xs text-muted-foreground">{item.price} {item.currency || "USD"}</span>
                    )}
                    {item.product_url && (
                      <a
                        href={item.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 flex items-center gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3 w-3" />
                        {isAr ? "الرابط" : "Link"}
                      </a>
                    )}
                  </div>
                </div>
                {/* Owner actions */}
                {isOwner && (
                  <div className="flex gap-1 flex-shrink-0">
                    {!item.is_received && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-10 w-10 text-green-500"
                        onClick={onMarkReceived}
                        title={isAr ? "تم الاستلام" : "Mark received"}
                      >
                        <Check className="h-4.5 w-4.5" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-10 w-10 text-red-500"
                      onClick={onDelete}
                      title={isAr ? "حذف" : "Delete"}
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Friend claim status */}
              {!isOwner && (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  {item.is_received ? (
                    <Badge variant="secondary" className="text-xs">
                      🎁 {isAr ? "تم استلامه" : "Received"}
                    </Badge>
                  ) : isClaimedByOther ? (
                    <Badge className="text-xs bg-orange-500/20 text-orange-600 border-orange-400/30">
                      🔒 {isAr ? "محجوز من شخص آخر" : "Claimed by someone"}
                    </Badge>
                  ) : isClaimedByMe ? (
                    <div className="flex items-center gap-2">
                      <Badge className="text-xs bg-green-500/20 text-green-600 border-green-400/30">
                        ✅ {isAr ? "حجزته أنت" : "Claimed by you"}
                        {item.claim?.status === "pending" && ` (${isAr ? "في الانتظار" : "pending"})`}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="min-h-10 px-3 text-xs text-muted-foreground"
                        onClick={onUnclaim}
                      >
                        <X className="h-3 w-3 mr-1" />{isAr ? "إلغاء" : "Unclaim"}
                      </Button>
                      {item.is_received && !item.claim?.["thank_you_sent"] && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="min-h-10 px-3 text-xs text-blue-500"
                          onClick={handleGenerateTY}
                          disabled={generatingTY}
                        >
                          {generatingTY ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Heart className="h-3 w-3 mr-1" />}
                          {isAr ? "شكر AI" : "AI Thank You"}
                        </Button>
                      )}
                    </div>
                  ) : allowClaims ? (
                    <Button
                      size="sm"
                      className="min-h-11 px-4 text-xs bg-gradient-to-r from-[hsl(210,100%,65%)] to-[hsl(180,85%,60%)] text-white"
                      onClick={onClaim}
                    >
                      <GiftIcon className="h-3.5 w-3.5 mr-1" />
                      {isAr ? "سأشتريه" : "I'll get this!"}
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </CardContent>

        {/* AI Thank You message popup */}
        {showThankYou && thankYouMsg && (
          <div className="mx-3 mb-3 p-3 bg-blue-500/10 border border-blue-400/30 rounded-lg">
            <div className="flex items-start gap-2">
              <Heart className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-foreground flex-1">{thankYouMsg}</p>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5"
                onClick={() => setShowThankYou(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    );
  };

  // ─── PAGE LAYOUT ─────────────────────────────────────────────────────────────
  return (
    <div className={cn("flex flex-col p-4 pb-28 min-h-screen", isAr && "rtl")}>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[hsl(210,100%,65%)] to-[hsl(195,100%,60%)] bg-clip-text text-transparent">
              {isAr ? "رغباتي 🎁" : "Wishlists 🎁"}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isAr ? "شارك رغباتك مع أصدقائك" : "Share your wishes with friends"}
            </p>
          </div>
        </div>
        {(view === "my" || view === "list-detail") && view !== "list-detail" && (
          <Button size="sm" onClick={() => setShowNewListDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            {isAr ? "جديد" : "New"}
          </Button>
        )}
      </div>

      {/* Top Tabs — only show when at root of each section */}
      {(view === "my" || view === "friends") && renderTopTabs()}

      {/* Content */}
      {view === "my" && renderMyLists()}
      {view === "friends" && renderFriendLists()}
      {view === "list-detail" && renderListDetail()}
      {view === "friend-list-detail" && renderFriendListDetail()}

      {/* ── New Wishlist Dialog ───────────────────────────────────────────── */}
      <Dialog open={showNewListDialog} onOpenChange={setShowNewListDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isAr ? "قائمة جديدة" : "New Wishlist"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{isAr ? "العنوان *" : "Title *"}</Label>
              <Input
                value={newListTitle}
                onChange={(e) => setNewListTitle(e.target.value)}
                placeholder={isAr ? "مثال: عيد ميلادي 🎂" : "e.g. My Birthday 🎂"}
                className="mt-1"
              />
            </div>
            <div>
              <Label>{isAr ? "الوصف (اختياري)" : "Description (optional)"}</Label>
              <Textarea
                value={newListDesc}
                onChange={(e) => setNewListDesc(e.target.value)}
                placeholder={isAr ? "أضف وصفاً..." : "Add a description..."}
                rows={2}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isAr ? "تاريخ الحدث" : "Event Date"}</Label>
                <Input
                  type="date"
                  value={newListDate}
                  onChange={(e) => setNewListDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>{isAr ? "الخصوصية" : "Privacy"}</Label>
                <Select value={newListPrivacy} onValueChange={(v) => setNewListPrivacy(v as WishlistPrivacy)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contacts">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{isAr ? "جهات الاتصال" : "Contacts"}</span>
                        <span className="text-xs text-muted-foreground">{isAr ? "جميع جهات الاتصال" : "All contacts"}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="public">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{isAr ? "عام" : "Public"}</span>
                        <span className="text-xs text-muted-foreground">{isAr ? "جميع جهات الاتصال + رابط" : "All contacts + URL"}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="private">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{isAr ? "خاص" : "Private"}</span>
                        <span className="text-xs text-muted-foreground">{isAr ? "إرسال لجهات اتصال محددة" : "Send to hand-picked contacts"}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setNewListAllowClaims((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-lg border p-4 min-h-16 text-left active:scale-[0.98] transition-transform"
            >
              <div>
                <p className="text-sm font-medium">{isAr ? "السماح بالحجز" : "Allow Claims"}</p>
                <p className="text-xs text-muted-foreground">{isAr ? "يسمح للأصدقاء بحجز عناصر" : "Friends can reserve items"}</p>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <Switch checked={newListAllowClaims} onCheckedChange={setNewListAllowClaims} />
              </div>
            </button>
            {newListAllowClaims && (
              <button
                type="button"
                onClick={() => setNewListAutoApprove((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-lg border p-4 min-h-16 text-left active:scale-[0.98] transition-transform"
              >
                <div>
                  <p className="text-sm font-medium">{isAr ? "الموافقة التلقائية" : "Auto-approve"}</p>
                  <p className="text-xs text-muted-foreground">{isAr ? "قبول الحجوزات تلقائياً" : "Approve claims automatically"}</p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <Switch checked={newListAutoApprove} onCheckedChange={setNewListAutoApprove} />
                </div>
              </button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewListDialog(false)}>{isAr ? "إلغاء" : "Cancel"}</Button>
            <Button
              onClick={() => createListMutation.mutate()}
              disabled={!newListTitle.trim() || createListMutation.isPending}
            >
              {createListMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              {isAr ? "إنشاء" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Item Sheet ────────────────────────────────────────────────── */}
      <Sheet open={showAddItemSheet} onOpenChange={(o) => { setShowAddItemSheet(o); if (!o) resetItemForm(); }}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{isAr ? "إضافة رغبة" : "Add a Wish"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 pb-6 pt-4">
            {/* Mode tabs */}
            <div className="flex gap-2">
              {(["manual", "url", "image"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setItemMode(mode)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-semibold transition-all",
                    itemMode === mode
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {mode === "manual" && <><Edit3 className="h-3.5 w-3.5 inline mr-1" />{isAr ? "يدوي" : "Manual"}</>}
                  {mode === "url" && <><Link2 className="h-3.5 w-3.5 inline mr-1" />{isAr ? "رابط" : "URL"}</>}
                  {mode === "image" && <><ImageIcon className="h-3.5 w-3.5 inline mr-1" />{isAr ? "صورة" : "Image"}</>}
                </button>
              ))}
            </div>

            {/* URL mode — AI extract */}
            {itemMode === "url" && (
              <div className="space-y-2">
                <Label>{isAr ? "رابط المنتج" : "Product URL"}</Label>
                <div className="flex gap-2">
                  <Input
                    value={itemUrl}
                    onChange={(e) => setItemUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAIExtractURL}
                    disabled={isExtractingAI || !itemUrl.trim()}
                    className="bg-gradient-to-r from-[hsl(210,100%,65%)] to-[hsl(195,100%,60%)] text-white"
                  >
                    {isExtractingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  </Button>
                </div>
                {isExtractingAI && (
                  <p className="text-xs text-muted-foreground animate-pulse">
                    {isAr ? "Wakti AI يستخرج التفاصيل..." : "Wakti AI is extracting details..."}
                  </p>
                )}
              </div>
            )}

            {/* Image URL for image mode */}
            {itemMode === "image" && (
              <div className="space-y-2">
                <Label>{isAr ? "رابط الصورة" : "Image URL"}</Label>
                <Input
                  value={itemImageUrl}
                  onChange={(e) => setItemImageUrl(e.target.value)}
                  placeholder="https://..."
                />
                {itemImageUrl && (
                  <img src={itemImageUrl} alt="preview" className="w-full h-32 object-contain rounded-lg border" onError={() => {}} />
                )}
              </div>
            )}

            {/* Title — always shown */}
            <div>
              <Label>{isAr ? "الاسم *" : "Name *"}</Label>
              <Input
                value={itemTitle}
                onChange={(e) => setItemTitle(e.target.value)}
                placeholder={isAr ? "اسم العنصر" : "Item name"}
                className="mt-1"
              />
            </div>

            <div>
              <Label>{isAr ? "الوصف" : "Description"}</Label>
              <Textarea
                value={itemDesc}
                onChange={(e) => setItemDesc(e.target.value)}
                placeholder={isAr ? "تفاصيل إضافية..." : "More details..."}
                rows={2}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isAr ? "السعر (اختياري)" : "Price (optional)"}</Label>
                <Input
                  type="number"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>{isAr ? "الأولوية" : "Priority"}</Label>
                <Select value={String(itemPriority)} onValueChange={(v) => setItemPriority(Number(v))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((p) => (
                      <SelectItem key={p} value={String(p)}>
                        {"⭐".repeat(p)} {priorityConfig[p as keyof typeof priorityConfig].label[isAr ? "ar" : "en"]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {itemMode !== "image" && (
              <div>
                <Label>{isAr ? "صورة المنتج (رابط)" : "Product image (URL)"}</Label>
                <Input
                  value={itemImageUrl}
                  onChange={(e) => setItemImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="mt-1"
                />
              </div>
            )}

            <Button
              className="w-full"
              onClick={() => addItemMutation.mutate()}
              disabled={!itemTitle.trim() || addItemMutation.isPending}
            >
              {addItemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              {isAr ? "إضافة" : "Add Item"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
