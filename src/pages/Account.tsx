
import { useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { PageContainer } from "@/components/PageContainer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

export default function Account() {
  const { language } = useTheme();
  const [activeTab, setActiveTab] = useState("profile");

  return (
    <PageContainer title={t("account", language)} showBackButton={true}>
      <div className="p-4 pb-20">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 mb-8">
            <TabsTrigger value="profile">
              {language === "ar" ? "الملف الشخصي" : "Profile"}
            </TabsTrigger>
            <TabsTrigger value="settings">
              {language === "ar" ? "الإعدادات" : "Settings"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            {/* Profile Picture */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="h-24 w-24 rounded-full bg-secondary flex items-center justify-center text-2xl font-bold">
                  JD
                </div>
                <Button
                  size="sm"
                  className="absolute -right-2 -bottom-1 rounded-full h-8 w-8 p-0"
                >
                  +
                </Button>
              </div>
            </div>

            {/* Profile Form */}
            <div className="space-y-4">
              <div className="grid gap-2">
                <label htmlFor="fullName" className="text-sm font-medium">
                  {language === "ar" ? "الاسم الكامل" : "Full Name"}
                </label>
                <Input
                  id="fullName"
                  placeholder={
                    language === "ar" ? "أدخل اسمك الكامل" : "Enter your full name"
                  }
                  defaultValue="Jane Doe"
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="username" className="text-sm font-medium">
                  {t("username", language)}
                </label>
                <Input
                  id="username"
                  placeholder={
                    language === "ar"
                      ? "أدخل اسم المستخدم"
                      : "Enter your username"
                  }
                  defaultValue="jane_doe"
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="email" className="text-sm font-medium">
                  {t("email", language)}
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder={
                    language === "ar"
                      ? "أدخل بريدك الإلكتروني"
                      : "Enter your email"
                  }
                  defaultValue="jane@example.com"
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="bio" className="text-sm font-medium">
                  {language === "ar" ? "السيرة الذاتية" : "Bio"}
                </label>
                <Textarea
                  id="bio"
                  placeholder={
                    language === "ar"
                      ? "أضف سيرة قصيرة عنك"
                      : "Add a short bio about yourself"
                  }
                  defaultValue="WAKTI enthusiast and productivity expert."
                />
              </div>

              <Button className="w-full mt-4">
                {language === "ar" ? "حفظ التغييرات" : "Save Changes"}
              </Button>

              <div className="grid gap-2 pt-4">
                <label htmlFor="password" className="text-sm font-medium">
                  {language === "ar" ? "تغيير كلمة المرور" : "Change Password"}
                </label>
                <Button variant="outline">
                  {language === "ar" ? "تغيير كلمة المرور" : "Change Password"}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            {/* Privacy Settings */}
            <Card className="p-4">
              <h3 className="font-medium text-lg mb-4">
                {language === "ar" ? "إعدادات الخصوصية" : "Privacy Settings"}
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {language === "ar"
                        ? "الموافقة التلقائية على الطلبات"
                        : "Auto-Approve Requests"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {language === "ar"
                        ? "قبول طلبات الاتصال تلقائيًا بدون مراجعة"
                        : "Accept connection requests automatically without review"}
                    </p>
                  </div>
                  <Switch id="auto-approve" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {language === "ar" ? "حالة النشاط" : "Activity Status"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {language === "ar"
                        ? "اعرض متى تكون نشطًا على التطبيق"
                        : "Show when you're active on the app"}
                    </p>
                  </div>
                  <Switch id="activity-status" defaultChecked />
                </div>
              </div>
            </Card>

            {/* Notification Settings */}
            <Card className="p-4">
              <h3 className="font-medium text-lg mb-4">
                {language === "ar" ? "إعدادات الإشعارات" : "Notification Settings"}
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>
                    {language === "ar" ? "إشعارات المهام" : "Task Notifications"}
                  </span>
                  <Switch id="task-notifications" defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <span>
                    {language === "ar"
                      ? "إشعارات الفعاليات"
                      : "Event Notifications"}
                  </span>
                  <Switch id="event-notifications" defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <span>
                    {language === "ar"
                      ? "إشعارات الرسائل"
                      : "Message Notifications"}
                  </span>
                  <Switch id="message-notifications" defaultChecked />
                </div>
              </div>
            </Card>

            {/* Widget Settings */}
            <Card className="p-4">
              <h3 className="font-medium text-lg mb-4">
                {language === "ar"
                  ? "إعدادات الأدوات المصغرة"
                  : "Widget Settings"}
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>
                    {language === "ar"
                      ? "أداة التقويم المصغرة"
                      : "Calendar Widget"}
                  </span>
                  <Switch id="calendar-widget" defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <span>
                    {language === "ar"
                      ? "أداة التذكيرات المصغرة"
                      : "Reminders Widget"}
                  </span>
                  <Switch id="reminders-widget" defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <span>
                    {language === "ar"
                      ? "أداة الاقتباس اليومي المصغرة"
                      : "Daily Quote Widget"}
                  </span>
                  <Switch id="quote-widget" defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <span>
                    {language === "ar"
                      ? "أداة الفعاليات المصغرة"
                      : "Events Widget"}
                  </span>
                  <Switch id="events-widget" defaultChecked />
                </div>

                <div className="grid gap-2 pt-2">
                  <label className="text-sm font-medium">
                    {language === "ar" ? "فئة الاقتباس" : "Quote Category"}
                  </label>
                  <select className="w-full p-2 border rounded-md">
                    <option>
                      {language === "ar" ? "النجاح" : "Success"}
                    </option>
                    <option>
                      {language === "ar" ? "الإلهام" : "Inspiration"}
                    </option>
                    <option>
                      {language === "ar" ? "الإبداع" : "Creativity"}
                    </option>
                  </select>
                </div>
              </div>
            </Card>

            {/* Report an Issue */}
            <Card className="p-4">
              <h3 className="font-medium text-lg mb-4">
                {language === "ar" ? "الإبلاغ عن مشكلة" : "Report an Issue"}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-2">
                    {language === "ar" ? "نوع التقرير" : "Report Type"}
                  </label>
                  <RadioGroup defaultValue="user">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="user" id="user" />
                      <label htmlFor="user">
                        {language === "ar" ? "مستخدم" : "User"}
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="content" id="content" />
                      <label htmlFor="content">
                        {language === "ar" ? "محتوى" : "Content"}
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="other" id="other" />
                      <label htmlFor="other">
                        {language === "ar" ? "آخر" : "Other"}
                      </label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-2">
                    {language === "ar" ? "التفاصيل" : "Details"}
                  </label>
                  <Textarea
                    placeholder={
                      language === "ar"
                        ? "صف المشكلة بالتفصيل..."
                        : "Describe the issue in detail..."
                    }
                    rows={4}
                  />
                </div>

                <Button variant="outline" className="w-full">
                  {language === "ar" ? "إرسال التقرير" : "Submit Report"}
                </Button>
              </div>
            </Card>

            {/* Blocked Users */}
            <Card className="p-4">
              <h3 className="font-medium text-lg mb-4">
                {language === "ar" ? "المستخدمون المحظورون" : "Blocked Users"}
              </h3>
              <div className="text-center py-8 text-muted-foreground">
                <p>
                  {language === "ar"
                    ? "لا يوجد مستخدمون محظورون"
                    : "No blocked users"}
                </p>
              </div>
              <Separator className="my-4" />
              <div className="hidden">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-full bg-secondary" />
                    <div>
                      <p className="font-medium">User Name</p>
                      <p className="text-sm text-muted-foreground">@username</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline">
                    {language === "ar" ? "إلغاء الحظر" : "Unblock"}
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
