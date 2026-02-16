import { motion } from "framer-motion";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ArrowRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import type { WaktiLang } from "@/components/wakti-landing/WaktiLayout";

export default function WaktiBlogPost() {
  const { lang } = useOutletContext<{ lang: WaktiLang }>();
  const isAr = lang === "ar";
  const { slug } = useParams<{ slug: string }>();

  const { data: post, isLoading } = useQuery({
    queryKey: ["wakti-blog-post", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug!)
        .eq("published", true)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="pt-24 pb-20 px-5 text-center text-[#606062]">
        {isAr ? "جاري التحميل..." : "Loading..."}
      </div>
    );
  }

  if (!post) {
    return (
      <div className="pt-24 pb-20 px-5 text-center">
        <p className="text-[#858384] mb-4">{isAr ? "المقال غير موجود." : "Post not found."}</p>
        <Link to="/wakti/blog" className="text-[#e9ceb0] text-sm hover:underline">
          {isAr ? "العودة للمدونة" : "Back to Blog"}
        </Link>
      </div>
    );
  }

  const title = isAr ? post.title_ar || post.title : post.title;
  const content = isAr ? post.content_ar || post.content : post.content;
  const BackArrow = isAr ? ArrowRight : ArrowLeft;

  return (
    <div className="pt-24 pb-20 px-5">
      <div className="max-w-3xl mx-auto">
        <Link
          to="/wakti/blog"
          className="inline-flex items-center gap-2 text-[#858384] text-sm hover:text-[#e9ceb0] transition-colors mb-8"
        >
          <BackArrow size={16} />
          {isAr ? "العودة للمدونة" : "Back to Blog"}
        </Link>

        {post.cover_image_url && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl overflow-hidden mb-8 aspect-video"
          >
            <img
              src={post.cover_image_url}
              alt={title}
              className="w-full h-full object-cover"
            />
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-xs text-[#606062] mb-3">
            {post.published_at &&
              new Date(post.published_at).toLocaleDateString(isAr ? "ar" : "en", {
                year: "numeric", month: "long", day: "numeric",
              })}
            {post.author_name && ` · ${post.author_name}`}
          </p>

          <h1
            className="text-3xl md:text-4xl font-bold mb-8"
            style={{ color: "#e9ceb0", fontFamily: "'Georgia', serif" }}
          >
            {title}
          </h1>

          <article className="prose prose-invert prose-sm max-w-none 
            prose-headings:text-[#e9ceb0] prose-p:text-[#858384] prose-a:text-[#e9ceb0]
            prose-strong:text-[#e9ceb0] prose-li:text-[#858384] prose-blockquote:border-[#e9ceb0]/30">
            <ReactMarkdown rehypePlugins={[rehypeRaw]} remarkPlugins={[remarkGfm]}>
              {content || ""}
            </ReactMarkdown>
          </article>
        </motion.div>
      </div>
    </div>
  );
}
