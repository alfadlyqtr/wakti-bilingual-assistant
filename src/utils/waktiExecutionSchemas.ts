import type { WaktiCapabilityId } from '@/utils/waktiCapabilities';

export type WaktiExecutionMode = 'run' | 'prepare' | 'navigate' | 'guide';
export type WaktiExecutionApproval = 'none' | 'review' | 'required';
export type WaktiExecutionFieldType = 'text' | 'long_text' | 'choice' | 'date' | 'time' | 'contact' | 'file' | 'toggle';
export type WaktiExecutionChoiceSource = 'music_style';
export type WaktiExecutionStageId = 'understand' | 'collect' | 'open' | 'review' | 'run' | 'track' | 'complete';
export type WaktiExecutionFieldValue = string | boolean | string[];

export interface WaktiExecutionChoice {
  value: string;
  labelEn: string;
  labelAr: string;
  descriptionEn?: string;
  descriptionAr?: string;
}

export interface WaktiExecutionChoiceGroup {
  id: string;
  labelEn: string;
  labelAr: string;
  choices: WaktiExecutionChoice[];
}

export interface WaktiExecutionField {
  key: string;
  labelEn: string;
  labelAr: string;
  type: WaktiExecutionFieldType;
  required: boolean;
  requiredWhen?: string;
  defaultValue?: string;
  helpEn: string;
  helpAr: string;
  allowedValues?: string[];
  choices?: WaktiExecutionChoiceGroup[];
  choiceSource?: WaktiExecutionChoiceSource;
}

export interface WaktiExecutionFieldDetails {
  key: string;
  label: string;
  help: string;
  type: WaktiExecutionFieldType;
  required: boolean;
  requiredWhen?: string;
  defaultValue?: string;
  allowedValues?: string[];
  choices: Array<{
    id: string;
    label: string;
    choices: Array<{
      value: string;
      label: string;
      description?: string;
    }>;
  }>;
  choiceSource?: WaktiExecutionChoiceSource;
}

export interface WaktiExecutionStage {
  id: WaktiExecutionStageId;
  labelEn: string;
  labelAr: string;
  detailEn: string;
  detailAr: string;
}

export interface WaktiExecutionAction {
  id: string;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
  executionMode: WaktiExecutionMode;
  approval: WaktiExecutionApproval;
  route: string;
  targetEn: string;
  targetAr: string;
  adapter: string | null;
  backend: string[];
  fields: WaktiExecutionField[];
  preconditionsEn: string[];
  preconditionsAr: string[];
  stages: WaktiExecutionStage[];
  resultEn: string;
  resultAr: string;
}

export interface WaktiExecutionActionDetails {
  id: string;
  label: string;
  description: string;
  target: string;
  result: string;
  route: string;
  executionMode: WaktiExecutionMode;
  approval: WaktiExecutionApproval;
  adapter: string | null;
  backend: string[];
  fields: WaktiExecutionFieldDetails[];
  preconditions: string[];
  stages: Array<{
    id: WaktiExecutionStageId;
    label: string;
    detail: string;
  }>;
}

export interface WaktiExecutionSchema {
  capabilityId: WaktiCapabilityId;
  titleEn: string;
  titleAr: string;
  actions: WaktiExecutionAction[];
}

const field = (
  key: string,
  labelEn: string,
  labelAr: string,
  type: WaktiExecutionFieldType,
  required: boolean,
  helpEn: string,
  helpAr: string,
  options: Pick<WaktiExecutionField, 'requiredWhen' | 'defaultValue' | 'allowedValues' | 'choices' | 'choiceSource'> = {},
): WaktiExecutionField => ({ key, labelEn, labelAr, type, required, helpEn, helpAr, ...options });

const stage = (
  id: WaktiExecutionStageId,
  labelEn: string,
  labelAr: string,
  detailEn: string,
  detailAr: string,
): WaktiExecutionStage => ({ id, labelEn, labelAr, detailEn, detailAr });

const navigationStages = (titleEn: string, titleAr: string): WaktiExecutionStage[] => [
  stage('understand', 'Understand the request', 'فهم الطلب', `Identify the requested ${titleEn} area.`, `تحديد القسم المطلوب داخل ${titleAr}.`),
  stage('open', `Open ${titleEn}`, `فتح ${titleAr}`, 'Open the exact screen where this work continues.', 'فتح الشاشة الدقيقة التي يستمر فيها هذا العمل.'),
  stage('complete', 'Ready', 'جاهز', 'Confirm that the requested screen is ready.', 'تأكيد أن الشاشة المطلوبة جاهزة.'),
];

const preparationStages = (titleEn: string, titleAr: string, actionEn: string, actionAr: string): WaktiExecutionStage[] => [
  stage('understand', 'Understand the request', 'فهم الطلب', `Identify the exact ${titleEn} action.`, `تحديد الإجراء الدقيق داخل ${titleAr}.`),
  stage('collect', 'Collect the details', 'جمع التفاصيل', 'Check the required information and ask only for what is missing.', 'فحص المعلومات المطلوبة وطلب الناقص فقط.'),
  stage('open', `Open ${titleEn}`, `فتح ${titleAr}`, 'Open the correct screen and fill the real controls.', 'فتح الشاشة الصحيحة وتعبئة الحقول الحقيقية.'),
  stage('review', 'Review the draft', 'مراجعة المسودة', 'Show the prepared action before any important change.', 'عرض الإجراء المجهز قبل أي تغيير مهم.'),
  stage('complete', actionEn, actionAr, 'Leave the real action ready in the feature for the person to review or finish.', 'ترك الإجراء الحقيقي جاهزاً داخل الميزة ليراجعه المستخدم أو يكمله.'),
];

const runStages = (titleEn: string, titleAr: string, actionEn: string, actionAr: string): WaktiExecutionStage[] => [
  stage('understand', 'Understand the request', 'فهم الطلب', `Identify the exact ${titleEn} action.`, `تحديد الإجراء الدقيق داخل ${titleAr}.`),
  stage('collect', 'Collect the details', 'جمع التفاصيل', 'Check the required information and ask only for what is missing.', 'فحص المعلومات المطلوبة وطلب الناقص فقط.'),
  stage('review', 'Review before action', 'المراجعة قبل التنفيذ', 'Wait for approval when the action changes data or creates a result.', 'انتظار الموافقة عندما يغير الإجراء البيانات أو ينشئ نتيجة.'),
  stage('run', actionEn, actionAr, 'Run the real feature action.', 'تشغيل الإجراء الحقيقي للميزة.'),
  stage('track', 'Track the result', 'متابعة النتيجة', 'Show the real status until the action finishes or fails.', 'إظهار الحالة الحقيقية حتى يكتمل الإجراء أو يفشل.'),
  stage('complete', 'Show the result', 'إظهار النتيجة', 'Report the real result without claiming success early.', 'عرض النتيجة الحقيقية دون الادعاء بالنجاح مبكراً.'),
];

const guideStages = (titleEn: string, titleAr: string): WaktiExecutionStage[] => [
  stage('understand', 'Understand the request', 'فهم الطلب', `Identify the ${titleEn} workflow the person needs.`, `تحديد تدفق ${titleAr} الذي يحتاجه المستخدم.`),
  stage('open', `Open ${titleEn}`, `فتح ${titleAr}`, 'Open the correct place when the person wants to continue.', 'فتح المكان الصحيح عندما يريد المستخدم المتابعة.'),
  stage('complete', 'Explain the next step', 'شرح الخطوة التالية', 'Give only verified guidance for the real feature.', 'تقديم إرشاد موثق فقط للميزة الحقيقية.'),
];

const action = (
  id: string,
  labelEn: string,
  labelAr: string,
  descriptionEn: string,
  descriptionAr: string,
  executionMode: WaktiExecutionMode,
  approval: WaktiExecutionApproval,
  route: string,
  targetEn: string,
  targetAr: string,
  fields: WaktiExecutionField[] = [],
  options: Partial<Pick<WaktiExecutionAction, 'adapter' | 'backend' | 'preconditionsEn' | 'preconditionsAr' | 'stages' | 'resultEn' | 'resultAr'>> = {},
): WaktiExecutionAction => ({
  id,
  labelEn,
  labelAr,
  descriptionEn,
  descriptionAr,
  executionMode,
  approval,
  route,
  targetEn,
  targetAr,
  adapter: options.adapter ?? null,
  backend: options.backend ?? [],
  fields,
  preconditionsEn: options.preconditionsEn ?? [],
  preconditionsAr: options.preconditionsAr ?? [],
  stages: options.stages ?? (executionMode === 'run'
    ? runStages(targetEn, targetAr, labelEn, labelAr)
    : executionMode === 'prepare'
      ? preparationStages(targetEn, targetAr, labelEn, labelAr)
      : executionMode === 'guide'
        ? guideStages(targetEn, targetAr)
        : navigationStages(targetEn, targetAr)),
  resultEn: options.resultEn ?? `${labelEn} is ready in ${targetEn}.`,
  resultAr: options.resultAr ?? `${labelAr} جاهز داخل ${targetAr}.`,
});

