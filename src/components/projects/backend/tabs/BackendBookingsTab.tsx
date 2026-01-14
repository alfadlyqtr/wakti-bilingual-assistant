import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, Users, Settings, Plus, Search, Filter, 
  Check, X, AlertCircle, Loader2, ChevronLeft, ChevronRight,
  CalendarDays, Edit, Trash2, MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BackendBookingsTabProps {
  bookings: any[];
  projectId: string;
  isRTL: boolean;
  onRefresh: () => void;
}

type BookingInnerTab = 'bookings' | 'services' | 'availability' | 'calendar';

const INNER_TABS: { id: BookingInnerTab; icon: any; label: string; labelAr: string }[] = [
  { id: 'bookings', icon: Calendar, label: 'Bookings', labelAr: 'الحجوزات' },
  { id: 'services', icon: Users, label: 'Services', labelAr: 'الخدمات' },
  { id: 'availability', icon: Clock, label: 'Availability', labelAr: 'الأوقات' },
  { id: 'calendar', icon: CalendarDays, label: 'Calendar', labelAr: 'التقويم' },
];

interface Service {
  id?: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price: number;
  currency: string;
  max_concurrent: number;
  advance_booking_days: number;
  is_active: boolean;
}

interface AvailabilitySlot {
  day: number; // 0-6 (Sunday-Saturday)
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface BookingSettings {
  buffer_minutes: number;
  min_notice_hours: number;
  cancellation_hours: number;
  auto_confirm: boolean;
  working_hours: AvailabilitySlot[];
  blocked_dates: string[];
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export function BackendBookingsTab({ bookings, projectId, isRTL, onRefresh }: BackendBookingsTabProps) {
  const [activeInnerTab, setActiveInnerTab] = useState<BookingInnerTab>('bookings');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Modal states
  const [showAddService, setShowAddService] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  
  // Data states
  const [services, setServices] = useState<Service[]>([]);
  const [settings, setSettings] = useState<BookingSettings>({
    buffer_minutes: 15,
    min_notice_hours: 24,
    cancellation_hours: 24,
    auto_confirm: false,
    working_hours: DAYS.map((_, i) => ({
      day: i,
      start_time: '09:00',
      end_time: '17:00',
      is_available: i !== 5 && i !== 6 // Closed Friday & Saturday
    })),
    blocked_dates: []
  });
  const [saving, setSaving] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Stats
  const todayBookings = bookings.filter(b => b.booking_date === new Date().toISOString().split('T')[0]).length;
  const pendingBookings = bookings.filter(b => b.status === 'pending').length;
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;

  useEffect(() => {
    fetchServices();
    fetchSettings();
  }, [projectId]);

  const fetchServices = async () => {
    const { data } = await supabase
      .from('project_collections')
      .select('*')
      .eq('project_id', projectId)
      .eq('collection_name', 'booking_services');
    setServices((data || []).map(d => ({ id: d.id, ...d.data })));
  };

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('project_collections')
      .select('*')
      .eq('project_id', projectId)
      .eq('collection_name', 'booking_settings')
      .single();
    if (data?.data) {
      setSettings({
        ...settings,
        ...(data.data as any)
      });
    }
  };

  const t = (en: string, ar: string) => isRTL ? ar : en;

  // Filtered bookings
  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = searchQuery === '' || 
      booking.service_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.customer_info?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleUpdateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('project_bookings')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', bookingId);
      if (error) throw error;
      toast.success(t('Booking updated', 'تم تحديث الحجز'));
      onRefresh();
    } catch (err) {
      toast.error(t('Failed to update booking', 'فشل تحديث الحجز'));
    }
  };

  const handleSaveService = async (service: Service) => {
    setSaving(true);
    try {
      const serviceData = { ...service };
      delete serviceData.id;
      
      if (editingService?.id) {
        const { error } = await supabase
          .from('project_collections')
          .update({ data: serviceData })
          .eq('id', editingService.id);
        if (error) throw error;
        toast.success(t('Service updated', 'تم تحديث الخدمة'));
      } else {
        const { error } = await supabase
          .from('project_collections')
          .insert({
            project_id: projectId,
            owner_id: (await supabase.auth.getUser()).data.user?.id,
            collection_name: 'booking_services',
            data: serviceData
          });
        if (error) throw error;
        toast.success(t('Service added', 'تمت إضافة الخدمة'));
      }
      setShowAddService(false);
      setEditingService(null);
      fetchServices();
    } catch (err) {
      toast.error(t('Failed to save service', 'فشل حفظ الخدمة'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    try {
      const { error } = await supabase
        .from('project_collections')
        .delete()
        .eq('id', serviceId);
      if (error) throw error;
      toast.success(t('Service deleted', 'تم حذف الخدمة'));
      fetchServices();
    } catch (err) {
      toast.error(t('Failed to delete service', 'فشل حذف الخدمة'));
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('project_collections')
        .select('id')
        .eq('project_id', projectId)
        .eq('collection_name', 'booking_settings')
        .single();
      
      if (existing) {
        await supabase
          .from('project_collections')
          .update({ data: settings })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('project_collections')
          .insert({
            project_id: projectId,
            owner_id: (await supabase.auth.getUser()).data.user?.id,
            collection_name: 'booking_settings',
            data: settings
          });
      }
      toast.success(t('Settings saved', 'تم حفظ الإعدادات'));
    } catch (err) {
      toast.error(t('Failed to save settings', 'فشل حفظ الإعدادات'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-indigo-500" />
          {t('Booking Management', 'إدارة الحجوزات')}
        </h3>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-indigo-500" />
            <span className="text-xs text-muted-foreground">{t('Today', 'اليوم')}</span>
          </div>
          <p className="text-lg font-bold text-indigo-500">{todayBookings}</p>
        </div>
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-muted-foreground">{t('Pending', 'قيد الانتظار')}</span>
          </div>
          <p className="text-lg font-bold text-amber-500">{pendingBookings}</p>
        </div>
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Check className="h-4 w-4 text-emerald-500" />
            <span className="text-xs text-muted-foreground">{t('Confirmed', 'مؤكد')}</span>
          </div>
          <p className="text-lg font-bold text-emerald-500">{confirmedBookings}</p>
        </div>
      </div>

      {/* Inner Tab Navigation */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl overflow-x-auto">
        {INNER_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveInnerTab(tab.id); setSearchQuery(''); setStatusFilter('all'); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
              activeInnerTab === tab.id 
                ? "bg-indigo-500 text-white shadow-lg" 
                : "text-muted-foreground hover:bg-white/10"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {isRTL ? tab.labelAr : tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {activeInnerTab === 'bookings' && (
          <BookingsListTab 
            bookings={filteredBookings}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            onUpdateStatus={handleUpdateBookingStatus}
            isRTL={isRTL}
          />
        )}
        
        {activeInnerTab === 'services' && (
          <ServicesTab 
            services={services}
            onAddService={() => { setEditingService(null); setShowAddService(true); }}
            onEditService={(s) => { setEditingService(s); setShowAddService(true); }}
            onDeleteService={handleDeleteService}
            isRTL={isRTL}
          />
        )}
        
        {activeInnerTab === 'availability' && (
          <AvailabilityTab 
            settings={settings}
            setSettings={setSettings}
            onSave={handleSaveSettings}
            saving={saving}
            isRTL={isRTL}
          />
        )}
        
        {activeInnerTab === 'calendar' && (
          <CalendarTab 
            bookings={bookings}
            calendarDate={calendarDate}
            setCalendarDate={setCalendarDate}
            isRTL={isRTL}
          />
        )}
      </div>

      {/* Add/Edit Service Modal */}
      <ServiceModal 
        open={showAddService}
        onClose={() => { setShowAddService(false); setEditingService(null); }}
        service={editingService}
        onSave={handleSaveService}
        saving={saving}
        isRTL={isRTL}
      />
    </div>
  );
}

// ========== Bookings List Tab ==========
function BookingsListTab({ bookings, searchQuery, setSearchQuery, statusFilter, setStatusFilter, onUpdateStatus, isRTL }: any) {
  const t = (en: string, ar: string) => isRTL ? ar : en;
  
  return (
    <div className="space-y-4">
      {/* Search and Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder={t('Search bookings...', 'بحث في الحجوزات...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white/5 border-white/10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[120px] bg-white/5 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('All', 'الكل')}</SelectItem>
            <SelectItem value="pending">{t('Pending', 'قيد الانتظار')}</SelectItem>
            <SelectItem value="confirmed">{t('Confirmed', 'مؤكد')}</SelectItem>
            <SelectItem value="completed">{t('Completed', 'مكتمل')}</SelectItem>
            <SelectItem value="cancelled">{t('Cancelled', 'ملغي')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 rounded-2xl bg-indigo-500/10 mb-4">
            <Calendar className="h-10 w-10 text-indigo-500" />
          </div>
          <h4 className="font-semibold text-foreground mb-1">{t('No Bookings Yet', 'لا توجد حجوزات')}</h4>
          <p className="text-sm text-muted-foreground max-w-xs">
            {t('When customers book appointments, they will appear here', 'عندما يحجز العملاء مواعيد، ستظهر هنا')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {bookings.map((booking: any) => (
            <div key={booking.id} className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-medium text-foreground">{booking.service_name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {booking.customer_info?.name || t('Guest', 'ضيف')}
                  </p>
                </div>
                <Badge variant="outline" className={cn(
                  "text-xs",
                  booking.status === 'confirmed' && "border-emerald-500/30 text-emerald-500",
                  booking.status === 'pending' && "border-amber-500/30 text-amber-500",
                  booking.status === 'completed' && "border-blue-500/30 text-blue-500",
                  booking.status === 'cancelled' && "border-red-500/30 text-red-500"
                )}>
                  {booking.status}
                </Badge>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {booking.booking_date}
                </span>
                {booking.start_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {booking.start_time}
                  </span>
                )}
              </div>
              
              {/* Quick Actions */}
              <div className="flex gap-2">
                {booking.status === 'pending' && (
                  <>
                    <Button 
                      size="sm" 
                      className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1"
                      onClick={() => onUpdateStatus(booking.id, 'confirmed')}
                    >
                      <Check className="h-3.5 w-3.5" />
                      {t('Confirm', 'تأكيد')}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="text-red-500 border-red-500/30 hover:bg-red-500/10 gap-1"
                      onClick={() => onUpdateStatus(booking.id, 'cancelled')}
                    >
                      <X className="h-3.5 w-3.5" />
                      {t('Decline', 'رفض')}
                    </Button>
                  </>
                )}
                {booking.status === 'confirmed' && (
                  <Button 
                    size="sm" 
                    className="bg-blue-500 hover:bg-blue-600 text-white gap-1"
                    onClick={() => onUpdateStatus(booking.id, 'completed')}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {t('Mark Complete', 'إتمام')}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ========== Services Tab ==========
function ServicesTab({ services, onAddService, onEditService, onDeleteService, isRTL }: any) {
  const t = (en: string, ar: string) => isRTL ? ar : en;
  
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onAddService} className="bg-indigo-500 hover:bg-indigo-600 text-white gap-1">
          <Plus className="h-4 w-4" />
          {t('Add Service', 'إضافة خدمة')}
        </Button>
      </div>

      {services.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 rounded-2xl bg-indigo-500/10 mb-4">
            <Users className="h-10 w-10 text-indigo-500" />
          </div>
          <h4 className="font-semibold text-foreground mb-1">{t('No Services', 'لا توجد خدمات')}</h4>
          <p className="text-sm text-muted-foreground max-w-xs mb-4">
            {t('Create services that customers can book', 'أنشئ خدمات يمكن للعملاء حجزها')}
          </p>
          <Button onClick={onAddService} className="bg-indigo-500 hover:bg-indigo-600 text-white gap-2">
            <Plus className="h-4 w-4" />
            {t('Create First Service', 'إنشاء أول خدمة')}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {services.map((service: Service) => (
            <div key={service.id} className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-foreground">{service.name}</h4>
                    <Badge variant="outline" className={service.is_active ? "border-emerald-500/30 text-emerald-500" : ""}>
                      {service.is_active ? t('Active', 'نشط') : t('Inactive', 'غير نشط')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                    <span>{service.duration_minutes} {t('min', 'دقيقة')}</span>
                    <span>•</span>
                    <span className="font-medium text-foreground">{service.currency} {service.price}</span>
                  </div>
                  {service.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{service.description}</p>
                  )}
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEditService(service)}>
                      <Edit className="h-4 w-4 mr-2" />
                      {t('Edit', 'تعديل')}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => onDeleteService(service.id)}
                      className="text-red-500 focus:text-red-500"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('Delete', 'حذف')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ========== Availability Tab ==========
function AvailabilityTab({ settings, setSettings, onSave, saving, isRTL }: any) {
  const t = (en: string, ar: string) => isRTL ? ar : en;
  const dayNames = isRTL ? DAYS_AR : DAYS;
  
  const updateWorkingHour = (dayIndex: number, field: string, value: any) => {
    const updated = settings.working_hours.map((h: AvailabilitySlot) => 
      h.day === dayIndex ? { ...h, [field]: value } : h
    );
    setSettings({ ...settings, working_hours: updated });
  };
  
  return (
    <div className="space-y-6">
      {/* Working Hours */}
      <div className="space-y-3">
        <h4 className="font-medium text-foreground">{t('Working Hours', 'ساعات العمل')}</h4>
        {settings.working_hours.map((slot: AvailabilitySlot) => (
          <div key={slot.day} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
            <div className="w-24">
              <span className="text-sm font-medium">{dayNames[slot.day]}</span>
            </div>
            <Switch 
              checked={slot.is_available}
              onCheckedChange={(v) => updateWorkingHour(slot.day, 'is_available', v)}
            />
            {slot.is_available && (
              <>
                <Input 
                  type="time"
                  value={slot.start_time}
                  onChange={(e) => updateWorkingHour(slot.day, 'start_time', e.target.value)}
                  className="w-28 bg-white/5 border-white/10"
                />
                <span className="text-muted-foreground">-</span>
                <Input 
                  type="time"
                  value={slot.end_time}
                  onChange={(e) => updateWorkingHour(slot.day, 'end_time', e.target.value)}
                  className="w-28 bg-white/5 border-white/10"
                />
              </>
            )}
            {!slot.is_available && (
              <span className="text-sm text-muted-foreground">{t('Closed', 'مغلق')}</span>
            )}
          </div>
        ))}
      </div>
      
      {/* Booking Settings */}
      <div className="space-y-4">
        <h4 className="font-medium text-foreground">{t('Booking Rules', 'قواعد الحجز')}</h4>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t('Buffer Time (min)', 'وقت الفاصل (دقيقة)')}</Label>
            <Input 
              type="number"
              value={settings.buffer_minutes}
              onChange={(e) => setSettings({ ...settings, buffer_minutes: parseInt(e.target.value) || 0 })}
              className="mt-1 bg-white/5 border-white/10"
            />
          </div>
          <div>
            <Label>{t('Min Notice (hours)', 'أقل إشعار (ساعات)')}</Label>
            <Input 
              type="number"
              value={settings.min_notice_hours}
              onChange={(e) => setSettings({ ...settings, min_notice_hours: parseInt(e.target.value) || 0 })}
              className="mt-1 bg-white/5 border-white/10"
            />
          </div>
        </div>
        
        <div>
          <Label>{t('Cancellation Window (hours)', 'نافذة الإلغاء (ساعات)')}</Label>
          <Input 
            type="number"
            value={settings.cancellation_hours}
            onChange={(e) => setSettings({ ...settings, cancellation_hours: parseInt(e.target.value) || 0 })}
            className="mt-1 bg-white/5 border-white/10"
          />
        </div>
        
        <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
          <div>
            <p className="font-medium">{t('Auto-confirm Bookings', 'تأكيد تلقائي')}</p>
            <p className="text-xs text-muted-foreground">{t('Automatically confirm new bookings', 'تأكيد الحجوزات الجديدة تلقائياً')}</p>
          </div>
          <Switch 
            checked={settings.auto_confirm}
            onCheckedChange={(checked) => setSettings({ ...settings, auto_confirm: checked })}
          />
        </div>
      </div>
      
      <Button onClick={onSave} disabled={saving} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {t('Save Settings', 'حفظ الإعدادات')}
      </Button>
    </div>
  );
}

// ========== Calendar Tab ==========
function CalendarTab({ bookings, calendarDate, setCalendarDate, isRTL }: any) {
  const t = (en: string, ar: string) => isRTL ? ar : en;
  
  const startOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
  const endOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);
  const startDay = startOfMonth.getDay();
  const daysInMonth = endOfMonth.getDate();
  
  const days: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  
  const getBookingsForDay = (day: number) => {
    const dateStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return bookings.filter((b: any) => b.booking_date === dateStr);
  };
  
  const navigateMonth = (delta: number) => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + delta, 1));
  };
  
  const dayNames = isRTL ? DAYS_AR : DAYS;
  
  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h4 className="font-medium text-foreground">
          {calendarDate.toLocaleDateString(isRTL ? 'ar' : 'en', { month: 'long', year: 'numeric' })}
        </h4>
        <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Day Headers */}
        {dayNames.map((day, i) => (
          <div key={i} className="p-2 text-center text-xs font-medium text-muted-foreground">
            {day.slice(0, 3)}
          </div>
        ))}
        
        {/* Day Cells */}
        {days.map((day, idx) => {
          const dayBookings = day ? getBookingsForDay(day) : [];
          const isToday = day === new Date().getDate() && 
            calendarDate.getMonth() === new Date().getMonth() &&
            calendarDate.getFullYear() === new Date().getFullYear();
          
          return (
            <div 
              key={idx}
              className={cn(
                "min-h-[60px] p-1 rounded-lg border border-transparent",
                day && "bg-white/5 hover:bg-white/10 transition-colors",
                isToday && "border-indigo-500/50 bg-indigo-500/10"
              )}
            >
              {day && (
                <>
                  <span className={cn(
                    "text-sm font-medium",
                    isToday && "text-indigo-500"
                  )}>{day}</span>
                  {dayBookings.length > 0 && (
                    <div className="mt-1">
                      {dayBookings.slice(0, 2).map((b: any, i: number) => (
                        <div 
                          key={i} 
                          className={cn(
                            "text-[10px] px-1 py-0.5 rounded truncate mb-0.5",
                            b.status === 'confirmed' && "bg-emerald-500/20 text-emerald-500",
                            b.status === 'pending' && "bg-amber-500/20 text-amber-500"
                          )}
                        >
                          {b.start_time || b.service_name}
                        </div>
                      ))}
                      {dayBookings.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{dayBookings.length - 2}</span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ========== Service Modal ==========
function ServiceModal({ open, onClose, service, onSave, saving, isRTL }: any) {
  const t = (en: string, ar: string) => isRTL ? ar : en;
  const [form, setForm] = useState<Service>({
    name: '',
    description: '',
    duration_minutes: 60,
    price: 0,
    currency: 'QAR',
    max_concurrent: 1,
    advance_booking_days: 30,
    is_active: true
  });

  useEffect(() => {
    if (service) {
      setForm(service);
    } else {
      setForm({
        name: '',
        description: '',
        duration_minutes: 60,
        price: 0,
        currency: 'QAR',
        max_concurrent: 1,
        advance_booking_days: 30,
        is_active: true
      });
    }
  }, [service, open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {service ? t('Edit Service', 'تعديل الخدمة') : t('Add Service', 'إضافة خدمة')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>{t('Service Name', 'اسم الخدمة')} *</Label>
            <Input 
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('e.g. Consultation', 'مثال: استشارة')}
              className="mt-1"
            />
          </div>
          
          <div>
            <Label>{t('Description', 'الوصف')}</Label>
            <Textarea 
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('Duration (min)', 'المدة (دقيقة)')} *</Label>
              <Select 
                value={String(form.duration_minutes)} 
                onValueChange={(v) => setForm({ ...form, duration_minutes: parseInt(v) })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[15, 30, 45, 60, 90, 120].map(d => (
                    <SelectItem key={d} value={String(d)}>{d} {t('min', 'دقيقة')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('Price', 'السعر')} *</Label>
              <Input 
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                className="mt-1"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('Max Concurrent', 'الحد الأقصى')}</Label>
              <Input 
                type="number"
                value={form.max_concurrent}
                onChange={(e) => setForm({ ...form, max_concurrent: parseInt(e.target.value) || 1 })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t('Advance Days', 'أيام مسبقة')}</Label>
              <Input 
                type="number"
                value={form.advance_booking_days}
                onChange={(e) => setForm({ ...form, advance_booking_days: parseInt(e.target.value) || 30 })}
                className="mt-1"
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
            <span className="font-medium">{t('Active', 'نشط')}</span>
            <Switch 
              checked={form.is_active}
              onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t('Cancel', 'إلغاء')}</Button>
          <Button 
            onClick={() => onSave(form)}
            disabled={saving || !form.name}
            className="bg-indigo-500 hover:bg-indigo-600 text-white"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {service ? t('Save Changes', 'حفظ التغييرات') : t('Add Service', 'إضافة الخدمة')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
