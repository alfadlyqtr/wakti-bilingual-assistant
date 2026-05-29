export type WaktiCapabilityId =
  | 'dashboard'
  | 'wakti_ai'
  | 'image_studio'
  | 'music_studio'
  | 'text_tools'
  | 'voice_studio'
  | 'email'
  | 'tasks_reminders'
  | 'calendar'
  | 'maw3d'
  | 'contacts_chat'
  | 'social'
  | 'projects'
  | 'files'
  | 'vitality'
  | 'deen'
  | 'games'
  | 'settings'
  | 'help';

export type WaktiCapabilitySupportLevel = 'full_operator' | 'guided_operator' | 'navigation_only';

export interface WaktiCapability {
  id: WaktiCapabilityId;
  category: 'assistant' | 'creation' | 'productivity' | 'system';
  titleEn: string;
  titleAr: string;
  route: string;
  routeLabelEn: string;
  routeLabelAr: string;
  keywords: string[];
  guideEn: string;
  guideAr: string;
  stepsEn: string[];
  stepsAr: string[];
  supportLevel: WaktiCapabilitySupportLevel;
  supportSummaryEn: string;
  supportSummaryAr: string;
}

export const WAKTI_CAPABILITIES: WaktiCapability[] = [
  {
    id: 'dashboard',
    category: 'productivity',
    titleEn: 'Dashboard',
    titleAr: 'لوحة التحكم',
    route: '/dashboard',
    routeLabelEn: 'Open Dashboard',
    routeLabelAr: 'افتح لوحة التحكم',
    keywords: ['dashboard', 'home', 'homepage', 'main screen', 'الرئيسية', 'لوحة التحكم', 'الصفحة الرئيسية'],
    guideEn: 'Dashboard is the main Wakti home where your main apps, widgets, and quick entry points live.',
    guideAr: 'لوحة التحكم هي الصفحة الرئيسية في وكتي وفيها التطبيقات الأساسية والويدجتس ونقاط الدخول السريعة.',
    stepsEn: ['Open Dashboard', 'Choose the app family you need', 'Tap the target app to continue'],
    stepsAr: ['افتح لوحة التحكم', 'اختر فئة التطبيق التي تريدها', 'اضغط على التطبيق المطلوب للمتابعة'],
    supportLevel: 'navigation_only',
    supportSummaryEn: 'Operator can take you there, but does not automate dashboard-only actions yet.',
    supportSummaryAr: 'يمكن للمشغّل أن يأخذك إليها، لكنه لا ينفذ إجراءات لوحة التحكم نفسها بعد.',
  },
  {
    id: 'wakti_ai',
    category: 'assistant',
    titleEn: 'Wakti AI',
    titleAr: 'Wakti AI',
    route: '/wakti-ai-v2',
    routeLabelEn: 'Open Wakti AI',
    routeLabelAr: 'افتح Wakti AI',
    keywords: ['wakti ai', 'assistant', 'chat ai', 'ask wakti', 'وكتي', 'الذكاء', 'المساعد'],
    guideEn: 'Wakti AI is the conversational assistant area for asking, drafting, searching, and getting help across the app.',
    guideAr: 'Wakti AI هو مساحة المساعد الحواري للسؤال والكتابة والبحث والحصول على المساعدة داخل التطبيق.',
    stepsEn: ['Open Wakti AI', 'Choose the right mode or start chatting', 'Ask your question or request the task you want'],
    stepsAr: ['افتح Wakti AI', 'اختر الوضع المناسب أو ابدأ المحادثة', 'اطرح سؤالك أو اطلب المهمة التي تريدها'],
    supportLevel: 'guided_operator',
    supportSummaryEn: 'Operator can route you here for guidance, but full cross-app execution still depends on module adapters.',
    supportSummaryAr: 'يمكن للمشغّل أن يوجّهك إلى هنا للإرشاد، لكن التنفيذ الكامل عبر التطبيق ما زال يعتمد على ربط الوحدات.',
  },
  {
    id: 'image_studio',
    category: 'creation',
    titleEn: 'Image Studio',
    titleAr: 'استوديو الصور',
    route: '/music?operatorTarget=image',
    routeLabelEn: 'Open Image Studio',
    routeLabelAr: 'افتح استوديو الصور',
    keywords: ['image', 'picture', 'photo', 'poster', 'logo', 'thumbnail', 'cover', 'generate image', 'create image', 'studio image', 'image studio', 'صورة', 'صور', 'بوستر', 'شعار', 'صمم صورة', 'توليد صورة'],
    guideEn: 'Use Image Studio to write a prompt, choose quality, generate the image, then save or share it.',
    guideAr: 'استخدم استوديو الصور لكتابة وصف الصورة، اختيار الجودة، إنشاء الصورة، ثم حفظها أو مشاركتها.',
    stepsEn: ['Open Image Studio', 'Stay on the image creation tab', 'Write the prompt', 'Press Generate', 'Save, share, or hand it off'],
    stepsAr: ['افتح استوديو الصور', 'ابقَ في تبويب إنشاء الصورة', 'اكتب وصف الصورة', 'اضغط إنشاء', 'احفظها أو شاركها أو سلّمها لتدفق آخر'],
    supportLevel: 'full_operator',
    supportSummaryEn: 'Operator can already open Image Studio, prefill the prompt, generate, save, and hand the result to email.',
    supportSummaryAr: 'المشغّل يستطيع الآن فتح استوديو الصور، تعبئة الوصف، إنشاء الصورة، حفظها، وتسليمها للبريد.',
  },
  {
    id: 'music_studio',
    category: 'creation',
    titleEn: 'Music Studio',
    titleAr: 'استوديو الموسيقى',
    route: '/music?operatorTarget=music',
    routeLabelEn: 'Open Music Studio',
    routeLabelAr: 'افتح استوديو الموسيقى',
    keywords: ['music', 'song', 'track', 'beat', 'jingle', 'compose music', 'generate song', 'music studio', 'أغنية', 'موسيقى', 'لحن', 'مقطع', 'استوديو الموسيقى'],
    guideEn: 'Use Music Studio to set the title, lyrics or style, then generate and save the track.',
    guideAr: 'استخدم استوديو الموسيقى لتحديد العنوان والكلمات أو النمط ثم إنشاء المقطع وحفظه.',
    stepsEn: ['Open Music Studio', 'Stay on the compose tab', 'Set the title and lyrics or style', 'Press Generate', 'Review and save the track'],
    stepsAr: ['افتح استوديو الموسيقى', 'ابقَ في تبويب التأليف', 'حدد العنوان والكلمات أو النمط', 'اضغط إنشاء', 'راجع المقطع واحفظه'],
    supportLevel: 'full_operator',
    supportSummaryEn: 'Operator can already open Music Studio, prefill the draft, and trigger generation for supported flows.',
    supportSummaryAr: 'المشغّل يستطيع الآن فتح استوديو الموسيقى، تعبئة المسودة، وتشغيل الإنشاء في التدفقات المدعومة.',
  },
  {
    id: 'text_tools',
    category: 'creation',
    titleEn: 'Text Tools',
    titleAr: 'أدوات النص',
    route: '/tools/text',
    routeLabelEn: 'Open Text Tools',
    routeLabelAr: 'افتح أدوات النص',
    keywords: ['text', 'write', 'writing', 'translation', 'translate', 'presentation', 'diagram', 'a4', 'prompt writing', 'نص', 'كتابة', 'ترجمة', 'عرض', 'مخطط'],
    guideEn: 'Text Tools is the place for writing, rewriting, translating, diagrams, presentations, and document-style generation.',
    guideAr: 'أدوات النص هي المكان المخصص للكتابة وإعادة الصياغة والترجمة والمخططات والعروض وتوليد المستندات.',
    stepsEn: ['Open Text Tools', 'Choose the right tab such as compose, translate, diagram, or presentation', 'Enter your request and continue'],
    stepsAr: ['افتح أدوات النص', 'اختر التبويب المناسب مثل الكتابة أو الترجمة أو المخطط أو العرض', 'أدخل طلبك ثم تابع'],
    supportLevel: 'guided_operator',
    supportSummaryEn: 'Operator can guide and navigate here, but text-tool execution is not yet unified under the new Operator runtime.',
    supportSummaryAr: 'يمكن للمشغّل الإرشاد والتنقل إلى هنا، لكن تنفيذ أدوات النص لم يُدمج بعد في وقت تشغيل المشغّل الجديد.',
  },
  {
    id: 'voice_studio',
    category: 'creation',
    titleEn: 'Voice Studio',
    titleAr: 'استوديو الصوت',
    route: '/tools/voice-studio',
    routeLabelEn: 'Open Voice Studio',
    routeLabelAr: 'افتح استوديو الصوت',
    keywords: ['voice', 'tasjeel', 'record', 'tts', 'voice clone', 'voice studio', 'audio', 'صوت', 'تسجيل', 'استنساخ صوت', 'تحويل نص إلى صوت'],
    guideEn: 'Voice Studio includes recording, voice generation, and related voice tools like Tasjeel and text-to-speech.',
    guideAr: 'استوديو الصوت يشمل التسجيل وتوليد الصوت وأدوات الصوت مثل تسجيل وتحويل النص إلى صوت.',
    stepsEn: ['Open Voice Studio', 'Choose the right tab such as Tasjeel, clone, or speech', 'Start the voice flow you need'],
    stepsAr: ['افتح استوديو الصوت', 'اختر التبويب المناسب مثل تسجيل أو الاستنساخ أو الكلام', 'ابدأ التدفق الصوتي الذي تحتاجه'],
    supportLevel: 'guided_operator',
    supportSummaryEn: 'Operator can route you here and reuse some transcript logic, but full voice-tool coverage is still incomplete.',
    supportSummaryAr: 'يمكن للمشغّل أن يوجّهك إلى هنا ويستفيد من بعض منطق النص المفرغ، لكن تغطية أدوات الصوت ما زالت غير مكتملة.',
  },
  {
    id: 'email',
    category: 'productivity',
    titleEn: 'Email',
    titleAr: 'البريد',
    route: '/tools/email',
    routeLabelEn: 'Open Email',
    routeLabelAr: 'افتح البريد',
    keywords: ['email', 'mail', 'gmail', 'compose email', 'draft email', 'send email', 'بريد', 'ايميل', 'ارسل بريد', 'مسودة بريد'],
    guideEn: 'Use Email to connect accounts, open compose, draft a message, attach files, and send once you approve.',
    guideAr: 'استخدم البريد لربط الحسابات وفتح نافذة الكتابة وإنشاء المسودة وإرفاق الملفات ثم الإرسال بعد موافقتك.',
    stepsEn: ['Open Email', 'Choose the connected provider', 'Open compose', 'Write or review the draft', 'Send only after approval'],
    stepsAr: ['افتح البريد', 'اختر مزود البريد المتصل', 'افتح نافذة الكتابة', 'اكتب المسودة أو راجعها', 'أرسل فقط بعد الموافقة'],
    supportLevel: 'full_operator',
    supportSummaryEn: 'Operator can already open Email with a prepared draft and attachments, while final send should remain approval-based.',
    supportSummaryAr: 'المشغّل يستطيع الآن فتح البريد مع مسودة جاهزة ومرفقات، بينما الإرسال النهائي يجب أن يبقى بعد الموافقة.',
  },
  {
    id: 'tasks_reminders',
    category: 'productivity',
    titleEn: 'Tasks & Reminders',
    titleAr: 'المهام والتذكيرات',
    route: '/tr',
    routeLabelEn: 'Open Tasks & Reminders',
    routeLabelAr: 'افتح المهام والتذكيرات',
    keywords: ['task', 'tasks', 'todo', 'to do', 'reminder', 'reminders', 'schedule reminder', 'task list', 'مهمة', 'مهام', 'تذكير', 'تذكيرات', 'جدولة تذكير'],
    guideEn: 'Use Tasks & Reminders to create tasks, subtasks, reminders, due dates, and quick follow-up items.',
    guideAr: 'استخدم المهام والتذكيرات لإنشاء المهام والمهام الفرعية والتذكيرات وتواريخ الاستحقاق والمتابعات السريعة.',
    stepsEn: ['Open Tasks & Reminders', 'Choose Tasks or Reminders', 'Open the create modal', 'Review or edit the draft', 'Create the item'],
    stepsAr: ['افتح المهام والتذكيرات', 'اختر المهام أو التذكيرات', 'افتح نافذة الإنشاء', 'راجع المسودة أو عدّلها', 'أنشئ العنصر'],
    supportLevel: 'full_operator',
    supportSummaryEn: 'Operator can already open the create flow, prefill drafts, and mark completion after the item is saved.',
    supportSummaryAr: 'المشغّل يستطيع الآن فتح تدفق الإنشاء، تعبئة المسودات، وتأكيد الإكمال بعد حفظ العنصر.',
  },
  {
    id: 'calendar',
    category: 'productivity',
    titleEn: 'Calendar',
    titleAr: 'التقويم',
    route: '/calendar',
    routeLabelEn: 'Open Calendar',
    routeLabelAr: 'افتح التقويم',
    keywords: ['calendar', 'schedule', 'agenda', 'date', 'appointment', 'التقويم', 'جدول', 'موعد', 'مواعيد'],
    guideEn: 'Use Calendar to view scheduled items, dates, and time-based planning across your day and week.',
    guideAr: 'استخدم التقويم لعرض العناصر المجدولة والتواريخ والتخطيط الزمني خلال يومك وأسبوعك.',
    stepsEn: ['Open Calendar', 'Choose the right view', 'Check the date or event you need', 'Continue into the linked flow if needed'],
    stepsAr: ['افتح التقويم', 'اختر طريقة العرض المناسبة', 'تحقق من التاريخ أو الحدث الذي تحتاجه', 'تابع إلى التدفق المرتبط عند الحاجة'],
    supportLevel: 'navigation_only',
    supportSummaryEn: 'Operator can navigate here, but full calendar action adapters are not wired yet.',
    supportSummaryAr: 'يمكن للمشغّل التنقل إلى هنا، لكن ربط إجراءات التقويم الكاملة لم يُنجز بعد.',
  },
  {
    id: 'maw3d',
    category: 'productivity',
    titleEn: 'Maw3d Events',
    titleAr: 'Maw3d',
    route: '/maw3d',
    routeLabelEn: 'Open Maw3d',
    routeLabelAr: 'افتح Maw3d',
    keywords: ['maw3d', 'event', 'invite', 'invitation', 'rsvp', 'gathering', 'موعد', 'حدث', 'دعوة', 'دعوات', 'حفل'],
    guideEn: 'Use Maw3d to create, manage, and share events and invitations with RSVP flows.',
    guideAr: 'استخدم Maw3d لإنشاء الأحداث والدعوات وإدارتها ومشاركتها مع تدفقات تأكيد الحضور.',
    stepsEn: ['Open Maw3d', 'Choose create or manage', 'Review the event details', 'Continue into invite or prep actions'],
    stepsAr: ['افتح Maw3d', 'اختر الإنشاء أو الإدارة', 'راجع تفاصيل الحدث', 'تابع إلى الدعوات أو خطوات التحضير'],
    supportLevel: 'guided_operator',
    supportSummaryEn: 'A planning-oriented Agent path already exists for event prep, but it is not yet unified with the main Operator runtime.',
    supportSummaryAr: 'هناك مسار وكيل يركز على التخطيط لتحضير الحدث، لكنه لم يُدمج بعد مع وقت تشغيل المشغّل الرئيسي.',
  },
  {
    id: 'contacts_chat',
    category: 'productivity',
    titleEn: 'Contacts & Chat',
    titleAr: 'جهات الاتصال والمحادثة',
    route: '/contacts',
    routeLabelEn: 'Open Contacts',
    routeLabelAr: 'افتح جهات الاتصال',
    keywords: ['contacts', 'contact', 'chat', 'message', 'messages', 'conversation', 'جهات الاتصال', 'اتصال', 'رسالة', 'محادثة'],
    guideEn: 'Use Contacts to open direct chats, browse people, and continue one-to-one conversations.',
    guideAr: 'استخدم جهات الاتصال لفتح المحادثات المباشرة واستعراض الأشخاص ومتابعة المحادثات الفردية.',
    stepsEn: ['Open Contacts', 'Choose the person or conversation', 'Continue chatting from there'],
    stepsAr: ['افتح جهات الاتصال', 'اختر الشخص أو المحادثة', 'تابع الدردشة من هناك'],
    supportLevel: 'navigation_only',
    supportSummaryEn: 'Operator can guide and navigate here, but does not yet automate contact or chat actions.',
    supportSummaryAr: 'يمكن للمشغّل الإرشاد والتنقل إلى هنا، لكنه لا ينفذ إجراءات جهات الاتصال أو الدردشة بعد.',
  },
  {
    id: 'social',
    category: 'productivity',
    titleEn: 'Social',
    titleAr: 'سوشيال',
    route: '/social',
    routeLabelEn: 'Open Social',
    routeLabelAr: 'افتح سوشيال',
    keywords: ['social', 'post', 'instagram', 'publish', 'social media', 'سوشيال', 'منشور', 'انستغرام', 'نشر'],
    guideEn: 'Use Social for social posting and related content actions inside Wakti.',
    guideAr: 'استخدم سوشيال للنشر الاجتماعي والإجراءات المرتبطة بالمحتوى داخل وكتي.',
    stepsEn: ['Open Social', 'Choose the content or connected account', 'Review before any publish action'],
    stepsAr: ['افتح سوشيال', 'اختر المحتوى أو الحساب المتصل', 'راجع قبل أي إجراء نشر'],
    supportLevel: 'navigation_only',
    supportSummaryEn: 'Operator can take you there, but publish-safe adapter rules are not yet in the unified runtime.',
    supportSummaryAr: 'يمكن للمشغّل أن يأخذك إلى هناك، لكن قواعد التنفيذ الآمن للنشر لم تُدمج بعد في وقت التشغيل الموحد.',
  },
  {
    id: 'projects',
    category: 'creation',
    titleEn: 'Projects',
    titleAr: 'المشاريع',
    route: '/projects',
    routeLabelEn: 'Open Projects',
    routeLabelAr: 'افتح المشاريع',
    keywords: ['project', 'projects', 'code', 'build app', 'edit project', 'مشروع', 'مشاريع', 'برمجة', 'كود'],
    guideEn: 'Use Projects to create, inspect, and continue coded project work inside Wakti.',
    guideAr: 'استخدم المشاريع لإنشاء العمل البرمجي داخل وكتي وفحصه ومتابعته.',
    stepsEn: ['Open Projects', 'Choose the project or create a new one', 'Continue from the project detail flow'],
    stepsAr: ['افتح المشاريع', 'اختر المشروع أو أنشئ مشروعاً جديداً', 'تابع من تدفق تفاصيل المشروع'],
    supportLevel: 'guided_operator',
    supportSummaryEn: 'A next-steps Agent path already exists conceptually, but project execution is not yet unified with the Operator.',
    supportSummaryAr: 'يوجد مسار وكيل للخطوات التالية من ناحية الفكرة، لكن تنفيذ المشاريع لم يُدمج بعد مع المشغّل.',
  },
  {
    id: 'files',
    category: 'productivity',
    titleEn: 'My Files',
    titleAr: 'ملفاتي',
    route: '/my-warranty',
    routeLabelEn: 'Open My Files',
    routeLabelAr: 'افتح ملفاتي',
    keywords: ['files', 'my files', 'saved files', 'documents', 'warranty', 'ملفاتي', 'ملفات', 'مستندات'],
    guideEn: 'Use My Files to browse saved items and file-like records stored in Wakti.',
    guideAr: 'استخدم ملفاتي لاستعراض العناصر المحفوظة والسجلات الشبيهة بالملفات داخل وكتي.',
    stepsEn: ['Open My Files', 'Browse the saved records', 'Open the item you need'],
    stepsAr: ['افتح ملفاتي', 'استعرض السجلات المحفوظة', 'افتح العنصر الذي تحتاجه'],
    supportLevel: 'navigation_only',
    supportSummaryEn: 'Operator can navigate here, but file-level automation is not yet standardized.',
    supportSummaryAr: 'يمكن للمشغّل التنقل إلى هنا، لكن أتمتة مستوى الملفات لم تُوحد بعد.',
  },
  {
    id: 'vitality',
    category: 'productivity',
    titleEn: 'Vitality',
    titleAr: 'الحيوية',
    route: '/fitness',
    routeLabelEn: 'Open Vitality',
    routeLabelAr: 'افتح الحيوية',
    keywords: ['fitness', 'health', 'vitality', 'whoop', 'wellness', 'صحة', 'لياقة', 'الحيوية', 'ووب'],
    guideEn: 'Use Vitality to review health and fitness data and switch between supported data sources.',
    guideAr: 'استخدم الحيوية لمراجعة بيانات الصحة واللياقة والتنقل بين مصادر البيانات المدعومة.',
    stepsEn: ['Open Vitality', 'Choose the right data source', 'Review the health data you need'],
    stepsAr: ['افتح الحيوية', 'اختر مصدر البيانات المناسب', 'راجع بيانات الصحة التي تحتاجها'],
    supportLevel: 'navigation_only',
    supportSummaryEn: 'Operator can guide and navigate here, but health-data actions are not yet adapterized.',
    supportSummaryAr: 'يمكن للمشغّل الإرشاد والتنقل إلى هنا، لكن إجراءات بيانات الصحة لم تُحوّل بعد إلى محولات تنفيذ.',
  },
  {
    id: 'deen',
    category: 'productivity',
    titleEn: 'Deen',
    titleAr: 'دين',
    route: '/deen',
    routeLabelEn: 'Open Deen',
    routeLabelAr: 'افتح دين',
    keywords: ['deen', 'quran', 'hadith', 'azkar', 'islamic', 'دين', 'قرآن', 'حديث', 'أذكار'],
    guideEn: 'Use Deen to access Quran, Hadith, Azkar, study, and ask flows in the Deen area.',
    guideAr: 'استخدم دين للوصول إلى القرآن والحديث والأذكار والدراسة وطلبات السؤال داخل قسم دين.',
    stepsEn: ['Open Deen', 'Choose Quran, Hadith, Azkar, Study, or Ask', 'Continue from the selected area'],
    stepsAr: ['افتح دين', 'اختر القرآن أو الحديث أو الأذكار أو الدراسة أو السؤال', 'تابع من القسم الذي اخترته'],
    supportLevel: 'navigation_only',
    supportSummaryEn: 'Operator can direct you here, but Deen-specific actions are not yet in the unified Operator registry.',
    supportSummaryAr: 'يمكن للمشغّل توجيهك إلى هنا، لكن إجراءات دين المتخصصة لم تُدمج بعد في سجل المشغّل الموحد.',
  },
  {
    id: 'games',
    category: 'productivity',
    titleEn: 'Games',
    titleAr: 'الألعاب',
    route: '/games',
    routeLabelEn: 'Open Games',
    routeLabelAr: 'افتح الألعاب',
    keywords: ['game', 'games', 'letters', 'play game', 'الألعاب', 'لعبة', 'حروف'],
    guideEn: 'Use Games to launch available game modes like Letters and related play flows.',
    guideAr: 'استخدم الألعاب لتشغيل أوضاع اللعب المتاحة مثل الحروف والتدفقات المرتبطة بها.',
    stepsEn: ['Open Games', 'Choose the game mode', 'Continue into setup or play'],
    stepsAr: ['افتح الألعاب', 'اختر وضع اللعب', 'تابع إلى الإعداد أو اللعب'],
    supportLevel: 'navigation_only',
    supportSummaryEn: 'Operator can take you there, but game-specific orchestration is not part of the unified Operator yet.',
    supportSummaryAr: 'يمكن للمشغّل أن يأخذك إلى هناك، لكن تنسيق إجراءات الألعاب ليس جزءاً من المشغّل الموحد بعد.',
  },
  {
    id: 'settings',
    category: 'system',
    titleEn: 'Settings',
    titleAr: 'الإعدادات',
    route: '/settings',
    routeLabelEn: 'Open Settings',
    routeLabelAr: 'افتح الإعدادات',
    keywords: ['settings', 'preferences', 'theme', 'language', 'account settings', 'الإعدادات', 'اللغة', 'المظهر'],
    guideEn: 'Use Settings to control preferences like theme, language, and connected app behavior.',
    guideAr: 'استخدم الإعدادات للتحكم في التفضيلات مثل المظهر واللغة وسلوك التطبيق المتصل.',
    stepsEn: ['Open Settings', 'Choose the settings section you need', 'Review before any important changes'],
    stepsAr: ['افتح الإعدادات', 'اختر قسم الإعدادات الذي تحتاجه', 'راجع قبل أي تغييرات مهمة'],
    supportLevel: 'navigation_only',
    supportSummaryEn: 'Operator can navigate here, but settings changes should stay approval-based and are not unified yet.',
    supportSummaryAr: 'يمكن للمشغّل التنقل إلى هنا، لكن تغييرات الإعدادات يجب أن تبقى بعد الموافقة ولم تُدمج بعد.',
  },
  {
    id: 'help',
    category: 'system',
    titleEn: 'Help',
    titleAr: 'المساعدة',
    route: '/help',
    routeLabelEn: 'Open Help',
    routeLabelAr: 'افتح المساعدة',
    keywords: ['help', 'support', 'help page', 'support page', 'customer support', 'contact support', 'مساعدة', 'صفحة المساعدة', 'الدعم', 'الدعم الفني'],
    guideEn: 'Help is the built-in guidance area when you want a manual explanation instead of direct execution.',
    guideAr: 'المساعدة هي مساحة الإرشاد المدمجة عندما تريد شرحاً يدوياً بدلاً من التنفيذ المباشر.',
    stepsEn: ['Open Help', 'Choose the relevant help topic', 'Use the guide as a walkthrough while you act'],
    stepsAr: ['افتح المساعدة', 'اختر موضوع المساعدة المناسب', 'استخدم الدليل كشرح أثناء تنفيذك'],
    supportLevel: 'guided_operator',
    supportSummaryEn: 'Operator can open Help when you explicitly ask for the Help area.',
    supportSummaryAr: 'يمكن للمشغّل فتح المساعدة عندما تطلب قسم المساعدة بشكل صريح.',
  },
];