const titleField = () => field('title', 'Title', 'العنوان', 'text', true, 'Use a short, clear title.', 'استخدم عنواناً قصيراً وواضحاً.');
const musicStyleField = () => field('style', 'Style', 'النمط', 'choice', true, 'Choose the genre, mood, instruments, rhythm, and language that fit the track.', 'اختر النوع والمزاج والآلات والإيقاع واللغة المناسبة للمقطع.', { choiceSource: 'music_style' });
const descriptionField = () => field('description', 'Description', 'الوصف', 'long_text', false, 'Add the details the person wants included.', 'أضف التفاصيل التي يريد المستخدم تضمينها.');
const targetField = () => field('target', 'Target item', 'العنصر المستهدف', 'text', true, 'Identify the existing item to change.', 'حدد العنصر الحالي المطلوب تعديله.');

export const WAKTI_EXECUTION_SCHEMAS: Record<WaktiCapabilityId, WaktiExecutionSchema> = {
  dashboard: {
    capabilityId: 'dashboard',
    titleEn: 'Dashboard',
    titleAr: 'لوحة التحكم',
    actions: [
      action('open_dashboard', 'Open Dashboard', 'فتح لوحة التحكم', 'Open the Wakti home dashboard.', 'فتح الصفحة الرئيسية لوكتي.', 'navigate', 'none', '/dashboard', 'Dashboard', 'لوحة التحكم'),
    ],
  },
  wakti_ai: {
    capabilityId: 'wakti_ai',
    titleEn: 'Wakti AI',
    titleAr: 'Wakti AI',
    actions: [
      action('start_wakti_chat', 'Start Wakti AI chat', 'بدء محادثة Wakti AI', 'Open Wakti AI with the person’s question or task ready.', 'فتح Wakti AI مع تجهيز سؤال أو مهمة المستخدم.', 'prepare', 'none', '/wakti-ai-v2', 'Wakti AI', 'Wakti AI', [field('request', 'Request', 'الطلب', 'long_text', true, 'State the question or task clearly.', 'اكتب السؤال أو المهمة بوضوح.')], { adapter: 'wakti_ai_chat' }),
      action('search_with_wakti', 'Search with Wakti AI', 'البحث باستخدام Wakti AI', 'Prepare a search request inside Wakti AI.', 'تجهيز طلب بحث داخل Wakti AI.', 'prepare', 'review', '/wakti-ai-v2', 'Wakti AI', 'Wakti AI', [field('query', 'Search query', 'عبارة البحث', 'long_text', true, 'State what needs to be found.', 'اكتب ما تريد العثور عليه.')], { adapter: 'wakti_ai_search' }),
    ],
  },
  image_studio: {
    capabilityId: 'image_studio',
    titleEn: 'Image Studio',
    titleAr: 'استوديو الصور',
    actions: [
      action('generate_image', 'Generate image', 'إنشاء صورة', 'Create an image from a written description.', 'إنشاء صورة من وصف مكتوب.', 'run', 'review', '/music?operatorTarget=image', 'Image Studio / Create', 'استوديو الصور / إنشاء', [field('prompt', 'Image description', 'وصف الصورة', 'long_text', true, 'Describe subject, style, mood, composition, and important details.', 'صف الموضوع والنمط والمزاج والتكوين والتفاصيل المهمة.'), field('quality', 'Quality', 'الجودة', 'choice', false, 'Choose the real Image Studio quality when stated.', 'اختر جودة استوديو الصور الحقيقية عند ذكرها.', { allowedValues: ['quick', 'fast', 'best_fast'] })], { adapter: 'image_generation', backend: ['Image Studio generation flow'], preconditionsEn: ['The person must be signed in.', 'Image quota must allow generation.'], preconditionsAr: ['يجب تسجيل دخول المستخدم.', 'يجب أن تسمح حصة الصور بالإنشاء.'] }),
      action('transform_image', 'Transform image', 'تعديل صورة', 'Create a new image from a supplied reference image.', 'إنشاء صورة جديدة من صورة مرجعية مرفقة.', 'run', 'review', '/music?operatorTarget=image', 'Image Studio / Transform', 'استوديو الصور / تعديل', [field('sourceImage', 'Reference image', 'صورة مرجعية', 'file', true, 'Choose the image to transform.', 'اختر الصورة المطلوب تعديلها.'), field('prompt', 'Transformation request', 'طلب التعديل', 'long_text', true, 'Describe how the reference image should change.', 'صف كيف يجب أن تتغير الصورة المرجعية.')], { adapter: 'image_generation', backend: ['Image Studio generation flow'] }),
      action('save_or_share_image', 'Save or share image', 'حفظ أو مشاركة الصورة', 'Save a finished image or prepare it for sharing.', 'حفظ صورة مكتملة أو تجهيزها للمشاركة.', 'prepare', 'review', '/music?operatorTarget=image&imageMode=saved', 'Image Studio / Result', 'استوديو الصور / النتيجة', [field('image', 'Generated image', 'الصورة المنشأة', 'file', true, 'Choose the generated image to save or share.', 'اختر الصورة المنشأة المطلوب حفظها أو مشاركتها.')], { adapter: 'image_result_handoff' }),
    ],
  },
  music_studio: {
    capabilityId: 'music_studio',
    titleEn: 'Music Studio',
    titleAr: 'استوديو الموسيقى',
    actions: [
      action('prepare_music_track', 'Prepare music track', 'تجهيز مقطع موسيقي', 'Fill a music draft without starting generation.', 'تعبئة مسودة موسيقية دون بدء الإنشاء.', 'prepare', 'required', '/music?operatorTarget=music', 'Music Studio / Compose', 'استوديو الموسيقى / التأليف', [titleField(), musicStyleField(), field('mode', 'Mode', 'الوضع', 'choice', false, 'Choose vocal or instrumental music.', 'اختر موسيقى غنائية أو بدون كلمات.', { defaultValue: 'vocal', allowedValues: ['vocal', 'instrumental'] }), field('lyrics', 'Lyrics', 'الكلمات', 'long_text', false, 'Required for vocal music unless the person chooses instrumental.', 'مطلوبة للموسيقى الغنائية ما لم يختر المستخدم موسيقى بدون كلمات.', { requiredWhen: 'mode is vocal' }), field('vocalType', 'Vocal type', 'نوع الصوت', 'choice', false, 'Choose automatic, male, female, custom voice, or none.', 'اختر تلقائي أو رجالي أو نسائي أو صوت مخصص أو بدون صوت.', { defaultValue: 'automatic', allowedValues: ['automatic', 'male', 'female', 'custom', 'none'] }), field('duration', 'Duration', 'المدة', 'choice', false, 'Choose the real Music Studio duration when stated.', 'اختر مدة استوديو الموسيقى الحقيقية عند ذكرها.', { allowedValues: ['30', '60', '90', '120', '150', '180', '210'] })], { adapter: 'music_generation', backend: ['music-generate', 'music-status', 'music-callback'], preconditionsEn: ['The person must be signed in.', 'Music quota must allow generation.', 'A custom voice must be ready when selected.'], preconditionsAr: ['يجب تسجيل دخول المستخدم.', 'يجب أن تسمح حصة الموسيقى بالإنشاء.', 'يجب أن يكون الصوت المخصص جاهزاً عند اختياره.'] }),
      action('generate_music_track', 'Generate approved music track', 'إنشاء مقطع موسيقي معتمد', 'Submit an approved Music Studio draft and track the real result.', 'إرسال مسودة استوديو الموسيقى المعتمدة ومتابعة النتيجة الحقيقية.', 'run', 'required', '/music?operatorTarget=music', 'Music Studio / Compose', 'استوديو الموسيقى / التأليف', [titleField(), musicStyleField(), field('mode', 'Mode', 'الوضع', 'choice', false, 'Choose vocal or instrumental music.', 'اختر موسيقى غنائية أو بدون كلمات.', { defaultValue: 'vocal', allowedValues: ['vocal', 'instrumental'] }), field('lyrics', 'Lyrics', 'الكلمات', 'long_text', false, 'Required for vocal music unless instrumental is selected.', 'مطلوبة للموسيقى الغنائية ما لم يتم اختيار موسيقى بدون كلمات.', { requiredWhen: 'mode is vocal' })], { adapter: 'music_generation', backend: ['music-generate', 'music-status', 'music-callback'], stages: [stage('understand', 'Understand the music request', 'فهم طلب الموسيقى', 'Use only the details the person actually gave.', 'استخدم التفاصيل التي ذكرها المستخدم فقط.'), stage('collect', 'Prepare the music draft', 'تجهيز مسودة الموسيقى', 'Fill the real Music Studio controls and identify missing information.', 'تعبئة حقول استوديو الموسيقى الحقيقية وتحديد المعلومات الناقصة.'), stage('review', 'Wait for approval', 'انتظار الموافقة', 'Show the final draft before submitting generation.', 'عرض المسودة النهائية قبل إرسال الإنشاء.'), stage('run', 'Submit music generation', 'إرسال إنشاء الموسيقى', 'Submit the approved request after quota and voice checks.', 'إرسال الطلب المعتمد بعد فحص الحصة والصوت.'), stage('track', 'Track music generation', 'متابعة إنشاء الموسيقى', 'Show real provider status until the tracks complete or fail.', 'إظهار حالة المزود الحقيقية حتى تكتمل المقاطع أو تفشل.'), stage('complete', 'Finalize tracks', 'تجهيز المقاطع النهائية', 'Show only saved completed tracks as successful.', 'عرض المقاطع المكتملة والمحفوظه فقط كنجاح.')], resultEn: 'Completed tracks are saved and ready to review.', resultAr: 'المقاطع المكتملة محفوظة وجاهزة للمراجعة.' }),
    ],
  },
  video_studio: {
    capabilityId: 'video_studio',
    titleEn: 'Video Studio',
    titleAr: 'استوديو الفيديو',
    actions: [
      action('create_text_video', 'Prepare text-to-video', 'تجهيز فيديو من نص', 'Open the AI Videomaker text-to-video workflow and validate the real video description.', 'فتح تدفق الفيديو من النص والتحقق من وصف الفيديو الحقيقي.', 'prepare', 'review', '/music?studioTab=video', 'Video Studio / AI Videomaker', 'استوديو الفيديو / صانع الفيديو بالذكاء', [field('prompt', 'Video description', 'وصف الفيديو', 'long_text', true, 'Describe subject, environment, camera movement, style, and desired motion.', 'صف الموضوع والبيئة وحركة الكاميرا والنمط والحركة المطلوبة.'), field('duration', 'Duration', 'المدة', 'choice', false, 'Choose the real video duration when stated.', 'اختر مدة الفيديو الحقيقية عند ذكرها.', { allowedValues: ['4', '5', '6', '8', '10'] }), field('resolution', 'Resolution', 'الدقة', 'choice', false, 'Choose 480p, 720p, or 1080p when stated.', 'اختر 480p أو 720p أو 1080p عند ذكرها.', { allowedValues: ['480p', '720p', '1080p'] })], { adapter: 'video_text_to_video', backend: ['AI Videomaker'] }),
      action('create_image_video', 'Prepare image-to-video', 'تجهيز فيديو من صورة', 'Open the image-to-video workflow and validate the source image and motion request.', 'فتح تدفق الفيديو من الصورة والتحقق من الصورة المصدر وطلب الحركة.', 'prepare', 'review', '/music?studioTab=video', 'Video Studio / AI Videomaker', 'استوديو الفيديو / صانع الفيديو بالذكاء', [field('sourceImage', 'Source image', 'الصورة المصدر', 'file', true, 'Choose the image to animate.', 'اختر الصورة المطلوب تحريكها.'), field('prompt', 'Motion description', 'وصف الحركة', 'long_text', false, 'Describe any motion, camera, or visual changes.', 'صف أي حركة أو كاميرا أو تغيرات بصرية.')], { adapter: 'video_image_to_video', backend: ['AI Videomaker'] }),
      action('create_two_image_video', 'Prepare two-image video', 'تجهيز فيديو من صورتين', 'Open the two-image video workflow and validate the start and end images.', 'فتح تدفق الفيديو من صورتين والتحقق من صورة البداية والنهاية.', 'prepare', 'review', '/music?studioTab=video', 'Video Studio / AI Videomaker', 'استوديو الفيديو / صانع الفيديو بالذكاء', [field('startImage', 'Start image', 'صورة البداية', 'file', true, 'Choose the opening image.', 'اختر صورة البداية.'), field('endImage', 'End image', 'صورة النهاية', 'file', true, 'Choose the ending image.', 'اختر صورة النهاية.'), field('prompt', 'Transition description', 'وصف الانتقال', 'long_text', false, 'Describe the desired transition or motion.', 'صف الانتقال أو الحركة المطلوبة.')], { adapter: 'video_two_image_to_video', backend: ['AI Videomaker'] }),
      action('create_cinema_video', 'Prepare cinema video', 'تجهيز فيديو سينمائي', 'Open the cinema workflow and validate its narrative description.', 'فتح تدفق السينما والتحقق من الوصف السردي.', 'prepare', 'review', '/music?studioTab=video', 'Video Studio / Cinema', 'استوديو الفيديو / السينما', [field('prompt', 'Cinema description', 'الوصف السينمائي', 'long_text', true, 'Describe the story, scene, style, camera, and motion.', 'صف القصة والمشهد والنمط والكاميرا والحركة.')], { adapter: 'video_cinema', backend: ['AI Videomaker'] }),
      action('review_saved_videos', 'Review saved videos', 'مراجعة الفيديوهات المحفوظة', 'Open Video Studio to review saved video results.', 'فتح استوديو الفيديو لمراجعة النتائج المحفوظة.', 'navigate', 'none', '/music?studioTab=video', 'Video Studio / Saved', 'استوديو الفيديو / المحفوظات'),
    ],
  },
  qr_creator: {
    capabilityId: 'qr_creator',
    titleEn: 'QR Creator',
    titleAr: 'منشئ رموز QR',
    actions: [
      action('create_url_qr', 'Prepare URL QR code', 'تجهيز رمز QR لرابط', 'Open QR Creator for a direct, dynamic, or call-to-action link.', 'فتح منشئ رموز QR لرابط مباشر أو ديناميكي أو صفحة أزرار.', 'prepare', 'review', '/music?studioTab=qrcode', 'QR Creator / URL', 'منشئ رموز QR / رابط', [field('url', 'URL', 'الرابط', 'text', true, 'Provide the destination URL.', 'أضف رابط الوجهة.'), field('urlMode', 'URL mode', 'وضع الرابط', 'choice', false, 'Choose direct, dynamic, or call-to-action.', 'اختر مباشر أو ديناميكي أو صفحة أزرار.', { allowedValues: ['direct', 'dynamic', 'cta'] })], { adapter: 'qr_url', backend: ['saved_qr_codes'] }),
      action('create_text_qr', 'Prepare text QR code', 'تجهيز رمز QR لنص', 'Open QR Creator for text content.', 'فتح منشئ رموز QR لمحتوى نصي.', 'prepare', 'review', '/music?studioTab=qrcode', 'QR Creator / Text', 'منشئ رموز QR / نص', [field('text', 'Text', 'النص', 'long_text', true, 'Provide the text to encode.', 'أضف النص المطلوب تضمينه.')], { adapter: 'qr_text', backend: ['saved_qr_codes'] }),
      action('create_email_qr', 'Prepare email QR code', 'تجهيز رمز QR لبريد', 'Open QR Creator for an email action.', 'فتح منشئ رموز QR لإجراء بريد إلكتروني.', 'prepare', 'review', '/music?studioTab=qrcode', 'QR Creator / Email', 'منشئ رموز QR / بريد', [field('email', 'Email address', 'البريد الإلكتروني', 'text', true, 'Provide the email address.', 'أضف البريد الإلكتروني.'), field('subject', 'Email subject', 'موضوع البريد', 'text', false, 'Provide the subject when wanted.', 'أضف الموضوع عند الرغبة.')], { adapter: 'qr_email', backend: ['saved_qr_codes'] }),
      action('create_phone_qr', 'Prepare phone QR code', 'تجهيز رمز QR لهاتف', 'Open QR Creator for a phone action.', 'فتح منشئ رموز QR لإجراء هاتف.', 'prepare', 'review', '/music?studioTab=qrcode', 'QR Creator / Phone', 'منشئ رموز QR / هاتف', [field('phone', 'Phone number', 'رقم الهاتف', 'text', true, 'Provide the phone number to call.', 'أضف رقم الهاتف المطلوب الاتصال به.')], { adapter: 'qr_phone', backend: ['saved_qr_codes'] }),
      action('create_wifi_qr', 'Prepare Wi-Fi QR code', 'تجهيز رمز QR للواي فاي', 'Open QR Creator for Wi-Fi connection details.', 'فتح منشئ رموز QR لتفاصيل اتصال الواي فاي.', 'prepare', 'review', '/music?studioTab=qrcode', 'QR Creator / Wi-Fi', 'منشئ رموز QR / واي فاي', [field('ssid', 'Wi-Fi name', 'اسم الشبكة', 'text', true, 'Provide the Wi-Fi network name.', 'أضف اسم شبكة الواي فاي.'), field('password', 'Wi-Fi password', 'كلمة مرور الواي فاي', 'text', false, 'Provide the password for protected networks.', 'أضف كلمة المرور للشبكات المحمية.'), field('encryption', 'Encryption', 'التشفير', 'choice', false, 'Choose the network encryption when stated.', 'اختر تشفير الشبكة عند ذكره.', { allowedValues: ['WPA', 'WEP', 'nopass'] })], { adapter: 'qr_wifi', backend: ['saved_qr_codes'] }),
      action('review_saved_qr_codes', 'Review saved QR codes', 'مراجعة رموز QR المحفوظة', 'Open QR Creator to review saved QR codes.', 'فتح منشئ رموز QR لمراجعة الرموز المحفوظة.', 'navigate', 'none', '/music?studioTab=qrcode', 'QR Creator / Saved', 'منشئ رموز QR / المحفوظات'),
    ],
  },
  text_tools: {
    capabilityId: 'text_tools',
    titleEn: 'Text Tools',
    titleAr: 'أدوات النص',
    actions: [
      action('compose_text', 'Compose text', 'كتابة نص', 'Prepare a new written draft.', 'تجهيز مسودة كتابة جديدة.', 'prepare', 'review', '/tools/text?tab=compose', 'Text Tools / Compose', 'أدوات النص / كتابة', [field('goal', 'Goal', 'الهدف', 'long_text', true, 'State what to write, for whom, and the preferred tone.', 'حدد ما تريد كتابته ولمن والنبرة المطلوبة.'), field('language', 'Language', 'اللغة', 'choice', false, 'Choose the requested writing language.', 'اختر لغة الكتابة المطلوبة.', { allowedValues: ['Arabic', 'English', 'French', 'Spanish', 'German', 'Turkish', 'Italian', 'Urdu'] })], { adapter: 'text_compose' }),
      action('reply_to_text', 'Prepare reply', 'تجهيز رد', 'Prepare a reply to supplied text or a message.', 'تجهيز رد على نص أو رسالة مرفقة.', 'prepare', 'review', '/tools/text?tab=reply', 'Text Tools / Reply', 'أدوات النص / رد', [field('sourceText', 'Original message', 'الرسالة الأصلية', 'long_text', true, 'Provide the message that needs a reply.', 'أضف الرسالة المطلوب الرد عليها.'), field('tone', 'Tone', 'النبرة', 'text', false, 'State the preferred reply tone.', 'حدد نبرة الرد المطلوبة.')], { adapter: 'text_reply' }),
      action('translate_text', 'Translate text', 'ترجمة نص', 'Prepare text for translation into the requested language.', 'تجهيز نص للترجمة إلى اللغة المطلوبة.', 'prepare', 'review', '/tools/text?tab=translate', 'Text Tools / Translate', 'أدوات النص / ترجمة', [field('sourceText', 'Text to translate', 'النص المطلوب ترجمته', 'long_text', true, 'Provide the text to translate.', 'أضف النص المطلوب ترجمته.'), field('targetLanguage', 'Target language', 'اللغة المطلوبة', 'text', true, 'State the language to translate into.', 'حدد اللغة المطلوب الترجمة إليها.')], { adapter: 'text_translate' }),
      action('create_diagram', 'Create diagram', 'إنشاء مخطط', 'Prepare a diagram request from a topic or process.', 'تجهيز طلب مخطط من موضوع أو عملية.', 'prepare', 'review', '/tools/text?tab=diagrams', 'Text Tools / Diagrams', 'أدوات النص / مخططات', [field('topic', 'Diagram topic', 'موضوع المخطط', 'long_text', true, 'Describe the process, structure, or relationship to show.', 'صف العملية أو البنية أو العلاقة المطلوب إظهارها.')], { adapter: 'text_diagram' }),
      action('create_presentation', 'Create presentation', 'إنشاء عرض', 'Prepare a presentation request.', 'تجهيز طلب عرض تقديمي.', 'prepare', 'review', '/tools/text?tab=presentation', 'Text Tools / Presentation', 'أدوات النص / عرض', [field('topic', 'Presentation topic', 'موضوع العرض', 'long_text', true, 'State the topic, audience, and desired result.', 'حدد الموضوع والجمهور والنتيجة المطلوبة.')], { adapter: 'text_presentation' }),
      action('create_a4_document', 'Create A4 document', 'إنشاء مستند A4', 'Prepare a structured A4 document request.', 'تجهيز طلب مستند A4 منظم.', 'prepare', 'review', '/tools/text?tab=a4', 'Text Tools / A4', 'أدوات النص / A4', [field('documentType', 'Document type', 'نوع المستند', 'text', true, 'State the document type and purpose.', 'حدد نوع المستند والغرض منه.'), field('content', 'Content', 'المحتوى', 'long_text', false, 'Provide any facts or text that must appear.', 'أضف أي حقائق أو نص يجب أن يظهر.')], { adapter: 'text_a4' }),
    ],
  },
  voice_studio: {
    capabilityId: 'voice_studio',
    titleEn: 'Voice Studio',
    titleAr: 'استوديو الصوت',
    actions: [
      action('generate_speech', 'Generate speech', 'إنشاء صوت', 'Turn supplied text into spoken audio.', 'تحويل النص المرفق إلى صوت منطوق.', 'run', 'review', '/tools/voice-studio?tab=tts', 'Voice Studio / Text to Speech', 'استوديو الصوت / تحويل النص إلى كلام', [field('text', 'Text to speak', 'النص المطلوب نطقه', 'long_text', true, 'Provide the exact text to speak.', 'أضف النص الدقيق المطلوب نطقه.'), field('voice', 'Voice', 'الصوت', 'choice', false, 'Choose a voice when one is specified.', 'اختر صوتاً عندما يحدد المستخدم صوتاً.', { allowedValues: ['cedar', 'marin'] })], { adapter: 'voice_tts', backend: ['generate-speech'], preconditionsEn: ['The person must be signed in.', 'A selected custom voice must be ready.'], preconditionsAr: ['يجب تسجيل دخول المستخدم.', 'يجب أن يكون الصوت المخصص المختار جاهزاً.'] }),
      action('live_translate_voice', 'Prepare live voice translation', 'تجهيز ترجمة صوتية فورية', 'Open the live translator with the requested languages ready.', 'فتح المترجم الفوري مع تجهيز اللغات المطلوبة.', 'prepare', 'review', '/tools/voice-studio?tab=live-translator', 'Voice Studio / Live Translator', 'استوديو الصوت / المترجم الفوري', [field('spokenLanguage', 'Spoken language', 'لغة التحدث', 'text', false, 'State the language the person will speak.', 'حدد اللغة التي سيتحدث بها المستخدم.'), field('targetLanguage', 'Target language', 'اللغة المطلوبة', 'text', true, 'State the language to translate into.', 'حدد اللغة المطلوب الترجمة إليها.')], { adapter: 'voice_live_translate' }),
      action('clone_voice', 'Prepare voice clone', 'تجهيز استنساخ صوت', 'Open the verified voice cloning workflow.', 'فتح تدفق استنساخ الصوت الموثق.', 'prepare', 'required', '/tools/voice-studio?tab=clone', 'Voice Studio / Clone', 'استوديو الصوت / استنساخ', [field('voiceName', 'Voice name', 'اسم الصوت', 'text', true, 'Choose a name for the new voice.', 'اختر اسماً للصوت الجديد.'), field('recording', 'Verification recording', 'تسجيل التحقق', 'file', true, 'Provide the recording required for verification.', 'أضف التسجيل المطلوب للتحقق.')], { adapter: 'voice_clone' }),
      action('record_audio', 'Record audio', 'تسجيل صوت', 'Open the recording workflow.', 'فتح تدفق التسجيل الصوتي.', 'prepare', 'review', '/tools/voice-studio?tab=tasjeel', 'Voice Studio / Recording', 'استوديو الصوت / التسجيل', [field('purpose', 'Recording purpose', 'غرض التسجيل', 'text', false, 'State what the recording is for when known.', 'حدد غرض التسجيل عند توفره.')], { adapter: 'voice_recording' }),
    ],
  },
  email: {
    capabilityId: 'email',
    titleEn: 'Email',
    titleAr: 'البريد',
    actions: [
      action('draft_email', 'Draft email', 'تجهيز بريد', 'Prepare a complete email in the real composer.', 'تجهيز رسالة بريد كاملة داخل محرر البريد الحقيقي.', 'prepare', 'required', '/tools/email', 'Email / Composer', 'البريد / محرر الرسائل', [field('recipients', 'Recipients', 'المستلمون', 'text', true, 'Provide one or more email addresses.', 'أضف عنوان بريد إلكتروني واحداً أو أكثر.'), field('subject', 'Subject', 'الموضوع', 'text', true, 'Provide a clear email subject.', 'أضف موضوعاً واضحاً للبريد.'), field('body', 'Message', 'الرسالة', 'long_text', true, 'Provide the message or describe what to write.', 'أضف الرسالة أو صف ما يجب كتابته.'), field('attachments', 'Attachments', 'المرفقات', 'file', false, 'Choose any files or generated items to attach.', 'اختر أي ملفات أو عناصر مولدة لإرفاقها.')], { adapter: 'email_draft', backend: ['gmail-api', 'imap-api'], preconditionsEn: ['A sending account must be connected before sending.'], preconditionsAr: ['يجب ربط حساب إرسال قبل الإرسال.'] }),
      action('send_approved_email', 'Send approved email', 'إرسال بريد معتمد', 'Send only a reviewed email through a connected account.', 'إرسال بريد تمت مراجعته فقط من خلال حساب متصل.', 'prepare', 'required', '/tools/email', 'Email / Composer', 'البريد / محرر الرسائل', [field('recipients', 'Recipients', 'المستلمون', 'text', true, 'Confirm the recipient addresses.', 'أكد عناوين المستلمين.'), field('subject', 'Subject', 'الموضوع', 'text', true, 'Confirm the email subject.', 'أكد موضوع البريد.'), field('body', 'Message', 'الرسالة', 'long_text', true, 'Confirm the final message.', 'أكد الرسالة النهائية.')], { adapter: 'email_send', backend: ['gmail-api', 'imap-api'] }),
    ],
  },
  tasks_reminders: {
    capabilityId: 'tasks_reminders',
    titleEn: 'Tasks & Reminders',
    titleAr: 'المهام والتذكيرات',
    actions: [
      action('create_task', 'Create task', 'إنشاء مهمة', 'Prepare a task in the real task form.', 'تجهيز مهمة داخل نموذج المهام الحقيقي.', 'prepare', 'required', '/tr?intent=create&tab=tasks', 'Tasks & Reminders / Tasks', 'المهام والتذكيرات / المهام', [titleField(), descriptionField(), field('dueDate', 'Due date', 'تاريخ الاستحقاق', 'date', false, 'Provide a date when the task has a deadline.', 'أضف تاريخاً عندما تكون للمهمة مهلة.'), field('dueTime', 'Due time', 'وقت الاستحقاق', 'time', false, 'Provide a time when needed.', 'أضف وقتاً عند الحاجة.'), field('priority', 'Priority', 'الأولوية', 'choice', false, 'Choose normal, high, or urgent when stated.', 'اختر عادي أو عالي أو عاجل عند ذكره.', { allowedValues: ['normal', 'high', 'urgent'] })], { adapter: 'task_create' }),
      action('create_reminder', 'Create reminder', 'إنشاء تذكير', 'Prepare a reminder in the real reminder form.', 'تجهيز تذكير داخل نموذج التذكيرات الحقيقي.', 'prepare', 'required', '/tr?intent=create&tab=reminders', 'Tasks & Reminders / Reminders', 'المهام والتذكيرات / التذكيرات', [titleField(), descriptionField(), field('dueDate', 'Reminder date', 'تاريخ التذكير', 'date', true, 'Provide the date for the reminder.', 'أضف تاريخ التذكير.'), field('dueTime', 'Reminder time', 'وقت التذكير', 'time', false, 'Provide the reminder time when known.', 'أضف وقت التذكير عند توفره.')], { adapter: 'reminder_create' }),
      action('complete_task', 'Complete task', 'إكمال مهمة', 'Complete a clearly identified existing task.', 'إكمال مهمة حالية محددة بوضوح.', 'run', 'required', '/tr?tab=tasks', 'Tasks & Reminders / Tasks', 'المهام والتذكيرات / المهام', [targetField()], { adapter: 'task_complete', preconditionsEn: ['The target task must match exactly one item.'], preconditionsAr: ['يجب أن يطابق اسم المهمة المستهدفة عنصراً واحداً فقط.'] }),
      action('snooze_reminder', 'Snooze reminder', 'تأجيل تذكير', 'Snooze a clearly identified existing reminder.', 'تأجيل تذكير حالي محدد بوضوح.', 'run', 'required', '/tr?tab=reminders', 'Tasks & Reminders / Reminders', 'المهام والتذكيرات / التذكيرات', [targetField(), field('until', 'Snooze until', 'التأجيل حتى', 'date', false, 'Provide the new reminder time or date when stated.', 'أضف وقت أو تاريخ التذكير الجديد عند ذكره.')], { adapter: 'reminder_snooze' }),
      action('edit_task_or_reminder', 'Edit task or reminder', 'تعديل مهمة أو تذكير', 'Open an identified task or reminder for review before editing.', 'فتح مهمة أو تذكير محدد للمراجعة قبل التعديل.', 'prepare', 'required', '/tr', 'Tasks & Reminders', 'المهام والتذكيرات', [targetField(), field('changes', 'Requested changes', 'التغييرات المطلوبة', 'long_text', true, 'State exactly what should change.', 'حدد بالضبط ما الذي يجب تغييره.')], { adapter: 'task_edit' }),
      action('add_subtasks', 'Add subtasks', 'إضافة مهام فرعية', 'Add reviewed subtasks to one identified task.', 'إضافة مهام فرعية تمت مراجعتها إلى مهمة واحدة محددة.', 'run', 'required', '/tr?tab=tasks', 'Tasks & Reminders / Tasks', 'المهام والتذكيرات / المهام', [targetField(), field('subtasks', 'Subtasks', 'المهام الفرعية', 'long_text', true, 'List the subtasks to add.', 'اكتب المهام الفرعية المطلوب إضافتها.')], { adapter: 'task_subtasks' }),
    ],
  },
  calendar: {
    capabilityId: 'calendar',
    titleEn: 'Calendar',
    titleAr: 'التقويم',
    actions: [
      action('open_calendar_date', 'Open calendar date', 'فتح تاريخ في التقويم', 'Open Calendar at the requested date.', 'فتح التقويم عند التاريخ المطلوب.', 'navigate', 'none', '/calendar', 'Calendar', 'التقويم', [field('date', 'Date', 'التاريخ', 'date', false, 'Provide the date to open when known.', 'أضف التاريخ المطلوب فتحه عند توفره.')], { adapter: 'calendar_navigation' }),
      action('change_calendar_view', 'Change calendar view', 'تغيير عرض التقويم', 'Switch Calendar to day, week, month, or year view.', 'تبديل التقويم إلى عرض اليوم أو الأسبوع أو الشهر أو السنة.', 'run', 'none', '/calendar', 'Calendar', 'التقويم', [field('view', 'View', 'العرض', 'choice', true, 'Choose day, week, month, or year.', 'اختر اليوم أو الأسبوع أو الشهر أو السنة.', { allowedValues: ['day', 'week', 'month', 'year'] })], { adapter: 'calendar_view' }),
      action('create_calendar_note', 'Create calendar note', 'إنشاء ملاحظة تقويم', 'Prepare a new note in Calendar.', 'تجهيز ملاحظة جديدة داخل التقويم.', 'prepare', 'review', '/calendar', 'Calendar', 'التقويم', [titleField(), descriptionField(), field('date', 'Date', 'التاريخ', 'date', false, 'Provide the date for the note.', 'أضف تاريخ الملاحظة.')], { adapter: 'calendar_note_create' }),
      action('edit_calendar_note', 'Edit calendar note', 'تعديل ملاحظة تقويم', 'Open an identified Calendar note for review and editing.', 'فتح ملاحظة تقويم محددة للمراجعة والتعديل.', 'prepare', 'review', '/calendar', 'Calendar', 'التقويم', [targetField(), field('changes', 'Requested changes', 'التغييرات المطلوبة', 'long_text', true, 'State exactly what should change.', 'حدد بالضبط ما الذي يجب تغييره.')], { adapter: 'calendar_note_edit' }),
    ],
  },
  maw3d: {
    capabilityId: 'maw3d',
    titleEn: 'Maw3d',
    titleAr: 'موعد',
    actions: [
      action('create_event', 'Create event', 'إنشاء حدث', 'Prepare an event invitation in the real Maw3d form.', 'تجهيز دعوة حدث داخل نموذج موعد الحقيقي.', 'prepare', 'required', '/maw3d/create', 'Maw3d / Create event', 'موعد / إنشاء حدث', [titleField(), field('date', 'Event date', 'تاريخ الحدث', 'date', true, 'Provide the event date.', 'أضف تاريخ الحدث.'), field('startTime', 'Start time', 'وقت البداية', 'time', false, 'Provide the start time when known.', 'أضف وقت البداية عند توفره.'), field('endTime', 'End time', 'وقت النهاية', 'time', false, 'Provide the end time when known.', 'أضف وقت النهاية عند توفره.'), field('location', 'Location', 'الموقع', 'text', false, 'Provide a physical or online location.', 'أضف موقعاً فعلياً أو إلكترونياً.'), descriptionField()], { adapter: 'maw3d_event_create' }),
      action('manage_event', 'Manage event', 'إدارة حدث', 'Open an existing event for management.', 'فتح حدث حالي لإدارته.', 'navigate', 'none', '/maw3d', 'Maw3d / Events', 'موعد / الأحداث', [targetField()], { adapter: 'maw3d_event_manage' }),
      action('review_event_rsvps', 'Review event RSVPs', 'مراجعة ردود الحضور', 'Open an existing event’s attendance details.', 'فتح تفاصيل حضور حدث حالي.', 'navigate', 'none', '/maw3d', 'Maw3d / Events', 'موعد / الأحداث', [targetField()], { adapter: 'maw3d_rsvp_review' }),
    ],
  },
  contacts_chat: {
    capabilityId: 'contacts_chat',
    titleEn: 'Contacts & Chat',
    titleAr: 'جهات الاتصال والمحادثة',
    actions: [
      action('find_contact', 'Find contact', 'البحث عن جهة اتصال', 'Open Contacts ready to locate a person or group.', 'فتح جهات الاتصال جاهزة للبحث عن شخص أو مجموعة.', 'navigate', 'none', '/contacts?tab=contacts', 'Contacts', 'جهات الاتصال', [field('contact', 'Contact or group', 'جهة الاتصال أو المجموعة', 'contact', false, 'Provide the person or group name.', 'أضف اسم الشخص أو المجموعة.')], { adapter: 'contact_lookup' }),
      action('prepare_chat_message', 'Prepare chat message', 'تجهيز رسالة محادثة', 'Open the right chat and prepare a message without sending it early.', 'فتح المحادثة الصحيحة وتجهيز رسالة دون إرسالها مبكراً.', 'prepare', 'required', '/contacts?tab=contacts', 'Contacts & Chat', 'جهات الاتصال والمحادثة', [field('contact', 'Recipient', 'المستلم', 'contact', true, 'Provide the person or group to contact.', 'أضف الشخص أو المجموعة المطلوب التواصل معها.'), field('message', 'Message', 'الرسالة', 'long_text', true, 'Provide or describe the message to prepare.', 'أضف أو صف الرسالة المطلوب تجهيزها.')], { adapter: 'chat_draft' }),
      action('send_approved_chat_message', 'Send approved chat message', 'إرسال رسالة محادثة معتمدة', 'Open a prepared message for final review and send inside the real chat.', 'فتح رسالة مجهزة للمراجعة النهائية والإرسال من داخل المحادثة الحقيقية.', 'prepare', 'required', '/contacts?tab=contacts', 'Contacts & Chat', 'جهات الاتصال والمحادثة', [field('contact', 'Recipient', 'المستلم', 'contact', true, 'Confirm the recipient.', 'أكد المستلم.'), field('message', 'Message', 'الرسالة', 'long_text', true, 'Confirm the final message.', 'أكد الرسالة النهائية.')], { adapter: 'chat_send' }),
    ],
  },
  social: {
    capabilityId: 'social',
    titleEn: 'Social',
    titleAr: 'سوشيال',
    actions: [
      action('open_social_contacts', 'Open social contacts', 'فتح جهات الاتصال الاجتماعية', 'Open the contacts section inside Social.', 'فتح قسم جهات الاتصال داخل سوشيال.', 'run', 'none', '/social?section=contacts&tab=contacts', 'Social / Contacts', 'سوشيال / جهات الاتصال', [], { adapter: 'social_section' }),
      action('open_social_groups', 'Open social groups', 'فتح المجموعات الاجتماعية', 'Open the groups section inside Social.', 'فتح قسم المجموعات داخل سوشيال.', 'run', 'none', '/social?section=groups', 'Social / Groups', 'سوشيال / المجموعات', [], { adapter: 'social_section' }),
      action('open_social_requests', 'Open social requests', 'فتح الطلبات الاجتماعية', 'Open the incoming requests section inside Social.', 'فتح قسم الطلبات الواردة داخل سوشيال.', 'run', 'none', '/social?section=requests', 'Social / Requests', 'سوشيال / الطلبات', [], { adapter: 'social_section' }),
      action('open_social_gallery', 'Open social gallery', 'فتح المعرض الاجتماعي', 'Open My Gallery inside Social.', 'فتح معرضي داخل سوشيال.', 'run', 'none', '/social?section=gallery', 'Social / My Gallery', 'سوشيال / معرضي', [], { adapter: 'social_section' }),
      action('prepare_social_post', 'Prepare social post', 'تجهيز منشور اجتماعي', 'Explain the verified posting path without claiming a unified publish action exists.', 'شرح مسار النشر الموثق دون الادعاء بوجود إجراء نشر موحد.', 'guide', 'review', '/social', 'Social', 'سوشيال', [field('content', 'Post content', 'محتوى المنشور', 'long_text', true, 'Provide or describe the post content.', 'أضف أو صف محتوى المنشور.'), field('account', 'Connected account', 'الحساب المتصل', 'text', false, 'State the connected account when known.', 'حدد الحساب المتصل عند توفره.')], { resultEn: 'The post details are ready for the supported publishing screen.', resultAr: 'تفاصيل المنشور جاهزة لشاشة النشر المدعومة.' }),
    ],
  },
  projects: {
    capabilityId: 'projects',
    titleEn: 'Projects',
    titleAr: 'المشاريع',
    actions: [
      action('prepare_project_build', 'Prepare project build', 'تجهيز بناء مشروع', 'Open Projects with a project build request ready in the real prompt field.', 'فتح المشاريع مع تجهيز طلب بناء مشروع في حقل الطلب الحقيقي.', 'prepare', 'required', '/projects', 'Projects / Builder', 'المشاريع / البناء', [field('goal', 'Project goal', 'هدف المشروع', 'long_text', true, 'Describe what to build or change.', 'صف ما تريد بناءه أو تغييره.'), field('mode', 'Workspace mode', 'وضع مساحة العمل', 'choice', false, 'Choose builder or assistant when stated.', 'اختر البناء أو المساعد عند ذكره.', { allowedValues: ['builder', 'assistant'] })], { adapter: 'project_build_prompt' }),
      action('continue_project', 'Continue project', 'متابعة مشروع', 'Open an existing project for further work.', 'فتح مشروع حالي لمتابعة العمل.', 'navigate', 'none', '/projects', 'Projects', 'المشاريع', [targetField()], { adapter: 'project_navigation' }),
    ],
  },
  files: {
    capabilityId: 'files',
    titleEn: 'My Files',
    titleAr: 'ملفاتي',
    actions: [
      action('browse_files', 'Browse saved files', 'استعراض الملفات المحفوظة', 'Open My Files and browse saved records.', 'فتح ملفاتي واستعراض السجلات المحفوظة.', 'navigate', 'none', '/my-warranty', 'My Files', 'ملفاتي'),
      action('open_saved_file', 'Open saved file', 'فتح ملف محفوظ', 'Open My Files ready to find one saved item.', 'فتح ملفاتي جاهزة للبحث عن عنصر محفوظ.', 'navigate', 'none', '/my-warranty', 'My Files', 'ملفاتي', [field('fileName', 'File name', 'اسم الملف', 'text', true, 'Provide the saved item name or identifier.', 'أضف اسم العنصر المحفوظ أو معرفه.')]),
      action('manage_file', 'Manage file', 'إدارة ملف', 'Explain the verified file-management path when direct automation is not available.', 'شرح مسار إدارة الملف الموثق عندما لا تكون الأتمتة المباشرة متاحة.', 'guide', 'review', '/my-warranty', 'My Files', 'ملفاتي', [field('fileName', 'File name', 'اسم الملف', 'text', true, 'Provide the saved item name or identifier.', 'أضف اسم العنصر المحفوظ أو معرفه.')]),
    ],
  },
  vitality: {
    capabilityId: 'vitality',
    titleEn: 'Vitality',
    titleAr: 'الحيوية',
    actions: [
      action('show_whoop_data', 'Show Whoop data', 'عرض بيانات Whoop', 'Open Vitality on the Whoop data source.', 'فتح الحيوية على مصدر بيانات Whoop.', 'run', 'none', '/fitness?source=whoop', 'Vitality / Whoop', 'الحيوية / Whoop', [], { adapter: 'vitality_source', preconditionsEn: ['The Whoop account must be connected to show personal data.'], preconditionsAr: ['يجب ربط حساب Whoop لعرض البيانات الشخصية.'] }),
      action('show_healthkit_data', 'Show HealthKit data', 'عرض بيانات HealthKit', 'Open Vitality on the HealthKit data source.', 'فتح الحيوية على مصدر بيانات HealthKit.', 'run', 'none', '/fitness?source=healthkit', 'Vitality / HealthKit', 'الحيوية / HealthKit', [], { adapter: 'vitality_source', preconditionsEn: ['HealthKit must be available and connected on the device.'], preconditionsAr: ['يجب أن يكون HealthKit متاحاً ومتصلاً على الجهاز.'] }),
      action('review_wellness_data', 'Review wellness data', 'مراجعة بيانات العافية', 'Open the requested Vitality source for the person to review their own data.', 'فتح مصدر الحيوية المطلوب ليقوم المستخدم بمراجعة بياناته بنفسه.', 'guide', 'none', '/fitness', 'Vitality', 'الحيوية'),
    ],
  },
  deen: {
    capabilityId: 'deen',
    titleEn: 'Deen',
    titleAr: 'دين',
    actions: [
      action('open_prayer_times', 'Open prayer times', 'فتح مواقيت الصلاة', 'Open the prayer times area.', 'فتح قسم مواقيت الصلاة.', 'navigate', 'none', '/deen/prayer-times', 'Deen / Prayer Times', 'دين / مواقيت الصلاة'),
      action('open_quran', 'Open Quran', 'فتح القرآن', 'Open the Quran area.', 'فتح قسم القرآن.', 'navigate', 'none', '/deen/quran', 'Deen / القرآن', 'دين / القرآن'),
      action('open_hadith', 'Open Hadith', 'فتح الحديث', 'Open the Hadith area.', 'فتح قسم الحديث.', 'navigate', 'none', '/deen/hadith', 'Deen / Hadith', 'دين / الحديث'),
      action('open_azkar', 'Open Azkar', 'فتح الأذكار', 'Open the Azkar area.', 'فتح قسم الأذكار.', 'navigate', 'none', '/deen/azkar', 'Deen / Azkar', 'دين / الأذكار'),
      action('open_deen_study', 'Open Deen study', 'فتح دراسة الدين', 'Open the Deen study area.', 'فتح قسم دراسة الدين.', 'navigate', 'none', '/deen/study', 'Deen / Study', 'دين / الدراسة'),
      action('ask_deen_question', 'Ask Deen question', 'طرح سؤال ديني', 'Open the Deen question area with the question ready.', 'فتح قسم الأسئلة الدينية مع تجهيز السؤال.', 'prepare', 'none', '/deen/ask', 'Deen / Ask', 'دين / اسأل', [field('question', 'Question', 'السؤال', 'long_text', true, 'State the question clearly.', 'اكتب السؤال بوضوح.')], { adapter: 'deen_question' }),
    ],
  },
  games: {
    capabilityId: 'games',
    titleEn: 'Games',
    titleAr: 'الألعاب',
    actions: [
      action('open_chess', 'Open chess', 'فتح الشطرنج', 'Open the Chess game screen.', 'فتح شاشة لعبة الشطرنج.', 'run', 'none', '/games?screen=chess', 'Games / Chess', 'الألعاب / الشطرنج', [], { adapter: 'game_navigation' }),
      action('open_tic_tac_toe', 'Open Tic-Tac-Toe', 'فتح إكس-أو', 'Open the Tic-Tac-Toe game screen.', 'فتح شاشة لعبة إكس-أو.', 'run', 'none', '/games?screen=tictactoe', 'Games / Tic-Tac-Toe', 'الألعاب / إكس-أو', [], { adapter: 'game_navigation' }),
      action('open_solitaire', 'Open Solitaire', 'فتح سوليتير', 'Open the Solitaire game screen.', 'فتح شاشة لعبة سوليتير.', 'run', 'none', '/games?screen=solitaire', 'Games / Solitaire', 'الألعاب / سوليتير', [], { adapter: 'game_navigation' }),
      action('open_letters', 'Open Letters', 'فتح الحروف', 'Open the Letters game screen.', 'فتح شاشة لعبة الحروف.', 'run', 'none', '/games?screen=letters', 'Games / Letters', 'الألعاب / الحروف', [], { adapter: 'game_navigation' }),
    ],
  },
  journal: {
    capabilityId: 'journal',
    titleEn: 'Journal',
    titleAr: 'اليومية',
    actions: [
      action('open_journal_today', 'Open today’s Journal', 'فتح يومية اليوم', 'Open the daily Journal check-in.', 'فتح تسجيل اليومية لليوم.', 'navigate', 'none', '/journal?tab=today', 'Journal / Today', 'اليومية / اليوم'),
      action('prepare_journal_checkin', 'Prepare Journal check-in', 'تجهيز تسجيل يوميات', 'Explain the verified Journal check-in fields and open the daily entry for personal review.', 'شرح حقول تسجيل اليومية الموثقة وفتح إدخال اليوم للمراجعة الشخصية.', 'guide', 'required', '/journal?tab=today', 'Journal / Today', 'اليومية / اليوم', [field('mood', 'Mood', 'المزاج', 'choice', true, 'Choose the mood that best represents the day.', 'اختر المزاج الذي يمثل اليوم بشكل أفضل.', { allowedValues: ['1', '2', '3', '4', '5'] }), field('note', 'Note', 'ملاحظة', 'long_text', false, 'Add a personal note when wanted.', 'أضف ملاحظة شخصية عند الرغبة.'), field('tags', 'Tags', 'الوسوم', 'text', false, 'Choose relevant activities or themes.', 'اختر الأنشطة أو الموضوعات المناسبة.'), field('gratitude', 'Gratitude', 'الامتنان', 'long_text', false, 'Add one or more gratitude entries when wanted.', 'أضف إدخال امتنان واحداً أو أكثر عند الرغبة.')], { adapter: 'journal_checkin', backend: ['journal_days', 'journal_checkins'], resultEn: 'The verified Journal check-in form is open for the person to review and save.', resultAr: 'نموذج تسجيل اليومية الموثق مفتوح ليراجعه المستخدم ويحفظه.' }),
      action('review_journal_timeline', 'Review Journal timeline', 'مراجعة سجل اليومية', 'Open the Journal timeline for the selected day.', 'فتح سجل اليومية لليوم المحدد.', 'navigate', 'none', '/journal?tab=timeline', 'Journal / Timeline', 'اليومية / السجل', [field('date', 'Date', 'التاريخ', 'date', false, 'Provide the date to review when known.', 'أضف التاريخ المطلوب مراجعته عند توفره.')]),
      action('review_journal_charts', 'Review Journal charts', 'مراجعة إحصائيات اليومية', 'Open Journal charts to review recorded patterns.', 'فتح إحصائيات اليومية لمراجعة الأنماط المسجلة.', 'navigate', 'none', '/journal?tab=charts', 'Journal / Charts', 'اليومية / الإحصائيات'),
      action('ask_journal', 'Ask Journal', 'اسأل اليومية', 'Open the private Journal question area with the question ready for review.', 'فتح قسم أسئلة اليومية الخاص مع تجهيز السؤال للمراجعة.', 'guide', 'none', '/journal?tab=ask', 'Journal / Ask', 'اليومية / اسأل', [field('question', 'Question', 'السؤال', 'long_text', true, 'Ask about recorded moods, memories, or patterns.', 'اسأل عن المزاج أو الذكريات أو الأنماط المسجلة.')], { adapter: 'journal_qa', backend: ['journal-qa'] }),
    ],
  },
  account: {
    capabilityId: 'account',
    titleEn: 'Account',
    titleAr: 'حسابي',
    actions: [
      action('open_account_profile', 'Open account profile', 'فتح الملف الشخصي', 'Open the Account profile tab.', 'فتح تبويب الملف الشخصي في الحساب.', 'navigate', 'none', '/account?tab=profile', 'Account / Profile', 'حسابي / الملف الشخصي'),
      action('open_account_wishes', 'Open account wishes', 'فتح رغبات الحساب', 'Open the Account wishes tab.', 'فتح تبويب رغبات الحساب.', 'navigate', 'none', '/account?tab=wishes', 'Account / Wishes', 'حسابي / الرغبات'),
      action('open_account_billing', 'Open account billing', 'فتح فاتورة الحساب', 'Open the Account billing tab.', 'فتح تبويب الفاتورة في الحساب.', 'navigate', 'none', '/account?tab=billing', 'Account / الفاتورة', 'حسابي / الفاتورة'),
      action('prepare_profile_change', 'Prepare profile change', 'تجهيز تغيير الملف الشخصي', 'Open the profile settings and explain the exact information that must be reviewed before saving.', 'فتح إعدادات الملف الشخصي وشرح المعلومات التي يجب مراجعتها قبل الحفظ.', 'guide', 'required', '/account?tab=profile', 'Account / Profile', 'حسابي / الملف الشخصي', [field('field', 'Profile field', 'حقل الملف الشخصي', 'text', true, 'State the profile field to change.', 'حدد حقل الملف الشخصي المطلوب تغييره.'), field('newValue', 'New value', 'القيمة الجديدة', 'text', true, 'State the intended new value.', 'حدد القيمة الجديدة المطلوبة.')], { adapter: 'account_profile', backend: ['profiles'], resultEn: 'The profile change is ready for the person to review and save.', resultAr: 'تغيير الملف الشخصي جاهز ليراجعه المستخدم ويحفظه.' }),
      action('review_subscription', 'Review subscription', 'مراجعة الاشتراك', 'Open the billing area to review the current subscription or purchase options.', 'فتح قسم الفاتورة لمراجعة الاشتراك الحالي أو خيارات الشراء.', 'navigate', 'none', '/account?tab=billing', 'Account / Billing', 'حسابي / الفاتورة'),
    ],
  },
  wishlists: {
    capabilityId: 'wishlists',
    titleEn: 'Wishlists',
    titleAr: 'قوائم الرغبات',
    actions: [
      action('open_wishlists', 'Open Wishlists', 'فتح قوائم الرغبات', 'Open the personal Wishlists area.', 'فتح قسم قوائم الرغبات الشخصية.', 'navigate', 'none', '/wishlists', 'Wishlists', 'قوائم الرغبات'),
      action('prepare_wishlist', 'Prepare wishlist', 'تجهيز قائمة رغبات', 'Open Wishlists and explain the real list fields before creating a new list.', 'فتح قوائم الرغبات وشرح حقول القائمة الحقيقية قبل إنشاء قائمة جديدة.', 'guide', 'required', '/wishlists', 'Wishlists / New list', 'قوائم الرغبات / قائمة جديدة', [titleField(), descriptionField(), field('eventDate', 'Event date', 'تاريخ المناسبة', 'date', false, 'Provide a date when the list is for an event.', 'أضف تاريخاً عندما تكون القائمة لمناسبة.'), field('privacy', 'Privacy', 'الخصوصية', 'choice', true, 'Choose public, contacts only, or private.', 'اختر عام أو جهات الاتصال فقط أو خاص.', { allowedValues: ['public', 'contacts', 'private'] }), field('allowClaims', 'Allow claims', 'السماح بحجز الهدايا', 'toggle', false, 'State whether contacts may claim items.', 'حدد ما إذا كان يمكن لجهات الاتصال حجز العناصر.', { defaultValue: 'true' })], { adapter: 'wishlist_create', backend: ['wishlists'], resultEn: 'The new wishlist details are ready for personal review and saving.', resultAr: 'تفاصيل قائمة الرغبات الجديدة جاهزة للمراجعة والحفظ الشخصي.' }),
      action('prepare_wishlist_item', 'Prepare wishlist item', 'تجهيز عنصر رغبة', 'Open an existing wishlist and explain the real item fields before adding it.', 'فتح قائمة رغبات حالية وشرح حقول العنصر الحقيقية قبل إضافته.', 'guide', 'required', '/wishlists', 'Wishlists / Add item', 'قوائم الرغبات / إضافة عنصر', [field('wishlist', 'Wishlist', 'قائمة الرغبات', 'text', true, 'Identify the list that will receive the item.', 'حدد القائمة التي سيضاف إليها العنصر.'), titleField(), descriptionField(), field('productUrl', 'Product link', 'رابط المنتج', 'text', false, 'Add a product link when available.', 'أضف رابط المنتج عند توفره.'), field('price', 'Price', 'السعر', 'text', false, 'Add a price and currency when known.', 'أضف السعر والعملة عند توفرهما.'), field('priority', 'Priority', 'الأولوية', 'choice', false, 'Choose a priority from 1 to 5 when stated.', 'اختر أولوية من 1 إلى 5 عند ذكرها.', { allowedValues: ['1', '2', '3', '4', '5'] })], { adapter: 'wishlist_item_create', backend: ['wishlist_items'] }),
      action('review_wishlist_claims', 'Review wishlist claims', 'مراجعة حجوزات الهدايا', 'Open Wishlists to review claimed and pending items.', 'فتح قوائم الرغبات لمراجعة العناصر المحجوزة والمعلقة.', 'navigate', 'none', '/wishlists', 'Wishlists', 'قوائم الرغبات'),
      action('share_public_wishlist', 'Share public wishlist', 'مشاركة قائمة رغبات عامة', 'Explain the verified sharing requirements and open Wishlists for final review.', 'شرح متطلبات المشاركة الموثقة وفتح قوائم الرغبات للمراجعة النهائية.', 'guide', 'required', '/wishlists', 'Wishlists / Share', 'قوائم الرغبات / مشاركة', [field('wishlist', 'Wishlist', 'قائمة الرغبات', 'text', true, 'Identify the list to share.', 'حدد القائمة المطلوب مشاركتها.')], { adapter: 'wishlist_share', preconditionsEn: ['The wishlist must be public and allow sharing.'], preconditionsAr: ['يجب أن تكون قائمة الرغبات عامة وأن تسمح بالمشاركة.'] }),
    ],
  },
  settings: {
    capabilityId: 'settings',
    titleEn: 'Settings',
    titleAr: 'الإعدادات',
    actions: [
      action('open_settings', 'Open Settings', 'فتح الإعدادات', 'Open the Wakti settings screen.', 'فتح شاشة إعدادات وكتي.', 'navigate', 'none', '/settings', 'Settings', 'الإعدادات'),
      action('change_theme', 'Change theme', 'تغيير المظهر', 'Open Settings ready to review a light or dark theme change.', 'فتح الإعدادات جاهزة لمراجعة تغيير المظهر الفاتح أو الداكن.', 'guide', 'required', '/settings', 'Settings', 'الإعدادات', [field('theme', 'Theme', 'المظهر', 'choice', true, 'Choose light or dark.', 'اختر فاتح أو داكن.', { allowedValues: ['light', 'dark'] })]),
      action('change_language', 'Change language', 'تغيير اللغة', 'Open Settings ready to review the app language.', 'فتح الإعدادات جاهزة لمراجعة لغة التطبيق.', 'guide', 'required', '/settings', 'Settings', 'الإعدادات', [field('language', 'Language', 'اللغة', 'choice', true, 'Choose the app language.', 'اختر لغة التطبيق.', { allowedValues: ['en', 'ar'] })]),
      action('manage_account_settings', 'Manage account settings', 'إدارة إعدادات الحساب', 'Open Settings for an account-related change that needs final user review.', 'فتح الإعدادات لتغيير متعلق بالحساب يحتاج مراجعة المستخدم النهائية.', 'guide', 'required', '/settings', 'Settings', 'الإعدادات', [field('setting', 'Setting', 'الإعداد', 'text', true, 'State the setting to review.', 'حدد الإعداد المطلوب مراجعته.')]),
    ],
  },
  help: {
    capabilityId: 'help',
    titleEn: 'Help',
    titleAr: 'المساعدة',
    actions: [
      action('open_help', 'Open Help', 'فتح المساعدة', 'Open the Wakti Help screen.', 'فتح شاشة مساعدة وكتي.', 'navigate', 'none', '/help', 'Help', 'المساعدة'),
      action('get_feature_help', 'Get feature help', 'الحصول على مساعدة لميزة', 'Open Help with the requested Wakti feature in mind.', 'فتح المساعدة مع تحديد ميزة وكتي المطلوبة.', 'guide', 'none', '/help', 'Help', 'المساعدة', [field('topic', 'Feature or task', 'الميزة أو المهمة', 'text', true, 'State the feature or task that needs help.', 'حدد الميزة أو المهمة التي تحتاج مساعدة.')]),
    ],
  },
};

