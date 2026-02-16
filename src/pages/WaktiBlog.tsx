import { useState } from "react";
import { motion } from "framer-motion";
import { useOutletContext, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search } from "lucide-react";
import type { WaktiLang } from "@/components/wakti-landing/WaktiLayout";

export default function WaktiBlog() {
  const { lang } = useOutletContext<{ lang: WaktiLang }>();
  const isAr = lang === "ar";
  const [search, setSearch] = useState("");

  const { data: posts, isLoading } = useQuery({
    queryKey: ["wakti-blog-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("published", true)
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = posts?.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.title?.toLowerCase().includes(q) ||
      p.title_ar?.toLowerCase().includes(q) ||
      p.excerpt?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="pt-24 pb-20 px-5">
      <div className="max-w-4xl mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-5xl font-bold text-center mb-4"
          style={{ color: "#e9ceb0", fontFamily: "'Georgia', serif" }}
        >
          {isAr ? "المدونة" : "Blog"}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-center text-[#858384] mb-10"
        >
          {isAr ? "أحدث الأخبار والمقالات" : "Latest news and articles"}
        </motion.p>

        {/* Search */}
        <div className="max-w-md mx-auto mb-12 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606062]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? "بحث..." : "Search..."}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#e9ceb0]/10 text-sm text-[#e9ceb0] placeholder-[#606062] focus:outline-none focus:border-[#e9ceb0]/30 transition-colors"
            style={{ background: "rgba(21,24,32,0.8)" }}
          />
        </div>

        {isLoading ? (
          <div className="text-center text-[#606062] py-20">
            {isAr ? "جاري التحميل..." : "Loading..."}
          </div>
        ) : !filtered?.length ? (
          <div className="text-center text-[#606062] py-20">
            {isAr ? "لا توجد مقالات بعد." : "No posts yet."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.map((post, i) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <Link
                  to={`/wakti/blog/${post.slug}`}
                  className="block rounded-2xl border border-[#e9ceb0]/8 overflow-hidden hover:border-[#e9ceb0]/20 transition-all group"
                  style={{ background: "linear-gradient(135deg, rgba(21,24,32,0.8), rgba(26,30,40,0.6))" }}
                >
                  {post.cover_image_url && (
                    <div className="aspect-video overflow-hidden">
                      <img
                        src={post.cover_image_url}
                        alt={isAr ? post.title_ar || post.title : post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    <p className="text-xs text-[#606062] mb-2">
                      {post.published_at
                        ? new Date(post.published_at).toLocaleDateString(isAr ? "ar" : "en", {
                            year: "numeric", month: "long", day: "numeric",
                          })
                        : ""}
                      {post.author_name && ` · ${post.author_name}`}
                    </p>
                    <h2 className="text-[#e9ceb0] font-semibold text-lg mb-2 group-hover:text-white transition-colors">
                      {isAr ? post.title_ar || post.title : post.title}
                    </h2>
                    <p className="text-[#858384] text-sm line-clamp-3">
                      {isAr ? post.excerpt_ar || post.excerpt : post.excerpt}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
