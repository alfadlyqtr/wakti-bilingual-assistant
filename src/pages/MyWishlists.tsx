import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  Plus,
  Gift,
  Link2,
  ImageIcon,
  Sparkles,
  Trash2,
  Edit3,
  ChevronLeft,
  Globe,
  Users,
  Lock,
  Star,
  Check,
  X,
  Heart,
  ExternalLink,
  Package,
  ShoppingBag,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  GiftIcon,
  HandHeart,
  Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { safeCopyToClipboard } from "@/utils/clipboardUtils";
import { getContacts } from "@/services/contactsService";

// ─── Types ────────────────────────────────────────────────────────────────────

type WishlistPrivacy = "public" | "contacts" | "private";
type ClaimStatus = "pending" | "approved" | "declined" | "unclaimed";

interface WishlistClaimProfile {
  username?: string;
  display_name?: string;
  avatar_url?: string;
}

interface WishlistClaim {
  id: string;
  status: ClaimStatus;
  claimer_id: string;
  claimer?: WishlistClaimProfile | null;
}

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
  pending_claim_count?: number;
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
  claim?: WishlistClaim | null;
}

interface FriendWishlist extends Wishlist {
  owner: { username: string; display_name: string; avatar_url?: string };
}

interface WishlistAIExtractResponse {
  success: boolean;
  title?: string;
  description?: string;
  image_url?: string | null;
  error?: string;
}

// ─── Priority Labels ───────────────────────────────────────────────────────────
const priorityConfig = {
  1: {
    label: { en: "Nice to have", ar: "جميل لو وجد" },
    color: "text-blue-500",
    stars: 1,
  },
  2: {
    label: { en: "Would like", ar: "أريده" },
    color: "text-green-500",
    stars: 2,
  },
  3: {
    label: { en: "Really want", ar: "أريده فعلاً" },
    color: "text-yellow-500",
    stars: 3,
  },
  4: {
    label: { en: "Really need", ar: "أحتاجه" },
    color: "text-orange-500",
    stars: 4,
  },
  5: {
    label: { en: "Must have!", ar: "ضروري!" },
    color: "text-red-500",
    stars: 5,
  },
};