export function getWaktiExecutionSchema(capabilityId?: WaktiCapabilityId | null): WaktiExecutionSchema | null {
  if (!capabilityId) return null;
  return WAKTI_EXECUTION_SCHEMAS[capabilityId] || null;
}

export function getWaktiExecutionActions(capabilityId?: WaktiCapabilityId | null): WaktiExecutionAction[] {
  return getWaktiExecutionSchema(capabilityId)?.actions || [];
}

export function getWaktiExecutionAction(capabilityId?: WaktiCapabilityId | null, actionId?: string | null): WaktiExecutionAction | null {
  if (!actionId) return null;
  return getWaktiExecutionActions(capabilityId).find((item) => item.id === actionId) || null;
}

export function getWaktiExecutionActionDetails(actionSchema: WaktiExecutionAction, language: 'ar' | 'en'): WaktiExecutionActionDetails {
  return {
    id: actionSchema.id,
    label: language === 'ar' ? actionSchema.labelAr : actionSchema.labelEn,
    description: language === 'ar' ? actionSchema.descriptionAr : actionSchema.descriptionEn,
    target: language === 'ar' ? actionSchema.targetAr : actionSchema.targetEn,
    result: language === 'ar' ? actionSchema.resultAr : actionSchema.resultEn,
    route: actionSchema.route,
    executionMode: actionSchema.executionMode,
    approval: actionSchema.approval,
    adapter: actionSchema.adapter,
    backend: actionSchema.backend,
    fields: actionSchema.fields.map((item) => ({
      key: item.key,
      label: language === 'ar' ? item.labelAr : item.labelEn,
      help: language === 'ar' ? item.helpAr : item.helpEn,
      type: item.type,
      required: item.required,
      requiredWhen: item.requiredWhen,
      defaultValue: item.defaultValue,
      allowedValues: item.allowedValues,
      choices: item.choices?.map((group) => ({
        id: group.id,
        label: language === 'ar' ? group.labelAr : group.labelEn,
        choices: group.choices.map((choice) => ({
          value: choice.value,
          label: language === 'ar' ? choice.labelAr : choice.labelEn,
          description: language === 'ar' ? choice.descriptionAr : choice.descriptionEn,
        })),
      })) || (item.allowedValues?.length
        ? [{
            id: `${item.key}-options`,
            label: language === 'ar' ? 'الخيارات' : 'Options',
            choices: item.allowedValues.map((value) => ({ value, label: value })),
          }]
        : []),
      choiceSource: item.choiceSource,
    })),
    preconditions: language === 'ar' ? actionSchema.preconditionsAr : actionSchema.preconditionsEn,
    stages: actionSchema.stages.map((item) => ({
      id: item.id,
      label: language === 'ar' ? item.labelAr : item.labelEn,
      detail: language === 'ar' ? item.detailAr : item.detailEn,
    })),
  };
}

