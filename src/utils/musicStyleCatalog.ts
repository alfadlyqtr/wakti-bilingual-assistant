export interface WaktiMusicStyleGroup {
  id: string;
  titleEn: string;
  titleAr: string;
  itemsEn: string[];
  itemsAr: string[];
}

export const WAKTI_MUSIC_STYLE_GROUPS: WaktiMusicStyleGroup[] = [
  { id: 'khaleeji-core', titleEn: 'Khaleeji — Core', titleAr: 'خليجي — أساسي', itemsEn: ['Khaleeji Pop', 'Khaleeji Romantic', 'Khaleeji Elegant', 'Khaleeji Party', 'Khaleeji Wedding', 'Khaleeji Rap'], itemsAr: ['بوب خليجي', 'خليجي رومانسي', 'خليجي أنيق', 'خليجي حفلات', 'خليجي أعراس', 'خليجي راب'] },
  { id: 'khaleeji-crossover', titleEn: 'Khaleeji — Radio & Crossover', titleAr: 'خليجي — راديو وكروس أوفر', itemsEn: ['Khaleeji Radio Pop', 'Khaleeji Dance Pop', 'Khaleeji Electro Pop', 'Khaleeji Synth Pop', 'Modern Khaleeji Fusion', 'English Khaleeji Pop'], itemsAr: ['خليجي إذاعي', 'خليجي دانس', 'خليجي إلكتروني', 'خليجي سينث بوب', 'فيوجن خليجي', 'إنجليزي بطابع خليجي'] },
  { id: 'khaleeji-rich', titleEn: 'Khaleeji — Rich', titleAr: 'خليجي — ريتش', itemsEn: ['Khaleeji R&B Pop', 'Luxury Khaleeji Pop', 'Khaleeji Cinematic', 'Khaleeji Anthem'], itemsAr: ['خليجي آر أند بي', 'خليجي فاخر', 'خليجي سينمائي', 'خليجي جماهيري'] },
  { id: 'khaleeji-heritage', titleEn: 'Khaleeji — Heritage', titleAr: 'خليجي — تراثي', itemsEn: ['Khaleeji Traditional', 'Sheilat', 'Samri', 'Ardah', 'Jalsa', 'Liwa', 'Khaleeji Shaabi', 'Zar', 'Khaleeji Trap'], itemsAr: ['خليجي تراثي', 'شيلات', 'سامري', 'جلسة', 'ليوان', 'شعبي خليجي'] },
  { id: 'regional', titleEn: 'Others', titleAr: 'أنماط أخرى', itemsEn: ['Egyptian', 'Egyptian Shaabi', 'Iraqi Style', 'Lebanese Style', 'Moroccan Style', 'Turkish'], itemsAr: ['مصري', 'شعبي مصري', 'عراقي', 'لبناني', 'مغربي', 'تركي', 'مهرجانات', 'شامي'] },
  { id: 'islamic', titleEn: 'Islamic', titleAr: 'إسلامي', itemsEn: ['Anasheed'], itemsAr: ['أناشيد'] },
  { id: 'poetry', titleEn: 'Poetry / Spoken', titleAr: 'الشعر والإلقاء', itemsEn: ['GCC Poem', 'Arabic Poem', 'English Poem'], itemsAr: ['قصيدة خليجية', 'قصيدة عربية فصحى', 'قصيدة إنجليزية'] },
  { id: 'pop', titleEn: 'Pop', titleAr: 'بوب وحديث', itemsEn: ['pop', 'Dance Pop', 'Teen Pop', 'Power Pop', 'Pop Rock', 'Indie Pop', 'Bubblegum Pop', 'K-Pop', 'J-Pop', 'Latin Pop', '80s pop', '90s pop', 'Synthpop', 'Electropop'], itemsAr: ['بوب', 'دانس بوب', 'تين بوب', 'باور بوب', 'بوب روك', 'إندي بوب', 'آر آند بي', 'نيو سول', 'ديسكو معاصر', 'سينث بوب', 'إلكترو بوب', 'بوب الثمانينات', 'بوب التسعينات', 'كي-بوب', 'جي-بوب', 'لاتن بوب'] },
  { id: 'soul', titleEn: 'R&B / Soul / Funk', titleAr: 'سول وفنك وديسكو', itemsEn: ['R&B', 'soul', 'Neo-Soul', 'Contemporary R&B', 'Motown', 'funk', 'disco', 'New Jack Swing', 'Quiet Storm', 'Blue-eyed Soul'], itemsAr: ['سول', 'نيو سول', 'فنك', 'ديسكو', 'موتاون', 'نيو جاك سوينج', 'كوايت ستورم', 'آر آند بي معاصر'] },
  { id: 'hip-hop', titleEn: 'Hip-Hop / Rap', titleAr: 'هيب هوب وراب', itemsEn: ['hip hop', 'rap', 'Trap', 'Drill', 'Boom Bap', 'Conscious Hip Hop', 'Gangsta Rap', 'East Coast Hip Hop', 'West Coast Hip Hop', 'Southern Hip Hop', 'Alternative Hip Hop', 'Cloud Rap', 'Crunk'], itemsAr: ['هيب هوب', 'راب', 'تراب', 'درِل', 'بوم باب', 'راب واعٍ', 'غانجستا راب', 'كلاود راب', 'ساوذرن هيب هوب'] },
  { id: 'urban-world', titleEn: 'Urban / World', titleAr: 'إيقاعي وعالمي', itemsEn: ['Afrobeats', 'Afrobeat', 'Reggaeton', 'Latin', 'Salsa', 'Bachata', 'Merengue', 'Tango', 'Samba', 'Cumbia', 'Bossa Nova', 'Bollywood', 'Bhangra', 'Latin Rock'], itemsAr: ['أفروبيتس', 'أفروبيت', 'ريغيتون', 'لاتين', 'سالسا', 'باتشاتا', 'ميرينغي', 'تانغو', 'سامبا', 'كومبيا', 'بوسا نوفا', 'بوليوود', 'بهانغرا'] },
  { id: 'rock', titleEn: 'Rock', titleAr: 'روك', itemsEn: ['rock', 'Classic Rock', 'rock and roll', 'soft rock', 'Hard Rock', 'alternative rock', 'indie rock', 'Progressive Rock', 'Psychedelic Rock', 'Garage Rock', 'Glam Rock', 'grunge', 'Britpop', 'Shoegaze', 'Post-Rock', 'Math Rock', 'Surf Rock', 'Dream Pop'], itemsAr: ['روك', 'روك كلاسيك', 'روك آند رول', 'سوفت روك', 'روك بديل', 'إندي روك', 'روك تقدمي', 'روك نفسي', 'هارد روك', 'غاراج روك', 'غلام روك', 'غرانج', 'بريت بوب', 'شوغيز', 'بوست روك', 'ماث روك', 'سيرف روك'] },
  { id: 'metal', titleEn: 'Metal', titleAr: 'ميتال', itemsEn: ['heavy metal', 'thrash metal', 'Death Metal', 'Black Metal', 'Power Metal', 'Doom Metal', 'Gothic Metal', 'Symphonic Metal', 'Progressive Metal', 'Speed Metal'], itemsAr: ['ميتال ثقيل', 'ثراش ميتال', 'ديث ميتال', 'بلاك ميتال', 'باور ميتال', 'دووم ميتال', 'غوثيك ميتال', 'سيمفوني ميتال', 'برو ميتال'] },
  { id: 'punk', titleEn: 'Punk', titleAr: 'بانك وإيمو', itemsEn: ['punk rock', 'Pop Punk', 'Hardcore Punk', 'Ska Punk', 'Emo', 'Screamo', 'New Wave'], itemsAr: ['بانك روك', 'بوب بانك', 'هارد كور بانك', 'سكا بانك', 'إيمو', 'سكريمو'] },
  { id: 'roots', titleEn: 'Roots / Americana', titleAr: 'جذور وتراث', itemsEn: ['country', 'Country Pop', 'Outlaw Country', 'Country Rock', 'Alternative Country', 'Honky Tonk', 'Western Swing', 'Americana', 'Contemporary Country', 'bluegrass', 'folk', 'Indie Folk', 'Folk Rock', 'Folk Pop', 'Folk Punk', 'Protest Folk'], itemsAr: ['كانتري', 'كانتري بوب', 'بلوغراس', 'فولك', 'فولك روك', 'فولك إندي', 'فولك بوب', 'أمريكانا', 'كانتري أوت لاو', 'كانتري روك'] },
  { id: 'jazz', titleEn: 'Jazz', titleAr: 'جاز', itemsEn: ['jazz', 'Bebop', 'swing', 'smooth jazz', 'Cool Jazz', 'Jazz Fusion', 'Latin Jazz', 'Jazz Funk', 'Hard Bop', 'Acid Jazz', 'Free Jazz', 'Big Band'], itemsAr: ['جاز', 'بيباب', 'سوينج', 'جاز ناعم', 'جاز بارد', 'فيوجن جاز', 'جاز لاتيني', 'جاز فنك', 'هارد باب', 'جاز حر'] },
  { id: 'blues', titleEn: 'Blues', titleAr: 'بلوز', itemsEn: ['blues', 'delta blues', 'Chicago Blues', 'Electric Blues', 'Blues Rock', 'Texas Blues', 'Memphis Blues', 'Jump Blues', 'Boogie-Woogie', 'Country Blues'], itemsAr: ['بلوز', 'بلوز دلتا', 'بلوز شيكاغو', 'بلوز كهربائي', 'بلوز روك', 'تكساس بلوز', 'جامب بلوز', 'بوغي ووغي'] },
  { id: 'reggae', titleEn: 'Reggae', titleAr: 'ريغي', itemsEn: ['reggae', 'Roots Reggae', 'Dancehall', 'ska', 'dub', 'Reggae Fusion', 'Lovers Rock', 'Ragga'], itemsAr: ['ريغي', 'روتس ريغي', 'دانس هول', 'سكا', 'داب', 'ريغي فيوجن', 'راغا موفن'] },
  { id: 'classical', titleEn: 'Classical / Orchestral', titleAr: 'كلاسيكي وأوركسترالي', itemsEn: ['classical', 'Baroque', 'Romantic', 'Contemporary Classical', 'Symphony', 'Opera', 'Chamber Music', 'Choral', 'Gregorian Chant'], itemsAr: ['كلاسيكي', 'باروك', 'رومانسي', 'معاصر كلاسيكي', 'سيمفوني', 'أوبرا', 'موسيقى غرفة', 'كورال'] },
  { id: 'electronic', titleEn: 'Electronic / Dance', titleAr: 'إلكتروني ودانس', itemsEn: ['Lo-Fi', 'House', 'Deep House', 'Tech House', 'Trance', 'Techno', 'Dubstep', 'Drum & Bass', 'EDM', 'Electro', 'Hardcore', 'IDM', 'ambient', 'synthwave', 'chillwave', 'Vaporwave', 'Glitch', 'Witch House', 'Grime', 'UK Garage', '2-Step', 'Electro Swing', 'Chiptune'], itemsAr: ['لوفاي', 'هاوس', 'ديب هاوس', 'تيك هاوس', 'ترانس', 'تيكنو', 'دبسْتِب', 'درَم آند بَيس', 'إي دي إم', 'إلكترو', 'هارد كور إلكتروني', 'آيدي إم', 'أمبيينت', 'سينث ويف', 'تشيل ويف', 'فيبور ويف', 'غلتش', 'غريم', 'يو كي غاراج', 'إلكترو سوينج', 'شيبتيون'] },
  { id: 'world', titleEn: 'World', titleAr: 'موسيقى عالمية', itemsEn: ['Flamenco', 'Fado', 'Celtic', 'gospel', 'Ragtime', 'Zydeco', 'Cajun', 'Industrial', 'Bhangra', 'Afrobeat'], itemsAr: ['فلامنكو', 'فادو', 'سيلتيك', 'أفروبيت', 'جوجو نيجيري', 'بهانغرا', 'موسيقى عالم'] },
  { id: 'other', titleEn: 'Other', titleAr: 'أخرى', itemsEn: [], itemsAr: ['غوسبل', 'جاز سوينغ', 'بيغ باند', 'راغتايم', 'ديسكو', 'زيديكو', 'صوت جديد', 'إيندستريال'] },
];

export function getWaktiMusicStyleGroups(language: 'ar' | 'en') {
  return WAKTI_MUSIC_STYLE_GROUPS.map((group) => ({
    id: group.id,
    title: language === 'ar' ? group.titleAr : group.titleEn,
    items: language === 'ar' ? group.itemsAr : group.itemsEn,
  })).filter((group) => group.items.length > 0);
}

export function getWaktiMusicStyleValues(language: 'ar' | 'en') {
  return getWaktiMusicStyleGroups(language).flatMap((group) => group.items);
}
