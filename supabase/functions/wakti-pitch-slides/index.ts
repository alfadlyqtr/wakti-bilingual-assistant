// @ts-nocheck: Deno/Supabase edge runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { logAIFromRequest } from "../_shared/aiLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Dokie-style rich slide structure from outline
interface SlideOutline {
  slideNumber: number;
  role: string;
  title: string;
  subtitle?: string;
  bullets: string[];
  highlightedStats?: string[];
  columns?: { title: string; description: string; icon: string }[];
  imageHint?: string;
  layoutHint: string;
  footer?: string;
}

interface SlidesRequest {
  outline: SlideOutline[];
  brief: {
    subject: string;
    objective: string;
    audience: string;
    scenario: string;
    tone: string;
  };
  theme: string;
  language: string;
}

// Final slide with all data for rendering
interface Slide {
  id: string;
  slideNumber: number;
  role: string;
  layoutType: string;
  theme: string;
  title: string;
  subtitle?: string;
  bullets: string[];
  highlightedStats?: string[];
  columns?: { title: string; description: string; icon: string }[];
  imageUrl?: string;
  imageMeta?: {
    photographer?: string;
    photographerUrl?: string;
    pexelsUrl?: string;
  };
  footer?: string;
}

// ALL slides get images now (except cover and thank_you which are text-focused)
const SKIP_IMAGE_ROLES = ["cover", "thank_you", "contents"];

async function fetchPexelsImage(query: string): Promise<{ url: string; meta: Slide["imageMeta"] } | null> {
  const pexelsKey = Deno.env.get("PEXELS_API_KEY");
  if (!pexelsKey) {
    console.warn("PEXELS_API_KEY not configured");
    return null;
  }

  try {
    // Clean and simplify query - extract key nouns, remove filler words
    let cleanQuery = query
      .replace(/[^\w\s]/g, " ")
      .replace(/\b(the|a|an|and|or|of|in|on|at|to|for|with|by|from|about|into|through|during|before|after|above|below|between|under|over|out|up|down|off|professional|business|hero|banner|overview|infographic|illustration|concept|image|photo|picture)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 50);
    
    // If query is too short after cleaning, use original
    if (cleanQuery.length < 5) {
      cleanQuery = query.replace(/[^\w\s]/g, " ").substring(0, 50);
    }
    
    console.log("Pexels search query:", cleanQuery);
    const url = "https://api.pexels.com/v1/search?query=" + encodeURIComponent(cleanQuery) + "&per_page=5&orientation=landscape";
    
    const res = await fetch(url, {
      headers: { Authorization: pexelsKey },
    });

    if (!res.ok) {
      console.error("Pexels error:", res.status);
      return null;
    }

    const data = await res.json();
    const photos = data?.photos || [];
    if (photos.length === 0) {
      console.log("No Pexels results for:", cleanQuery);
      return null;
    }
    
    // Pick a random photo from results for variety
    const photo = photos[Math.floor(Math.random() * photos.length)];
    console.log("Selected photo:", photo.id, "from", photos.length, "results");

    return {
      url: photo.src?.large || photo.src?.medium,
      meta: {
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
        pexelsUrl: photo.url,
      },
    };
  } catch (err) {
    console.error("Pexels fetch error:", err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const outline = body.outline;
    const brief = body.brief;
    const theme = body.theme || "professional";

    if (!outline || outline.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Outline is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generating " + outline.length + " Dokie-style slides");

    const slides = [];
    let imageCount = 0;
    const maxImages = 15; // Fetch images for all content slides

    for (let i = 0; i < outline.length; i++) {
      const outlineSlide = outline[i];
      const role = outlineSlide.role || "content";
      
      console.log("Processing slide " + (i + 1) + ": " + outlineSlide.title + " (" + role + ")");

      // Fetch image for ALL slides except cover/thank_you/contents
      let imageData = null;
      const skipImage = SKIP_IMAGE_ROLES.includes(role);
      
      if (!skipImage && imageCount < maxImages) {
        // ALWAYS use the presentation topic as the PRIMARY search term
        // This ensures images are relevant to the actual topic
        const mainTopic = brief.subject;
        const slideHint = outlineSlide.imageHint || "";
        
        // Build query: ALWAYS start with the main topic
        // Then add slide-specific hint if it adds value
        let query = mainTopic;
        
        // Only add slideHint if it's different from the topic and adds context
        if (slideHint && !slideHint.toLowerCase().includes(mainTopic.toLowerCase())) {
          // Extract useful keywords from hint (remove generic words)
          const usefulHint = slideHint
            .replace(/\b(overview|infographic|concept|illustration|banner|professional|business|chart|data|statistics)\b/gi, "")
            .trim();
          if (usefulHint.length > 3) {
            query = mainTopic + " " + usefulHint;
          }
        }
        
        console.log("🖼️ Pexels search for slide " + (i + 1) + ": \"" + query + "\"");
        imageData = await fetchPexelsImage(query);
        if (imageData) {
          imageCount++;
          console.log("✅ Found image for slide " + (i + 1));
        } else {
          console.log("⚠️ No image found for slide " + (i + 1));
        }
      }

      // Build the final slide
      const slide = {
        id: "slide-" + outlineSlide.slideNumber,
        slideNumber: outlineSlide.slideNumber,
        role: role,
        layoutType: outlineSlide.layoutHint || "title_and_bullets",
        theme: theme,
        title: outlineSlide.title,
        subtitle: outlineSlide.subtitle || null,
        bullets: outlineSlide.bullets || [],
        highlightedStats: outlineSlide.highlightedStats || [],
        columns: outlineSlide.columns || null,
        imageUrl: imageData ? imageData.url : null,
        imageMeta: imageData ? imageData.meta : null,
        footer: outlineSlide.footer || brief.subject.substring(0, 30).toUpperCase(),
      };

      slides.push(slide);
    }

    console.log("Generated " + slides.length + " slides with " + imageCount + " images");

    // Log successful AI usage (image generation)
    await logAIFromRequest(req, {
      functionName: "wakti-pitch-slides",
      provider: "runware",
      model: "runware:97@2",
      inputText: brief.subject,
      status: "success",
      metadata: { slideCount: slides.length, imageCount }
    });

    return new Response(
      JSON.stringify({ success: true, slides: slides }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    
    // Log failed AI usage
    await logAIFromRequest(req, {
      functionName: "wakti-pitch-slides",
      provider: "runware",
      model: "runware:97@2",
      status: "error",
      errorMessage: (error as Error).message
    });

    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message || "Failed to generate slides" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