export function getWaktiCapability(id?: WaktiCapabilityId | null) {
  if (!id) return null;
  return WAKTI_CAPABILITIES.find((capability) => capability.id === id) || null;
}

export function getWaktiCapabilityTitle(capability: WaktiCapability, language: 'ar' | 'en') {
  return language === 'ar' ? capability.titleAr : capability.titleEn;
}

export function getWaktiCapabilityRouteLabel(capability: WaktiCapability, language: 'ar' | 'en') {
  return language === 'ar' ? capability.routeLabelAr : capability.routeLabelEn;
}

export function getWaktiCapabilityGuide(capability: WaktiCapability, language: 'ar' | 'en') {
  return language === 'ar' ? capability.guideAr : capability.guideEn;
}

export function getWaktiCapabilitySteps(capability: WaktiCapability, language: 'ar' | 'en') {
  return language === 'ar' ? capability.stepsAr : capability.stepsEn;
}

export function getWaktiCapabilitySupportSummary(capability: WaktiCapability, language: 'ar' | 'en') {
  return language === 'ar' ? capability.supportSummaryAr : capability.supportSummaryEn;
}

export function findBestWaktiCapabilityMatch(input: string) {
  const normalized = input.toLowerCase();
  let best: { capability: WaktiCapability; score: number } | null = null;

  for (const capability of WAKTI_CAPABILITIES) {
    const score = capability.keywords.reduce((total, keyword) => {
      const normalizedKeyword = keyword.toLowerCase().trim();
      if (!normalizedKeyword) return total;
      if (normalized === normalizedKeyword) return total + 5;
      if (normalized.includes(normalizedKeyword)) return total + Math.max(2, Math.min(4, normalizedKeyword.split(/\s+/).length + 1));
      return total;
    }, 0);

    if (!score) continue;
    if (!best || score > best.score) {
      best = { capability, score };
    }
  }

  return best;
}