function isWaktiExecutionFieldRequired(fieldSchema: WaktiExecutionField, values: Record<string, WaktiExecutionFieldValue | undefined>) {
  if (fieldSchema.required) return true;
  if (!fieldSchema.requiredWhen) return false;
  const match = fieldSchema.requiredWhen.match(/^([A-Za-z0-9_]+) is (.+)$/);
  if (!match) return false;
  const [, sourceKey, expectedValue] = match;
  const sourceValue = values[sourceKey];
  return typeof sourceValue === 'string' && sourceValue.toLowerCase() === expectedValue.trim().toLowerCase();
}

export function getWaktiExecutionMissingFields(
  actionSchema: WaktiExecutionAction,
  values: Record<string, WaktiExecutionFieldValue | undefined>,
) {
  return actionSchema.fields.filter((fieldSchema) => {
    if (!isWaktiExecutionFieldRequired(fieldSchema, values)) return false;
    const value = values[fieldSchema.key];
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'boolean') return false;
    return !value?.trim();
  });
}

export function buildWaktiExecutionKnowledgeManifest(language: 'ar' | 'en') {
  return Object.values(WAKTI_EXECUTION_SCHEMAS)
    .flatMap((schema) => schema.actions.map((item) => {
      const fields = item.fields.map((fieldSchema) => {
        const requirement = `${fieldSchema.key}${fieldSchema.required ? '*' : ''}${fieldSchema.requiredWhen ? `(${fieldSchema.requiredWhen})` : ''}`;
        const options = fieldSchema.choiceSource
          ? `{${fieldSchema.choiceSource}}`
          : fieldSchema.allowedValues?.length
            ? `{${fieldSchema.allowedValues.join('|')}}`
            : '';
        return `${requirement}${options}`;
      }).join(',') || 'none';
      const label = language === 'ar' ? item.labelAr : item.labelEn;
      const target = language === 'ar' ? item.targetAr : item.targetEn;
      return `${schema.capabilityId}/${item.id}|mode=${item.executionMode}|approval=${item.approval}|fields=${fields}|target=${target}|action=${label}`;
    }))
    .join('\n');
}

export function isWaktiExecutionAction(capabilityId: WaktiCapabilityId | null | undefined, actionId: string | null | undefined) {
  return Boolean(getWaktiExecutionAction(capabilityId, actionId));
}
