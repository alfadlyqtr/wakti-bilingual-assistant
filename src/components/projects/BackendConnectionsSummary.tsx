import React from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle2, 
  Database, 
  Mail, 
  Calendar, 
  ShoppingBag, 
  Users, 
  Image,
  Settings,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DetectedConnection {
  id: string;
  name: string;
  nameAr: string;
  icon: React.ReactNode;
  status: 'connected' | 'available' | 'needs_config';
  description: string;
  descriptionAr: string;
}

interface BackendConnectionsSummaryProps {
  generatedFiles: Record<string, string>;
  isRTL?: boolean;
  onConfigureClick?: (connectionId: string) => void;
  className?: string;
}

// Detect what backend features are used in the generated code
const detectConnections = (files: Record<string, string>): DetectedConnection[] => {
  const allCode = Object.values(files).join('\n').toLowerCase();
  const connections: DetectedConnection[] = [];

  // Contact Form Detection
  if (allCode.includes('contact') && (allCode.includes('form') || allCode.includes('submit'))) {
    const isConnected = allCode.includes('project-backend-api') || allCode.includes('action: \'submit\'');
    connections.push({
      id: 'contact',
      name: 'Contact Form',
      nameAr: 'نموذج الاتصال',
      icon: <Mail className="w-4 h-4" />,
      status: isConnected ? 'connected' : 'available',
      description: isConnected ? 'Submissions go to your Backend inbox' : 'Can be connected to receive messages',
      descriptionAr: isConnected ? 'الرسائل تصل إلى صندوق الوارد' : 'يمكن ربطه لاستقبال الرسائل'
    });
  }

  // Booking System Detection
  if (allCode.includes('booking') || allCode.includes('appointment') || allCode.includes('schedule')) {
    const isConnected = allCode.includes('project-backend-api') && allCode.includes('booking');
    connections.push({
      id: 'booking',
      name: 'Booking System',
      nameAr: 'نظام الحجز',
      icon: <Calendar className="w-4 h-4" />,
      status: isConnected ? 'connected' : 'needs_config',
      description: isConnected ? 'Bookings saved to your Backend' : 'Configure to accept real bookings',
      descriptionAr: isConnected ? 'الحجوزات محفوظة في الباك اند' : 'قم بالإعداد لقبول الحجوزات'
    });
  }

  // Products/Shop Detection
  if (allCode.includes('product') || allCode.includes('shop') || allCode.includes('cart')) {
    const isConnected = allCode.includes('project-backend-api') && (allCode.includes('products') || allCode.includes('inventory'));
    connections.push({
      id: 'products',
      name: 'Product Catalog',
      nameAr: 'كتالوج المنتجات',
      icon: <ShoppingBag className="w-4 h-4" />,
      status: isConnected ? 'connected' : 'needs_config',
      description: isConnected ? 'Products fetched from Backend' : 'Add real products via Backend',
      descriptionAr: isConnected ? 'المنتجات من الباك اند' : 'أضف منتجات حقيقية من الباك اند'
    });
  }

  // Auth/Users Detection
  if (allCode.includes('login') || allCode.includes('signup') || allCode.includes('auth') || allCode.includes('register')) {
    const isConnected = allCode.includes('project-backend-api') && (allCode.includes('site-auth') || allCode.includes('login'));
    connections.push({
      id: 'auth',
      name: 'User Authentication',
      nameAr: 'تسجيل المستخدمين',
      icon: <Users className="w-4 h-4" />,
      status: isConnected ? 'connected' : 'needs_config',
      description: isConnected ? 'Users can sign up and log in' : 'Enable user accounts',
      descriptionAr: isConnected ? 'المستخدمون يمكنهم التسجيل' : 'فعّل حسابات المستخدمين'
    });
  }

  // Media/Gallery Detection
  if (allCode.includes('gallery') || allCode.includes('portfolio') || allCode.includes('media')) {
    const isConnected = allCode.includes('project-backend-api') && allCode.includes('media');
    connections.push({
      id: 'media',
      name: 'Media Gallery',
      nameAr: 'معرض الوسائط',
      icon: <Image className="w-4 h-4" />,
      status: isConnected ? 'connected' : 'available',
      description: isConnected ? 'Images from your Backend' : 'Can upload images via Backend',
      descriptionAr: isConnected ? 'الصور من الباك اند' : 'يمكن رفع الصور من الباك اند'
    });
  }

  return connections;
};

const statusColors = {
  connected: 'bg-green-500/10 text-green-400 border-green-500/20',
  available: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  needs_config: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
};

const statusLabels = {
  connected: { en: 'Connected', ar: 'متصل' },
  available: { en: 'Available', ar: 'متاح' },
  needs_config: { en: 'Needs Setup', ar: 'يحتاج إعداد' }
};

export const BackendConnectionsSummary: React.FC<BackendConnectionsSummaryProps> = ({
  generatedFiles,
  isRTL = false,
  onConfigureClick,
  className = ''
}) => {
  const connections = React.useMemo(() => detectConnections(generatedFiles), [generatedFiles]);

  if (connections.length === 0) return null;

  const connectedCount = connections.filter(c => c.status === 'connected').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-foreground">
            {isRTL ? 'اتصالات الباك اند' : 'Backend Connections'}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {connectedCount}/{connections.length} {isRTL ? 'متصل' : 'connected'}
        </span>
      </div>

      {/* Connections List */}
      <div className="divide-y divide-white/5">
        {connections.map((connection, index) => (
          <motion.div
            key={connection.id}
            initial={{ opacity: 0, x: isRTL ? 10 : -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${statusColors[connection.status]}`}>
                {connection.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {isRTL ? connection.nameAr : connection.name}
                  </span>
                  {connection.status === 'connected' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? connection.descriptionAr : connection.description}
                </p>
              </div>
            </div>

            {connection.status !== 'connected' && onConfigureClick && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onConfigureClick(connection.id)}
                className="h-7 px-2 text-xs"
              >
                <Settings className="w-3 h-3 mr-1" />
                {isRTL ? 'إعداد' : 'Setup'}
                <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            )}
          </motion.div>
        ))}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 bg-white/[0.02] border-t border-white/5">
        <p className="text-[10px] text-muted-foreground text-center">
          {isRTL 
            ? 'الميزات المتصلة تحفظ البيانات تلقائياً في الباك اند'
            : 'Connected features automatically save data to your Backend'}
        </p>
      </div>
    </motion.div>
  );
};

export default BackendConnectionsSummary;
