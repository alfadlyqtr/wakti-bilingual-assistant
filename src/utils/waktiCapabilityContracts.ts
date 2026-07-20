import type { WaktiCapabilityId } from '@/utils/waktiCapabilities';

export type WaktiCapabilityAdapter =
  | 'navigation'
  | 'module_handoff'
  | 'image_generation'
  | 'music_generation'
  | 'text_generation'
  | 'voice_generation'
  | 'email_draft'
  | 'task_action'
  | 'calendar_action'
  | 'event_action'
  | 'chat_action'
  | 'project_action'
  | 'social_action'
  | 'game_action'
  | 'vitality_action';

export type WaktiCapabilityApproval = 'none' | 'review' | 'required';

export interface WaktiCapabilityRequirement {
  key: string;
  labelEn: string;
  labelAr: string;
  required: boolean;
  requiredWhen?: string;
  defaultValue?: string;
  helpEn: string;
  helpAr: string;
}

export interface WaktiCapabilityStage {
  id: string;
  labelEn: string;
  labelAr: string;
  detailEn: string;
  detailAr: string;
}

export interface WaktiCapabilityContract {
  capabilityId: WaktiCapabilityId;
  adapter: WaktiCapabilityAdapter;
  approval: WaktiCapabilityApproval;
  purposeEn: string;
  purposeAr: string;
  backend: string | null;
  resultEn: string;
  resultAr: string;
  requirements: WaktiCapabilityRequirement[];
  preconditionsEn: string[];
  preconditionsAr: string[];
  stages: WaktiCapabilityStage[];
}

const requirement = (
  key: string,
  labelEn: string,
  labelAr: string,
  required: boolean,
  helpEn: string,
  helpAr: string,
  options: Pick<WaktiCapabilityRequirement, 'requiredWhen' | 'defaultValue'> = {},
): WaktiCapabilityRequirement => ({ key, labelEn, labelAr, required, helpEn, helpAr, ...options });

const stage = (
  id: string,
  labelEn: string,
  labelAr: string,
  detailEn: string,
  detailAr: string,
): WaktiCapabilityStage => ({ id, labelEn, labelAr, detailEn, detailAr });

const navigationStages = (titleEn: string, titleAr: string): WaktiCapabilityStage[] => [
  stage('understand', 'Understand the request', 'فهم الطلب', `Match the request to ${titleEn}.`, `مطابقة الطلب مع ${titleAr}.`),
  stage('open', `Open ${titleEn}`, `فتح ${titleAr}`, 'Navigate to the correct Wakti area.', 'الانتقال إلى المكان الصحيح داخل وكتي.'),
  stage('ready', 'Ready for the next step', 'جاهز للخطوة التالية', 'Show the person where the work continues.', 'إظهار المكان الذي تستمر فيه المهمة.'),
];

const actionStages = (titleEn: string, titleAr: string, actionEn: string, actionAr: string): WaktiCapabilityStage[] => [
  stage('understand', 'Understand the request', 'فهم الطلب', `Identify the exact ${titleEn} action.`, `تحديد الإجراء المطلوب داخل ${titleAr}.`),
  stage('prepare', 'Prepare the request', 'تجهيز الطلب', 'Collect and validate the information needed for the action.', 'جمع والتحقق من المعلومات اللازمة للإجراء.'),
  stage('review', 'Review with the person', 'مراجعة مع المستخدم', 'Show the prepared action before it runs.', 'عرض الإجراء المجهز قبل تنفيذه.'),
  stage('execute', actionEn, actionAr, 'Run the real feature action.', 'تشغيل الإجراء الحقيقي للميزة.'),
  stage('complete', 'Report the result', 'إظهار النتيجة', 'Show the real success or failure result.', 'إظهار نتيجة النجاح أو الفشل الحقيقية.'),
];