// ─── Privacy config ────────────────────────────────────────────────────────────
const privacyConfig = {
  public: {
    icon: Globe,
    label: { en: "Public", ar: "عام" },
    color: "text-blue-500",
  },
  contacts: {
    icon: Users,
    label: { en: "Contacts only", ar: "جهات الاتصال" },
    color: "text-green-500",
  },
  private: {
    icon: Lock,
    label: { en: "Private", ar: "خاص" },
    color: "text-gray-500",
  },
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function MyWishlists() {
  const { language } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAr = language === "ar";
  const [searchParams] = useSearchParams();
  const entrySource = searchParams.get("from");
  const cameFromAccount = entrySource === "account";

  const buildWishlistRoute = (params?: Record<string, string | null | undefined>) => {
    const nextParams = new URLSearchParams();

    if (cameFromAccount) {
      nextParams.set("from", "account");
    }

    Object.entries(params || {}).forEach(([key, value]) => {
      if (!value) return;
      nextParams.set(key, value);
    });

    const queryString = nextParams.toString();
    return queryString ? `/wishlists?${queryString}` : "/wishlists";
  };

  const navigateBackToSource = () => {
    if (cameFromAccount) {
      navigate("/account?tab=wishes");
      return;
    }

    navigate("/wishlists");
  };

  const handleRootBack = () => {
    if (cameFromAccount) {
      navigate("/account?tab=wishes");
      return;
    }

    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/account?tab=wishes");
  };

  // View state: "my" | "friends" | "list-detail" | "friend-list-detail" | "shared-list-detail"
  const [view, setView] = useState<"my" | "friends" | "list-detail" | "friend-list-detail" | "shared-list-detail">("my");
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedFriendListId, setSelectedFriendListId] = useState<string | null>(null);
  const [sharedListId, setSharedListId] = useState<string | null>(null);
  const [contactFilterId, setContactFilterId] = useState<string | null>(null);
  const blockedContactAutoOpenRef = useRef<string | null>(null);

  // Check for list query parameter and auto-open that list
  useEffect(() => {
    const sharedId = searchParams.get("sharedView") || searchParams.get("shared");
    if (sharedId) {
      setSharedListId(sharedId);
      setSelectedListId(null);
      setSelectedFriendListId(null);
      setContactFilterId(null);
      setView("shared-list-detail");
      return;
    }

    const contactId = searchParams.get("contact");
    if (contactId) {
      setSharedListId(null);
      setSelectedListId(null);
      setSelectedFriendListId(null);
      setContactFilterId(contactId);
      setView("friends");
      return;
    }

    const listId = searchParams.get("list");
    if (listId) {
      setSharedListId(null);
      setSelectedListId(listId);
      setSelectedFriendListId(null);
      setContactFilterId(null);
      setView("list-detail");
      return;
    }

    setSharedListId(null);
    setSelectedListId(null);
    setSelectedFriendListId(null);
    setContactFilterId(null);
    setView("my");
  }, [searchParams]);

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
  const [itemMode, setItemMode] = useState<"manual" | "auto">("manual");
  const [itemTitle, setItemTitle] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const [itemUrl, setItemUrl] = useState("");
  const [itemImageUrl, setItemImageUrl] = useState("");
  const [itemImageFile, setItemImageFile] = useState<File | null>(null);
  const [itemImagePreviewUrl, setItemImagePreviewUrl] = useState("");
  const [itemPriority, setItemPriority] = useState(2);
  const [itemAIExtracted, setItemAIExtracted] = useState(false);
  const [isExtractingAI, setIsExtractingAI] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const itemImageInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (itemImagePreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(itemImagePreviewUrl);
      }
    };
  }, [itemImagePreviewUrl]);

  const fileToBase64 = async (file: File) => {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        if (!base64) {
          reject(new Error("Failed to read image"));
          return;
        }
        resolve(base64);
      };
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(file);
    });
  };

  const applyExtractedItemDetails = (payload: WishlistAIExtractResponse) => {
    if (payload.title?.trim()) setItemTitle(payload.title.trim());
    if (payload.description?.trim()) setItemDesc(payload.description.trim());
    if (payload.image_url?.trim()) setItemImageUrl(payload.image_url.trim());
  };

  const enrichItemsWithClaims = async (items: WishlistItem[]) => {
    if (!items.length) return [] as WishlistItem[];

    const itemIds = items.map((item) => item.id);
    const { data: claims, error: claimsError } = await supabase
      .from("wishlist_claims")
      .select("id, status, claimer_id, item_id, claimed_at")
      .in("item_id", itemIds)
      .neq("status", "unclaimed")
      .neq("status", "declined")
      .order("claimed_at", { ascending: false });

    if (claimsError) throw claimsError;

    const claimerIds = Array.from(new Set((claims || []).map((claim) => claim.claimer_id).filter(Boolean)));
    let claimerProfileMap = new Map<string, WishlistClaimProfile>();

    if (claimerIds.length > 0) {
      const { data: claimerProfiles, error: claimerProfilesError } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", claimerIds);

      if (claimerProfilesError) throw claimerProfilesError;

      claimerProfileMap = new Map(
        (claimerProfiles || []).map((profile) => [
          profile.id,
          {
            username: profile.username || undefined,
            display_name: profile.display_name || undefined,
            avatar_url: profile.avatar_url || undefined,
          },
        ])
      );
    }

    const latestClaimsByItemId = new Map<string, WishlistClaim>();
    for (const claim of claims || []) {
      if (latestClaimsByItemId.has(claim.item_id)) continue;
      latestClaimsByItemId.set(claim.item_id, {
        id: claim.id,
        status: claim.status as ClaimStatus,
        claimer_id: claim.claimer_id,
        claimer: claimerProfileMap.get(claim.claimer_id) || null,
      });
    }

    return items.map((item) => ({
      ...item,
      claim: latestClaimsByItemId.get(item.id) || null,
    })) as WishlistItem[];
  };

  const buildWishlistShareUrl = (wishlistId: string) => {
    return `${window.location.origin}/wishlist/${encodeURIComponent(wishlistId)}`;
  };

  const handleShareWishlist = async (list: Wishlist) => {
    if (!list.allow_sharing || list.privacy !== "public") {
      toast.error(isAr ? "اجعل القائمة عامة لتتمكن من مشاركتها" : "Make the wishlist public to share it");
      return;
    }

    const shareUrl = buildWishlistShareUrl(list.id);

    try {
      if (navigator.share) {
        await navigator.share({
          title: list.title,
          text: isAr ? "هذه قائمتي للرغبات على Wakti" : "Here is my Wakti wishlist",
          url: shareUrl,
        });
        return;
      }
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") {
        return;
      }
    }

    const copied = await safeCopyToClipboard(shareUrl);
    if (copied) {
      toast.success(isAr ? "تم نسخ رابط القائمة" : "Wishlist link copied");
      return;
    }

    toast.error(isAr ? "تعذر نسخ رابط القائمة" : "Couldn't copy wishlist link");
  };

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
          const [{ count: itemCount }, { count: pendingClaimCount }] = await Promise.all([
            supabase
              .from("wishlist_items")
              .select("id", { count: "exact", head: true })
              .eq("wishlist_id", list.id),
            supabase
              .from("wishlist_claims")
              .select("id", { count: "exact", head: true })
              .eq("wishlist_id", list.id)
              .eq("owner_id", user.id)
              .eq("status", "pending"),
          ]);
          return {
            ...list,
            item_count: itemCount || 0,
            pending_claim_count: pendingClaimCount || 0,
          };
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
      return await enrichItemsWithClaims((data || []) as WishlistItem[]);
    },
    enabled: !!selectedListId,
  });

  // ── Fetch friend wishlists ──────────────────────────────────────────────────
  const { data: friendLists = [], isLoading: loadingFriendLists } = useQuery({
    queryKey: ["wishlists", "friends", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const contacts = await getContacts();
      if (!contacts || contacts.length === 0) return [];
      const contactIds = contacts.map((contact) => contact.contact_id);
      const { data: lists, error } = await supabase
        .from("wishlists")
        .select("*")
        .in("user_id", contactIds)
        .neq("privacy", "private")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = (lists || []) as Wishlist[];
      if (rows.length === 0) return [];

      const ownerIds = Array.from(new Set(rows.map((list) => list.user_id)));
      const { data: ownerProfiles, error: ownerProfilesError } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", ownerIds);

      if (ownerProfilesError) throw ownerProfilesError;

      const ownerProfileMap = new Map(
        (ownerProfiles || []).map((profile) => [
          profile.id,
          {
            username: profile.username || "unknown",
            display_name: profile.display_name || "",
            avatar_url: profile.avatar_url || undefined,
          },
        ])
      );

      return rows.map((list) => ({
        ...list,
        owner: ownerProfileMap.get(list.user_id) || { username: "unknown", display_name: "" },
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
      return await enrichItemsWithClaims((data || []) as WishlistItem[]);
    },
    enabled: !!selectedFriendListId,
  });

  const { data: sharedList, isLoading: loadingSharedList } = useQuery({
    queryKey: ["wishlists", "shared", sharedListId, user?.id],
    queryFn: async () => {
      if (!sharedListId) return null;

      const { data, error } = await supabase
        .from("wishlists")
        .select("*")
        .eq("id", sharedListId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const row = data as Wishlist;
      if (row.user_id !== user?.id && (!row.allow_sharing || row.privacy !== "public")) {
        return null;
      }

      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("id", row.user_id)
        .maybeSingle();

      return {
        ...row,
        owner: ownerProfile || { username: "unknown", display_name: "" },
      } as FriendWishlist;
    },
    enabled: !!sharedListId,
  });

  const { data: sharedListItems = [], isLoading: loadingSharedItems } = useQuery({
    queryKey: ["wishlist-items", "shared", sharedListId],
    queryFn: async () => {
      if (!sharedListId) return [];
      const { data, error } = await supabase
        .from("wishlist_items")
        .select("*")
        .eq("wishlist_id", sharedListId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return await enrichItemsWithClaims((data || []) as WishlistItem[]);
    },
    enabled: !!sharedListId && !!sharedList,
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
      setNewListTitle("");
      setNewListDesc("");
      setNewListDate("");
      setNewListPrivacy("contacts");
      setNewListAllowClaims(true);
      setNewListAutoApprove(false);
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
      setView("my");
      setSelectedListId(null);
    },
  });

  // ── Add Item ────────────────────────────────────────────────────────────────
  const addItemMutation = useMutation({
    mutationFn: async () => {
      if (!selectedListId || !itemTitle.trim()) return;
      let finalImageUrl: string | null = null;

      if (itemMode === "manual" && itemImageFile) {
        if (!user?.id) throw new Error("User not authenticated");
        const fileExt = itemImageFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const filePath = `${user.id}/wishlist-items/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, itemImageFile, {
            contentType: itemImageFile.type || "image/jpeg",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(filePath);
        finalImageUrl = publicData?.publicUrl || null;
      }

      if (itemMode === "auto") {
        finalImageUrl = itemImageUrl.trim() || null;
      }

      const { error } = await supabase.from("wishlist_items").insert({
        wishlist_id: selectedListId,
        user_id: user?.id,
        title: itemTitle.trim(),
        description: itemDesc.trim() || null,
        image_url: finalImageUrl,
        product_url: itemMode === "auto" ? itemUrl.trim() || null : null,
        priority: itemPriority,
        ai_extracted: itemAIExtracted,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist-items"] });
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
      queryClient.invalidateQueries({ queryKey: ["wishlist-items"] });
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
      queryClient.invalidateQueries({ queryKey: ["wishlist-items"] });
      toast.success(isAr ? "تم تحديده كمُستلَم 🎁" : "Marked as received! 🎁");
    },
  });

  // ── Claim Item (as a friend) ────────────────────────────────────────────────
  const claimItemMutation = useMutation({
    mutationFn: async ({ itemId, ownerId, autoApprove, wishlistId }: { itemId: string; ownerId: string; autoApprove: boolean; wishlistId: string }) => {
      const status = autoApprove ? "approved" : "pending";
      const { error } = await supabase.from("wishlist_claims").insert({
        item_id: itemId,
        wishlist_id: wishlistId,
        claimer_id: user?.id,
        owner_id: ownerId,
        status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist-items"] });
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
      queryClient.invalidateQueries({ queryKey: ["wishlist-items"] });
      toast.success(isAr ? "تم إلغاء الحجز" : "Claim removed");
    },
  });

  const approveClaimMutation = useMutation({
    mutationFn: async (claimId: string) => {
      const { error } = await supabase
        .from("wishlist_claims")
        .update({ status: "approved", resolved_at: new Date().toISOString() })
        .eq("id", claimId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist-items"] });
      queryClient.invalidateQueries({ queryKey: ["wishlists", "mine"] });
      toast.success(isAr ? "تمت الموافقة على الحجز" : "Claim approved");
    },
    onError: () => toast.error(isAr ? "تعذرت الموافقة على الحجز" : "Couldn't approve the claim"),
  });

  const declineClaimMutation = useMutation({
    mutationFn: async (claimId: string) => {
      const { error } = await supabase
        .from("wishlist_claims")
        .update({ status: "declined", resolved_at: new Date().toISOString() })
        .eq("id", claimId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist-items"] });
      queryClient.invalidateQueries({ queryKey: ["wishlists", "mine"] });
      toast.success(isAr ? "تم رفض الحجز" : "Claim declined");
    },
    onError: () => toast.error(isAr ? "تعذر رفض الحجز" : "Couldn't decline the claim"),
  });

  // ── AI Extract from URL ─────────────────────────────────────────────────────
  const handleAIExtractURL = async () => {
    if (!itemUrl.trim()) {
      toast.error(isAr ? "أدخل رابط المنتج" : "Enter a product URL");
      return;
    }
    setItemAIExtracted(false);
    setIsExtractingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke<WishlistAIExtractResponse>("wishlist-ai-extract", {
        body: {
          mode: "url",
          url: itemUrl.trim(),
          language: isAr ? "ar" : "en",
        },
      });
      if (error) throw error;
      if (data?.success) {
        applyExtractedItemDetails(data);
        setItemAIExtracted(true);
        toast.success(isAr ? "تم استخراج التفاصيل ✨" : "Details extracted ✨");
      } else {
        setItemAIExtracted(false);
        toast.error(data?.error || (isAr ? "لم أتمكن من قراءة الرابط" : "Couldn't read the URL"));
      }
    } catch {
      setItemAIExtracted(false);
      toast.error(isAr ? "حدث خطأ في الاستخراج" : "Extraction failed");
    } finally {
      setIsExtractingAI(false);
    }
  };

  const handleManualItemImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(isAr ? "اختر صورة صحيحة" : "Please choose a valid image");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(isAr ? "حجم الصورة يجب أن يكون أقل من 5MB" : "Image must be smaller than 5MB");
      return;
    }

    if (itemImagePreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(itemImagePreviewUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    setItemImageFile(file);
    setItemImagePreviewUrl(previewUrl);
    setItemImageUrl("");
    setItemAIExtracted(false);
  };

  const handleAnalyzeManualImage = async () => {
    if (!itemImageFile) {
      toast.error(isAr ? "ارفع صورة أولاً" : "Upload a photo first");
      return;
    }

    setIsAnalyzingImage(true);
    setItemAIExtracted(false);
    try {
      const imageBase64 = await fileToBase64(itemImageFile);
      const { data, error } = await supabase.functions.invoke<WishlistAIExtractResponse>("wishlist-ai-extract", {
        body: {
          mode: "image",
          imageBase64,
          mimeType: itemImageFile.type || "image/jpeg",
          language: isAr ? "ar" : "en",
        },
      });
      if (error) throw error;
      if (data?.success) {
        applyExtractedItemDetails(data);
        setItemAIExtracted(Boolean(data.title || data.description));
        toast.success(isAr ? "تم اقتراح الاسم والوصف ✨" : "Name and description suggested ✨");
      } else {
        toast.error(data?.error || (isAr ? "تعذر تحليل الصورة" : "Couldn't analyze the image"));
      }
    } catch {
      toast.error(isAr ? "تعذر تحليل الصورة" : "Couldn't analyze the image");
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const clearManualItemImage = () => {
    if (itemImagePreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(itemImagePreviewUrl);
    }
    setItemImageFile(null);
    setItemImagePreviewUrl("");
    setItemAIExtracted(false);
    if (itemImageInputRef.current) {
      itemImageInputRef.current.value = "";
    }
  };

  // ── AI Generate Thank You ───────────────────────────────────────────────────
  const handleGenerateThankYou = async (claimerName: string, itemTitle: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("wakti-ai-v2-brain-stream", {
        body: {
          messages: [
            {
              role: "user",
              content: `Write a warm, short thank-you message (2-3 sentences) for receiving "${itemTitle}" from ${claimerName}. Be genuine and heartfelt. Return only the message text.`,
            },
          ],
          mode: "chat",
          stream: false,
        },
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
    if (itemImagePreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(itemImagePreviewUrl);
    }
    setItemTitle("");
    setItemDesc("");
    setItemUrl("");
    setItemImageUrl("");
    setItemImageFile(null);
    setItemImagePreviewUrl("");
    setItemAIExtracted(false);
    setItemPriority(2);
    setItemMode("manual");
    setIsExtractingAI(false);
    setIsAnalyzingImage(false);
    if (itemImageInputRef.current) {
      itemImageInputRef.current.value = "";
    }
  };

  const selectedList = myLists.find((l) => l.id === selectedListId);
  const selectedFriendList = friendLists.find((l) => l.id === selectedFriendListId) as FriendWishlist | undefined;
  const visibleFriendLists = contactFilterId
    ? friendLists.filter((list) => list.user_id === contactFilterId)
    : friendLists;
  const selectedFriendOwnerListCount = selectedFriendList
    ? friendLists.filter((list) => list.user_id === selectedFriendList.user_id).length
    : 0;
  const selectedFriendOwnerName = selectedFriendList
    ? selectedFriendList.owner?.display_name || selectedFriendList.owner?.username || (isAr ? "صديقك" : "Your contact")
    : "";

  const handleBackFromFriendListDetail = () => {
    if (contactFilterId) {
      blockedContactAutoOpenRef.current = contactFilterId;
    }

    setSelectedFriendListId(null);
    setView("friends");
  };

  const handleShowFriendWishlistGroup = (ownerUserId: string) => {
    blockedContactAutoOpenRef.current = ownerUserId;
    setContactFilterId(ownerUserId);
    setSelectedFriendListId(null);
    setView("friends");
  };

  useEffect(() => {
    if (!contactFilterId || view !== "friends" || selectedFriendListId || visibleFriendLists.length !== 1) {
      return;
    }

    if (blockedContactAutoOpenRef.current === contactFilterId) {
      blockedContactAutoOpenRef.current = null;
      return;
    }

    setSelectedFriendListId(visibleFriendLists[0].id);
    setView("friend-list-detail");
  }, [contactFilterId, selectedFriendListId, view, visibleFriendLists]);

  // ── RENDER: Top nav tabs ────────────────────────────────────────────────────
  const renderTopTabs = () => (
    <div className="flex gap-2 mb-6">
      <button
        onClick={() => {
          setView("my");
          setSelectedListId(null);
          setSelectedFriendListId(null);
          setSharedListId(null);
          setContactFilterId(null);
        }}
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
        onClick={() => { setView("friends"); setSelectedListId(null); setSelectedFriendListId(null); setSharedListId(null); }}
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
                      {(list.pending_claim_count || 0) > 0 && (
                        <Badge className="text-xs bg-orange-500/15 text-orange-600 border-orange-400/30">
                          ⏳ {list.pending_claim_count} {isAr ? "بانتظار الموافقة" : "pending"}
                        </Badge>
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
    const pendingClaimCount = loadingItems
      ? selectedList.pending_claim_count || 0
      : listItems.filter((item) => item.claim?.status === "pending").length;
    return (
      <div>
        {/* Back + Header */}
        <div className="flex items-center gap-3 mb-4">
          <button 
            onClick={navigateBackToSource}
            className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-[hsl(210,100%,55%)] to-[hsl(195,100%,50%)] text-white shadow-lg active:scale-95 transition-transform"
            aria-label={isAr ? "رجوع" : "Back"}
            title={isAr ? "رجوع" : "Back"}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg truncate">{selectedList.title}</h2>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <PrivacyIcon className={cn("h-3 w-3", privacyConfig[selectedList.privacy].color)} />
              {privacyConfig[selectedList.privacy].label[isAr ? "ar" : "en"]}
              {selectedList.allow_claims && (
                <span className="ml-1 text-green-500">• {isAr ? "الحجز مفعّل" : "Claims enabled"}</span>
              )}
            </div>
            {pendingClaimCount > 0 && (
              <div className="mt-1.5">
                <Badge className="text-xs bg-orange-500/15 text-orange-600 border-orange-400/30">
                  ⏳ {pendingClaimCount} {isAr ? "حجوزات بانتظار موافقتك" : "pending claims need your approval"}
                </Badge>
              </div>
            )}
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
          className="w-full mb-2 bg-gradient-to-r from-[hsl(210,100%,65%)] to-[hsl(195,100%,60%)] text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          {isAr ? "إضافة رغبة" : "Add a Wish"}
        </Button>
        <Button
          variant="outline"
          className="w-full mb-4"
          onClick={() => handleShareWishlist(selectedList)}
        >
          <Share2 className="h-4 w-4 mr-2" />
          {isAr ? "مشاركة القائمة" : "Share Wishlist"}
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
                onApproveClaim={() => item.claim && approveClaimMutation.mutate(item.claim.id)}
                onDeclineClaim={() => item.claim && declineClaimMutation.mutate(item.claim.id)}
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
      ) : visibleFriendLists.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="text-5xl">👥</div>
          <p className="text-lg font-semibold">{contactFilterId ? (isAr ? "لا توجد قوائم لهذا الصديق" : "This contact has no visible wishlists") : (isAr ? "لا توجد قوائم من الأصدقاء" : "No friend wishlists yet")}</p>
          <p className="text-sm text-muted-foreground">
            {contactFilterId ? (isAr ? "إذا كانت القائمة عامة أو لجهات الاتصال فستظهر هنا." : "If their wishlist is public or contacts-visible, it will appear here.") : (isAr ? "سيظهر هنا قوائم أصدقائك عندما يشاركونها" : "Your friends' lists will appear here once they share them")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleFriendLists.map((list) => {
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
    const ownerUsername = fl.owner?.username ? `@${fl.owner.username}` : selectedFriendOwnerName;
    const friendEventLabel = fl.event_date
      ? new Date(fl.event_date).toLocaleDateString(isAr ? "ar" : "en")
      : null;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBackFromFriendListDetail}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">
              {contactFilterId ? (isAr ? "قوائم هذا الصديق" : "This contact's wishlists") : (isAr ? "قوائم الأصدقاء" : "Friend wishlists")}
            </p>
            <p className="font-semibold truncate">
              {contactFilterId && selectedFriendOwnerListCount > 1
                ? (isAr ? `العودة إلى ${selectedFriendOwnerListCount} قوائم` : `Back to ${selectedFriendOwnerListCount} wishlists`)
                : (isAr ? "العودة" : "Back")}
            </p>
          </div>
        </div>

        <Card className="border border-border/60 bg-card/80">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Avatar className="h-11 w-11 flex-shrink-0">
                {fl.owner?.avatar_url && <AvatarImage src={fl.owner.avatar_url} />}
                <AvatarFallback>{(fl.owner?.username || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-lg leading-tight break-words">{selectedFriendList.title}</h2>
                  {selectedFriendOwnerListCount > 1 && (
                    <Badge variant="secondary" className="text-xs">
                      {selectedFriendOwnerListCount} {isAr ? "قوائم" : "wishlists"}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground break-words">
                  {selectedFriendOwnerName}
                  {fl.owner?.username ? ` • ${ownerUsername}` : ""}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {friendEventLabel && (
                <Badge variant="outline" className="text-xs">
                  📅 {friendEventLabel}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                🧾 {loadingFriendItems ? (isAr ? "جارٍ تحميل العناصر..." : "Loading items...") : `${friendListItems.length} ${isAr ? "عناصر" : "items"}`}
              </Badge>
              {selectedFriendList.allow_claims && (
                <Badge className="text-xs bg-green-500/15 text-green-600 border-green-400/30">
                  🎁 {isAr ? "الحجز مفتوح" : "Claims open"}
                </Badge>
              )}
            </div>

            {selectedFriendList.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                {selectedFriendList.description}
              </p>
            )}

            {selectedFriendOwnerListCount > 1 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleShowFriendWishlistGroup(selectedFriendList.user_id)}
              >
                <Users className="h-4 w-4 mr-2" />
                {isAr ? `عرض كل قوائم ${selectedFriendOwnerName}` : `View all ${selectedFriendOwnerListCount} wishlists`}
              </Button>
            )}
          </CardContent>
        </Card>

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
                    wishlistId: selectedFriendList.id,
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

  const renderSharedListDetail = () => {
    if (loadingSharedList) {
      return (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (!sharedList) {
      return (
        <div className="space-y-4">
          <Button variant="ghost" size="icon" onClick={() => { setSharedListId(null); setView("my"); navigate(buildWishlistRoute()); }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-center py-12 space-y-3">
            <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="text-lg font-semibold">{isAr ? "القائمة غير متاحة" : "Wishlist unavailable"}</p>
            <p className="text-sm text-muted-foreground">{isAr ? "الرابط غير صالح أو أن هذه القائمة غير قابلة للمشاركة" : "This link is invalid or this wishlist is not shareable"}</p>
          </div>
        </div>
      );
    }

    const sharedListIsOwner = sharedList.user_id === user?.id;
    const ownerName = sharedList.owner?.display_name || sharedList.owner?.username || (isAr ? "صاحب القائمة" : "Wishlist owner");

    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => { setSharedListId(null); setView("my"); navigate(buildWishlistRoute()); }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-8 w-8">
            {sharedList.owner?.avatar_url && <AvatarImage src={sharedList.owner.avatar_url} />}
            <AvatarFallback>{(sharedList.owner?.display_name || sharedList.owner?.username || "?").charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-base truncate">{sharedList.title}</h2>
            <p className="text-xs text-muted-foreground">{sharedListIsOwner ? (isAr ? "هذه قائمتك المشتركة" : "This is your shared wishlist") : `@${sharedList.owner?.username || ownerName}`}</p>
          </div>
        </div>

        {sharedListIsOwner && (
          <Button
            variant="outline"
            className="w-full mb-4"
            onClick={() => handleShareWishlist(sharedList)}
          >
            <Share2 className="h-4 w-4 mr-2" />
            {isAr ? "مشاركة القائمة" : "Share Wishlist"}
          </Button>
        )}

        {loadingSharedItems ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sharedListItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{isAr ? "القائمة فارغة حتى الآن" : "List is empty for now"}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sharedListItems.map((item) => (
              <WishlistItemCard
                key={item.id}
                item={item}
                isOwner={sharedListIsOwner}
                isAr={isAr}
                allowClaims={sharedList.allow_claims}
                currentUserId={user?.id}
                onDelete={sharedListIsOwner ? () => deleteItemMutation.mutate(item.id) : undefined}
                onMarkReceived={sharedListIsOwner ? () => markReceivedMutation.mutate(item.id) : undefined}
                onClaim={() =>
                  claimItemMutation.mutate({
                    itemId: item.id,
                    ownerId: sharedList.user_id,
                    autoApprove: sharedList.auto_approve_claims,
                    wishlistId: sharedList.id,
                  })
                }
                onUnclaim={() => item.claim && unclaimMutation.mutate(item.claim.id)}
                onGenerateThankYou={() => handleGenerateThankYou(ownerName, item.title)}
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
    onApproveClaim?: () => void;
    onDeclineClaim?: () => void;
    onGenerateThankYou?: () => Promise<string>;
  }

  function WishlistItemCard({
    item, isOwner, isAr, allowClaims = false,
    currentUserId, onDelete, onMarkReceived, onClaim, onUnclaim, onApproveClaim, onDeclineClaim, onGenerateThankYou
  }: WishlistItemCardProps) {
    const [showThankYou, setShowThankYou] = useState(false);
    const [thankYouMsg, setThankYouMsg] = useState("");
    const [generatingTY, setGeneratingTY] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);

    const isMyClaim = item.claim?.claimer_id === currentUserId;
    const isClaimedByOther = item.claim && !isMyClaim && item.claim.status !== "unclaimed";
    const isClaimedByMe = isMyClaim && item.claim?.status !== "unclaimed";
    const pConfig = priorityConfig[item.priority as keyof typeof priorityConfig] || priorityConfig[2];
    const canExpand = item.title.length > 28 || Boolean(item.description && item.description.length > 90);
    const claimDisplayName = item.claim?.claimer?.display_name || item.claim?.claimer?.username || (isAr ? "أحد الأصدقاء" : "a friend");

    const handleGenerateTY = async () => {
      if (!onGenerateThankYou) return;
      setGeneratingTY(true);
      const msg = await onGenerateThankYou();
      setThankYouMsg(msg);
      setGeneratingTY(false);
      setShowThankYou(true);
    };

    return (
      <>
        <Card className={cn(
          "border transition-all",
          item.is_received && "opacity-60",
          isClaimedByOther && "border-orange-400/40 bg-orange-500/5"
        )}>
          <CardContent className="p-3">
            <div className="flex gap-3">
              {item.image_url && (
                <button
                  type="button"
                  className="w-16 h-16 rounded-lg flex-shrink-0 border overflow-hidden cursor-zoom-in active:scale-[0.98] transition-transform"
                  onClick={() => setExpandedImageUrl(item.image_url || null)}
                  title={isAr ? "اضغط لتكبير الصورة" : "Tap to enlarge image"}
                >
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const wrapper = (e.target as HTMLImageElement).parentElement;
                      if (wrapper) {
                        wrapper.style.display = "none";
                      }
                    }}
                  />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "font-semibold text-sm",
                      isExpanded ? "whitespace-normal break-words" : "truncate",
                      item.is_received && "line-through text-muted-foreground"
                    )}>
                      {item.title}
                      {item.ai_extracted && (
                        <Sparkles className="h-3 w-3 inline ml-1 text-purple-500" />
                      )}
                    </p>
                    {item.description && (
                      <p className={cn(
                        "text-xs text-muted-foreground mt-0.5",
                        isExpanded ? "whitespace-pre-wrap break-words" : "truncate"
                      )}>{item.description}</p>
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
                    {canExpand && (
                      <button
                        type="button"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[hsl(210,100%,65%)]"
                        onClick={() => setIsExpanded((prev) => !prev)}
                      >
                        <span>{isExpanded ? (isAr ? "إخفاء" : "Show less") : (isAr ? "عرض المزيد" : "Show more")}</span>
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")} />
                      </button>
                    )}
                  </div>
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

                {isOwner && item.claim && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge className={cn(
                      "text-xs border",
                      item.claim.status === "pending"
                        ? "bg-orange-500/15 text-orange-600 border-orange-400/30"
                        : "bg-green-500/15 text-green-600 border-green-400/30"
                    )}>
                      {item.claim.status === "pending"
                        ? `⏳ ${isAr ? `طلب حجز من ${claimDisplayName}` : `Claim request from ${claimDisplayName}`}`
                        : `✅ ${isAr ? `محجوز بواسطة ${claimDisplayName}` : `Claimed by ${claimDisplayName}`}`}
                    </Badge>
                    {item.claim.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          className="min-h-10 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
                          onClick={onApproveClaim}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          {isAr ? "موافقة" : "Approve"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-10 px-3 text-xs"
                          onClick={onDeclineClaim}
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          {isAr ? "رفض" : "Decline"}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>

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

        <Dialog open={!!expandedImageUrl} onOpenChange={(open) => !open && setExpandedImageUrl(null)}>
          <DialogContent className="max-w-3xl p-3 sm:p-4">
            <DialogHeader>
              <DialogTitle className="truncate pr-8">{item.title}</DialogTitle>
            </DialogHeader>
            {expandedImageUrl && (
              <div className="overflow-hidden rounded-xl border bg-muted/20">
                <img
                  src={expandedImageUrl}
                  alt={item.title}
                  className="w-full max-h-[75vh] object-contain"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  };

  // ─── PAGE LAYOUT ─────────────────────────────────────────────────────────────
  return (
    <div className={cn("flex flex-col p-4 pb-28 min-h-screen", isAr && "rtl")}>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-start gap-3">
          {(view === "my" || view === "friends") && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={handleRootBack}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[hsl(210,100%,65%)] to-[hsl(195,100%,60%)] bg-clip-text text-transparent">
              {isAr ? "رغباتي" : "Wishlists"}
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
      {view === "shared-list-detail" && renderSharedListDetail()}

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
             {(["manual", "auto"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setItemMode(mode)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-semibold transition-all",
                    itemMode === mode
                      ? "bg-[hsl(210,100%,55%)] text-white"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {mode === "manual" && <><Edit3 className="h-3.5 w-3.5 inline mr-1" />{isAr ? "يدوي" : "Manual"}</>}
                  {mode === "auto" && <><Sparkles className="h-3.5 w-3.5 inline mr-1" />{isAr ? "تلقائي" : "Auto"}</>}
                </button>
              ))}
            </div>

            {itemMode === "manual" && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="wish-photo-upload">{isAr ? "صورة الرغبة" : "Wish photo"}</Label>
                  <input
                    id="wish-photo-upload"
                    ref={itemImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleManualItemImageChange}
                    className="hidden"
                    aria-label={isAr ? "رفع صورة الرغبة" : "Upload wish photo"}
                    title={isAr ? "رفع صورة الرغبة" : "Upload wish photo"}
                  />
                  {!itemImagePreviewUrl && (
                    <button
                      type="button"
                      onClick={() => itemImageInputRef.current?.click()}
                      className="mt-1 flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[hsl(210,100%,55%)]/40 bg-[hsl(210,100%,55%)]/5 px-4 py-5 text-center active:scale-[0.98] transition-transform"
                    >
                      <ImageIcon className="h-5 w-5 text-[hsl(210,100%,55%)]" />
                      <span className="text-sm font-medium text-foreground">
                        {isAr ? "ارفع صورة للرغبة" : "Upload a wish photo"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {isAr ? "JPG, PNG, WEBP حتى 5MB" : "JPG, PNG, WEBP up to 5MB"}
                      </span>
                    </button>
                  )}
                </div>

                {itemImagePreviewUrl && (
                  <div className="rounded-xl border border-border/60 p-3 space-y-3">
                    <img
                      src={itemImagePreviewUrl}
                      alt={isAr ? "معاينة الصورة" : "Image preview"}
                      className="h-40 w-full rounded-lg object-cover"
                    />
                    {isAnalyzingImage && (
                      <div className="flex items-center gap-2 rounded-lg bg-[hsl(210,100%,55%)]/8 px-3 py-2 text-sm text-[hsl(210,100%,55%)]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{isAr ? "Wakti AI يحلل الصورة..." : "Wakti AI is analyzing the image..."}</span>
                      </div>
                    )}
                    <Button
                      type="button"
                      className="w-full bg-gradient-to-r from-[hsl(210,100%,65%)] to-[hsl(195,100%,60%)] text-white"
                      onClick={handleAnalyzeManualImage}
                      disabled={isAnalyzingImage || !itemImageFile}
                    >
                      {isAnalyzingImage ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                      {isAr ? "حلل الصورة بالذكاء الاصطناعي" : "Analyze photo with AI"}
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button type="button" variant="outline" className="w-full" onClick={() => itemImageInputRef.current?.click()}>
                        <ImageIcon className="h-4 w-4 mr-2" />
                        {isAr ? "تغيير الصورة" : "Change photo"}
                      </Button>
                      <Button type="button" variant="outline" className="w-full" onClick={clearManualItemImage}>
                        <X className="h-4 w-4 mr-2" />
                        {isAr ? "إزالة الصورة" : "Remove photo"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Auto mode — AI extract */}
            {itemMode === "auto" && (
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

                {itemImageUrl && (
                  <div className="rounded-xl border border-border/60 p-3">
                    <img
                      src={itemImageUrl}
                      alt={isAr ? "صورة مستخرجة" : "Extracted wish image"}
                      className="h-40 w-full rounded-lg object-cover"
                    />
                  </div>
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
