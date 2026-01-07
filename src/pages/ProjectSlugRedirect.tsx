import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";

type ProjectRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  published_url: string | null;
};

export default function ProjectSlugRedirect() {
  const { slug } = useParams();
  const { language, theme } = useTheme();
  const isRTL = language === "ar";
  const isDark = theme === "dark";

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const normalizedSlug = useMemo(() => (slug || "").trim(), [slug]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!normalizedSlug) {
        if (!mounted) return;
        setError(isRTL ? "رابط غير صالح" : "Invalid link");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: dbError } = await (supabase
          .from("projects" as any)
          .select("id,name,slug,status,published_url")
          .eq("slug", normalizedSlug)
          .maybeSingle() as any);

        if (dbError) throw dbError;
        if (!mounted) return;

        const p = (data || null) as ProjectRow | null;
        setProject(p);

        if (p?.published_url && (p.status === "published" || p.status === "live")) {
          window.location.replace(p.published_url);
          return;
        }

        setLoading(false);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || (isRTL ? "حدث خطأ" : "Something went wrong"));
        setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [normalizedSlug, isRTL]);

  const title = loading
    ? isRTL
      ? "جارٍ فتح المشروع..."
      : "Opening project..."
    : project
      ? project.name
      : isRTL
        ? "المشروع غير موجود"
        : "Project not found";

  const subtitle = loading
    ? isRTL
      ? "لحظة واحدة"
      : "One moment"
    : project
      ? project.published_url
        ? isRTL
          ? "المشروع غير منشور بعد"
          : "This project is not published yet"
        : isRTL
          ? "المشروع لا يحتوي على رابط نشر"
          : "This project has no published link"
      : isRTL
        ? "تأكد من الرابط"
        : "Check the link";

  return (
    <div
      className={isRTL ? "rtl" : ""}
      style={{
        minHeight: "100vh",
        background: isDark
          ? "linear-gradient(135deg, #0c0f14 0%, hsl(235 25% 7%) 25%, hsl(250 20% 8%) 50%, hsl(260 15% 9%) 75%, #0c0f14 100%)"
          : "linear-gradient(135deg, #fcfefd 0%, hsl(200 25% 95%) 50%, #fcfefd 100%)",
      }}
    >
      <div
        style={{
          maxWidth: 680,
          margin: "0 auto",
          padding: "48px 16px",
          textAlign: isRTL ? "right" : "left",
        }}
      >
        <div
          style={{
            borderRadius: 16,
            padding: 20,
            border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.06)",
            background: isDark
              ? "linear-gradient(135deg, #0c0f14 0%, hsl(235 25% 8%) 30%, hsl(250 20% 10%) 70%, #0c0f14 100%)"
              : "linear-gradient(135deg, #fcfefd 0%, hsl(200 15% 96%) 30%, #fcfefd 100%)",
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, color: isDark ? "#f2f2f2" : "#060541" }}>
            {title}
          </div>
          <div style={{ marginTop: 8, fontSize: 14, color: isDark ? "rgba(242,242,242,0.7)" : "rgba(6,5,65,0.7)" }}>
            {subtitle}
          </div>

          {error ? (
            <div style={{ marginTop: 12, fontSize: 13, color: isDark ? "rgba(242,242,242,0.8)" : "rgba(6,5,65,0.8)" }}>
              {error}
            </div>
          ) : null}

          {!loading ? (
            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <Button asChild>
                <Link to="/projects">{isRTL ? "مشاريعي" : "My Projects"}</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/home">{isRTL ? "الصفحة الرئيسية" : "Home"}</Link>
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