const contracts: WaktiCapabilityContract[] = [
  {
    capabilityId: 'dashboard',
    adapter: 'navigation',
    approval: 'none',
    purposeEn: 'Open the Wakti home dashboard and guide the person to the correct app area.',
    purposeAr: 'فتح لوحة وكتي الرئيسية وتوجيه المستخدم إلى القسم الصحيح.',
    backend: null,
    resultEn: 'The correct dashboard area is open.',
    resultAr: 'تم فتح القسم الصحيح من لوحة التحكم.',
    requirements: [],
    preconditionsEn: [],
    preconditionsAr: [],
    stages: navigationStages('Dashboard', 'لوحة التحكم'),
  },
  {
    capabilityId: 'wakti_ai',
    adapter: 'module_handoff',
    approval: 'none',
    purposeEn: 'Open Wakti AI for chat, drafting, search, and supported AI help.',
    purposeAr: 'فتح Wakti AI للمحادثة والكتابة والبحث والمساعدة المدعومة بالذكاء الاصطناعي.',
    backend: 'wakti-ai-v2-brain-stream',
    resultEn: 'The person is in the correct Wakti AI mode with their request attached.',
    resultAr: 'المستخدم داخل وضع Wakti AI الصحيح مع إرفاق طلبه.',
    requirements: [
      requirement('request', 'Request', 'الطلب', true, 'The question or task the person wants help with.', 'السؤال أو المهمة التي يريد المستخدم المساعدة فيها.'),
    ],
    preconditionsEn: ['The person must be signed in for account-specific help.'],
    preconditionsAr: ['يجب تسجيل الدخول للمساعدة المرتبطة بالحساب.'],
    stages: actionStages('Wakti AI', 'Wakti AI', 'Start Wakti AI', 'بدء Wakti AI'),
  },
  {
    capabilityId: 'image_studio',
    adapter: 'image_generation',
    approval: 'review',
    purposeEn: 'Prepare an image request, generate the image, and hand the result to supported Wakti flows.',
    purposeAr: 'تجهيز طلب صورة وإنشاؤها وتسليم النتيجة إلى التدفقات المدعومة داخل وكتي.',
    backend: 'image generation provider',
    resultEn: 'Generated images are available to review, save, share, or hand off.',
    resultAr: 'الصور المنشأة جاهزة للمراجعة أو الحفظ أو المشاركة أو التسليم.',
    requirements: [
      requirement('prompt', 'Image description', 'وصف الصورة', true, 'Describe the subject, style, mood, and important visual details.', 'صف الموضوع والنمط والمزاج والتفاصيل البصرية المهمة.'),
      requirement('sourceImage', 'Reference image', 'صورة مرجعية', false, 'Optional when the person wants to transform an existing image.', 'اختياري عندما يريد المستخدم تعديل صورة موجودة.'),
      requirement('quality', 'Quality', 'الجودة', false, 'Use the studio default unless the person asks for a specific quality.', 'استخدم الإعداد الافتراضي ما لم يطلب المستخدم جودة محددة.'),
    ],
    preconditionsEn: ['The person must be signed in.', 'The image quota must allow generation.'],
    preconditionsAr: ['يجب تسجيل دخول المستخدم.', 'يجب أن تسمح حصة الصور بالإنشاء.'],
    stages: actionStages('Image Studio', 'استوديو الصور', 'Generate image', 'إنشاء الصورة'),
  },
  {
    capabilityId: 'music_studio',
    adapter: 'music_generation',
    approval: 'required',
    purposeEn: 'Prepare and generate an original music track through the real Music Studio pipeline.',
    purposeAr: 'تجهيز وإنشاء مقطع موسيقي أصلي من خلال مسار استوديو الموسيقى الحقيقي.',
    backend: 'music-generate → music-callback / music-status',
    resultEn: 'The completed music variations are saved and ready to review.',
    resultAr: 'النسخ الموسيقية المكتملة محفوظة وجاهزة للمراجعة.',
    requirements: [
      requirement('title', 'Track title', 'عنوان المقطع', true, 'A clear title for the track.', 'عنوان واضح للمقطع.'),
      requirement('mode', 'Mode', 'الوضع', false, 'Choose vocal music or instrumental music.', 'اختر موسيقى غنائية أو موسيقى بدون كلمات.', { defaultValue: 'vocal' }),
      requirement('style', 'Style', 'النمط', true, 'Describe genre, mood, instruments, rhythm, and any language or dialect needed.', 'صف النوع والمزاج والآلات والإيقاع وأي لغة أو لهجة مطلوبة.'),
      requirement('lyrics', 'Lyrics', 'الكلمات', false, 'Required for vocal music and not used for instrumental music.', 'مطلوبة للموسيقى الغنائية ولا تستخدم للموسيقى بدون كلمات.', { requiredWhen: 'mode is vocal' }),
      requirement('vocalType', 'Vocal type', 'نوع الصوت', false, 'Choose automatic, male, female, custom voice, or no vocals for instrumental music.', 'اختر تلقائي أو رجالي أو نسائي أو صوت مخصص أو بدون صوت للموسيقى الآلية.', { defaultValue: 'automatic' }),
      requirement('duration', 'Duration', 'المدة', false, 'Use the studio default unless the person asks for a duration.', 'استخدم مدة الاستوديو الافتراضية ما لم يطلب المستخدم مدة محددة.'),
      requirement('customVoice', 'Custom voice', 'صوت مخصص', false, 'A selected custom voice must already be ready before generation.', 'يجب أن يكون الصوت المخصص المحدد جاهزاً قبل الإنشاء.', { requiredWhen: 'vocalType is custom' }),
    ],
    preconditionsEn: ['The person must be signed in.', 'Music quota must allow generation.', 'A custom voice must be ready when selected.', 'The person must approve the final request before generation starts.'],
    preconditionsAr: ['يجب تسجيل دخول المستخدم.', 'يجب أن تسمح حصة الموسيقى بالإنشاء.', 'يجب أن يكون الصوت المخصص جاهزاً عند اختياره.', 'يجب أن يوافق المستخدم على الطلب النهائي قبل بدء الإنشاء.'],
    stages: [
      stage('understand', 'Understand the music idea', 'فهم فكرة الموسيقى', 'Extract only the title, style, mode, vocals, lyrics, and duration that the person actually stated.', 'استخراج العنوان والنمط والوضع والصوت والكلمات والمدة التي ذكرها المستخدم فقط.'),
      stage('prepare', 'Prepare the music draft', 'تجهيز مسودة الموسيقى', 'Fill the Music Studio draft and identify any missing required information.', 'تعبئة مسودة استوديو الموسيقى وتحديد أي معلومات مطلوبة ناقصة.'),
      stage('review', 'Waiting for approval', 'بانتظار الموافقة', 'Show the final title, style, mode, vocals, lyrics, and duration before sending the request.', 'عرض العنوان والنمط والوضع والصوت والكلمات والمدة النهائية قبل إرسال الطلب.'),
      stage('submit', 'Submit music generation', 'إرسال إنشاء الموسيقى', 'Check quota and submit the validated request to the music provider.', 'فحص الحصة وإرسال الطلب المتحقق منه إلى مزود الموسيقى.'),
      stage('generate', 'Generating music', 'جارٍ إنشاء الموسيقى', 'Track the provider task until completed or failed.', 'متابعة مهمة المزود حتى تكتمل أو تفشل.'),
      stage('finalize', 'Finalize tracks', 'تجهيز المقاطع النهائية', 'Save completed variants and make them available in Music Studio.', 'حفظ النسخ المكتملة وإتاحتها داخل استوديو الموسيقى.'),
    ],
  },
  {
    capabilityId: 'text_tools',
    adapter: 'text_generation',
    approval: 'review',
    purposeEn: 'Prepare writing, replies, translation, diagrams, presentations, and documents in the correct Text Tools mode.',
    purposeAr: 'تجهيز الكتابة والردود والترجمة والمخططات والعروض والمستندات في وضع أدوات النص الصحيح.',
    backend: 'Text Tools module',
    resultEn: 'A prepared request or generated text is available in the selected Text Tools mode.',
    resultAr: 'طلب مجهز أو نص مولد متاح في وضع أدوات النص المحدد.',
    requirements: [
      requirement('task', 'Text task', 'مهمة النص', true, 'State whether the person wants writing, a reply, translation, a diagram, a presentation, or a document.', 'حدد ما إذا كان المستخدم يريد كتابة أو رداً أو ترجمة أو مخططاً أو عرضاً أو مستنداً.'),
      requirement('sourceText', 'Source text', 'النص المصدر', false, 'Needed for rewriting, replying, translating, or summarizing.', 'مطلوب لإعادة الصياغة أو الرد أو الترجمة أو التلخيص.'),
      requirement('goal', 'Goal and audience', 'الهدف والجمهور', false, 'Describe the desired outcome, tone, and audience.', 'صف النتيجة والنبرة والجمهور المطلوب.'),
    ],
    preconditionsEn: [],
    preconditionsAr: [],
    stages: actionStages('Text Tools', 'أدوات النص', 'Create text result', 'إنشاء النتيجة النصية'),
  },
  {
    capabilityId: 'voice_studio',
    adapter: 'voice_generation',
    approval: 'review',
    purposeEn: 'Prepare text-to-speech, live translation, voice cloning, or recording work in Voice Studio.',
    purposeAr: 'تجهيز تحويل النص إلى كلام أو الترجمة الفورية أو استنساخ الصوت أو التسجيل في استوديو الصوت.',
    backend: 'Voice Studio module',
    resultEn: 'The requested voice workflow is prepared or completed in Voice Studio.',
    resultAr: 'تدفق الصوت المطلوب مجهز أو مكتمل في استوديو الصوت.',
    requirements: [
      requirement('task', 'Voice task', 'مهمة الصوت', true, 'Choose speech, live translation, voice cloning, or recording.', 'اختر الكلام أو الترجمة الفورية أو استنساخ الصوت أو التسجيل.'),
      requirement('text', 'Text', 'النص', false, 'Required for text-to-speech.', 'مطلوب لتحويل النص إلى كلام.', { requiredWhen: 'task is text-to-speech' }),
      requirement('targetLanguage', 'Target language', 'اللغة المطلوبة', false, 'Required for translation requests.', 'مطلوب لطلبات الترجمة.', { requiredWhen: 'task is translation' }),
    ],
    preconditionsEn: ['A voice must be selected and ready when a custom voice is requested.'],
    preconditionsAr: ['يجب اختيار صوت جاهز عند طلب صوت مخصص.'],
    stages: actionStages('Voice Studio', 'استوديو الصوت', 'Run voice request', 'تشغيل طلب الصوت'),
  },
  {
    capabilityId: 'email',
    adapter: 'email_draft',
    approval: 'required',
    purposeEn: 'Prepare a complete email draft and send it only after clear approval.',
    purposeAr: 'تجهيز مسودة بريد كاملة وإرسالها فقط بعد موافقة واضحة.',
    backend: 'Custom Mail module',
    resultEn: 'The email draft is prepared, and any send action is explicitly approved.',
    resultAr: 'تم تجهيز مسودة البريد، وأي إرسال يكون بموافقة صريحة.',
    requirements: [
      requirement('recipients', 'Recipients', 'المستلمون', true, 'One or more recipient email addresses.', 'عنوان بريد إلكتروني واحد أو أكثر للمستلمين.'),
      requirement('subject', 'Subject', 'الموضوع', true, 'A clear subject line.', 'عنوان موضوع واضح.'),
      requirement('body', 'Message', 'الرسالة', true, 'The message content and desired tone.', 'محتوى الرسالة والنبرة المطلوبة.'),
      requirement('attachments', 'Attachments', 'المرفقات', false, 'Files or generated items to attach.', 'ملفات أو عناصر مولدة لإرفاقها.'),
    ],
    preconditionsEn: ['A sending provider must be connected before sending.'],
    preconditionsAr: ['يجب ربط مزود إرسال قبل الإرسال.'],
    stages: actionStages('Email', 'البريد', 'Send approved email', 'إرسال البريد المعتمد'),
  },
  {
    capabilityId: 'tasks_reminders',
    adapter: 'task_action',
    approval: 'required',
    purposeEn: 'Create, edit, complete, snooze, or organize tasks and reminders.',
    purposeAr: 'إنشاء المهام والتذكيرات أو تعديلها أو إكمالها أو تأجيلها أو تنظيمها.',
    backend: 'Tasks & Reminders service',
    resultEn: 'Only the approved task or reminder changes are saved.',
    resultAr: 'يتم حفظ تغييرات المهام أو التذكيرات المعتمدة فقط.',
    requirements: [
      requirement('action', 'Action', 'الإجراء', true, 'Choose create, edit, complete, snooze, or add subtasks.', 'اختر إنشاء أو تعديل أو إكمال أو تأجيل أو إضافة مهام فرعية.'),
      requirement('title', 'Title', 'العنوان', true, 'The task or reminder title, or the existing item to target.', 'عنوان المهمة أو التذكير أو العنصر الحالي المستهدف.'),
      requirement('schedule', 'Due date and time', 'تاريخ ووقت الاستحقاق', false, 'Needed when the person wants a due date or reminder time.', 'مطلوب عندما يريد المستخدم تاريخ استحقاق أو وقت تذكير.'),
    ],
    preconditionsEn: ['The target item must be identified before editing, completing, snoozing, or adding subtasks.'],
    preconditionsAr: ['يجب تحديد العنصر المستهدف قبل التعديل أو الإكمال أو التأجيل أو إضافة المهام الفرعية.'],
    stages: actionStages('Tasks & Reminders', 'المهام والتذكيرات', 'Apply approved task action', 'تنفيذ إجراء المهمة المعتمد'),
  },
  {
    capabilityId: 'calendar',
    adapter: 'calendar_action',
    approval: 'review',
    purposeEn: 'Open the requested calendar view or prepare a calendar note.',
    purposeAr: 'فتح عرض التقويم المطلوب أو تجهيز ملاحظة تقويم.',
    backend: 'Calendar module',
    resultEn: 'The requested date, view, or prepared note is available in Calendar.',
    resultAr: 'التاريخ أو العرض أو الملاحظة المجهزة متاحة في التقويم.',
    requirements: [
      requirement('action', 'Calendar action', 'إجراء التقويم', true, 'Choose a date, change view, or create or edit a note.', 'اختر تاريخاً أو تغيير العرض أو إنشاء أو تعديل ملاحظة.'),
      requirement('date', 'Date', 'التاريخ', false, 'Needed when opening a specific date or scheduling a note.', 'مطلوب عند فتح تاريخ محدد أو جدولة ملاحظة.'),
      requirement('note', 'Note details', 'تفاصيل الملاحظة', false, 'Needed when creating or editing a note.', 'مطلوب عند إنشاء أو تعديل ملاحظة.'),
    ],
    preconditionsEn: [],
    preconditionsAr: [],
    stages: actionStages('Calendar', 'التقويم', 'Apply calendar action', 'تنفيذ إجراء التقويم'),
  },
  {
    capabilityId: 'maw3d',
    adapter: 'event_action',
    approval: 'required',
    purposeEn: 'Prepare and create an event invitation with the right date, time, location, and attendees.',
    purposeAr: 'تجهيز وإنشاء دعوة حدث بالتاريخ والوقت والموقع والحضور المناسبين.',
    backend: 'Maw3d module',
    resultEn: 'The approved event is created and ready for invitations or RSVP tracking.',
    resultAr: 'تم إنشاء الحدث المعتمد وهو جاهز للدعوات أو متابعة الردود.',
    requirements: [
      requirement('title', 'Event title', 'عنوان الحدث', true, 'A clear event name.', 'اسم واضح للحدث.'),
      requirement('date', 'Date', 'التاريخ', true, 'The event date.', 'تاريخ الحدث.'),
      requirement('time', 'Time', 'الوقت', false, 'Start and end time when known.', 'وقت البداية والنهاية عند توفرهما.'),
      requirement('location', 'Location', 'الموقع', false, 'Physical or online location.', 'الموقع الفعلي أو الإلكتروني.'),
    ],
    preconditionsEn: [],
    preconditionsAr: [],
    stages: actionStages('Maw3d', 'موعد', 'Create approved event', 'إنشاء الحدث المعتمد'),
  },
  {
    capabilityId: 'contacts_chat',
    adapter: 'chat_action',
    approval: 'required',
    purposeEn: 'Find a contact, prepare a direct message or chat handoff, and send only after approval.',
    purposeAr: 'البحث عن جهة اتصال وتجهيز رسالة مباشرة أو انتقال للمحادثة والإرسال فقط بعد الموافقة.',
    backend: 'Contacts & Chat module',
    resultEn: 'The approved message is ready in the correct conversation.',
    resultAr: 'الرسالة المعتمدة جاهزة في المحادثة الصحيحة.',
    requirements: [
      requirement('contact', 'Contact', 'جهة الاتصال', true, 'The recipient or group to contact.', 'المستلم أو المجموعة المطلوب التواصل معها.'),
      requirement('message', 'Message', 'الرسالة', true, 'The message to prepare or send.', 'الرسالة المطلوب تجهيزها أو إرسالها.'),
    ],
    preconditionsEn: ['The contact must be matched before sending.'],
    preconditionsAr: ['يجب مطابقة جهة الاتصال قبل الإرسال.'],
    stages: actionStages('Contacts & Chat', 'جهات الاتصال والمحادثات', 'Send approved message', 'إرسال الرسالة المعتمدة'),
  },
  {
    capabilityId: 'social',
    adapter: 'social_action',
    approval: 'review',
    purposeEn: 'Open the requested social area and prepare supported contact or gallery actions.',
    purposeAr: 'فتح القسم الاجتماعي المطلوب وتجهيز إجراءات جهات الاتصال أو المعرض المدعومة.',
    backend: 'Social module',
    resultEn: 'The person is in the intended social area with the request prepared where supported.',
    resultAr: 'المستخدم داخل القسم الاجتماعي المطلوب مع تجهيز الطلب عندما يكون مدعوماً.',
    requirements: [
      requirement('section', 'Section', 'القسم', true, 'Choose contacts, requests, groups, cards, or gallery.', 'اختر جهات الاتصال أو الطلبات أو المجموعات أو البطاقات أو المعرض.'),
    ],
    preconditionsEn: [],
    preconditionsAr: [],
    stages: actionStages('Social', 'الاجتماعي', 'Open social action', 'فتح الإجراء الاجتماعي'),
  },
  {
    capabilityId: 'projects',
    adapter: 'project_action',
    approval: 'review',
    purposeEn: 'Open Projects and prepare a build or assistant request for the project workspace.',
    purposeAr: 'فتح المشاريع وتجهيز طلب بناء أو مساعدة لمساحة عمل المشروع.',
    backend: 'Projects module',
    resultEn: 'The project request is ready in the correct Projects workspace.',
    resultAr: 'طلب المشروع جاهز في مساحة المشاريع الصحيحة.',
    requirements: [
      requirement('goal', 'Project goal', 'هدف المشروع', true, 'Describe what the person wants to build or change.', 'صف ما يريد المستخدم بناءه أو تغييره.'),
      requirement('mode', 'Workspace mode', 'وضع مساحة العمل', false, 'Choose builder or assistant when stated.', 'اختر البناء أو المساعد عند ذكره.'),
    ],
    preconditionsEn: [],
    preconditionsAr: [],
    stages: actionStages('Projects', 'المشاريع', 'Prepare project request', 'تجهيز طلب المشروع'),
  },
  {
    capabilityId: 'files',
    adapter: 'module_handoff',
    approval: 'review',
    purposeEn: 'Open Files and prepare supported file management work.',
    purposeAr: 'فتح الملفات وتجهيز أعمال إدارة الملفات المدعومة.',
    backend: 'Files module',
    resultEn: 'The person is in the correct file area with the requested context.',
    resultAr: 'المستخدم داخل مساحة الملفات الصحيحة مع السياق المطلوب.',
    requirements: [
      requirement('action', 'File action', 'إجراء الملف', true, 'State whether the person wants to find, open, organize, share, or manage files.', 'حدد ما إذا كان المستخدم يريد البحث أو الفتح أو التنظيم أو المشاركة أو إدارة الملفات.'),
      requirement('file', 'File or folder', 'ملف أو مجلد', false, 'Name or identify the target file or folder.', 'اسم أو تحديد الملف أو المجلد المستهدف.'),
    ],
    preconditionsEn: [],
    preconditionsAr: [],
    stages: actionStages('Files', 'الملفات', 'Open file action', 'فتح إجراء الملف'),
  },
  {
    capabilityId: 'vitality',
    adapter: 'vitality_action',
    approval: 'review',
    purposeEn: 'Open Vitality and prepare a health data source or wellness view.',
    purposeAr: 'فتح Vitality وتجهيز مصدر بيانات صحية أو عرض عافية.',
    backend: 'Vitality module',
    resultEn: 'The requested health or wellness view is open.',
    resultAr: 'عرض الصحة أو العافية المطلوب مفتوح.',
    requirements: [
      requirement('source', 'Data source', 'مصدر البيانات', false, 'Choose Whoop or HealthKit when the person specifies a source.', 'اختر Whoop أو HealthKit عندما يحدد المستخدم مصدراً.'),
    ],
    preconditionsEn: ['The selected health provider must be connected when data access is required.'],
    preconditionsAr: ['يجب ربط مزود الصحة المحدد عندما يكون الوصول للبيانات مطلوباً.'],
    stages: actionStages('Vitality', 'Vitality', 'Open Vitality view', 'فتح عرض Vitality'),
  },
  {
    capabilityId: 'deen',
    adapter: 'module_handoff',
    approval: 'none',
    purposeEn: 'Open the requested Deen experience for prayer, Quran, study, or spiritual tools.',
    purposeAr: 'فتح تجربة الدين المطلوبة للصلاة أو القرآن أو الدراسة أو الأدوات الروحية.',
    backend: 'Deen module',
    resultEn: 'The requested Deen tool is open.',
    resultAr: 'أداة الدين المطلوبة مفتوحة.',
    requirements: [
      requirement('topic', 'Requested tool', 'الأداة المطلوبة', false, 'State prayer, Quran, study, or another Deen area.', 'حدد الصلاة أو القرآن أو الدراسة أو منطقة دين أخرى.'),
    ],
    preconditionsEn: [],
    preconditionsAr: [],
    stages: navigationStages('Deen', 'الدين'),
  },
  {
    capabilityId: 'games',
    adapter: 'game_action',
    approval: 'none',
    purposeEn: 'Open the requested Wakti game or game screen.',
    purposeAr: 'فتح لعبة وكتي أو شاشة اللعبة المطلوبة.',
    backend: 'Games module',
    resultEn: 'The requested game is open and ready to play.',
    resultAr: 'اللعبة المطلوبة مفتوحة وجاهزة للعب.',
    requirements: [
      requirement('game', 'Game', 'اللعبة', false, 'Choose chess, tic-tac-toe, solitaire, letters, or the game home screen.', 'اختر الشطرنج أو إكس أو سوليتير أو الحروف أو الصفحة الرئيسية للألعاب.'),
    ],
    preconditionsEn: [],
    preconditionsAr: [],
    stages: navigationStages('Games', 'الألعاب'),
  },
  {
    capabilityId: 'settings',
    adapter: 'module_handoff',
    approval: 'required',
    purposeEn: 'Open Settings and prepare an account or preference change for review.',
    purposeAr: 'فتح الإعدادات وتجهيز تغيير للحساب أو التفضيلات للمراجعة.',
    backend: 'Settings module',
    resultEn: 'The requested settings area is open and changes remain reviewable.',
    resultAr: 'منطقة الإعدادات المطلوبة مفتوحة والتغييرات تبقى قابلة للمراجعة.',
    requirements: [
      requirement('setting', 'Setting to change', 'الإعداد المطلوب تغييره', true, 'State the setting or preference to review.', 'حدد الإعداد أو التفضيل المطلوب مراجعته.'),
    ],
    preconditionsEn: ['Account-impacting changes require clear approval.'],
    preconditionsAr: ['التغييرات المؤثرة على الحساب تحتاج موافقة واضحة.'],
    stages: actionStages('Settings', 'الإعدادات', 'Apply approved setting', 'تطبيق الإعداد المعتمد'),
  },
  {
    capabilityId: 'help',
    adapter: 'navigation',
    approval: 'none',
    purposeEn: 'Open Help and explain the correct workflow for a Wakti feature.',
    purposeAr: 'فتح المساعدة وشرح التدفق الصحيح لميزة من ميزات وكتي.',
    backend: null,
    resultEn: 'The person sees the relevant help guidance.',
    resultAr: 'المستخدم يرى إرشادات المساعدة ذات الصلة.',
    requirements: [
      requirement('topic', 'Help topic', 'موضوع المساعدة', false, 'State the feature or task that needs explanation.', 'حدد الميزة أو المهمة التي تحتاج شرحاً.'),
    ],
    preconditionsEn: [],
    preconditionsAr: [],
    stages: navigationStages('Help', 'المساعدة'),
  },
];

