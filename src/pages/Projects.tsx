import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BusinessContextForm, { type ContextField, type BusinessContextData } from '@/components/projects/BusinessContextForm';
import { useNavigate, useLocation } from 'react-router-dom';
import RippleGrid from '../components/landing/RippleGrid';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import TrialGateOverlay from '@/components/TrialGateOverlay';
import { Button } from '@/components/ui/button';
import ShareButton from '@/components/ui/ShareButton';
import { 
  Code2, 
  Trash2, 
  Loader2, 
  Paperclip,
  Send,
  MessageSquare,
  Image as ImageIcon,
  FileText,
  ChevronDown,
  Sparkles,
  Eye,
  Plus,
  X,
  Palette,
  Type,
  Layers,
  Square,
  Sun,
  Moon,
  Settings2,
  Share2,
  Copy,
  Check,
  Globe,
  Server,
  Bot,
  MessageCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  template_type: string | null;
  status: string;
  published_url: string | null;
  subdomain: string | null;
  created_at: string;
  updated_at: string;
  thumbnail_url?: string | null;
  files?: Record<string, string>;
}

const WaktiAssistant = lazy(() => import('./WaktiAssistant'));

const MAX_PROJECTS = 3;

// Project Preview Thumbnail Component - premium fallback card
const ProjectPreviewThumbnail = ({ project, isRTL }: { project: Project; isRTL: boolean }) => {
  return (
    <div className="aspect-video relative overflow-hidden bg-[#0c0f14]">
      {project.thumbnail_url ? (
        <img
          src={project.thumbnail_url}
          alt={project.name}
          className="absolute inset-0 w-full h-full object-cover object-top opacity-85"
        />
      ) : null}

      <div className="absolute inset-0 bg-[linear-gradient(135deg,hsl(210_100%_60%)_0%,hsl(280_70%_65%)_50%,hsl(25_95%_60%)_100%)] opacity-35" />
      <div className="absolute -inset-10 bg-[radial-gradient(closest-side,hsla(210,100%,65%,0.35),transparent)]" />
      <div className="absolute inset-0 bg-black/35" />

      <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-white/10 border border-white/15 backdrop-blur px-2 py-1">
        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
          <Code2 className="h-3.5 w-3.5 text-white/80" />
        </div>
        <div className="text-[11px] font-semibold text-white/90">
          {isRTL ? 'وقتي' : 'Wakti'}
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-11 h-11 rounded-full bg-white/10 border border-white/15 backdrop-blur flex items-center justify-center">
          <Eye className="h-6 w-6 text-white drop-shadow" />
        </div>
      </div>
    </div>
  );
};

// Theme settings type
type ThemeSettings = {
  fontStyle: 'modern' | 'classic' | 'playful' | 'minimal' | 'bold';
  shadowStyle: 'none' | 'soft' | 'hard' | 'glow' | 'neon';
  borderRadius: 'none' | 'subtle' | 'rounded' | 'pill';
  layoutStyle: 'cards' | 'minimal' | 'bento' | 'magazine';
  mood: 'professional' | 'playful' | 'elegant' | 'bold' | 'calm';
};

