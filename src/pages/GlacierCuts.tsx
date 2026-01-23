import { useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import '@/styles/glacier.css';

export default function GlacierCuts() {
  const { language } = useTheme();
  const isRTL = language === 'ar';

  useEffect(() => {
    // Set document title
    document.title = isRTL ? 'جلاسير كتس - صالون متميز' : 'Glacier Cuts - Premium Salon';
  }, [isRTL]);

  return (
    <div className="min-h-screen bg-[#2F323A] text-white">
      {/* Header */}
      <header className="glacier-header">
        <nav className="glacier-nav">
          <div className="flex items-center gap-4">
            <img src="/images/glacier-logo.svg" alt="Glacier Cuts" className="h-8" />
            <span className="text-xl font-semibold">Glacier Cuts</span>
          </div>
          <div className="glacier-nav-links">
            <a href="#home" className="glacier-nav-link">Home</a>
            <a href="#booking" className="glacier-nav-link">Booking</a>
            <a href="#shop" className="glacier-nav-link">Shop</a>
            <a href="#gallery" className="glacier-nav-link">Gallery</a>
            <a href="#contact" className="glacier-nav-link">Contact</a>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="glacier-hero">
        <div className="glacier-hero-content">
          <h1 className="glacier-title">
            {isRTL ? 'الأناقة معاد تعريفها، الدقة مثالية' : 'Style Redefined, Precision Perfected'}
          </h1>
          <p className="glacier-subtitle">
            {isRTL 
              ? 'اختبر فن تصفيف الشعر في جلاسير كتس. حيث تلتقي التقنيات الكلاسيكية مع اللمسات العصرية'
              : 'Experience the art of grooming at Glacier Cuts. Where classic techniques meet modern flair'}
          </p>
          <button className="glacier-button">
            {isRTL ? 'احجز موعدك' : 'Book Appointment'}
          </button>
        </div>
      </section>

      {/* Services Grid */}
      <section className="glacier-grid">
        <div className="glacier-card">
          <img src="/images/haircut.jpg" alt="Premium Haircut" className="glacier-image mb-4 h-48" />
          <h3 className="text-xl font-semibold mb-2">
            {isRTL ? 'قص شعر متميز' : 'Premium Haircut'}
          </h3>
          <p className="text-white/70">
            {isRTL 
              ? 'قص شعر احترافي مع اهتمام خاص بالتفاصيل'
              : 'Professional haircut with meticulous attention to detail'}
          </p>
        </div>
        <div className="glacier-card">
          <img src="/images/styling.jpg" alt="Styling" className="glacier-image mb-4 h-48" />
          <h3 className="text-xl font-semibold mb-2">
            {isRTL ? 'تصفيف الشعر' : 'Hair Styling'}
          </h3>
          <p className="text-white/70">
            {isRTL
              ? 'تصفيف شعر احترافي يناسب شخصيتك'
              : 'Professional styling tailored to your personality'}
          </p>
        </div>
        <div className="glacier-card">
          <img src="/images/beard.jpg" alt="Beard Grooming" className="glacier-image mb-4 h-48" />
          <h3 className="text-xl font-semibold mb-2">
            {isRTL ? 'تشذيب اللحية' : 'Beard Grooming'}
          </h3>
          <p className="text-white/70">
            {isRTL
              ? 'عناية كاملة باللحية مع تشذيب احترافي'
              : 'Complete beard care with professional trimming'}
          </p>
        </div>
      </section>
    </div>
  );
}