export const WAKTI_CAPABILITY_CONTRACTS = Object.fromEntries(
  contracts.map((contract) => [contract.capabilityId, contract]),
) as Record<WaktiCapabilityId, WaktiCapabilityContract>;

export function getWaktiCapabilityContract(capabilityId?: WaktiCapabilityId | null) {
  if (!capabilityId) return null;
  return WAKTI_CAPABILITY_CONTRACTS[capabilityId] || null;
}

export function getWaktiCapabilityRequirements(contract: WaktiCapabilityContract, language: 'ar' | 'en') {
  return contract.requirements.map((item) => ({
    key: item.key,
    label: language === 'ar' ? item.labelAr : item.labelEn,
    help: language === 'ar' ? item.helpAr : item.helpEn,
    required: item.required,
    requiredWhen: item.requiredWhen,
    defaultValue: item.defaultValue,
  }));
}

export function getWaktiCapabilityStages(contract: WaktiCapabilityContract, language: 'ar' | 'en') {
  return contract.stages.map((item) => ({
    id: item.id,
    label: language === 'ar' ? item.labelAr : item.labelEn,
    detail: language === 'ar' ? item.detailAr : item.detailEn,
  }));
}

export function buildWaktiCapabilityKnowledgeManifest(language: 'ar' | 'en') {
  return contracts.map((contract) => {
    const requirements = getWaktiCapabilityRequirements(contract, language)
      .filter((item) => item.required)
      .map((item) => item.label)
      .join(', ');
    return `${contract.capabilityId} | adapter=${contract.adapter} | approval=${contract.approval} | required=${requirements || (language === 'ar' ? 'لا شيء' : 'none')}`;
  }).join('\n');
}