// Expanded theme collection with full settings (Lovable-style)
const THEMES: Array<{
  id: string;
  name: string;
  nameAr: string;
  colors: string[];
  settings?: ThemeSettings;
  isDefault?: boolean;
}> = [
  // Add User Prompt as first option and set as default - no colors or settings since they come from prompt
  { id: 'user_prompt', name: 'User Prompt', nameAr: 'من الطلب', colors: [], isDefault: true },
  // Default - let AI decide
  { id: 'none', name: 'Default', nameAr: 'افتراضي', colors: ['#6b7280', '#d1d5db'], settings: { fontStyle: 'modern', shadowStyle: 'soft', borderRadius: 'rounded', layoutStyle: 'cards', mood: 'professional' } },
  // Cool tones
  { id: 'glacier', name: 'Glacier', nameAr: 'جليدي', colors: ['#60a5fa', '#a5b4fc', '#c4b5fd', '#e0e7ff'], settings: { fontStyle: 'minimal', shadowStyle: 'soft', borderRadius: 'rounded', layoutStyle: 'minimal', mood: 'calm' } },
  { id: 'ocean', name: 'Ocean', nameAr: 'محيطي', colors: ['#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd'], settings: { fontStyle: 'modern', shadowStyle: 'soft', borderRadius: 'rounded', layoutStyle: 'cards', mood: 'professional' } },
  { id: 'lavender', name: 'Lavender', nameAr: 'لافندر', colors: ['#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe'], settings: { fontStyle: 'classic', shadowStyle: 'soft', borderRadius: 'rounded', layoutStyle: 'cards', mood: 'elegant' } },
  // Warm tones
  { id: 'harvest', name: 'Harvest', nameAr: 'حصاد', colors: ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a'], settings: { fontStyle: 'bold', shadowStyle: 'hard', borderRadius: 'subtle', layoutStyle: 'magazine', mood: 'bold' } },
  { id: 'sunset', name: 'Sunset', nameAr: 'غروب', colors: ['#f97316', '#fb923c', '#fdba74', '#fed7aa'], settings: { fontStyle: 'modern', shadowStyle: 'glow', borderRadius: 'rounded', layoutStyle: 'cards', mood: 'playful' } },
  { id: 'orchid', name: 'Orchid', nameAr: 'أوركيد', colors: ['#ec4899', '#f472b6', '#f9a8d4', '#fbcfe8'], settings: { fontStyle: 'playful', shadowStyle: 'soft', borderRadius: 'pill', layoutStyle: 'cards', mood: 'playful' } },
  { id: 'coral', name: 'Coral', nameAr: 'مرجاني', colors: ['#f43f5e', '#fb7185', '#fda4af', '#fecdd3'], settings: { fontStyle: 'bold', shadowStyle: 'hard', borderRadius: 'rounded', layoutStyle: 'bento', mood: 'bold' } },
  // Nature
  { id: 'emerald', name: 'Emerald', nameAr: 'زمردي', colors: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'], settings: { fontStyle: 'modern', shadowStyle: 'soft', borderRadius: 'rounded', layoutStyle: 'cards', mood: 'calm' } },
  { id: 'forest', name: 'Forest', nameAr: 'غابة', colors: ['#22c55e', '#4ade80', '#86efac', '#bbf7d0'], settings: { fontStyle: 'classic', shadowStyle: 'soft', borderRadius: 'subtle', layoutStyle: 'minimal', mood: 'calm' } },
  { id: 'solar', name: 'Solar', nameAr: 'شمسي', colors: ['#eab308', '#facc15', '#fde047', '#fef08a'], settings: { fontStyle: 'bold', shadowStyle: 'glow', borderRadius: 'rounded', layoutStyle: 'bento', mood: 'bold' } },
  // Dark & Bold
  { id: 'obsidian', name: 'Obsidian', nameAr: 'أوبسيديان', colors: ['#1e293b', '#334155', '#475569', '#64748b'], settings: { fontStyle: 'minimal', shadowStyle: 'none', borderRadius: 'subtle', layoutStyle: 'minimal', mood: 'professional' } },
  { id: 'brutalist', name: 'Brutalist', nameAr: 'بروتالي', colors: ['#6366f1', '#a855f7', '#ec4899', '#f43f5e'], settings: { fontStyle: 'bold', shadowStyle: 'neon', borderRadius: 'none', layoutStyle: 'bento', mood: 'bold' } },
  { id: 'midnight', name: 'Midnight', nameAr: 'منتصف الليل', colors: ['#1e1b4b', '#312e81', '#4338ca', '#6366f1'], settings: { fontStyle: 'modern', shadowStyle: 'glow', borderRadius: 'rounded', layoutStyle: 'cards', mood: 'elegant' } },
  // Wakti brand
  { id: 'wakti-dark', name: 'Wakti Dark', nameAr: 'وقتي داكن', colors: ['#0c0f14', '#060541', '#858384', '#f2f2f2'], settings: { fontStyle: 'modern', shadowStyle: 'glow', borderRadius: 'rounded', layoutStyle: 'cards', mood: 'elegant' } },
  { id: 'wakti-light', name: 'Wakti Light', nameAr: 'وقتي فاتح', colors: ['#fcfefd', '#060541', '#e9ceb0', '#f2f2f2'], settings: { fontStyle: 'classic', shadowStyle: 'soft', borderRadius: 'rounded', layoutStyle: 'cards', mood: 'elegant' } },
  // Vibrant
  { id: 'vibrant', name: 'Vibrant', nameAr: 'حيوي', colors: ['#3b82f6', '#8b5cf6', '#f97316', '#ec4899'], settings: { fontStyle: 'bold', shadowStyle: 'glow', borderRadius: 'rounded', layoutStyle: 'bento', mood: 'playful' } },
  { id: 'neon', name: 'Neon', nameAr: 'نيون', colors: ['#22d3ee', '#a3e635', '#facc15', '#f472b6'], settings: { fontStyle: 'bold', shadowStyle: 'neon', borderRadius: 'pill', layoutStyle: 'bento', mood: 'bold' } },
];

// Animated placeholder examples
const PLACEHOLDER_EXAMPLES = [
  { en: 'a gym landing page with pricing...', ar: 'صفحة نادي رياضي مع الأسعار...' },
  { en: 'a Ramadan countdown timer...', ar: 'عداد تنازلي لرمضان...' },
  { en: 'a restaurant menu with ordering...', ar: 'قائمة مطعم مع الطلب...' },
  { en: 'a portfolio for a photographer...', ar: 'معرض أعمال مصور...' },
  { en: 'a math quiz for kids...', ar: 'اختبار رياضيات للأطفال...' },
];

// Onboarding Gallery - Visual examples of what can be built
// Each template has customizable options for the business/product type
// Prompts are detailed and connected to backend features
const PROJECT_EXAMPLES = [
  { 
    id: 'ecommerce', 
    icon: '🛍️', 
    title: { en: 'Online Store', ar: 'متجر إلكتروني' },
    desc: { en: 'Sell products with cart & checkout', ar: 'بيع منتجات مع سلة وشراء' },
    promptTemplate: { 
      en: `Create a premium online store for {PRODUCT}.

DESIGN: Modern, elegant e-commerce design with smooth animations. Color scheme matching the product category.

STRUCTURE:
- Homepage with hero banner, featured products, and category navigation
- Product browsing with filtering and search
- Product details with images, pricing, and add-to-cart
- Shopping cart with quantity management
- Checkout flow with customer information

SECTIONS:
1. Hero Banner - Seasonal promotions, featured collection
2. Categories - Visual category navigation grid
3. Featured Products - Bestsellers and new arrivals
4. Product Grid - Filterable by category, price, and attributes
5. Product Detail - Multiple images, description, variants, add to cart
6. Cart Sidebar - Quick cart view with item management
7. Checkout - Customer info, order summary, payment

FEATURES:
- Product cards with image, name, price, quick-add button
- Category and price filtering
- Product image gallery with zoom
- Shopping cart icon with item count
- Wishlist functionality
- Size/color variant selection where applicable

Create 6-8 sample products with realistic names and prices for the {PRODUCT} category.`,
      ar: `أنشئ متجر إلكتروني فاخر لـ{PRODUCT}.

التصميم: تصميم تجارة إلكترونية عصري وأنيق مع حركات سلسة. ألوان تناسب فئة المنتجات.

الهيكل:
- صفحة رئيسية مع بانر، منتجات مميزة، وتنقل الفئات
- تصفح المنتجات مع فلترة وبحث
- تفاصيل المنتج مع صور وأسعار وإضافة للسلة
- سلة تسوق مع إدارة الكميات
- تدفق الدفع مع معلومات العميل

الأقسام:
1. البانر الرئيسي - عروض موسمية، مجموعة مميزة
2. الفئات - شبكة تنقل بصرية للفئات
3. المنتجات المميزة - الأكثر مبيعاً والوصول الجديد
4. شبكة المنتجات - قابلة للفلترة بالفئة والسعر والخصائص
5. تفاصيل المنتج - صور متعددة، وصف، متغيرات، إضافة للسلة
6. سلة جانبية - عرض سريع للسلة مع إدارة العناصر
7. الدفع - معلومات العميل، ملخص الطلب، الدفع

المميزات:
- بطاقات منتجات مع صورة واسم وسعر وزر إضافة سريع
- فلترة بالفئة والسعر
- معرض صور المنتج مع تكبير
- أيقونة سلة مع عدد العناصر
- قائمة المفضلة
- اختيار المقاس/اللون حيث ينطبق

أنشئ 6-8 منتجات نموذجية بأسماء وأسعار واقعية لفئة {PRODUCT}.`
    },
    options: [
      { en: 'Abayas & Fashion', ar: 'عبايات وأزياء' },
      { en: 'Perfumes & Oud', ar: 'عطور وعود' },
      { en: 'Jewelry & Gold', ar: 'مجوهرات وذهب' },
      { en: 'Electronics', ar: 'إلكترونيات' },
      { en: 'Dates & Sweets', ar: 'تمور وحلويات' },
      { en: 'Handmade Crafts', ar: 'حرف يدوية' },
      { en: 'Hair & Beard Products', ar: 'منتجات الشعر واللحية' },
      { en: 'Skincare & Cosmetics', ar: 'عناية بالبشرة ومستحضرات' },
      { en: 'Sports & Fitness', ar: 'رياضة ولياقة' },
      { en: 'Baby & Kids', ar: 'أطفال ورضع' },
      { en: 'Home & Kitchen', ar: 'المنزل والمطبخ' },
      { en: 'Gifts & Flowers', ar: 'هدايا وزهور' },
      { en: 'Pet Supplies', ar: 'مستلزمات الحيوانات' },
      { en: 'Car Accessories', ar: 'إكسسوارات السيارات' },
      { en: 'Furniture & Decor', ar: 'أثاث وديكور' },
      { en: 'Books & Stationery', ar: 'كتب وقرطاسية' },
      { en: 'Supplements & Vitamins', ar: 'مكملات وفيتامينات' },
      { en: 'Luxury Watches', ar: 'ساعات فاخرة' },
      { en: 'Groceries / Mini Mart', ar: 'بقالة / ميني ماركت' },
      { en: 'Phones & Accessories', ar: 'جوالات وإكسسوارات' },
      { en: 'Computer & Gaming', ar: 'كمبيوتر وألعاب' },
      { en: 'Health Pharmacy', ar: 'صيدلية / صحة' },
      { en: 'Coffee & Specialty Beans', ar: 'قهوة ومحاصيل' },
      { en: 'Accessories & Bags', ar: 'إكسسوارات وشنط' },
      { en: 'Traditional / Heritage', ar: 'تراثيات' },
    ],
    defaultOption: { en: 'Abayas & Fashion', ar: 'عبايات وأزياء' },
    color: 'from-pink-500 to-rose-500'
  },
  { 
    id: 'restaurant', 
    icon: '🍽️', 
    title: { en: 'Restaurant Menu', ar: 'قائمة مطعم' },
    desc: { en: 'Digital menu with ordering', ar: 'قائمة رقمية مع الطلب' },
    promptTemplate: { 
      en: `Create an interactive digital menu website for a {PRODUCT}.

DESIGN: Appetizing design with mouth-watering food imagery. Theme matching the cuisine style.

STRUCTURE: Single-page menu with category tabs or scrollable sections.

SECTIONS:
1. Header - Restaurant logo, name, and navigation
2. Hero - Featured dish or promotion with restaurant ambiance
3. Menu Categories - Tabbed or scrollable category navigation
4. Menu Items - Grid/list of dishes organized by category
5. Item Details - Modal or expandable view with full description
6. Order Summary - Floating cart or sidebar with selected items
7. Contact/Location - Address, hours, phone, delivery info

MENU CATEGORIES (customize for {PRODUCT}):
- Appetizers/Starters
- Main Courses
- Sides
- Desserts
- Beverages

FEATURES:
- Category tabs or smooth scroll navigation
- Each dish: photo, name, description, price, dietary icons
- Spice level indicators where applicable
- Add to order with quantity selection
- Special instructions field
- Floating cart with order total
- WhatsApp order button
- Dietary filters (vegetarian, gluten-free, etc.)

Create 10-15 sample menu items with realistic names and prices for a {PRODUCT}.`,
      ar: `أنشئ موقع قائمة طعام رقمية تفاعلية لـ{PRODUCT}.

التصميم: تصميم شهي مع صور طعام مغرية. ثيم يناسب نوع المطبخ.

الهيكل: قائمة صفحة واحدة مع تبويبات فئات أو أقسام قابلة للتمرير.

الأقسام:
1. الهيدر - شعار المطعم، الاسم، والتنقل
2. البانر - طبق مميز أو عرض مع أجواء المطعم
3. فئات القائمة - تنقل بالتبويبات أو التمرير
4. أصناف القائمة - شبكة/قائمة أطباق منظمة بالفئة
5. تفاصيل الصنف - نافذة أو عرض موسع مع الوصف الكامل
6. ملخص الطلب - سلة عائمة أو جانبية مع الأصناف المختارة
7. التواصل/الموقع - العنوان، الساعات، الهاتف، معلومات التوصيل

فئات القائمة (تخصيص لـ{PRODUCT}):
- مقبلات
- أطباق رئيسية
- إضافات
- حلويات
- مشروبات

المميزات:
- تبويبات فئات أو تنقل سلس بالتمرير
- كل طبق: صورة، اسم، وصف، سعر، أيقونات غذائية
- مؤشرات مستوى الحرارة حيث ينطبق
- إضافة للطلب مع اختيار الكمية
- حقل تعليمات خاصة
- سلة عائمة مع مجموع الطلب
- زر طلب واتساب
- فلاتر غذائية (نباتي، خالي من الجلوتين، إلخ)

أنشئ 10-15 صنف نموذجي بأسماء وأسعار واقعية لـ{PRODUCT}.`
    },
    options: [
      { en: 'Restaurant', ar: 'مطعم' },
      { en: 'Cafe & Coffee Shop', ar: 'كافيه ومقهى' },
      { en: 'Bakery', ar: 'مخبز' },
      { en: 'Food Truck', ar: 'عربة طعام' },
      { en: 'Catering Service', ar: 'خدمة تموين' },
      { en: 'Fine Dining', ar: 'مطعم فاخر' },
      { en: 'Fast Food', ar: 'وجبات سريعة' },
      { en: 'Burger Restaurant', ar: 'مطعم برجر' },
      { en: 'Pizza Restaurant', ar: 'مطعم بيتزا' },
      { en: 'Seafood', ar: 'مأكولات بحرية' },
      { en: 'BBQ & Grill', ar: 'شواء وجريل' },
      { en: 'Desserts Shop', ar: 'محل حلويات' },
      { en: 'Ice Cream Shop', ar: 'محل آيس كريم' },
      { en: 'Juice Bar', ar: 'عصائر' },
      { en: 'Healthy / Diet Food', ar: 'أكل صحي/دايت' },
      { en: 'Shawarma', ar: 'شاورما' },
      { en: 'Arabic / Gulf Cuisine', ar: 'مأكولات عربية/خليجية' },
      { en: 'Indian Cuisine', ar: 'مأكولات هندية' },
      { en: 'Italian', ar: 'مأكولات إيطالية' },
      { en: 'Sushi / Japanese', ar: 'سوشي / ياباني' },
      { en: 'Breakfast / Brunch', ar: 'فطور / برنش' },
      { en: 'Tea House', ar: 'بيت شاي' },
    ],
    defaultOption: { en: 'Restaurant', ar: 'مطعم' },
    color: 'from-amber-500 to-orange-500'
  },
  { 
    id: 'portfolio', 
    icon: '📸', 
    title: { en: 'Portfolio', ar: 'معرض أعمال' },
    desc: { en: 'Showcase your work beautifully', ar: 'اعرض أعمالك بشكل جميل' },
    promptTemplate: { 
      en: `Create a professional single-page portfolio website for a {PRODUCT}.

STRUCTURE: Single-page design with smooth scrolling navigation. Fixed header with clickable section links.

SECTIONS (all on one page with anchor navigation):
1. Hero - Professional photo/headshot, name, title/tagline, brief intro
2. About - Professional summary, career objectives, personal story
3. Skills - Visual skill bars or charts showing expertise levels by category
4. Experience - Timeline layout showing work history with key achievements
5. Portfolio/Work - Grid gallery of projects with filtering, lightbox for full view
6. Services - What you offer with descriptions (if applicable)
7. Testimonials - Client/colleague recommendations with photos
8. Contact - Contact form, email, phone, social media links

FEATURES:
- Smooth scroll navigation between sections
- Fixed header with section links that highlight on scroll
- "Download CV/Resume" button in hero or about section
- Skill visualization (progress bars, charts, or icons)
- Project gallery with category filtering
- Dark/light mode toggle
- Social media links (LinkedIn, GitHub, Behance, etc.)

DESIGN:
- Clean, professional typography with clear hierarchy
- Subtle scroll animations for section transitions
- Color scheme appropriate for the profession`,
      ar: `أنشئ موقع بورتفوليو احترافي صفحة واحدة لـ{PRODUCT}.

الهيكل: تصميم صفحة واحدة مع تنقل سلس بالتمرير. هيدر ثابت مع روابط أقسام قابلة للنقر.

الأقسام (كلها في صفحة واحدة مع تنقل بالروابط):
1. البانر الرئيسي - صورة احترافية، الاسم، اللقب/الشعار، مقدمة مختصرة
2. عني - ملخص مهني، أهداف وظيفية، قصة شخصية
3. المهارات - أشرطة أو رسوم بيانية تعرض مستويات الخبرة حسب الفئة
4. الخبرات - تخطيط زمني يعرض تاريخ العمل مع الإنجازات الرئيسية
5. الأعمال - معرض شبكي للمشاريع مع فلترة، عرض كامل للصور
6. الخدمات - ما تقدمه مع الوصف (إن وجد)
7. التوصيات - توصيات العملاء/الزملاء مع صور
8. التواصل - نموذج تواصل، إيميل، هاتف، روابط السوشيال

المميزات:
- تنقل سلس بالتمرير بين الأقسام
- هيدر ثابت مع روابط أقسام تتميز عند التمرير
- زر "تحميل السيرة الذاتية" في البانر أو قسم عني
- تصور المهارات (أشرطة تقدم، رسوم بيانية، أو أيقونات)
- معرض مشاريع مع فلترة بالفئة
- تبديل الوضع الداكن/الفاتح
- روابط السوشيال ميديا (لينكدإن، جيتهب، بيهانس، إلخ)

التصميم:
- خطوط نظيفة واحترافية مع تسلسل واضح
- حركات تمرير خفيفة لانتقالات الأقسام
- ألوان مناسبة للمهنة`
    },
    options: [
      { en: 'Photography', ar: 'تصوير فوتوغرافي' },
      { en: 'Graphic Design', ar: 'تصميم جرافيك' },
      { en: 'Web Development', ar: 'تطوير مواقع' },
      { en: 'Interior Design', ar: 'تصميم داخلي' },
      { en: 'Art & Illustration', ar: 'فن ورسم' },
      { en: 'Video Production', ar: 'إنتاج فيديو' },
      { en: 'Web Designer', ar: 'مصمم مواقع' },
      { en: 'UI/UX Designer', ar: 'مصمم UI/UX' },
      { en: 'Videographer', ar: 'مصور فيديو' },
      { en: 'Architect', ar: 'مهندس معماري' },
      { en: 'Makeup Artist', ar: 'خبيرة مكياج' },
      { en: 'Fitness Coach', ar: 'مدرب لياقة' },
      { en: 'Writer / Copywriter', ar: 'كاتب/كاتب محتوى' },
      { en: 'Developer', ar: 'مطور' },
      { en: 'Personal Portfolio / CV', ar: 'بورتفوليو شخصي / سيرة ذاتية' },
      { en: 'Student Portfolio', ar: 'بورتفوليو طالب' },
      { en: 'Job Seeker Portfolio', ar: 'بورتفوليو باحث عن عمل' },
      { en: 'Model / Talent', ar: 'عارضة/موهبة' },
      { en: 'Chef Portfolio', ar: 'بورتفوليو شيف' },
      { en: 'Makeup & Beauty Artist', ar: 'خبيرة تجميل/مكياج' },
      { en: 'Freelancer Portfolio', ar: 'بورتفوليو مستقل' },
      { en: 'Business/Agency Portfolio', ar: 'بورتفوليو شركة/وكالة' },
    ],
    defaultOption: { en: 'Photography', ar: 'تصوير فوتوغرافي' },
    color: 'from-violet-500 to-purple-500'
  },
  { 
    id: 'booking', 
    icon: '📅', 
    title: { en: 'Booking System', ar: 'نظام حجز' },
    desc: { en: 'Appointments & reservations', ar: 'مواعيد وحجوزات' },
    promptTemplate: { 
      en: `Create a professional appointment booking website for a {PRODUCT}.

DESIGN: Clean, trustworthy design with calming colors. Simple, intuitive booking flow.

STRUCTURE: Single-page or minimal navigation with focus on booking conversion.

SECTIONS:
1. Hero - Business name, tagline, main booking CTA
2. Services - Service cards with name, duration, price, book button
3. How It Works - Simple 3-step booking process explanation
4. Team/Staff - Staff members with photos and specialties (if applicable)
5. Testimonials - Customer reviews with ratings
6. Location & Hours - Address, map, operating hours
7. Contact - Phone, WhatsApp, email

BOOKING FLOW:
1. Select service → 2. Choose date/time → 3. Enter details → 4. Confirm

FEATURES:
- Service cards with duration and price clearly displayed
- Calendar date picker with available slots
- Time slot selection grid
- Customer form (name, phone, email, notes)
- Booking confirmation with summary
- WhatsApp quick inquiry button
- Staff selection (if multiple providers)

Create 6-10 sample services with realistic names, durations, and prices for a {PRODUCT}.`,
      ar: `أنشئ موقع حجز مواعيد احترافي لـ{PRODUCT}.

التصميم: تصميم نظيف وموثوق بألوان مريحة. تدفق حجز بسيط وبديهي.

الهيكل: صفحة واحدة أو تنقل بسيط مع التركيز على تحويل الحجز.

الأقسام:
1. البانر - اسم المكان، شعار، زر حجز رئيسي
2. الخدمات - بطاقات خدمات مع اسم، مدة، سعر، زر حجز
3. كيف يعمل - شرح عملية الحجز من 3 خطوات
4. الفريق - أعضاء الفريق مع صور وتخصصات (إن وجد)
5. آراء العملاء - تقييمات مع نجوم
6. الموقع والساعات - العنوان، خريطة، ساعات العمل
7. التواصل - هاتف، واتساب، إيميل

تدفق الحجز:
1. اختر الخدمة → 2. اختر التاريخ/الوقت → 3. أدخل البيانات → 4. تأكيد

المميزات:
- بطاقات خدمات مع المدة والسعر بوضوح
- منتقي تاريخ تقويمي مع الأوقات المتاحة
- شبكة اختيار الوقت
- نموذج العميل (اسم، هاتف، إيميل، ملاحظات)
- تأكيد الحجز مع ملخص
- زر استفسار واتساب سريع
- اختيار الموظف (إذا تعدد المقدمين)

أنشئ 6-10 خدمات نموذجية بأسماء ومدد وأسعار واقعية لـ{PRODUCT}.`
    },
    options: [
      { en: 'Beauty Salon', ar: 'صالون تجميل' },
      { en: 'Barbershop', ar: 'صالون حلاقة' },
      { en: 'Spa & Wellness', ar: 'سبا وعافية' },
      { en: 'Medical Clinic', ar: 'عيادة طبية' },
      { en: 'Fitness Studio', ar: 'استوديو لياقة' },
      { en: 'Consulting', ar: 'استشارات' },
      { en: 'Dentist', ar: 'عيادة أسنان' },
      { en: 'Personal Trainer', ar: 'مدرب شخصي' },
      { en: 'Tutor / Lessons', ar: 'مدرس/دروس' },
      { en: 'Car Wash', ar: 'غسيل سيارات' },
      { en: 'Home Services', ar: 'خدمات منزلية' },
      { en: 'Photography Sessions', ar: 'جلسات تصوير' },
      { en: 'Consultation / Coach', ar: 'استشارة/كوتش' },
      { en: 'Law Firm / Legal', ar: 'مكتب محاماة' },
      { en: 'Therapy / Counseling', ar: 'علاج/استشارات نفسية' },
      { en: 'Pet Grooming', ar: 'عناية بالحيوانات' },
      { en: 'Repair Services', ar: 'خدمات صيانة' },
      { en: 'Cleaning Service', ar: 'شركة تنظيف' },
      { en: 'Massage Therapist', ar: 'جلسات مساج' },
      { en: 'Nail Salon', ar: 'صالون أظافر' },
    ],
    defaultOption: { en: 'Beauty Salon', ar: 'صالون تجميل' },
    color: 'from-emerald-500 to-green-500'
  },
  { 
    id: 'landing', 
    icon: '🚀', 
    title: { en: 'Landing Page', ar: 'صفحة هبوط' },
    desc: { en: 'Convert visitors to customers', ar: 'حوّل الزوار لعملاء' },
    promptTemplate: { 
      en: `Create a high-converting single-page landing page for a {PRODUCT}.

DESIGN: Bold, modern, conversion-focused. Strong visual hierarchy with contrasting CTA colors.

STRUCTURE: Single scrolling page with sticky header navigation.

SECTIONS:
1. Hero - Compelling headline, subheadline, primary CTA, product image/mockup
2. Problem - Pain points your audience faces (2-3 points)
3. Solution - How your product solves these problems
4. Features - 4-6 key features with icons and brief descriptions
5. How It Works - 3-4 step process with visuals
6. Benefits - Why choose this over alternatives
7. Social Proof - Testimonials, logos, statistics
8. Pricing - 2-3 tiers with feature comparison (if applicable)
9. FAQ - 5-6 common questions with expandable answers
10. Final CTA - Strong closing with signup/contact form

FEATURES:
- Sticky header with CTA button
- Smooth scroll to sections
- Scroll-triggered animations
- Trust badges and social proof
- Mobile-optimized layout
- Clear, action-oriented CTAs throughout

Create compelling copy specific to a {PRODUCT} with realistic details.`,
      ar: `أنشئ صفحة هبوط واحدة عالية التحويل لـ{PRODUCT}.

التصميم: جريء، عصري، يركز على التحويل. تسلسل بصري قوي مع ألوان CTA متباينة.

الهيكل: صفحة تمرير واحدة مع هيدر ثابت للتنقل.

الأقسام:
1. البانر - عنوان جذاب، عنوان فرعي، CTA رئيسي، صورة/موكاب المنتج
2. المشكلة - نقاط الألم التي يواجهها جمهورك (2-3 نقاط)
3. الحل - كيف يحل منتجك هذه المشاكل
4. المميزات - 4-6 مميزات رئيسية مع أيقونات ووصف مختصر
5. كيف يعمل - عملية من 3-4 خطوات مع صور
6. الفوائد - لماذا تختار هذا على البدائل
7. الإثبات الاجتماعي - شهادات، شعارات، إحصائيات
8. الأسعار - 2-3 باقات مع مقارنة المميزات (إن وجد)
9. الأسئلة الشائعة - 5-6 أسئلة شائعة مع إجابات قابلة للتوسيع
10. CTA النهائي - إغلاق قوي مع نموذج تسجيل/تواصل

المميزات:
- هيدر ثابت مع زر CTA
- تمرير سلس للأقسام
- حركات تفعّل بالتمرير
- شارات ثقة وإثبات اجتماعي
- تخطيط محسّن للموبايل
- CTAs واضحة وموجهة للإجراء

أنشئ نصوص مقنعة خاصة بـ{PRODUCT} مع تفاصيل واقعية.`
    },
    options: [
      { en: 'Mobile App', ar: 'تطبيق موبايل' },
      { en: 'SaaS Product', ar: 'منتج SaaS' },
      { en: 'Online Course', ar: 'دورة أونلاين' },
      { en: 'Fitness Program', ar: 'برنامج لياقة' },
      { en: 'E-book', ar: 'كتاب إلكتروني' },
      { en: 'Agency Services', ar: 'خدمات وكالة' },
      { en: 'SaaS / Software', ar: 'SaaS/برمجيات' },
      { en: 'Restaurant Promo', ar: 'ترويج مطعم' },
      { en: 'Gym Promo', ar: 'ترويج نادي رياضي' },
      { en: 'App Download Page', ar: 'صفحة تحميل تطبيق' },
      { en: 'Course / Webinar', ar: 'دورة/ويبينار' },
      { en: 'Agency', ar: 'وكالة' },
      { en: 'Product Launch', ar: 'إطلاق منتج' },
      { en: 'Newsletter / Waitlist', ar: 'نشرة/قائمة انتظار' },
      { en: 'Event Promo', ar: 'ترويج فعالية' },
      { en: 'Service Promo', ar: 'ترويج خدمة' },
      { en: 'Real Estate Agent', ar: 'وسيط عقاري' },
      { en: 'Restaurant Opening / Promo', ar: 'افتتاح/ترويج مطعم' },
      { en: 'Clinic Promo', ar: 'ترويج عيادة' },
      { en: 'Barbershop Promo', ar: 'ترويج حلاق' },
      { en: 'Influencer / Creator', ar: 'صانع محتوى' },
      { en: 'Hiring / Recruitment', ar: 'توظيف' },
      { en: 'App Pre-Order', ar: 'طلب مسبق لتطبيق' },
    ],
    defaultOption: { en: 'Mobile App', ar: 'تطبيق موبايل' },
    color: 'from-blue-500 to-cyan-500'
  },
  { 
    id: 'event', 
    icon: '🎉', 
    title: { en: 'Event Page', ar: 'صفحة فعالية' },
    desc: { en: 'Weddings, parties, conferences', ar: 'أعراس، حفلات، مؤتمرات' },
    promptTemplate: { 
      en: `Create an elegant single-page event website for a {PRODUCT}.

DESIGN: Celebratory, elegant design matching the event type. Appropriate colors and imagery.

STRUCTURE: Single scrolling page with smooth section navigation.

SECTIONS:
1. Hero - Event title, date, countdown timer, beautiful background
2. About/Story - Background about the event (couple story for weddings, event purpose for conferences)
3. Details - Date, time, venue, dress code, what to expect
4. Schedule - Timeline of activities with times
5. Venue - Location with embedded map, directions, parking
6. Gallery - Related photos (engagement photos, past events, etc.)
7. RSVP - Guest response form with attendance confirmation
8. Additional Info - Gift registry, sponsors, or special notes
9. Contact - Organizer info, WhatsApp button

FEATURES:
- Live countdown timer to event date
- Smooth scroll navigation
- RSVP form with guest count and dietary preferences
- Photo gallery with lightbox
- Mobile-optimized design
- Social sharing buttons
- Add to calendar button

Create content appropriate for a {PRODUCT} with realistic details.`,
      ar: `أنشئ موقع فعالية أنيق صفحة واحدة لـ{PRODUCT}.

التصميم: تصميم احتفالي وأنيق يناسب نوع الفعالية. ألوان وصور مناسبة.

الهيكل: صفحة تمرير واحدة مع تنقل سلس بين الأقسام.

الأقسام:
1. البانر - عنوان الفعالية، التاريخ، عداد تنازلي، خلفية جميلة
2. عنا/القصة - خلفية عن الفعالية (قصة الزوجين للأعراس، هدف الفعالية للمؤتمرات)
3. التفاصيل - التاريخ، الوقت، المكان، الزي، ماذا تتوقع
4. الجدول - جدول زمني للأنشطة مع الأوقات
5. المكان - الموقع مع خريطة مدمجة، الاتجاهات، المواقف
6. المعرض - صور متعلقة (صور الخطوبة، فعاليات سابقة، إلخ)
7. تأكيد الحضور - نموذج استجابة الضيف مع تأكيد الحضور
8. معلومات إضافية - قائمة الهدايا، الرعاة، أو ملاحظات خاصة
9. التواصل - معلومات المنظم، زر واتساب

المميزات:
- عداد تنازلي حي لتاريخ الفعالية
- تنقل سلس بالتمرير
- نموذج RSVP مع عدد الضيوف والتفضيلات الغذائية
- معرض صور مع لايت بوكس
- تصميم محسّن للموبايل
- أزرار مشاركة اجتماعية
- زر إضافة للتقويم

أنشئ محتوى مناسب لـ{PRODUCT} مع تفاصيل واقعية.`
    },
    options: [
      { en: 'Wedding Invitation', ar: 'دعوة زفاف' },
      { en: 'Birthday Party', ar: 'حفلة عيد ميلاد' },
      { en: 'Conference', ar: 'مؤتمر' },
      { en: 'Workshop', ar: 'ورشة عمل' },
      { en: 'Product Launch', ar: 'إطلاق منتج' },
      { en: 'Graduation', ar: 'حفل تخرج' },
      { en: 'Baby Shower', ar: 'حفل استقبال مولود' },
      { en: 'Corporate Event', ar: 'فعالية شركة' },
      { en: 'Ramadan Iftar', ar: 'إفطار رمضان' },
      { en: 'Eid Gathering', ar: 'تجمع العيد' },
      { en: 'Concert', ar: 'حفل موسيقي' },
      { en: 'Exhibition', ar: 'معرض' },
      { en: 'Sports Event', ar: 'فعالية رياضية' },
      { en: 'Engagement / Khutbah', ar: 'خطوبة / ملكة' },
      { en: 'Henna Night', ar: 'ليلة الحناء' },
      { en: 'School Event', ar: 'فعالية مدرسية' },
      { en: 'Charity / Fundraiser', ar: 'فعالية خيرية' },
      { en: 'Community Meetup', ar: 'لقاء مجتمعي' },
      { en: 'Tournament', ar: 'بطولة' },
      { en: 'Open House', ar: 'يوم مفتوح' },
    ],
    defaultOption: { en: 'Wedding Invitation', ar: 'دعوة زفاف' },
    color: 'from-fuchsia-500 to-pink-500'
  },
  { 
    id: 'interactive-deck', 
    icon: '🧩', 
    title: { en: 'Interactive Deck', ar: 'عرض تفاعلي' },
    desc: { en: 'Interactive, explorable presentation', ar: 'عرض تقديمي تفاعلي للاستكشاف' },
    promptTemplate: { 
      en: `Create an interactive, explorable presentation deck about {PRODUCT}.

GOAL:
- This is NOT a static slideshow. It should feel like a modern web experience that is still clearly a deck.

TECH REQUIREMENTS:
- Build as a React app (single page).
- Use Tailwind classes for styling (Tailwind loaded via CDN).
- No external APIs required.

STRUCTURE:
- Use a clean multi-file structure (data + components).
- Keep slide content/data separate from UI components.
- Keep navigation/progress logic separate from slide rendering.

UI/UX:
- Left: collapsible Table of Contents (sections/chapters).
- Center: the active slide.
- Bottom: progress bar + Next/Prev.
- Support keyboard navigation (←/→, space, home/end) and mobile swipe.
- Each slide can include interactive blocks: tabs, accordion, reveal, stats cards, comparison grid.

DECK CONTENT:
- Generate 10-12 slides with a clear storyline.
- Include at least:
  1) Cover
  2) Agenda
  3) Problem
  4) Solution
  5) Key features (interactive tabs)
  6) Market / context (charts optional)
  7) Differentiation (comparison grid)
  8) Demo / how it works
  9) Roadmap
  10) Call to action

DESIGN:
- Premium, modern, dark-first look with subtle gradients and glow.
- Use a consistent design system and spacing.

Make all text realistic and tailored to {PRODUCT}.`,
      ar: `أنشئ عرض تقديمي تفاعلي واستكشافي عن {PRODUCT}.

الهدف:
- هذا ليس عرض شرائح ثابت. يجب أن يبدو كتجربة ويب حديثة ومع ذلك يكون واضحاً أنه عرض.

متطلبات تقنية:
- ابنِه كتطبيق React (صفحة واحدة).
- استخدم Tailwind classes للتصميم (Tailwind محمّل عبر CDN).
- بدون الاعتماد على APIs خارجية.

الهيكلة:
- استخدم هيكلة متعددة الملفات بشكل مرتب (بيانات + مكوّنات).
- افصل محتوى/بيانات الشرائح عن مكوّنات الواجهة.
- افصل منطق التنقل/التقدم عن عرض الشريحة.

تجربة المستخدم:
- يسار: جدول محتويات قابل للطي (أقسام/فصول).
- الوسط: الشريحة الحالية.
- أسفل: شريط تقدم + التالي/السابق.
- دعم التنقل بالكيبورد (يسار/يمين، مسافة، Home/End) ودعم سحب الموبايل.
- كل شريحة يمكن أن تحتوي عناصر تفاعلية: Tabs، Accordion، Reveal، بطاقات أرقام، مقارنة.

محتوى العرض:
- أنشئ 10-12 شريحة بقصة واضحة.
- يجب أن تتضمن على الأقل:
  1) الغلاف
  2) جدول الأعمال
  3) المشكلة
  4) الحل
  5) المميزات (Tabs تفاعلية)
  6) السوق/السياق (مخططات اختيارية)
  7) التميّز (جدول مقارنة)
  8) عرض/كيف يعمل
  9) خارطة طريق
  10) دعوة لاتخاذ إجراء

التصميم:
- مظهر فاخر وحديث (داكن بالأساس) مع تدرجات خفيفة وتوهج.
- حافظ على نظام تصميم ومسافات متسقة.

اجعل النصوص واقعية ومخصصة لـ{PRODUCT}.`
    },
    options: [
      { en: 'Startup Pitch Deck', ar: 'عرض شركة ناشئة' },
      { en: 'Product Feature Deck', ar: 'عرض مميزات المنتج' },
      { en: 'Portfolio / Case Study', ar: 'بورتفوليو / دراسة حالة' },
      { en: 'Guide / Handbook', ar: 'دليل / كتيّب' },
      { en: 'Proposal / Offer', ar: 'عرض / مقترح' },
      { en: 'Workshop / Training', ar: 'ورشة / تدريب' },
    ],
    defaultOption: { en: 'Startup Pitch Deck', ar: 'عرض شركة ناشئة' },
    color: 'from-violet-500 to-indigo-500'
  },
  {
    id: 'game',
    icon: '🎮',
    title: { en: 'Browser Game', ar: 'لعبة متصفح' },
    desc: { en: 'Playable game with score & levels', ar: 'لعبة قابلة للعب مع نقاط ومستويات' },
    promptTemplate: {
      en: `Build a fully playable browser game: {PRODUCT}.

GAME REQUIREMENTS:
- Use Phaser.js (loaded from CDN inside App.js onload callback)
- All scene classes defined INSIDE the script.onload callback — never at module top level
- Include: MenuScene (title + start), GameScene (core gameplay), GameOverScene
- Score HUD, lives/health display, level indicator using this.add.text()
- Keyboard controls (arrow keys / WASD / spacebar) + touch support for mobile
- Colorful shapes using this.add.rectangle() and this.add.graphics() — no external images needed
- Scrolling background using tileSprite where appropriate
- Increasing difficulty as score/level rises
- Polished game feel: particle effects, screen shake, sound cues (optional)

PLAYER OBJECT (always use this pattern):
  this.player = this.add.rectangle(x, y, w, h, 0x00ff88);
  this.physics.add.existing(this.player);
  this.player.body.setCollideWorldBounds(true);

Make it fun, addictive, and fully playable from the first second.`,
      ar: `ابنِ لعبة متصفح قابلة للعب بالكامل: {PRODUCT}.

متطلبات اللعبة:
- استخدم Phaser.js (محمّل من CDN داخل callback الـ onload في App.js)
- جميع كلاسات المشاهد تُعرَّف داخل callback الـ onload فقط
- يجب أن تتضمن: MenuScene (عنوان + ابدأ)، GameScene (اللعب الأساسي)، GameOverScene
- عرض النقاط والحياة والمستوى باستخدام this.add.text()
- تحكم بالكيبورد (أسهم / WASD / مسافة) + دعم اللمس للموبايل
- أشكال ملونة باستخدام this.add.rectangle() و this.add.graphics()
- صعوبة متزايدة مع ارتفاع النقاط والمستوى
- تجربة لعب ممتعة وإدمانية من اللحظة الأولى`
    },
    options: [
      { en: 'Racing Game', ar: 'لعبة سباق' },
      { en: 'Space Shooter', ar: 'مطلق فضائي' },
      { en: 'Platformer', ar: 'لعبة منصات' },
      { en: 'Endless Runner', ar: 'عداء لا نهائي' },
      { en: 'Puzzle Game', ar: 'لعبة ألغاز' },
      { en: 'Tower Defense', ar: 'دفاع عن البرج' },
      { en: 'Brick Breaker', ar: 'كسر الطوب' },
      { en: 'Snake Game', ar: 'لعبة الثعبان' },
      { en: 'Flappy Bird Clone', ar: 'نسخة فلابي بيرد' },
      { en: 'Math Quiz Game', ar: 'لعبة اختبار رياضيات' },
    ],
    defaultOption: { en: 'Racing Game', ar: 'لعبة سباق' },
    color: 'from-green-500 to-emerald-500'
  },
];

export default function Projects() {
  const { language, theme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isRTL = language === 'ar';
  const isDark = theme === 'dark';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trial user check — used to enforce 1 project limit
  const [isTrialUser, setIsTrialUser] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const { data: { user: u } } = await supabase.auth.getUser();
        if (!u?.id) return;
        const { data: profile } = await (supabase as any)
          .from('profiles')
          .select('is_subscribed, payment_method, next_billing_date, admin_gifted, free_access_start_at')
          .eq('id', u.id)
          .single();
        if (!profile) return;
        const isPaid = profile.is_subscribed === true;
        const isGifted = profile.admin_gifted === true;
        const pm = profile.payment_method;
        const isGift = pm && pm !== 'manual' && profile.next_billing_date && new Date(profile.next_billing_date) > new Date();
        const isOn24hTrial = profile.free_access_start_at != null;
        if (!isPaid && !isGift && !isGifted && isOn24hTrial) setIsTrialUser(true);
      } catch {}
    })();
  }, []);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [isDetectingContext, setIsDetectingContext] = useState(false);
  const [contextFormData, setContextFormData] = useState<{ siteType: string; heading: string; fields: ContextField[] } | null>(null);
  const pendingPromptRef = useRef<string>('');
  const [selectedTheme, setSelectedTheme] = useState('user_prompt');
  const [backendStatus, setBackendStatus] = useState<Record<string, boolean>>({});
  const [togglingBackend, setTogglingBackend] = useState<string | null>(null);
  const [showThemes, setShowThemes] = useState(false);
  const [themeSearch, setThemeSearch] = useState('');
  
  // Template selector state - for customizable project type dropdowns
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [templateSelections, setTemplateSelections] = useState<Record<string, string>>({});
  const [customTemplateInput, setCustomTemplateInput] = useState('');
  
  // Custom theme creator state
  const [showThemeCreator, setShowThemeCreator] = useState(false);
  const [customThemes, setCustomThemes] = useState<typeof THEMES>(() => {
    try {
      const saved = localStorage.getItem('wakti_custom_themes');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [newTheme, setNewTheme] = useState({
    name: '',
    colors: ['#3b82f6', '#8b5cf6', '#f97316', '#ec4899'],
    fontStyle: 'modern' as 'modern' | 'classic' | 'playful' | 'minimal' | 'bold',
    shadowStyle: 'soft' as 'none' | 'soft' | 'hard' | 'glow' | 'neon',
    borderRadius: 'rounded' as 'none' | 'subtle' | 'rounded' | 'pill',
    layoutStyle: 'cards' as 'cards' | 'minimal' | 'bento' | 'magazine',
    mood: 'professional' as 'professional' | 'playful' | 'elegant' | 'bold' | 'calm',
  });
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [activeTab, setActiveTab] = useState<'coder' | 'assistant'>('coder');
  const [isInBuilderMode, setIsInBuilderMode] = useState(false);

  // Listen for builder mode from WaktiAssistant (chatbot-builder-page class on body)
  useEffect(() => {
    const checkBuilderMode = () => {
      setIsInBuilderMode(document.body.classList.contains('chatbot-builder-page'));
    };
    checkBuilderMode();
    const observer = new MutationObserver(checkBuilderMode);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const [showEmpTooltip, setShowEmpTooltip] = useState(() => {
    // Show tooltip only on first visit (check localStorage)
    if (typeof window !== 'undefined') {
      return !localStorage.getItem('wakti_emp_tooltip_seen');
    }
    return false;
  });

  // Get username from profile
  const userName = user?.user_metadata?.username || 
                   user?.user_metadata?.full_name?.split(' ')[0] || 
                   user?.email?.split('@')[0] || 
                   'there';

  // Animated typing effect for placeholder
  useEffect(() => {
    const example = PLACEHOLDER_EXAMPLES[placeholderIndex];
    const fullText = isRTL ? example.ar : example.en;
    
    if (isTyping) {
      if (displayedPlaceholder.length < fullText.length) {
        const timeout = setTimeout(() => {
          setDisplayedPlaceholder(fullText.slice(0, displayedPlaceholder.length + 1));
        }, 50);
        return () => clearTimeout(timeout);
      } else {
        const timeout = setTimeout(() => {
          setIsTyping(false);
        }, 2000);
        return () => clearTimeout(timeout);
      }
    } else {
      if (displayedPlaceholder.length > 0) {
        const timeout = setTimeout(() => {
          setDisplayedPlaceholder(displayedPlaceholder.slice(0, -1));
        }, 30);
        return () => clearTimeout(timeout);
      } else {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_EXAMPLES.length);
        setIsTyping(true);
      }
    }
  }, [displayedPlaceholder, isTyping, placeholderIndex, isRTL]);

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      
      // CRITICAL: Filter by user_id to prevent cross-user visibility
      // RLS allows viewing published projects, but "My Projects" should only show own projects
      if (!user?.id) {
        setProjects([]);
        setLoading(false);
        return;
      }
      
      const { data, error } = await (supabase
        .from('projects' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false }) as any);

      if (error) throw error;
      
      // Fetch backend status for all projects
      if (data && data.length > 0) {
        const projectIds = data.map((p: Project) => p.id);
        const { data: backends } = await (supabase
          .from('project_backends' as any)
          .select('project_id, enabled')
          .in('project_id', projectIds) as any);
        
        if (backends && Array.isArray(backends)) {
          const statusMap: Record<string, boolean> = {};
          (backends as Array<{ project_id: string; enabled: boolean }>).forEach((b) => {
            statusMap[b.project_id] = b.enabled;
          });
          setBackendStatus(statusMap);
        }
      }
      
      // Fetch files for each project to enable preview
      const projectsWithFiles = await Promise.all((data || []).map(async (project: Project) => {
        try {
          const { data: filesData, error: filesError } = await (supabase
            .from('project_files' as any)
            .select('path, content')
            .eq('project_id', project.id) as any);
          
          if (filesData && filesData.length > 0) {
            let files: Record<string, string> = {};
            
            filesData.forEach((f: { path: string; content: string }) => {
              // Check if content is JSON (contains all files as JSON object)
              if (f.content && f.content.startsWith('{"/')) {
                try {
                  const parsed = JSON.parse(f.content);
                  files = { ...files, ...parsed };
                } catch (e) {
                  // Not JSON, treat as regular file
                  const path = f.path.startsWith('/') ? f.path : `/${f.path}`;
                  files[path] = f.content;
                }
              } else {
                const path = f.path.startsWith('/') ? f.path : `/${f.path}`;
                files[path] = f.content;
              }
            });
            
            if (Object.keys(files).length > 0) {
              return { ...project, files };
            }
          }
        } catch (e) {
          console.error('[Projects] Error fetching files for project:', project.id, e);
        }
        return project;
      }));
      
      setProjects(projectsWithFiles);
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle backend for a project
  const toggleBackend = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!user) return;
    
    setTogglingBackend(projectId);
    try {
      const isEnabled = backendStatus[projectId] || false;
      
      if (isEnabled) {
        // Disable backend
        await supabase
          .from('project_backends' as any)
          .update({ enabled: false })
          .eq('project_id', projectId);
        
        setBackendStatus(prev => ({ ...prev, [projectId]: false }));
        toast.success(isRTL ? 'تم إيقاف الخادم' : 'Server disabled');
      } else {
        // Enable backend - upsert to create if not exists
        const { error } = await supabase
          .from('project_backends' as any)
          .upsert({
            project_id: projectId,
            user_id: user.id,
            enabled: true,
            enabled_at: new Date().toISOString(),
            allowed_origins: ['*'], // Allow all origins by default
          }, { onConflict: 'project_id' });
        
        if (error) throw error;
        
        setBackendStatus(prev => ({ ...prev, [projectId]: true }));
        toast.success(isRTL ? 'تم تفعيل الخادم!' : 'Server enabled!');
      }
    } catch (err) {
      console.error('Error toggling backend:', err);
      toast.error(isRTL ? 'حدث خطأ' : 'Something went wrong');
    } finally {
      setTogglingBackend(null);
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setAttachedFiles(prev => [...prev, ...files]);
      toast.success(isRTL ? `تم إرفاق ${files.length} ملف` : `${files.length} file(s) attached`);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Generate AI instructions from custom theme settings
  const generateThemeInstructions = (theme: typeof newTheme): string => {
    const fontDescriptions = {
      modern: 'Use modern sans-serif fonts like Inter, SF Pro, or system-ui. Clean, geometric letterforms.',
      classic: 'Use elegant serif fonts like Playfair Display, Georgia, or Times. Traditional, refined typography.',
      playful: 'Use rounded, friendly fonts like Nunito, Quicksand, or Comic Neue. Fun, approachable feel.',
      minimal: 'Use thin, light-weight fonts like Roboto Light, Helvetica Neue Thin. Minimalist, airy typography.',
      bold: 'Use heavy, impactful fonts like Montserrat Black, Oswald, or Impact. Strong, attention-grabbing headlines.',
    };
    
    const shadowDescriptions = {
      none: 'No shadows. Flat design with clean edges.',
      soft: 'Soft, diffused shadows (shadow-lg, shadow-xl). Subtle depth and elevation.',
      hard: 'Hard, defined shadows with clear edges. Bold, graphic look.',
      glow: 'Glowing shadows using the theme colors. Futuristic, premium feel.',
      neon: 'Neon glow effects with bright, vibrant shadows. Electric, cyberpunk aesthetic.',
    };
    
    const radiusDescriptions = {
      none: 'Sharp corners (rounded-none). Angular, brutalist design.',
      subtle: 'Subtle rounding (rounded-md). Professional, clean edges.',
      rounded: 'Rounded corners (rounded-xl, rounded-2xl). Friendly, modern feel.',
      pill: 'Fully rounded pill shapes (rounded-full). Playful, soft design.',
    };
    
    const layoutDescriptions = {
      cards: 'Card-based layout with distinct sections. Each element in its own container.',
      minimal: 'Minimal layout with lots of whitespace. Content-focused, clean.',
      bento: 'Bento box grid layout with varying card sizes. Modern, Apple-style.',
      magazine: 'Magazine-style layout with mixed content sizes. Editorial, dynamic.',
    };
    
    const moodDescriptions = {
      professional: 'Professional, corporate feel. Trust-building, serious.',
      playful: 'Playful, fun atmosphere. Energetic, youthful.',
      elegant: 'Elegant, luxurious feel. Premium, sophisticated.',
      bold: 'Bold, impactful design. Attention-grabbing, confident.',
      calm: 'Calm, peaceful atmosphere. Relaxing, zen-like.',
    };

    return `CUSTOM THEME INSTRUCTIONS:
- Primary Color: ${theme.colors[0]} (use for buttons, links, accents)
- Secondary Color: ${theme.colors[1]} (use for highlights, secondary elements)
- Accent Color: ${theme.colors[2]} (use for hover states, decorations)
- Background Accent: ${theme.colors[3]} (use for subtle backgrounds, cards)

TYPOGRAPHY: ${fontDescriptions[theme.fontStyle]}

SHADOWS: ${shadowDescriptions[theme.shadowStyle]}

BORDER RADIUS: ${radiusDescriptions[theme.borderRadius]}

LAYOUT: ${layoutDescriptions[theme.layoutStyle]}

MOOD: ${moodDescriptions[theme.mood]}

Apply these styles consistently throughout the entire design.`;
  };

  // Save custom theme
  const saveCustomTheme = () => {
    if (!newTheme.name.trim()) {
      toast.error(isRTL ? 'أدخل اسم الثيم' : 'Enter a theme name');
      return;
    }
    
    const themeId = `custom-${Date.now()}`;
    const customTheme = {
      id: themeId,
      name: newTheme.name,
      nameAr: newTheme.name, // User can name it in any language
      colors: newTheme.colors,
      // Store full settings for instructions generation
      settings: {
        fontStyle: newTheme.fontStyle,
        shadowStyle: newTheme.shadowStyle,
        borderRadius: newTheme.borderRadius,
        layoutStyle: newTheme.layoutStyle,
        mood: newTheme.mood,
      },
      instructions: generateThemeInstructions(newTheme),
    };
    
    const updatedThemes = [...customThemes, customTheme];
    setCustomThemes(updatedThemes);
    localStorage.setItem('wakti_custom_themes', JSON.stringify(updatedThemes));
    
    // Auto-select the new theme
    setSelectedTheme(themeId);
    setShowThemeCreator(false);
    setShowThemes(false);
    
    // Reset form
    setNewTheme({
      name: '',
      colors: ['#3b82f6', '#8b5cf6', '#f97316', '#ec4899'],
      fontStyle: 'modern',
      shadowStyle: 'soft',
      borderRadius: 'rounded',
      layoutStyle: 'cards',
      mood: 'professional',
    });
    
    toast.success(isRTL ? 'تم حفظ الثيم!' : 'Theme saved!');
  };

  // Delete custom theme
  const deleteCustomTheme = (themeId: string) => {
    const updatedThemes = customThemes.filter((t: any) => t.id !== themeId);
    setCustomThemes(updatedThemes);
    localStorage.setItem('wakti_custom_themes', JSON.stringify(updatedThemes));
    if (selectedTheme === themeId) {
      setSelectedTheme('none');
    }
    toast.success(isRTL ? 'تم حذف الثيم' : 'Theme deleted');
  };

  // Build a theme-aware prompt by injecting selected theme's style into the template
  const buildThemeAwarePrompt = (baseTemplate: string, productType: string, templateId?: string): string => {
    // Replace the product placeholder
    let finalPrompt = baseTemplate.replace('{PRODUCT}', productType);
    
    // Get theme info
    const presetTheme = THEMES.find(t => t.id === selectedTheme);
    const customTheme = customThemes.find((t: any) => t.id === selectedTheme);
    
    // If a theme is selected (not 'none' or 'user_prompt'), inject theme-specific design direction
    if (selectedTheme && selectedTheme !== 'none' && selectedTheme !== 'user_prompt') {
      const themeName = presetTheme?.name || (customTheme as any)?.name || selectedTheme;
      const themeSettings = presetTheme?.settings;
      
      // Build theme design direction
      let themeDesignNote = '';
      if (themeSettings) {
        const styleWords = [];
        if (themeSettings.fontStyle) styleWords.push(themeSettings.fontStyle);
        if (themeSettings.shadowStyle && themeSettings.shadowStyle !== 'none') styleWords.push(`${themeSettings.shadowStyle} shadows`);
        if (themeSettings.borderRadius) styleWords.push(`${themeSettings.borderRadius} corners`);
        if (themeSettings.layoutStyle) styleWords.push(`${themeSettings.layoutStyle} layout`);
        if (themeSettings.mood) styleWords.push(`${themeSettings.mood} mood`);
        
        themeDesignNote = `\n\nTHEME: Apply "${themeName}" theme style - ${styleWords.join(', ')}. Use the theme's color palette consistently throughout.`;
      } else {
        themeDesignNote = `\n\nTHEME: Apply "${themeName}" theme style and color palette consistently throughout.`;
      }
      
      // Insert theme note after the first line (title)
      const lines = finalPrompt.split('\n');
      if (lines.length > 1) {
        lines.splice(1, 0, themeDesignNote);
        finalPrompt = lines.join('\n');
      } else {
        finalPrompt += themeDesignNote;
      }
    }
    
    // Add responsive/mobile emphasis at the end (skip for templates that are not websites)
    if (templateId !== 'interactive-deck') {
      const additionalInstructions = isRTL 
        ? `\n\nمهم جداً:
- تصميم متجاوب بالكامل (موبايل أولاً) - يجب أن يعمل بشكل مثالي على جميع الأجهزة
- أضف زر واتساب عائم للتواصل السريع
- استخدم صور من Freepik للمنتجات/الخدمات (لا تستخدم Unsplash أو picsum أو placeholder.com)
- تأكد من دعم اللغة العربية (RTL) بشكل كامل`
        : `\n\nIMPORTANT:
- Fully responsive design (mobile-first) - must work perfectly on all devices
- Add floating WhatsApp button for quick contact
- Use Freepik images for products/services (DO NOT use Unsplash, picsum, or placeholder.com)
- Ensure smooth animations and transitions throughout`;
      
      finalPrompt += additionalInstructions;
    }
    
    return finalPrompt;
  };

  // Get theme instructions for selected theme (works for both custom and preset themes)
  const getSelectedThemeInstructions = (): string => {
    // First check custom themes
    const customTheme = customThemes.find((t: any) => t.id === selectedTheme);
    if (customTheme && (customTheme as any).instructions) {
      return (customTheme as any).instructions;
    }
    
    // Then check preset themes with settings
    const presetTheme = THEMES.find(t => t.id === selectedTheme);
    if (presetTheme && presetTheme.settings && selectedTheme !== 'none') {
      // Generate instructions from preset theme settings
      return generateThemeInstructions({
        name: presetTheme.name,
        colors: presetTheme.colors.length >= 4 
          ? presetTheme.colors.slice(0, 4) as [string, string, string, string]
          : [...presetTheme.colors, ...Array(4 - presetTheme.colors.length).fill(presetTheme.colors[0])] as [string, string, string, string],
        ...presetTheme.settings
      });
    }
    
    return '';
  };

  // EMP - Enhance My Prompt using GPT-4o-mini
  const enhancePrompt = async () => {
    if (!prompt.trim()) {
      toast.error(isRTL ? 'اكتب شيئًا أولاً' : 'Write something first');
      return;
    }
    
    setIsEnhancing(true);
    try {
      const themeInstructions = getSelectedThemeInstructions();
      const response = await supabase.functions.invoke('projects-enhance-prompt', {
        body: {
          prompt: prompt,
          theme: selectedTheme,
          themeInstructions: themeInstructions || undefined,
          hasAssets: attachedFiles.length > 0,
        },
      });
      
      if (response.error || !response.data?.ok) {
        throw new Error(response.data?.error || 'Failed to enhance');
      }
      
      const enhanced = response.data.enhancedPrompt;
      if (enhanced && enhanced !== prompt) {
        setPrompt(enhanced);
        toast.success(isRTL ? 'تم تحسين الطلب!' : 'Prompt enhanced!');
      } else {
        toast.info(isRTL ? 'الطلب جيد كما هو' : 'Prompt is already good');
      }
    } catch (err: any) {
      console.error('EMP error:', err);
      toast.error(isRTL ? 'فشل في التحسين' : 'Failed to enhance');
    } finally {
      setIsEnhancing(false);
    }
  };

  const generateProjectTitle = (rawPrompt: string) => {
    const p = (rawPrompt || '').replace(/\s+/g, ' ').trim();
    console.log('[generateProjectTitle] Input:', p);
    if (!p) {
      console.log('[generateProjectTitle] Empty prompt, returning default');
      return isRTL ? 'مشروعي' : 'My Project';
    }

    const lower = p.toLowerCase();
    const leadingPatterns: RegExp[] = [
      /^build\s+(a|an|the)?\s*/i,
      /^create\s+(a|an|the)?\s*/i,
      /^make\s+(a|an|the)?\s*/i,
      /^generate\s+(a|an|the)?\s*/i,
      /^design\s+(a|an|the)?\s*/i,
      /^develop\s+(a|an|the)?\s*/i,
      /^i\s+want\s+(a|an|the)?\s*/i,
      /^i\s+need\s+(a|an|the)?\s*/i,
      /^please\s+(build|create|make|generate|design|develop)\s+(a|an|the)?\s*/i,
      /^you\s+to\s+(build|create|make|generate|design|develop)\s+(a|an|the)?\s*/i,
    ];

    let cleaned = p;
    for (const re of leadingPatterns) {
      if (re.test(cleaned)) {
        console.log('[generateProjectTitle] Matched pattern, removing:', re);
        cleaned = cleaned.replace(re, '').trim();
        break;
      }
    }

    cleaned = cleaned
      .replace(/[\s\-–—:;,.]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    console.log('[generateProjectTitle] After cleanup:', cleaned);

    if (!cleaned) {
      console.log('[generateProjectTitle] Empty after cleanup, returning default');
      return isRTL ? 'مشروعي' : 'My Project';
    }

    const words = cleaned.split(' ').filter(Boolean);
    const maxWords = 7;
    const short = words.slice(0, maxWords).join(' ');
    const result = short.length > 48 ? `${short.slice(0, 48).trim()}…` : short;
    console.log('[generateProjectTitle] Final result:', result);

    return result;
  };

  const createProject = async (enrichedPrompt?: string) => {
    const finalUserPrompt = enrichedPrompt || prompt;
    if (!finalUserPrompt.trim()) {
      toast.error(isRTL ? 'صف ما تريد بناءه' : 'Describe what you want to build');
      return;
    }
    
    if (!user?.id) {
      toast.error(isRTL ? 'يرجى تسجيل الدخول' : 'Please log in first');
      return;
    }

    if (!enrichedPrompt) {
      setIsDetectingContext(true);
      pendingPromptRef.current = finalUserPrompt;
      try {
        const response = await supabase.functions.invoke('projects-context-detect', {
          body: { prompt: finalUserPrompt },
        });
        console.log('[ContextDetect] Response:', response.data, response.error);
        if (!response.error && response.data?.ok && response.data?.fields?.length > 0) {
          setContextFormData({ siteType: response.data.siteType, heading: response.data.heading, fields: response.data.fields });
          setIsDetectingContext(false);
          return;
        }
      } catch (e) {
        console.warn('[ContextDetect] Failed, proceeding without form:', e);
      }
      setIsDetectingContext(false);
    }

    // Trial users: 1 project max
    if (isTrialUser && projects.length >= 1) {
      toast.error(
        isRTL
          ? 'التجربة المجانية تسمح بمشروع واحد فقط. اشترك لإنشاء المزيد!'
          : 'Free trial allows only 1 project. Subscribe to create more!'
      );
      return;
    }

    if (projects.length >= MAX_PROJECTS) {
      toast.error(
        isRTL
          ? `الحد الأقصى ${MAX_PROJECTS} مشاريع. احذف مشروعًا لإنشاء جديد.`
          : `Maximum ${MAX_PROJECTS} projects. Delete one to create a new one.`
      );
      return;
    }

    try {
      setGenerating(true);
      console.log('[createProject] Step 0: Starting with prompt:', finalUserPrompt.substring(0, 60));

      // Step 0: Assets are uploaded AFTER project creation so we can scope them to {userId}/{projectId}
      let assetUrls: string[] = [];

      // Ensure we have a valid session
      console.log('[createProject] Step 1: Getting session...');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(isRTL ? 'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى' : 'Session expired, please log in again');
        setGenerating(false);
        return;
      }
      console.log('[createProject] Step 1: Session OK');

      // Step 2: Create project immediately with placeholder
      const projectName = generateProjectTitle(finalUserPrompt);
      const slug = projectName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'my-project';

      console.log('[createProject] Step 2: Inserting project for user:', user.id);
      
      const { data: projectData, error: projectError } = await (supabase
        .from('projects' as any)
        .insert({
          user_id: session.user.id,
          name: projectName,
          slug: `${slug}-${Date.now().toString(36)}`,
          description: finalUserPrompt,
          template_type: 'ai-generated',
          status: 'generating',
        })
        .select()
        .single() as any);

      console.log('[createProject] Step 2: Result:', { projectData: !!projectData, projectError });
      
      if (projectError) {
        console.error('[createProject] Step 2: FAILED:', projectError);
        throw projectError;
      }

      // Upload assets (scoped to this project) and track them in project_uploads for hard-delete
      console.log('[createProject] Step 3: Uploading', attachedFiles.length, 'files...');
      if (attachedFiles.length > 0) {
        setIsUploading(true);
        for (const file of attachedFiles) {
          try {
            const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const storagePath = `${user.id}/${projectData.id}/${Date.now()}-${safeFilename}`;
            console.log('[createProject] Step 3: Uploading', safeFilename, '(' + file.size + ' bytes)');

            const { error: uploadError } = await supabase.storage
              .from('project-assets')
              .upload(storagePath, file);

            if (uploadError) {
              console.error('[createProject] Step 3: Upload error:', uploadError);
              continue;
            }
            console.log('[createProject] Step 3: Upload OK for', safeFilename);

            await supabase
              .from('project_uploads' as any)
              .insert({
                project_id: projectData.id,
                user_id: user.id,
                bucket_id: 'project-assets',
                filename: safeFilename,
                storage_path: storagePath,
                file_type: file.type,
                size_bytes: file.size,
              });

            const { data: { publicUrl } } = supabase.storage
              .from('project-assets')
              .getPublicUrl(storagePath);

            assetUrls.push(publicUrl);
          } catch (err) {
            console.error('Asset upload error:', err);
          }
        }
        setIsUploading(false);
      }

      console.log('[createProject] Step 4: Creating placeholder file...');
      const placeholderHtml = `<!DOCTYPE html>
<html ${language === 'ar' ? 'dir="rtl" lang="ar"' : 'lang="en"'}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isRTL ? 'جاري الإنشاء...' : 'Generating...'}</title>
  <style>
    body { 
      margin: 0; 
      min-height: 100vh; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      background: linear-gradient(135deg, hsl(210,100%,65%) 0%, hsl(280,70%,65%) 50%, hsl(25,95%,60%) 100%);
      font-family: system-ui, -apple-system, 'Segoe UI', 'Noto Sans Arabic', sans-serif;
    }
    .loader {
      text-align: center;
      color: white;
    }
    .spinner {
      width: 50px;
      height: 50px;
      border: 4px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <h2>${isRTL ? 'الذكاء الاصطناعي يقوم بإنشاء مشروعك...' : 'AI is creating your project...'}</h2>
    <p>${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}</p>
  </div>
</body>
</html>`;

      const { error: fileError } = await (supabase
        .from('project_files' as any)
        .insert({
          project_id: projectData.id,
          path: 'index.html',
          content: placeholderHtml,
        }) as any);

      if (fileError) {
        console.error('[createProject] Step 4: FAILED:', fileError);
        throw fileError;
      }
      console.log('[createProject] Step 4: Placeholder OK');
      
      console.log('[createProject] Step 5: Navigating to editor...');

      // Step 3: Navigate to editor immediately
      const assetParams = assetUrls.length > 0 ? `&assets=${encodeURIComponent(JSON.stringify(assetUrls))}` : '';
      const themeInstructions = getSelectedThemeInstructions();
      const instructionsParam = themeInstructions ? `&themeInstructions=${encodeURIComponent(themeInstructions)}` : '';
      const langParam = `&lang=${language}`;
      navigate(`/projects/${projectData.id}?generating=true&prompt=${encodeURIComponent(finalUserPrompt)}&theme=${selectedTheme}${assetParams}${instructionsParam}${langParam}`);

    } catch (err: any) {
      console.error('[createProject] FAILED:', err);
      const msg = err?.message || '';
      if (msg.includes('Failed to fetch')) {
        toast.error(isRTL ? 'خطأ في الاتصال. حاول مرة أخرى.' : 'Network error. Please try again.');
      } else {
        toast.error(msg || (isRTL ? 'فشل في الإنشاء' : 'Failed to create'));
      }
      setGenerating(false);
    }
  };

  const deleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    
    if (deleteConfirmId !== projectId) {
      // First click - show confirmation dialog
      setDeleteConfirmId(projectId);
      setDeleteConfirmText('');
      return;
    }
    
    // Second click - verify text and delete
    if (deleteConfirmText.toLowerCase() !== 'delete') {
      toast.error(isRTL ? 'اكتب "delete" للتأكيد' : 'Type "delete" to confirm');
      return;
    }
    
    try {
      setDeleting(projectId);

      const { data: result, error: hardDeleteError } = await supabase.functions.invoke('projects-hard-delete', {
        body: { projectId },
      });

      if (hardDeleteError) throw hardDeleteError;
      if (!result?.ok) throw new Error(result?.error || 'Hard delete failed');
      
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      setDeleteConfirmId(null);
      setDeleteConfirmText('');
      toast.success(isRTL ? 'تم الحذف' : 'Project deleted');
    } catch (err) {
      toast.error(isRTL ? 'فشل في الحذف' : 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const handleContextFormSubmit = async (data: BusinessContextData) => {
    setContextFormData(null);
    const originalPrompt = pendingPromptRef.current;

    if (data.uploadedFile) {
      // File uploaded — attach it and proceed directly, AI reads it from the uploaded asset
      setAttachedFiles(prev => [...prev, data.uploadedFile!]);
      createProject(originalPrompt);
      return;
    }

    // Build context block from filled fields
    const filledEntries = Object.entries(data.fields).filter(([, v]) => v.trim());
    if (filledEntries.length === 0) {
      createProject(originalPrompt);
      return;
    }

    const contextBlock = filledEntries
      .map(([id, val]) => {
        const field = contextFormData?.fields.find(f => f.id === id);
        return `${field?.label || id}: ${val}`;
      })
      .join('\n');

    const siteType = (contextFormData?.siteType || '').toLowerCase();

    // Determine context label + usage instructions based on what's being built
    let contextLabel = 'PROJECT DETAILS';
    let usageInstructions = 'Use this information throughout the entire project. Never use placeholder names or fake content.';

    // --- GAMES (template: any game type) ---
    if (/game|gaming|shooter|racing|puzzle|platformer|arcade|rpg|strategy|adventure|simulation|chess|card game|trivia|quiz game|battle|fighter|runner|clicker|tower defense|لعبة|سباق|مطلق|ألغاز|قتال|مغامرة/.test(siteType)) {
      contextLabel = 'GAME DETAILS';
      usageInstructions = 'Use this information in the game UI — title screen, loading screen, HUD, score display, leaderboard, game over screen, pause menu, level names, and any in-game text. Never use placeholder names.';

    // --- ONLINE STORE / ECOMMERCE (template: ecommerce) ---
    } else if (/online store|ecommerce|e-commerce|shop|store|marketplace|abayas|fashion|accessories|bags|traditional|heritage|luxury|watches|coffee|specialty|متجر|تسوق|أزياء|عباءات|إكسسوارات/.test(siteType)) {
      contextLabel = 'STORE DETAILS';
      usageInstructions = 'Use this information in the store header, hero section, product listings, category names, about page, checkout flow, and footer. Never use placeholder product names or fake prices.';

    // --- RESTAURANT / FOOD (template: restaurant) ---
    } else if (/restaurant|cafe|coffee shop|bakery|food truck|catering|fine dining|fast food|burger|pizza|seafood|bbq|grill|desserts|tea house|breakfast|brunch|مطعم|كافيه|مقهى|مخبز|طعام|وجبات|بيتزا|برجر|شواء/.test(siteType)) {
      contextLabel = 'RESTAURANT DETAILS';
      usageInstructions = 'Use this information in the hero section, menu page, about section, reservation form, contact page, and footer. Never use placeholder restaurant names or fake addresses.';

    // --- PORTFOLIO (template: portfolio) ---
    } else if (/portfolio|photography|graphic design|illustration|architect|interior design|fashion design|videography|filmmaker|musician|fitness coach|writer|copywriter|developer|personal cv|student portfolio|job seeker|model|talent|chef|makeup|beauty artist|freelancer|معرض|بورتفوليو|مصور|مصمم|مستقل/.test(siteType)) {
      contextLabel = 'PORTFOLIO DETAILS';
      usageInstructions = 'Use this information in the bio section, about page, skills section, project cards, work gallery, contact section, and footer. Never use placeholder names or fake contact info.';

    // --- BOOKING SYSTEM (template: booking) ---
    } else if (/booking|appointment|beauty salon|barbershop|spa|wellness|medical clinic|fitness studio|consulting|dentist|personal trainer|tutor|lessons|car wash|home services|photography sessions|coach|law firm|legal|therapy|counseling|pet grooming|repair|cleaning|massage|nail salon|حجز|مواعيد|صالون|عيادة|سبا|تدريب|استشارات/.test(siteType)) {
      contextLabel = 'BOOKING DETAILS';
      usageInstructions = 'Use this information in the hero, services list, staff profiles, booking form, location & hours section, and contact page. Never use placeholder business names or fake service prices.';

    // --- LANDING PAGE (template: landing) ---
    } else if (/landing page|mobile app|saas|software|e-book|agency services|gym promo|app download|course|webinar|newsletter|waitlist|influencer|creator|product launch|startup|صفحة هبوط|تطبيق|دورة|وكالة|منتج/.test(siteType)) {
      contextLabel = 'PRODUCT DETAILS';
      usageInstructions = 'Use this information in the hero section, features section, pricing page, testimonials, CTA buttons, and footer. Never use placeholder names or fake testimonials.';

    // --- EVENT PAGE (template: event) ---
    } else if (/event|wedding|birthday party|conference|workshop|product launch|graduation|baby shower|corporate event|ramadan|eid|concert|exhibition|sports event|engagement|henna|school event|charity|fundraiser|community meetup|tournament|open house|حفل|زفاف|مؤتمر|فعالية|عيد|رمضان|خطوبة|حناء|بطولة/.test(siteType)) {
      contextLabel = 'EVENT DETAILS';
      usageInstructions = 'Use this information in the event hero, countdown timer, schedule section, venue details, RSVP form, and contact section. Never use placeholder dates or fake venue names.';

    // --- INTERACTIVE DECK / PRESENTATION (template: interactive-deck) ---
    } else if (/interactive deck|presentation|pitch deck|startup pitch|investor deck|product demo|company overview|annual report|training deck|educational deck|عرض تفاعلي|عرض تقديمي|شرائح/.test(siteType)) {
      contextLabel = 'PRESENTATION DETAILS';
      usageInstructions = 'Use this information in the deck title slide, company overview slide, product/service slides, team slide, and closing slide. Never use placeholder company names or fake statistics.';

    // --- BLOG / NEWS / MAGAZINE ---
    } else if (/blog|news|magazine|article|journal|publication|مدونة|أخبار|مجلة/.test(siteType)) {
      contextLabel = 'BLOG DETAILS';
      usageInstructions = 'Use this information in the blog header, author bio, article bylines, about page, and footer. Never use placeholder author names or fake publication names.';

    // --- AGENCY / COMPANY / STUDIO ---
    } else if (/agency|studio|firm|company|corporate|شركة|وكالة/.test(siteType)) {
      contextLabel = 'COMPANY DETAILS';
      usageInstructions = 'Use this information in the hero, services section, team section, about page, contact page, and footer. Never use placeholder names or fake addresses.';

    // --- CLINIC / MEDICAL ---
    } else if (/clinic|hospital|doctor|medical|health|dental|عيادة|طبيب|صحة/.test(siteType)) {
      contextLabel = 'CLINIC DETAILS';
      usageInstructions = 'Use this information in the hero, services section, doctor profile, booking form, contact page, and footer. Never use placeholder doctor names or fake addresses.';

    // --- EDUCATION / SCHOOL / ACADEMY ---
    } else if (/school|academy|course|education|learning|university|مدرسة|أكاديمية|تعليم/.test(siteType)) {
      contextLabel = 'EDUCATION DETAILS';
      usageInstructions = 'Use this information in the hero, course listings, instructor bio, enrollment form, and footer. Never use placeholder names or fake course titles.';

    // --- HOTEL / PROPERTY / RENTAL ---
    } else if (/hotel|resort|airbnb|rental|accommodation|فندق|منتجع|إقامة/.test(siteType)) {
      contextLabel = 'PROPERTY DETAILS';
      usageInstructions = 'Use this information in the hero, room listings, amenities section, booking form, and footer. Never use placeholder property names or fake locations.';

    // --- MUSIC / ARTIST / PODCAST ---
    } else if (/music|band|artist|album|podcast|موسيقى|فنان|ألبوم/.test(siteType)) {
      contextLabel = 'ARTIST DETAILS';
      usageInstructions = 'Use this information in the hero, discography section, bio, tour dates, and contact section. Never use placeholder artist names or fake album titles.';

    // --- REAL ESTATE ---
    } else if (/real estate|realty|property listing|عقار|عقارات/.test(siteType)) {
      contextLabel = 'REAL ESTATE DETAILS';
      usageInstructions = 'Use this information in the hero, property listings, agent profile, contact form, and footer. Never use placeholder property names or fake prices.';

    // --- GYM / FITNESS ---
    } else if (/gym|fitness|sport|trainer|workout|صالة|رياضة|تدريب/.test(siteType)) {
      contextLabel = 'FITNESS DETAILS';
      usageInstructions = 'Use this information in the hero, class schedule, trainer profile, membership plans, and contact section. Never use placeholder gym names or fake trainer names.';

    // --- CHARITY / NGO ---
    } else if (/charity|nonprofit|ngo|donation|volunteer|خيري|تبرع|جمعية/.test(siteType)) {
      contextLabel = 'ORGANIZATION DETAILS';
      usageInstructions = 'Use this information in the hero, mission section, donation form, team page, and footer. Never use placeholder organization names or fake causes.';

    // --- FAN / COMMUNITY / CLUB ---
    } else if (/fan|tribute|community|forum|club|مشجع|نادي|مجتمع/.test(siteType)) {
      contextLabel = 'COMMUNITY DETAILS';
      usageInstructions = 'Use this information in the hero, about section, community highlights, and footer. Never use placeholder names or fake community info.';

    // --- DASHBOARD / ADMIN / SAAS APP ---
    } else if (/dashboard|admin|panel|crm|analytics|management|لوحة|إدارة/.test(siteType)) {
      contextLabel = 'APP DETAILS';
      usageInstructions = 'Use this information in the dashboard header, sidebar branding, welcome messages, data labels, and any onboarding screens. Never use placeholder company names.';

    // --- TOOL / UTILITY / CALCULATOR ---
    } else if (/tool|utility|calculator|converter|timer|tracker|أداة|حاسبة/.test(siteType)) {
      contextLabel = 'TOOL DETAILS';
      usageInstructions = 'Use this information in the tool header, description, result labels, and about section. Never use placeholder tool names or fake features.';
    }

    const enriched = `${originalPrompt}\n\n=== ${contextLabel} (USE AS REAL CONTENT — NOT PLACEHOLDERS) ===\n${contextBlock}\n\n${usageInstructions}`;
    createProject(enriched);
  };

  return (
    <div className={cn("h-full flex flex-col overflow-hidden", isRTL && "rtl")}>
      {/* ============ TOP TABS: PINNED (hidden in builder mode) ============ */}
      <div className={cn("w-full shrink-0 z-50 bg-background/90 supports-[backdrop-filter]:bg-background/70 backdrop-blur-3xl pt-6 pb-5 border-b border-zinc-200/50 dark:border-zinc-800/50 transition-all duration-300", isInBuilderMode && "opacity-0 pointer-events-none h-0 p-0 m-0 overflow-hidden border-none")}>
        <div className="flex justify-center px-4">
          <div className="relative inline-flex items-center p-1.5 bg-white/50 dark:bg-[#0c0f14]/50 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.5)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.05)] border border-black/5 dark:border-white/10">
            
            <button
              onClick={() => setActiveTab('coder')}
              className={cn(
                "relative z-10 flex items-center gap-3 px-8 py-3.5 rounded-[1.75rem] text-[13px] font-bold tracking-[0.15em] uppercase transition-colors duration-500",
                activeTab === 'coder' 
                  ? "text-white dark:text-[#0c0f14]" 
                  : "text-zinc-500 hover:text-[#060541] dark:text-zinc-400 dark:hover:text-white"
              )}
            >
              {activeTab === 'coder' && (
                <motion.div 
                  layoutId="luxuryMainTab"
                  className="absolute inset-0 bg-[#060541] dark:bg-[#f2f2f2] rounded-[1.75rem] shadow-[0_4px_16px_rgba(6,5,65,0.3)] dark:shadow-[0_4px_16px_rgba(255,255,255,0.2)]"
                  initial={false}
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <Code2 className="relative z-20 w-4.5 h-4.5" />
              <span className="relative z-20">{isRTL ? 'مبرمج الذكاء' : 'AI CODER'}</span>
            </button>

            <button
              onClick={() => setActiveTab('assistant')}
              className={cn(
                "relative z-10 flex items-center gap-3 px-8 py-3.5 rounded-[1.75rem] text-[13px] font-bold tracking-[0.15em] uppercase transition-colors duration-500",
                activeTab === 'assistant' 
                  ? "text-white dark:text-[#0c0f14]" 
                  : "text-zinc-500 hover:text-[#060541] dark:text-zinc-400 dark:hover:text-white"
              )}
            >
              {activeTab === 'assistant' && (
                <motion.div 
                  layoutId="luxuryMainTab"
                  className="absolute inset-0 bg-[#060541] dark:bg-[#f2f2f2] rounded-[1.75rem] shadow-[0_4px_16px_rgba(6,5,65,0.3)] dark:shadow-[0_4px_16px_rgba(255,255,255,0.2)]"
                  initial={false}
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <MessageCircle className="relative z-20 w-4.5 h-4.5" />
              <span className="relative z-20">{isRTL ? 'شات بوت الذكاء' : 'AI CHAT BOT'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ============ SCROLLABLE CONTENT ============ */}
      <div className="flex-1 min-h-0 overflow-y-auto relative h-full" id="projects-scroll">

      {/* ============ AI ASSISTANT TAB ============ */}
      {activeTab === 'assistant' && (
        <>
        <TrialGateOverlay featureKey="ai_chatbot" limit={0} featureLabel={{ en: 'AI Chatbot Builder', ar: 'منشئ الشات بوت' }} />
        <Suspense fallback={
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }>
          <WaktiAssistant />
        </Suspense>
        </>
      )}

      {/* ============ AI CODER TAB ============ */}
      {activeTab === 'coder' && (<>
      {/* Context Detect Loading Overlay */}
      {isDetectingContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'hsl(210,100%,65%)' }} />
            <p className="text-sm text-white/70">{isRTL ? 'جاري التحليل...' : 'Analyzing your request...'}</p>
          </div>
        </div>
      )}

      {/* Business Context Form Popup */}
      <AnimatePresence>
        {contextFormData && (
          <BusinessContextForm
            siteType={contextFormData.siteType}
            heading={contextFormData.heading}
            fields={contextFormData.fields}
            onSubmit={handleContextFormSubmit}
            isRTL={isRTL}
          />
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <div className="relative flex-1 flex flex-col min-h-[400px]">
        {/* Theme-aware base layer */}
        <div className={cn(
          "absolute inset-0",
          isDark ? "bg-[#04051a]" : "bg-[#f8f9fc]"
        )} />
        {/* RippleGrid on top — reduced wobble */}
        <div className="absolute -top-10 left-0 right-0 bottom-0">
          <RippleGrid
            enableRainbow
            gridColor={isDark ? "#0016bd" : "#3333ff"}
            rippleIntensity={0}
            gridSize={isDark ? 30 : 28}
            gridThickness={isDark ? 50 : 35}
            fadeDistance={4.9}
            vignetteStrength={isDark ? 1.5 : 0.6}
            glowIntensity={isDark ? 0.15 : 0.12}
            opacity={isDark ? 1 : 0.2}
            gridRotation={0}
            mouseInteraction={false}
            mouseInteractionRadius={2.1}
          />
        </div>
        {/* Subtle radial glow for depth */}
        <div 
          className="absolute inset-0" 
          style={{ 
            background: isDark 
              ? 'radial-gradient(ellipse 80% 60% at 50% 40%, hsla(230,100%,20%,0.45) 0%, transparent 70%)'
              : 'radial-gradient(ellipse 80% 60% at 50% 40%, hsla(230,100%,90%,0.3) 0%, transparent 70%)'
          }} 
        />
        {/* Light overlay for readability — dark mode only */}
        {isDark && <div className="absolute inset-0 bg-black/20" />}
        
        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-16">
          <h1 className={cn(
            "text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-10",
            isDark
              ? "text-white drop-shadow-lg"
              : "text-[#060541] drop-shadow-[0_2px_8px_rgba(6,5,65,0.25)]"
          )}>
            {isRTL ? `جاهز للبناء، ${userName}؟` : `Ready to build, ${userName}?`}
          </h1>

          <div className={cn(
            "w-full max-w-2xl rounded-2xl border relative",
            isDark
              ? "bg-[#0c0f14] border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.7),0_8px_24px_rgba(0,22,189,0.25),0_0_0_1px_rgba(255,255,255,0.05)]"
              : "bg-white border-[#060541]/15 shadow-[0_20px_60px_rgba(6,5,65,0.25),0_8px_24px_rgba(6,5,65,0.15),0_0_0_1px_rgba(6,5,65,0.05),inset_0_-2px_0_rgba(6,5,65,0.05)]"
          )} style={{ transform: 'translateZ(0)', perspective: '1000px' }}>
            {/* Limit Reached Overlay */}
            {projects.length >= MAX_PROJECTS && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-2xl z-20 flex items-center justify-center">
                <div className="text-center px-6">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 border-2 border-amber-500/50 rounded-full mb-3">
                    <span className="text-2xl">🔒</span>
                    <span className="text-sm font-bold text-amber-300 uppercase tracking-wider">
                      {isRTL ? 'وصلت للحد الأقصى' : 'Limit Reached'}
                    </span>
                  </div>
                  <p className="text-white/90 text-sm font-medium">
                    {isRTL 
                      ? 'لديك 3 مشاريع نشطة. احذف مشروعًا لإنشاء جديد.'
                      : 'You have 3 active projects. Delete one to create a new one.'}
                  </p>
                </div>
              </div>
            )}
            
            <div className="p-4">
                <textarea
                  id="projectPrompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !generating) {
                      e.preventDefault();
                      createProject();
                    }
                  }}
                  placeholder={`${isRTL ? 'اطلب من Wakti إنشاء ' : 'Ask Wakti to create '}${displayedPlaceholder}`}
                  className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground/50 resize-none min-h-[100px] max-h-[300px] overflow-y-auto"
                  disabled={generating || projects.length >= MAX_PROJECTS}
                  rows={4}
                  title={isRTL ? 'صف ما تريد بناءه' : 'Describe what you want to build'}
                />
                
                {/* Theme Injection Preview - INSIDE the prompt area */}
                {selectedTheme && selectedTheme !== 'none' && (() => {
                  const theme = THEMES.find(t => t.id === selectedTheme);
                  const customTheme = customThemes.find((t: any) => t.id === selectedTheme);
                  const themeInstructions = getSelectedThemeInstructions();
                  const themeName = theme ? (isRTL ? theme.nameAr : theme.name) : (customTheme as any)?.name || selectedTheme;
                  
                  return (
                    <div className="mt-3 pt-3 border-t border-border/30">
                      <div className="flex items-start gap-2">
                        <span className="text-[11px] text-muted-foreground font-medium shrink-0">
                          {isRTL ? '🎨 الثيم:' : '🎨 Theme:'}
                        </span>
                        <div className="flex-1">
                          <span className="text-[12px] font-semibold text-indigo-600 dark:text-indigo-400">
                            {themeName}
                          </span>
                          {themeInstructions && (
                            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                              {themeInstructions.slice(0, 150)}{themeInstructions.length > 150 ? '...' : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
            </div>

            {/* Attached Files Preview */}
            {attachedFiles.length > 0 && (
              <div className="px-4 pb-2 flex flex-wrap gap-2">
                {attachedFiles.map((file, i) => {
                  // Determine icon based on file type
                  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                  const isDoc = file.type.includes('word') || file.name.toLowerCase().endsWith('.doc') || file.name.toLowerCase().endsWith('.docx');
                  
                  return (
                    <div key={i} className="flex items-center gap-1 px-2 py-1 bg-muted rounded-lg text-xs">
                      {isPdf ? (
                        <FileText className="h-3 w-3 text-red-500" />
                      ) : isDoc ? (
                        <FileText className="h-3 w-3 text-blue-500" />
                      ) : (
                        <ImageIcon className="h-3 w-3" />
                      )}
                      <span className="max-w-[100px] truncate">{file.name}</span>
                      <button onClick={() => removeAttachment(i)} className="text-red-500 hover:text-red-600">×</button>
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Action Bar */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-muted/30 relative z-50">
              <div className="flex items-center gap-1">
                {/* Hidden file input - accepts images, PDF, and DOCX */}
                <input
                  id="projectAssetUpload"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  title={isRTL ? 'رفع ملفات (صور، PDF، Word)' : 'Upload files (images, PDF, Word)'}
                />
                
                {/* Attach Button */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={handleAttachClick}
                  disabled={generating || projects.length >= MAX_PROJECTS}
                >
                  <Paperclip className="h-4 w-4" />
                  <span className="text-xs hidden sm:inline">{isRTL ? 'إرفاق' : 'Attach'}</span>
                </Button>

                {/* EMP - Enhance My Prompt Button with Pulsing Dot & Tooltip */}
                <div className="relative">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="gap-1.5 text-muted-foreground hover:text-foreground hover:bg-purple-500/10 relative"
                    onClick={() => {
                      // Dismiss tooltip on first click
                      if (showEmpTooltip) {
                        setShowEmpTooltip(false);
                        localStorage.setItem('wakti_emp_tooltip_seen', 'true');
                      }
                      enhancePrompt();
                    }}
                    disabled={generating || isEnhancing || !prompt.trim() || projects.length >= MAX_PROJECTS}
                    title={isRTL ? 'تحسين الطلب' : 'Enhance My Prompt'}
                  >
                    {isEnhancing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 text-purple-500" />
                        {/* Pulsing dot indicator */}
                        {prompt.trim() && !generating && (
                          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500"></span>
                          </span>
                        )}
                      </>
                    )}
                    <span className="text-xs hidden sm:inline">{isRTL ? 'تحسين' : 'EMP'}</span>
                  </Button>
                  
                  {/* One-time tooltip for first-time users */}
                  {showEmpTooltip && prompt.trim() && !generating && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap relative">
                        <span>{isRTL ? '✨ اضغط لتحسين طلبك!' : '✨ Click to enhance your prompt!'}</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowEmpTooltip(false);
                            localStorage.setItem('wakti_emp_tooltip_seen', 'true');
                          }}
                          className="ml-2 text-white/70 hover:text-white"
                        >
                          ×
                        </button>
                        {/* Arrow pointing down */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-purple-600"></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Theme Selector - Lovable Style */}
                <div className="relative">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowThemes(!showThemes)}
                    disabled={generating || projects.length >= MAX_PROJECTS}
                  >
                    {/* Color preview dots */}
                    <div className="flex -space-x-0.5">
                      {THEMES.find(t => t.id === selectedTheme)?.colors.slice(0, 4).map((color, i) => (
                        <div 
                          key={i} 
                          className="w-2.5 h-2.5 rounded-full first:rounded-l-full last:rounded-r-full"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <span className="text-xs hidden sm:inline">{isRTL ? 'ثيم' : 'Theme'}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  
                  {showThemes && (
                    <div className="fixed inset-0 z-[9999]" onClick={() => { setShowThemes(false); setThemeSearch(''); }}>
                      <div 
                        className="absolute bg-white dark:bg-[#0c0f14] rounded-2xl shadow-2xl border border-border/50 overflow-hidden w-[280px]"
                        style={{ 
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Search Input */}
                        <div className="p-3 border-b border-border/50">
                          <div className="relative">
                            <input
                              type="text"
                              value={themeSearch}
                              onChange={(e) => setThemeSearch(e.target.value)}
                              placeholder={isRTL ? 'بحث عن ثيم...' : 'Search themes...'}
                              className="w-full bg-muted/50 dark:bg-white/5 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-muted-foreground/50"
                              autoFocus
                            />
                          </div>
                        </div>
                        
                        {/* Theme List - Scrollable */}
                        <div className="max-h-[280px] overflow-y-auto p-2">
                          {/* Custom Themes Section */}
                          {customThemes.length > 0 && (
                            <>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5 font-semibold">
                                {isRTL ? 'ثيماتي' : 'My themes'}
                              </p>
                              {customThemes
                                .filter((t: any) => {
                                  if (!themeSearch) return true;
                                  const search = themeSearch.toLowerCase();
                                  return t.name.toLowerCase().includes(search);
                                })
                                .map((t: any) => (
                                <div key={t.id} className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      setSelectedTheme(t.id);
                                      setShowThemes(false);
                                      setThemeSearch('');
                                    }}
                                    className={cn(
                                      "flex-1 flex items-center justify-between px-2 py-2 rounded-lg text-sm hover:bg-muted/80 transition-colors",
                                      selectedTheme === t.id && "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                                    )}
                                  >
                                    <span className="font-medium">{t.name}</span>
                                    <div className="flex -space-x-0.5">
                                      {t.colors.map((color: string, i: number) => (
                                        <div 
                                          key={i} 
                                          className="w-3 h-3 rounded-full"
                                          style={{ backgroundColor: color }}
                                        />
                                      ))}
                                    </div>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteCustomTheme(t.id);
                                    }}
                                    className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                                    title={isRTL ? 'حذف' : 'Delete'}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                              <div className="h-px bg-border/50 my-2" />
                            </>
                          )}
                          
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5 font-semibold">
                            {isRTL ? 'الثيمات' : 'Default themes'}
                          </p>
                          {THEMES
                            .filter(t => {
                              if (!themeSearch) return true;
                              const search = themeSearch.toLowerCase();
                              return t.name.toLowerCase().includes(search) || t.nameAr.includes(themeSearch);
                            })
                            .map((t) => (
                            <div
                              key={t.id}
                              onClick={() => {
                                setSelectedTheme(t.id);
                                setShowThemes(false);
                                setThemeSearch('');
                              }}
                              className={cn(
                                "w-full px-2 py-2 rounded-lg text-sm hover:bg-muted/80 transition-colors cursor-pointer",
                                selectedTheme === t.id && "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{isRTL ? t.nameAr : t.name}</span>
                                {/* Color pills - only show for non-user-prompt themes */}
                                {t.id !== 'user_prompt' && (
                                  <div className="flex -space-x-0.5">
                                    {t.colors.map((color, i) => (
                                      <div 
                                        key={i} 
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: color }}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                              {/* Style preview - shows font, shadow, layout, mood */}
                              {t.settings && t.id !== 'none' && t.id !== 'user_prompt' && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground">
                                    {t.settings.fontStyle}
                                  </span>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground">
                                    {t.settings.shadowStyle}
                                  </span>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground">
                                    {t.settings.layoutStyle}
                                  </span>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground">
                                    {t.settings.mood}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                          
                          {/* No results */}
                          {THEMES.filter(t => {
                            if (!themeSearch) return true;
                            const search = themeSearch.toLowerCase();
                            return t.name.toLowerCase().includes(search) || t.nameAr.includes(themeSearch);
                          }).length === 0 && customThemes.filter((t: any) => {
                            if (!themeSearch) return true;
                            return t.name.toLowerCase().includes(themeSearch.toLowerCase());
                          }).length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              {isRTL ? 'لا توجد نتائج' : 'No themes found'}
                            </p>
                          )}
                        </div>
                        
                        {/* Create New Button - Footer */}
                        <div className="p-2 border-t border-border/50">
                          <button
                            onClick={() => {
                              setShowThemes(false);
                              setShowThemeCreator(true);
                            }}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                            {isRTL ? 'إنشاء ثيم جديد' : 'Create new'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Chat Toggle */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-1.5 text-xs"
                  disabled={generating || projects.length >= MAX_PROJECTS}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{isRTL ? 'محادثة' : 'Chat'}</span>
                </Button>

                {/* Generate Button */}
                <Button
                  size="sm"
                  onClick={() => createProject()}
                  disabled={generating || !prompt.trim() || projects.length >= MAX_PROJECTS}
                  className="bg-[#060541] hover:bg-[#060541]/90 text-white gap-1.5"
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Limit Info */}
          {projects.length >= MAX_PROJECTS && (
            <p className="mt-4 text-sm text-white/80">
              {isRTL 
                ? 'وصلت للحد الأقصى. احذف مشروعًا لإنشاء جديد.'
                : 'You\'ve reached the limit of 3 projects. Delete a project to create a new one.'}
            </p>
          )}

          {/* Onboarding Gallery - What can you build? */}
          {projects.length < MAX_PROJECTS && !generating && (
            <div className="mt-8">
              <p className={cn(
                "inline-block px-4 py-2 rounded-full text-sm font-semibold text-center mb-4",
                isDark 
                  ? "bg-[#060541]/60 text-white shadow-[0_2px_8px_rgba(0,22,189,0.4)]" 
                  : "bg-[#060541] text-white shadow-[0_2px_8px_rgba(6,5,65,0.25)]"
              )}>
                {isRTL ? '✨ أو اختر نوع المشروع للبدء سريعاً' : '✨ Or pick a project type to get started quickly'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PROJECT_EXAMPLES.map((example) => {
                  const isActive = activeTemplateId === example.id;
                  const selectedOption = templateSelections[example.id] || (isRTL ? example.defaultOption.ar : example.defaultOption.en);
                  
                  return (
                    <div key={example.id} className="relative">
                      <button
                        onClick={() => {
                          if (isActive) {
                            // Already open - close it
                            setActiveTemplateId(null);
                          } else {
                            // Open this template's options
                            setActiveTemplateId(example.id);
                            setCustomTemplateInput('');
                          }
                        }}
                        className={cn(
                          "w-full group relative p-4 rounded-2xl border backdrop-blur-sm",
                          "hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300",
                          "text-left shadow-[0_4px_16px_rgba(6,5,65,0.08),0_2px_8px_rgba(6,5,65,0.04)]",
                          "hover:shadow-[0_12px_32px_rgba(6,5,65,0.2),0_8px_16px_rgba(6,5,65,0.12)]",
                          isDark
                            ? isActive ? "bg-white/10 border-white/50 shadow-[0_4px_16px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.5)]" : "bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/40 shadow-[0_4px_16px_rgba(0,0,0,0.3)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.4)]"
                            : isActive ? "bg-[#060541]/25 border-[#060541]/50" : "bg-[#060541]/15 border-[#060541]/30 hover:bg-[#060541]/25 hover:border-[#060541]/50"
                        )}
                      >
                        <div className={cn(
                          "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-50 transition-opacity",
                          `bg-gradient-to-br ${example.color}`
                        )} />
                        <div className="relative z-10">
                          <span className="text-2xl mb-2 block">{example.icon}</span>
                          <h3 className={cn("font-semibold text-sm mb-1", isDark ? "text-white" : "text-[#060541]")}>
                            {isRTL ? example.title.ar : example.title.en}
                          </h3>
                          <p className={cn("text-[11px] leading-tight", isDark ? "text-white/60" : "text-[#060541]/60")}>
                            {isRTL ? example.desc.ar : example.desc.en}
                          </p>
                          {/* Show selected option as a pill */}
                          <div className={cn("mt-2 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium border", isDark ? "bg-white/15 text-white border-white/25" : "bg-[#060541] text-white border-[#060541]")}>
                            <span className="truncate max-w-[100px]">{selectedOption}</span>
                            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                          </div>
                        </div>
                      </button>
                      
                      {/* Dropdown for selecting product/business type */}
                      {isActive && (
                        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-zinc-900 border border-white/20 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="p-2 border-b border-white/10">
                            <p className="text-[10px] text-white/50 uppercase tracking-wider px-2 mb-1">
                              {isRTL ? 'اختر النوع' : 'Select type'}
                            </p>
                          </div>
                          <div className="max-h-[200px] overflow-y-auto">
                            {example.options.map((option, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  const optionText = isRTL ? option.ar : option.en;
                                  setTemplateSelections(prev => ({ ...prev, [example.id]: optionText }));
                                  // Build theme-aware prompt with selected option
                                  const template = isRTL ? example.promptTemplate.ar : example.promptTemplate.en;
                                  const finalPrompt = buildThemeAwarePrompt(template, optionText, example.id);
                                  setPrompt(finalPrompt);
                                  setActiveTemplateId(null);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10 transition-colors"
                              >
                                {isRTL ? option.ar : option.en}
                              </button>
                            ))}
                            {/* Custom option */}
                            <div className="p-2 border-t border-white/10">
                              <p className="text-[10px] text-white/50 uppercase tracking-wider px-1 mb-1">
                                {isRTL ? 'أو اكتب نوعك' : 'Or type your own'}
                              </p>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={customTemplateInput}
                                  onChange={(e) => setCustomTemplateInput(e.target.value)}
                                  placeholder={isRTL ? 'مثال: ساعات فاخرة' : 'e.g., Luxury Watches'}
                                  className="flex-1 px-2 py-1.5 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/40"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && customTemplateInput.trim()) {
                                      setTemplateSelections(prev => ({ ...prev, [example.id]: customTemplateInput.trim() }));
                                      const template = isRTL ? example.promptTemplate.ar : example.promptTemplate.en;
                                      const finalPrompt = buildThemeAwarePrompt(template, customTemplateInput.trim(), example.id);
                                      setPrompt(finalPrompt);
                                      setActiveTemplateId(null);
                                      setCustomTemplateInput('');
                                    }
                                  }}
                                />
                                <button
                                  onClick={() => {
                                    if (customTemplateInput.trim()) {
                                      setTemplateSelections(prev => ({ ...prev, [example.id]: customTemplateInput.trim() }));
                                      const template = isRTL ? example.promptTemplate.ar : example.promptTemplate.en;
                                      const finalPrompt = buildThemeAwarePrompt(template, customTemplateInput.trim(), example.id);
                                      setPrompt(finalPrompt);
                                      setActiveTemplateId(null);
                                      setCustomTemplateInput('');
                                    }
                                  }}
                                  disabled={!customTemplateInput.trim()}
                                  className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-white/10 disabled:text-white/30 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                  {isRTL ? 'تم' : 'Go'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Click outside to close dropdown */}
              {activeTemplateId && (
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setActiveTemplateId(null)}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Projects Section */}
      <div className={cn(isDark ? "bg-[#04051a]" : "bg-[#f8f9fc]")}>
        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* Section Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">{isRTL ? 'مشاريعي' : 'My projects'}</h2>
            <span className="text-sm text-muted-foreground">
              {projects.length} / {MAX_PROJECTS}
            </span>
          </div>

          {/* Projects Grid */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Code2 className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg">{isRTL ? 'لا توجد مشاريع بعد' : 'No projects yet'}</p>
              <p className="text-sm mt-2 opacity-70">
                {isRTL ? 'ابدأ بوصف ما تريد بناءه أعلاه' : 'Start by describing what you want to build above'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <div key={project.id}>
                  <div
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="group relative overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-2"
                    style={{
                      background: isDark 
                        ? 'linear-gradient(145deg, rgba(17,24,39,0.95) 0%, rgba(31,41,55,0.85) 50%, rgba(55,65,81,0.7) 100%)'
                        : 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(249,250,251,0.95) 100%)',
                      borderRadius: '24px',
                      border: isDark 
                        ? '1px solid rgba(99,102,241,0.3)' 
                        : '1px solid rgba(229,231,235,0.9)',
                      backdropFilter: 'blur(12px)',
                      boxShadow: isDark
                        ? '0 25px 50px -12px rgba(0,0,0,0.5), 0 12px 24px -8px rgba(99,102,241,0.15), inset 0 1px 0 rgba(255,255,255,0.1), 0 0 0 1px rgba(99,102,241,0.1)'
                        : '0 25px 50px -12px rgba(0,0,0,0.15), 0 12px 24px -8px rgba(99,102,241,0.08), inset 0 1px 0 rgba(255,255,255,0.8), 0 0 0 1px rgba(99,102,241,0.05)',
                      transform: 'perspective(1000px) rotateX(0deg)',
                    }}
                  >
                    {/* 3D Shine Effect on Hover */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-[24px]" />
                    
                    {/* Luxury Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none rounded-[24px]" />
                    
                    {/* Project Preview Thumbnail */}
                    <div className="relative overflow-hidden rounded-t-[24px]">
                      <ProjectPreviewThumbnail project={project} isRTL={isRTL} />
                    </div>
                    
                    {/* Luxury Info Section */}
                    <div className="p-5 relative z-10">
                      {/* Title and Status Row */}
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <h3 className="font-bold text-lg truncate text-zinc-900 dark:text-white tracking-tight">{project.name}</h3>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={cn(
                              "shrink-0 px-3 py-1.5 text-[10px] rounded-full font-bold uppercase tracking-widest",
                              project.status === 'published'
                                ? "bg-emerald-500/30 text-emerald-600 dark:text-emerald-300 border border-emerald-500/50 shadow-lg shadow-emerald-500/20"
                                : project.status === 'generating'
                                ? "bg-indigo-500/30 text-indigo-600 dark:text-indigo-300 border border-indigo-500/50 shadow-lg shadow-indigo-500/20 animate-pulse"
                                : "bg-amber-500/30 text-amber-600 dark:text-amber-300 border border-amber-500/50 shadow-lg shadow-amber-500/20"
                            )}
                          >
                            {project.status === 'published' ? (isRTL ? 'منشور' : 'Live') : project.status === 'generating' ? (isRTL ? 'بناء' : 'Building') : (isRTL ? 'مسودة' : 'Draft')}
                          </span>
                          {/* Server Status Badge */}
                          <span
                            className={cn(
                              "shrink-0 px-2 py-0.5 text-[9px] rounded-full font-semibold uppercase tracking-wider",
                              backendStatus[project.id]
                                ? "bg-green-500/30 text-green-600 dark:text-green-300 border border-green-500/50"
                                : "bg-red-500/30 text-red-600 dark:text-red-300 border border-red-500/50"
                            )}
                          >
                            {backendStatus[project.id] 
                              ? (isRTL ? 'الخادم نشط' : 'Server Live')
                              : (isRTL ? 'الخادم متوقف' : 'Server Off')
                            }
                          </span>
                        </div>
                      </div>
                      
                      {/* Site URL - Show subdomain if published */}
                      {project.subdomain && project.status === 'published' ? (
                        <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                          <Globe className="h-3 w-3" />
                          <span className="font-mono truncate">{project.subdomain}.wakti.ai</span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {isRTL ? 'غير منشور بعد' : 'Not published yet'}
                        </p>
                      )}
                    </div>

                    {/* Actions - Top right */}
                    <div className="absolute top-4 right-4 flex gap-2 z-10">
                      {/* Share Button */}
                      {project.status === 'published' && project.subdomain && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <ShareButton
                            shareUrl={`https://${project.subdomain}.wakti.ai`}
                            shareTitle={project.name}
                            shareDescription={isRTL ? `شاهد موقعي: ${project.name}` : `Check out my site: ${project.name}`}
                            size="sm"
                          />
                        </div>
                      )}
                      
                      {/* Server/Backend Button */}
                      <Button
                        size="icon"
                        className={cn(
                          "h-9 w-9 rounded-full backdrop-blur-sm shadow-lg hover:shadow-xl transition-all bg-white/90 dark:bg-zinc-800/90 hover:bg-white dark:hover:bg-zinc-700",
                          backendStatus[project.id]
                            ? "text-green-600 dark:text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.6)] hover:shadow-[0_0_25px_rgba(34,197,94,0.8)]"
                            : "text-red-600 dark:text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.6)] hover:shadow-[0_0_25px_rgba(239,68,68,0.8)]"
                        )}
                        onClick={(e) => toggleBackend(e, project.id)}
                        disabled={togglingBackend === project.id}
                        title={backendStatus[project.id] 
                          ? (isRTL ? 'الخادم مفعل' : 'Server enabled') 
                          : (isRTL ? 'تفعيل الخادم' : 'Enable server')}
                      >
                        {togglingBackend === project.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Server className="h-4 w-4" />
                        )}
                      </Button>
                      
                      {/* Delete Button */}
                      <Button
                        size="icon"
                        className="h-9 w-9 rounded-full text-red-500 hover:text-red-600 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm shadow-lg hover:bg-red-50 dark:hover:bg-red-500/10 hover:shadow-xl transition-all"
                        onClick={(e) => deleteProject(e, project.id)}
                        disabled={deleting === project.id}
                      >
                        {deleting === project.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Delete Confirmation Dialog */}
                  {deleteConfirmId === project.id && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-sm w-full p-6 space-y-4">
                        <div>
                          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                            {isRTL ? 'حذف المشروع؟' : 'Delete Project?'}
                          </h3>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                            {isRTL 
                              ? 'هذا سيحذف المشروع وكل محتوياته - الكود والتصميم والخادم والرابط المنشور. لا يمكن التراجع عن هذا.'
                              : 'This will permanently delete your project, including all code, design, backend, and its public URL. This cannot be undone.'}
                          </p>
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-2">
                            {isRTL ? 'اكتب "delete" للتأكيد:' : 'Type "delete" to confirm:'}
                          </label>
                          <input
                            type="text"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && deleteConfirmText.toLowerCase() === 'delete') {
                                deleteProject(e as any, project.id);
                              }
                            }}
                            placeholder="delete"
                            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                            autoFocus
                          />
                        </div>

                        <div className="flex gap-3 pt-2">
                          <button
                            onClick={() => {
                              setDeleteConfirmId(null);
                              setDeleteConfirmText('');
                            }}
                            className="flex-1 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors font-medium"
                          >
                            {isRTL ? 'إلغاء' : 'Cancel'}
                          </button>
                          <button
                            onClick={(e) => deleteProject(e, project.id)}
                            disabled={deleteConfirmText.toLowerCase() !== 'delete' || deleting === project.id}
                            className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 disabled:cursor-not-allowed text-white transition-colors font-medium flex items-center justify-center gap-2"
                          >
                            {deleting === project.id ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {isRTL ? 'جاري الحذف...' : 'Deleting...'}
                              </>
                            ) : (
                              isRTL ? 'حذف المشروع' : 'Delete Project'
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </>)}

      {/* Custom Theme Creator Modal - Mobile Optimized */}
      {activeTab === 'coder' && showThemeCreator && (
        <div className="fixed inset-0 z-[10000] flex items-end md:items-center justify-center" onClick={() => setShowThemeCreator(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div 
            className="relative bg-white dark:bg-[#0c0f14] rounded-t-3xl md:rounded-2xl shadow-2xl border border-border/50 w-full md:max-w-lg max-h-[85vh] md:max-h-[90vh] overflow-hidden flex flex-col md:m-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile drag handle */}
            <div className="md:hidden flex justify-center py-2 shrink-0">
              <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 md:px-5 py-3 md:py-4 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-2 md:p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-indigo-500/30">
                  <Palette className="h-4 w-4 md:h-5 md:w-5 text-indigo-500" />
                </div>
                <div>
                  <h2 className="text-sm md:text-base font-bold">{isRTL ? 'إنشاء ثيم جديد' : 'Create New Theme'}</h2>
                  <p className="text-[10px] md:text-[11px] text-muted-foreground">{isRTL ? 'خصص ألوانك وأنماطك' : 'Customize colors & styles'}</p>
                </div>
              </div>
              <button
                onClick={() => setShowThemeCreator(false)}
                className="p-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                title={isRTL ? 'إغلاق' : 'Close'}
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 md:space-y-5">
              {/* Theme Name */}
              <div>
                <label className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 md:mb-2 block">
                  {isRTL ? 'اسم الثيم' : 'Theme Name'}
                </label>
                <input
                  type="text"
                  value={newTheme.name}
                  onChange={(e) => setNewTheme(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={isRTL ? 'مثال: ثيمي المميز' : 'e.g., My Awesome Theme'}
                  className="w-full bg-muted/50 dark:bg-white/5 rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 border border-border/50"
                />
              </div>

              {/* Colors */}
              <div>
                <label className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 md:mb-2 flex items-center gap-2">
                  <Palette className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  {isRTL ? 'الألوان (4)' : 'Colors (4)'}
                </label>
                <div className="grid grid-cols-4 gap-2 md:gap-3">
                  {newTheme.colors.map((color, i) => (
                    <div key={i} className="relative">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => {
                          const newColors = [...newTheme.colors];
                          newColors[i] = e.target.value;
                          setNewTheme(prev => ({ ...prev, colors: newColors }));
                        }}
                        className="w-full h-10 md:h-12 rounded-lg md:rounded-xl cursor-pointer border-2 border-white dark:border-zinc-800 shadow-md"
                        title={i === 0 ? 'Primary' : i === 1 ? 'Secondary' : i === 2 ? 'Accent' : 'Background'}
                      />
                      <span className="absolute -bottom-4 md:-bottom-5 left-0 right-0 text-[8px] md:text-[9px] text-center text-muted-foreground">
                        {i === 0 ? (isRTL ? 'رئيسي' : 'Primary') : 
                         i === 1 ? (isRTL ? 'ثانوي' : 'Secondary') :
                         i === 2 ? (isRTL ? 'تمييز' : 'Accent') : (isRTL ? 'خلفية' : 'BG')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Font Style */}
              <div className="mt-5 md:mt-6">
                <label className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 md:mb-2 flex items-center gap-2">
                  <Type className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  {isRTL ? 'نمط الخط' : 'Font Style'}
                </label>
                <div className="grid grid-cols-5 gap-1.5 md:gap-2">
                  {(['modern', 'classic', 'playful', 'minimal', 'bold'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => setNewTheme(prev => ({ ...prev, fontStyle: style }))}
                      className={cn(
                        "px-2 py-2 rounded-lg text-[11px] font-medium border transition-all",
                        newTheme.fontStyle === style 
                          ? "bg-indigo-500 text-white border-indigo-500" 
                          : "bg-muted/50 border-border/50 hover:border-indigo-500/50"
                      )}
                    >
                      {style === 'modern' ? (isRTL ? 'عصري' : 'Modern') :
                       style === 'classic' ? (isRTL ? 'كلاسيك' : 'Classic') :
                       style === 'playful' ? (isRTL ? 'مرح' : 'Playful') :
                       style === 'minimal' ? (isRTL ? 'بسيط' : 'Minimal') : (isRTL ? 'جريء' : 'Bold')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shadow Style */}
              <div>
                <label className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 md:mb-2 flex items-center gap-2">
                  <Layers className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  {isRTL ? 'نمط الظل' : 'Shadow Style'}
                </label>
                <div className="grid grid-cols-5 gap-1.5 md:gap-2">
                  {(['none', 'soft', 'hard', 'glow', 'neon'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => setNewTheme(prev => ({ ...prev, shadowStyle: style }))}
                      className={cn(
                        "px-1.5 md:px-2 py-1.5 md:py-2 rounded-lg text-[10px] md:text-[11px] font-medium border transition-all",
                        newTheme.shadowStyle === style 
                          ? "bg-indigo-500 text-white border-indigo-500" 
                          : "bg-muted/50 border-border/50 hover:border-indigo-500/50"
                      )}
                    >
                      {style === 'none' ? (isRTL ? 'بدون' : 'None') :
                       style === 'soft' ? (isRTL ? 'ناعم' : 'Soft') :
                       style === 'hard' ? (isRTL ? 'حاد' : 'Hard') :
                       style === 'glow' ? (isRTL ? 'توهج' : 'Glow') : (isRTL ? 'نيون' : 'Neon')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Border Radius */}
              <div>
                <label className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 md:mb-2 flex items-center gap-2">
                  <Square className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  {isRTL ? 'الحواف' : 'Border Radius'}
                </label>
                <div className="grid grid-cols-4 gap-1.5 md:gap-2">
                  {(['none', 'subtle', 'rounded', 'pill'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => setNewTheme(prev => ({ ...prev, borderRadius: style }))}
                      className={cn(
                        "px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-[10px] md:text-[11px] font-medium border transition-all",
                        newTheme.borderRadius === style 
                          ? "bg-indigo-500 text-white border-indigo-500" 
                          : "bg-muted/50 border-border/50 hover:border-indigo-500/50"
                      )}
                    >
                      {style === 'none' ? (isRTL ? 'حاد' : 'Sharp') :
                       style === 'subtle' ? (isRTL ? 'خفيف' : 'Subtle') :
                       style === 'rounded' ? (isRTL ? 'دائري' : 'Rounded') : (isRTL ? 'كبسولة' : 'Pill')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Layout Style */}
              <div>
                <label className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 md:mb-2 flex items-center gap-2">
                  <Settings2 className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  {isRTL ? 'نمط التخطيط' : 'Layout Style'}
                </label>
                <div className="grid grid-cols-4 gap-1.5 md:gap-2">
                  {(['cards', 'minimal', 'bento', 'magazine'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => setNewTheme(prev => ({ ...prev, layoutStyle: style }))}
                      className={cn(
                        "px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-[10px] md:text-[11px] font-medium border transition-all",
                        newTheme.layoutStyle === style 
                          ? "bg-indigo-500 text-white border-indigo-500" 
                          : "bg-muted/50 border-border/50 hover:border-indigo-500/50"
                      )}
                    >
                      {style === 'cards' ? (isRTL ? 'بطاقات' : 'Cards') :
                       style === 'minimal' ? (isRTL ? 'بسيط' : 'Minimal') :
                       style === 'bento' ? (isRTL ? 'بينتو' : 'Bento') : (isRTL ? 'مجلة' : 'Magazine')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mood */}
              <div>
                <label className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 md:mb-2 flex items-center gap-2">
                  <Sun className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  {isRTL ? 'المزاج العام' : 'Overall Mood'}
                </label>
                <div className="grid grid-cols-5 gap-1.5 md:gap-2">
                  {(['professional', 'playful', 'elegant', 'bold', 'calm'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => setNewTheme(prev => ({ ...prev, mood: style }))}
                      className={cn(
                        "px-1.5 md:px-2 py-1.5 md:py-2 rounded-lg text-[10px] md:text-[11px] font-medium border transition-all",
                        newTheme.mood === style 
                          ? "bg-indigo-500 text-white border-indigo-500" 
                          : "bg-muted/50 border-border/50 hover:border-indigo-500/50"
                      )}
                    >
                      {style === 'professional' ? (isRTL ? 'مهني' : 'Pro') :
                       style === 'playful' ? (isRTL ? 'مرح' : 'Fun') :
                       style === 'elegant' ? (isRTL ? 'أنيق' : 'Elegant') :
                       style === 'bold' ? (isRTL ? 'جريء' : 'Bold') : (isRTL ? 'هادئ' : 'Calm')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="mt-3 md:mt-4 p-3 md:p-4 rounded-xl border border-border/50 bg-muted/30">
                <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground mb-2 md:mb-3 font-semibold">
                  {isRTL ? 'معاينة' : 'Preview'}
                </p>
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="flex -space-x-1">
                    {newTheme.colors.map((color, i) => (
                      <div 
                        key={i}
                        className="w-6 h-6 md:w-8 md:h-8 rounded-full border-2 border-white dark:border-zinc-800"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-xs md:text-sm truncate">{newTheme.name || (isRTL ? 'ثيم جديد' : 'New Theme')}</p>
                    <p className="text-[9px] md:text-[10px] text-muted-foreground truncate">
                      {newTheme.fontStyle} • {newTheme.shadowStyle} • {newTheme.layoutStyle}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 md:gap-3 px-4 md:px-5 py-3 md:py-4 border-t border-border/50 shrink-0 bg-muted/20">
              <Button 
                variant="outline" 
                onClick={() => setShowThemeCreator(false)}
                className="flex-1 h-10 md:h-11 rounded-xl text-sm"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button 
                onClick={saveCustomTheme}
                className="flex-1 h-10 md:h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm"
              >
                {isRTL ? 'حفظ الثيم' : 'Save Theme'}
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>{/* end scrollable content */}
    </div>
  );
}
