import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Images } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { ContactsContent } from "@/pages/Contacts";
import { MyGallery } from "@/components/social/MyGallery";
import { emitEvent } from "@/utils/eventBus";
import { clearWaktiOperatorPayload, readWaktiOperatorPayload } from "@/utils/waktiOperator";

const SOCIAL_SECTION_STORAGE_KEY = "wakti_social_last_section";
const SOCIAL_TAB_STORAGE_KEY = "wakti_social_last_tab";
const SOCIAL_VIEW_STORAGE_KEY = "wakti_social_last_view";

const readStoredValue = (key: string, fallback: string) => {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) || fallback;
};

const writeStoredValue = (key: string, value: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
};

const resolveSocialSection = (searchParams: URLSearchParams) => {
  const rawSection = searchParams.has("section")
    ? searchParams.get("section")
    : readStoredValue(SOCIAL_SECTION_STORAGE_KEY, "contacts");
  const section = (rawSection || "contacts").toLowerCase();
  return section === "gallery" ? "gallery" : "contacts";
};

const resolveSocialTab = (searchParams: URLSearchParams) => {
  const rawTab = searchParams.has("tab")
    ? searchParams.get("tab")
    : readStoredValue(SOCIAL_TAB_STORAGE_KEY, "contacts");
  const tab = (rawTab || "contacts").toLowerCase();
  if (["contacts", "requests", "blocked", "groups"].includes(tab)) {
    return tab;
  }
  return "contacts";
};

const resolveSocialView = (searchParams: URLSearchParams) => {
  const rawView = searchParams.has("view")
    ? searchParams.get("view")
    : readStoredValue(SOCIAL_VIEW_STORAGE_KEY, "cards");
  const view = (rawView || "cards").toLowerCase();
  if (["contacts", "cards"].includes(view)) {
    return view as "contacts" | "cards";
  }
  return "cards" as const;
};

export default function Social() {
  const { language } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const operatorPayloadId = searchParams.get("waktiOperator");
  const operatorPayload = useMemo(() => readWaktiOperatorPayload(operatorPayloadId), [operatorPayloadId]);
  const handledOperatorPayloadIdRef = useRef<string | null>(null);

  const initialSection = resolveSocialSection(searchParams);
  const initialContactsTab = resolveSocialTab(searchParams);
  const initialContactView = resolveSocialView(searchParams);

  const openChatUserId = searchParams.get("openChat");
  const [activeSection, setActiveSection] = useState(initialSection);
  const [activeContactsTab, setActiveContactsTab] = useState(initialContactsTab);
  const [contactView, setContactView] = useState<"contacts" | "cards">(initialContactView);

  const clearOperatorFlow = useCallback(() => {
    if (!operatorPayloadId) return;
    clearWaktiOperatorPayload(operatorPayloadId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("waktiOperator");
    setSearchParams(nextParams, { replace: true });
  }, [operatorPayloadId, searchParams, setSearchParams]);

  useEffect(() => {
    setActiveSection(resolveSocialSection(searchParams));
    setActiveContactsTab(resolveSocialTab(searchParams));
    setContactView(resolveSocialView(searchParams));
  }, [searchParams]);

  useEffect(() => {
    writeStoredValue(SOCIAL_SECTION_STORAGE_KEY, activeSection);
  }, [activeSection]);

  useEffect(() => {
    writeStoredValue(SOCIAL_TAB_STORAGE_KEY, activeContactsTab);
  }, [activeContactsTab]);

  useEffect(() => {
    writeStoredValue(SOCIAL_VIEW_STORAGE_KEY, contactView);
  }, [contactView]);

  useEffect(() => {
    if (!operatorPayload?.runId || !operatorPayload.stepRefs?.openStepId || !operatorPayload.social) return;
    emitEvent("wakti-operator-status", {
      runId: operatorPayload.runId,
      stepId: operatorPayload.stepRefs.openStepId,
      status: "completed",
    });
  }, [operatorPayload]);

  useEffect(() => {
    const social = operatorPayload?.social;
    if (!social || handledOperatorPayloadIdRef.current === operatorPayloadId) return;
    const expectedTab = social.tab || "contacts";
    const sectionReady = activeSection === social.section;
    const tabReady = social.section !== "contacts" || activeContactsTab === expectedTab;
    const viewReady = social.section !== "contacts" || expectedTab !== "contacts" || !social.view || contactView === social.view;
    if (!sectionReady || !tabReady || !viewReady) return;
    handledOperatorPayloadIdRef.current = operatorPayloadId;
    if (operatorPayload.runId && operatorPayload.stepRefs?.handoffStepId) {
      emitEvent("wakti-operator-status", {
        runId: operatorPayload.runId,
        stepId: operatorPayload.stepRefs.handoffStepId,
        status: "completed",
      });
    }
    clearOperatorFlow();
  }, [activeContactsTab, activeSection, clearOperatorFlow, contactView, operatorPayload, operatorPayloadId]);

  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("section", section);
    if (section === "gallery") {
      nextParams.delete("tab");
      nextParams.delete("view");
    } else {
      nextParams.set("tab", activeContactsTab);
      if (activeContactsTab === "contacts") {
        nextParams.set("view", contactView);
      }
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleContactsTabChange = (tab: string) => {
    setActiveContactsTab(tab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("section", "contacts");
    nextParams.set("tab", tab);
    if (tab === "contacts") {
      nextParams.set("view", contactView);
    } else {
      nextParams.delete("view");
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleContactViewChange = (view: "contacts" | "cards" | "groups") => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("section", "contacts");

    if (view === "groups") {
      setActiveContactsTab("groups");
      nextParams.set("tab", "groups");
      nextParams.delete("view");
      setSearchParams(nextParams, { replace: true });
      return;
    }

    setContactView(view);
    setActiveContactsTab("contacts");
    nextParams.set("tab", "contacts");
    nextParams.set("view", view);
    setSearchParams(nextParams, { replace: true });
  };

  const clearOpenChat = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("openChat");
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div dir={language === "ar" ? "rtl" : "ltr"} className="flex flex-col px-2.5 sm:px-4 pb-24 pt-4">
      <Tabs value={activeSection} onValueChange={handleSectionChange}>
        <TabsList className="w-full grid grid-cols-2 mb-4 min-h-12 rounded-2xl bg-black/5 dark:bg-white/5 p-1.5 border-0">
          <TabsTrigger value="contacts" className="rounded-xl text-sm font-bold text-foreground/50 data-[state=active]:bg-[hsl(210,100%,55%)] data-[state=active]:text-white data-[state=active]:shadow-none transition-all py-2.5 flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>{language === "ar" ? "التواصل" : "Social"}</span>
          </TabsTrigger>
          <TabsTrigger value="gallery" className="rounded-xl text-sm font-bold text-foreground/50 data-[state=active]:bg-[hsl(25,95%,55%)] data-[state=active]:text-white data-[state=active]:shadow-none transition-all py-2.5 flex items-center gap-2">
            <Images className="h-4 w-4" />
            <span>{language === "ar" ? "معرضي" : "My Gallery"}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="mt-0">
          <ContactsContent
            language={language}
            activeTab={activeContactsTab}
            setActiveTab={handleContactsTabChange}
            contactView={contactView}
            setContactView={handleContactViewChange}
            openChatUserId={openChatUserId}
            clearOpenChat={clearOpenChat}
            source="social"
            operatorPayload={operatorPayload}
            operatorPayloadId={operatorPayloadId}
          />
        </TabsContent>

        <TabsContent value="gallery" className="mt-0">
          <MyGallery />
        </TabsContent>
      </Tabs>
    </div>
  );
}
