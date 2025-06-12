
import { useTheme } from "@/providers/ThemeProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Shield, Scale, Eye, AlertTriangle, Users, FileText } from "lucide-react";

export default function PrivacyTerms() {
  const { language } = useTheme();

  const content = {
    en: {
      title: "WAKTI Privacy Policy & Terms of Use",
      lastUpdated: "Last Updated: June 11, 2025",
      description: "Welcome to WAKTI, an AI-powered platform offering smart task management, messaging, event scheduling, recording tools, and intelligent summaries. By accessing or using the WAKTI app or services, you agree to abide by the terms outlined below. If you do not agree with these terms, you must not use WAKTI.",
      sections: [
        {
          icon: Scale,
          title: "1. Legal Compliance & Jurisdiction",
          content: `WAKTI is built and operated in full compliance with the laws of the State of Qatar, including but not limited to Qatar's Law No. (13) of 2016 on the Protection of Personal Data. All user activity, data, and legal responsibilities fall under Qatari jurisdiction.

We fully cooperate with law enforcement authorities. If we are presented with valid legal documentation (court orders, warrants, etc.), we will provide relevant data in accordance with Qatari law.`
        },
        {
          icon: Shield,
          title: "2. Data Privacy",
          content: `**2.1 What We Collect**
• Your account data: username, name, email, profile image
• Your activity: tasks, events, messages, voice recordings, summaries
• Technical data: device info, app usage, crash logs
• Temporary content (e.g., voice files) for AI processing

**2.2 How It's Used**
• To power and personalize the WAKTI experience
• To process AI features like transcription, summarization, or image generation
• To monitor app health, ensure lawful usage, and improve service
• To integrate and deliver services via third-party providers, including but not limited to OpenAI, DeepSeek, Runware, and Supabase

**2.3 Data Sharing with Third Parties**
To deliver WAKTI's features, we use carefully selected third-party service providers. These services may handle parts of your data for specific purposes (e.g. AI generation, voice transcription, storage).

WAKTI only shares necessary data to operate these features and expects all partners to comply with privacy standards equivalent to those required by Qatari law. However, users acknowledge that data processed by third parties is governed by their respective terms and privacy policies.

We do not sell your personal data to advertisers or unrelated third parties.

**2.4 Data Storage & Retention**
• Voice recordings are deleted after 10 days automatically
• Other data is stored only as long as required for functionality or by law
• You may delete your account at any time, and your data will be removed unless retention is required by legal authorities

**2.5 Your Rights**
You may:
• Access or correct your data
• Delete your account
• Withdraw consent for processing
• Contact us directly for any privacy-related request`
        },
        {
          icon: AlertTriangle,
          title: "3. Responsible Use Policy",
          content: `WAKTI is a powerful tool — but it must be used responsibly. We strictly prohibit the following:

• Uploading or generating sexual, violent, abusive, or illegal content
• Recording others without their permission
• Impersonation, harassment, hate speech, or misuse of AI-generated content
• Using WAKTI to deceive, defame, or exploit others
• Misuse of image or voice cloning tools

We reserve the right to suspend, restrict, or permanently terminate accounts that violate these rules. We monitor activity and will take action without notice when necessary to protect our users and platform integrity.`
        },
        {
          icon: Eye,
          title: "4. Law Enforcement & Investigations",
          content: `WAKTI fully complies with legal authorities. If required:

• We will share account information or content with investigators upon valid legal request
• We may suspend or delete user data without notice if required by law or criminal investigation`
        },
        {
          icon: Users,
          title: "5. Voice Recording, AI, and Voice Cloning Disclaimer",
          content: `WAKTI offers tools for recording, summarizing, and generating voice responses.

By using these features:
• You are solely responsible for informing others before recording
• Do not use voice tools to impersonate or mislead
• AI summaries may contain errors — always double-check critical content
• WAKTI disclaims liability for misuse or misrepresentation caused by users`
        },
        {
          icon: FileText,
          title: "6. AI Limitations and Health Disclaimer",
          content: `WAKTI uses advanced AI tools to generate summaries, text, visuals, and recommendations. These tools are powerful but imperfect.

• AI can and will make mistakes
• AI is not a replacement for human experts
• Do not rely on WAKTI AI for medical, legal, psychological, or emergency advice
• Always consult a real doctor, lawyer, or professional when needed

Using AI tools is done at your own risk.`
        }
      ],
      additionalSections: [
        {
          title: "7. Image Upload & Generation Policy",
          content: "You may upload images or use WAKTI's AI to generate them. You must not: Upload or generate sexually explicit or disturbing content, Upload copyrighted or stolen material, Attempt to bypass moderation using suggestive prompts. Violators will be banned immediately, and reported if necessary."
        },
        {
          title: "8. Subscription & Refunds",
          content: "WAKTI is offered as a monthly or yearly subscription service. All payments are final and non-refundable. You may cancel at any time to stop future charges. After cancellation, you retain access until your billing period ends. WAKTI does not offer partial refunds, pro-rated returns, or trial extensions."
        },
        {
          title: "9. Account Termination",
          content: "WAKTI reserves the right to suspend or delete your account if: You violate these terms, We detect harmful, fraudulent, or abusive behavior, We receive valid legal or user reports against your account, Your content causes risk, legal exposure, or harm to others. Repeated violations = permanent ban."
        },
        {
          title: "10. Intellectual Property",
          content: "All trademarks, features, and AI tools used in WAKTI are protected. You may not: Copy, reverse-engineer, or resell any part of the platform, Use WAKTI's voice or image tools for commercial impersonation, Bypass limits or automate interactions with our AI without permission."
        },
        {
          title: "11. Limitation of Liability",
          content: "WAKTI is provided as-is. We are not responsible for: Losses caused by AI-generated content, Misuse of summaries, recordings, or images, Platform downtime or data corruption. You assume full responsibility for how you use WAKTI."
        },
        {
          title: "12. Updates to Terms",
          content: "We may update these terms at any time. When we do: We will notify users of material changes, Continued use of WAKTI means you accept the updated terms."
        },
        {
          title: "13. Contact",
          content: "For questions, concerns, or legal matters: support@wakti.qa"
        }
      ],
      footer: "These Terms govern your access to and use of WAKTI's AI services, voice and image tools, and mobile application. By using WAKTI, you agree to comply with these terms, our privacy practices, and all applicable laws in the State of Qatar. WAKTI is a trademarked platform. Unauthorized use is prohibited. Your use of WAKTI signifies your acceptance of these conditions.",
      copyright: "© 2025 WAKTI. All rights reserved. Compliant with Qatar Law.",
      disclaimer: "Misuse will not be tolerated. AI must be used responsibly. Your data and safety matter."
    },
    ar: {
      title: "سياسة الخصوصية وشروط الاستخدام لـ WAKTI",
      lastUpdated: "آخر تحديث: 11 يونيو 2025",
      description: "مرحباً بك في WAKTI، منصة مدعومة بالذكاء الاصطناعي تقدم إدارة المهام الذكية والمراسلة وجدولة الأحداث وأدوات التسجيل والملخصات الذكية. باستخدام تطبيق أو خدمات WAKTI، فإنك توافق على الالتزام بالشروط المذكورة أدناه. إذا كنت لا توافق على هذه الشروط، فيجب عليك عدم استخدام WAKTI.",
      sections: [
        {
          icon: Scale,
          title: "1. الامتثال القانوني والاختصاص القضائي",
          content: `تم بناء وتشغيل WAKTI في امتثال كامل لقوانين دولة قطر، بما في ذلك على سبيل المثال لا الحصر قانون قطر رقم (13) لسنة 2016 بشأن حماية البيانات الشخصية. جميع أنشطة المستخدمين والبيانات والمسؤوليات القانونية تخضع للاختصاص القضائي القطري.

نحن نتعاون بالكامل مع سلطات إنفاذ القانون. إذا تم تقديم وثائق قانونية صالحة (أوامر محكمة، مذكرات، إلخ)، فسنقوم بتقديم البيانات ذات الصلة وفقاً للقانون القطري.`
        },
        {
          icon: Shield,
          title: "2. خصوصية البيانات",
          content: `**2.1 ما نجمعه**
• بيانات حسابك: اسم المستخدم، الاسم، البريد الإلكتروني، صورة الملف الشخصي
• نشاطك: المهام، الأحداث، الرسائل، التسجيلات الصوتية، الملخصات
• البيانات التقنية: معلومات الجهاز، استخدام التطبيق، سجلات الأعطال
• المحتوى المؤقت (مثل الملفات الصوتية) لمعالجة الذكاء الاصطناعي

**2.2 كيف يتم استخدامها**
• لتشغيل وتخصيص تجربة WAKTI
• لمعالجة ميزات الذكاء الاصطناعي مثل النسخ والتلخيص أو توليد الصور
• لمراقبة صحة التطبيق وضمان الاستخدام القانوني وتحسين الخدمة
• للتكامل مع مقدمي الخدمات الخارجيين، بما في ذلك على سبيل المثال لا الحصر OpenAI و DeepSeek و Runware و Supabase

**2.3 مشاركة البيانات مع أطراف ثالثة**
لتقديم ميزات WAKTI، نستخدم مقدمي خدمات خارجيين مختارين بعناية. هذه الخدمات قد تتعامل مع أجزاء من بياناتك لأغراض محددة (مثل توليد الذكاء الاصطناعي، النسخ الصوتي، التخزين).

WAKTI تشارك فقط البيانات الضرورية لتشغيل هذه الميزات وتتوقع من جميع الشركاء الامتثال لمعايير الخصوصية المعادلة لتلك المطلوبة بموجب القانون القطري. ومع ذلك، يقر المستخدمون أن البيانات المعالجة من قبل أطراف ثالثة تخضع لشروطهم وسياسات الخصوصية الخاصة بهم.

نحن لا نبيع بياناتك الشخصية للمعلنين أو أطراف ثالثة غير ذات صلة.

**2.4 تخزين البيانات والاحتفاظ بها**
• يتم حذف التسجيلات الصوتية تلقائياً بعد 10 أيام
• يتم تخزين البيانات الأخرى فقط طالما كان ذلك مطلوباً للوظائف أو بموجب القانون
• يمكنك حذف حسابك في أي وقت، وسيتم إزالة بياناتك ما لم يكن الاحتفاظ مطلوباً من قبل السلطات القانونية

**2.5 حقوقك**
يمكنك:
• الوصول إلى بياناتك أو تصحيحها
• حذف حسابك
• سحب الموافقة على المعالجة
• الاتصال بنا مباشرة لأي طلب متعلق بالخصوصية`
        },
        {
          icon: AlertTriangle,
          title: "3. سياسة الاستخدام المسؤول",
          content: `WAKTI أداة قوية — لكن يجب استخدامها بمسؤولية. نحن نمنع بشدة ما يلي:

• تحميل أو توليد محتوى جنسي أو عنيف أو مسيء أو غير قانوني
• تسجيل الآخرين دون إذنهم
• انتحال الشخصية أو المضايقة أو خطاب الكراهية أو إساءة استخدام المحتوى المولد بالذكاء الاصطناعي
• استخدام WAKTI للخداع أو التشهير أو استغلال الآخرين
• إساءة استخدام أدوات استنساخ الصور أو الصوت

نحتفظ بالحق في تعليق أو تقييد أو إنهاء الحسابات بشكل دائم التي تنتهك هذه القواعد. نراقب النشاط وسنتخذ إجراءات دون إشعار عند الضرورة لحماية مستخدمينا وسلامة المنصة.`
        },
        {
          icon: Eye,
          title: "4. إنفاذ القانون والتحقيقات",
          content: `WAKTI تمتثل بالكامل للسلطات القانونية. إذا لزم الأمر:

• سنشارك معلومات الحساب أو المحتوى مع المحققين عند طلب قانوني صالح
• قد نعلق أو نحذف بيانات المستخدم دون إشعار إذا كان ذلك مطلوباً بموجب القانون أو التحقيق الجنائي`
        },
        {
          icon: Users,
          title: "5. إخلاء مسؤولية التسجيل الصوتي والذكاء الاصطناعي واستنساخ الصوت",
          content: `يقدم WAKTI أدوات للتسجيل والتلخيص وتوليد الاستجابات الصوتية.

باستخدام هذه الميزات:
• أنت المسؤول الوحيد عن إعلام الآخرين قبل التسجيل
• لا تستخدم أدوات الصوت لانتحال الشخصية أو التضليل
• قد تحتوي ملخصات الذكاء الاصطناعي على أخطاء — تحقق دائماً من المحتوى المهم
• WAKTI تخلي مسؤوليتها عن سوء الاستخدام أو التحريف الناجم عن المستخدمين`
        },
        {
          icon: FileText,
          title: "6. قيود الذكاء الاصطناعي وإخلاء المسؤولية الصحية",
          content: `يستخدم WAKTI أدوات ذكاء اصطناعي متقدمة لتوليد الملخصات والنصوص والمرئيات والتوصيات. هذه الأدوات قوية لكنها غير مثالية.

• الذكاء الاصطناعي يمكن أن يرتكب أخطاء
• الذكاء الاصطناعي ليس بديلاً عن الخبراء البشر
• لا تعتمد على ذكاء WAKTI الاصطناعي للحصول على مشورة طبية أو قانونية أو نفسية أو طارئة
• استشر دائماً طبيباً أو محامياً أو مهنياً حقيقياً عند الحاجة

استخدام أدوات الذكاء الاصطناعي يتم على مسؤوليتك الخاصة.`
        }
      ],
      additionalSections: [
        {
          title: "7. سياسة تحميل وتوليد الصور",
          content: "يمكنك تحميل الصور أو استخدام ذكاء WAKTI الاصطناعي لتوليدها. يجب ألا تقوم بـ: تحميل أو توليد محتوى جنسي صريح أو مزعج، تحميل مواد محمية بحقوق الطبع والنشر أو مسروقة، محاولة تجاوز الإشراف باستخدام مطالبات موحية. سيتم حظر المخالفين فوراً والإبلاغ عنهم إذا لزم الأمر."
        },
        {
          title: "8. الاشتراك والاستردادات",
          content: "يُقدم WAKTI كخدمة اشتراك شهرية أو سنوية. جميع المدفوعات نهائية وغير قابلة للاسترداد. يمكنك الإلغاء في أي وقت لإيقاف الرسوم المستقبلية. بعد الإلغاء، تحتفظ بالوصول حتى انتهاء فترة الفوترة. WAKTI لا تقدم استردادات جزئية أو إرجاعات تناسبية أو تمديدات تجريبية."
        },
        {
          title: "9. إنهاء الحساب",
          content: "تحتفظ WAKTI بالحق في تعليق أو حذف حسابك إذا: انتهكت هذه الشروط، اكتشفنا سلوكاً ضاراً أو احتيالياً أو مسيئاً، تلقينا تقارير قانونية أو من المستخدمين صالحة ضد حسابك، تسبب محتواك في مخاطر أو تعرض قانوني أو ضرر للآخرين. الانتهاكات المتكررة = حظر دائم."
        },
        {
          title: "10. الملكية الفكرية",
          content: "جميع العلامات التجارية والميزات وأدوات الذكاء الاصطناعي المستخدمة في WAKTI محمية. لا يمكنك: نسخ أو هندسة عكسية أو إعادة بيع أي جزء من المنصة، استخدام أدوات الصوت أو الصورة في WAKTI لانتحال الشخصية التجارية، تجاوز الحدود أو أتمتة التفاعلات مع ذكائنا الاصطناعي دون إذن."
        },
        {
          title: "11. تحديد المسؤولية",
          content: "يُقدم WAKTI كما هو. نحن لسنا مسؤولين عن: الخسائر الناجمة عن المحتوى المولد بالذكاء الاصطناعي، سوء استخدام الملخصات أو التسجيلات أو الصور، توقف المنصة أو فساد البيانات. أنت تتحمل المسؤولية الكاملة عن كيفية استخدامك لـ WAKTI."
        },
        {
          title: "12. تحديثات الشروط",
          content: "قد نحدث هذه الشروط في أي وقت. عندما نفعل ذلك: سنخطر المستخدمين بالتغييرات المادية، الاستمرار في استخدام WAKTI يعني أنك تقبل الشروط المحدثة."
        },
        {
          title: "13. الاتصال",
          content: "للأسئلة أو المخاوف أو الأمور القانونية: support@wakti.qa"
        }
      ],
      footer: "تحكم هذه الشروط وصولك إلى واستخدامك لخدمات الذكاء الاصطناعي في WAKTI وأدوات الصوت والصورة والتطبيق المحمول. باستخدام WAKTI، فإنك توافق على الامتثال لهذه الشروط وممارسات الخصوصية لدينا وجميع القوانين المعمول بها في دولة قطر. WAKTI منصة محمية بعلامة تجارية. الاستخدام غير المصرح به محظور. استخدامك لـ WAKTI يدل على قبولك لهذه الشروط.",
      copyright: "© 2025 WAKTI. جميع الحقوق محفوظة. متوافق مع القانون القطري.",
      disclaimer: "لن يتم التسامح مع سوء الاستخدام. يجب استخدام الذكاء الاصطناعي بمسؤولية. بياناتك وسلامتك مهمة."
    }
  };

  const currentContent = content[language];

  return (
    <div className="min-h-screen bg-background text-foreground p-4 pb-28">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">{currentContent.title}</h1>
          <p className="text-sm text-muted-foreground">{currentContent.lastUpdated}</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm leading-relaxed">{currentContent.description}</p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {currentContent.sections.map((section, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-start gap-3 mb-4">
                  <section.icon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <h2 className="text-lg font-semibold">{section.title}</h2>
                </div>
                <div className="whitespace-pre-line text-sm leading-relaxed">
                  {section.content}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          {currentContent.additionalSections.map((section, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-3">{section.title}</h2>
                <p className="text-sm leading-relaxed">{section.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator />

        <Card className="border-primary/20">
          <CardContent className="p-6 space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground italic">
              {currentContent.footer}
            </p>
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold">{currentContent.copyright}</p>
              <p className="text-xs text-muted-foreground">{currentContent.disclaimer}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
