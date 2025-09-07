
export interface Country {
  name: string;
  code: string;
  nameAr: string;
}

export const countries: Country[] = [
  // Popular Middle East countries first
  { name: "Qatar", code: "QA", nameAr: "قطر" },
  { name: "United Arab Emirates", code: "AE", nameAr: "الإمارات العربية المتحدة" },
  { name: "Saudi Arabia", code: "SA", nameAr: "المملكة العربية السعودية" },
  { name: "Kuwait", code: "KW", nameAr: "الكويت" },
  { name: "Bahrain", code: "BH", nameAr: "البحرين" },
  { name: "Oman", code: "OM", nameAr: "عُمان" },
  { name: "Jordan", code: "JO", nameAr: "الأردن" },
  { name: "Lebanon", code: "LB", nameAr: "لبنان" },
  
  // Alphabetical list of other countries
  { name: "Afghanistan", code: "AF", nameAr: "أفغانستان" },
  { name: "Albania", code: "AL", nameAr: "ألبانيا" },
  { name: "Algeria", code: "DZ", nameAr: "الجزائر" },
  { name: "Argentina", code: "AR", nameAr: "الأرجنتين" },
  { name: "Australia", code: "AU", nameAr: "أستراليا" },
  { name: "Austria", code: "AT", nameAr: "النمسا" },
  { name: "Bangladesh", code: "BD", nameAr: "بنغلاديش" },
  { name: "Belgium", code: "BE", nameAr: "بلجيكا" },
  { name: "Brazil", code: "BR", nameAr: "البرازيل" },
  { name: "Canada", code: "CA", nameAr: "كندا" },
  { name: "China", code: "CN", nameAr: "الصين" },
  { name: "Colombia", code: "CO", nameAr: "كولومبيا" },
  { name: "Denmark", code: "DK", nameAr: "الدنمارك" },
  { name: "Egypt", code: "EG", nameAr: "مصر" },
  { name: "Ethiopia", code: "ET", nameAr: "إثيوبيا" },
  { name: "Finland", code: "FI", nameAr: "فنلندا" },
  { name: "France", code: "FR", nameAr: "فرنسا" },
  { name: "Germany", code: "DE", nameAr: "ألمانيا" },
  { name: "Ghana", code: "GH", nameAr: "غانا" },
  { name: "Greece", code: "GR", nameAr: "اليونان" },
  { name: "India", code: "IN", nameAr: "الهند" },
  { name: "Indonesia", code: "ID", nameAr: "إندونيسيا" },
  { name: "Iran", code: "IR", nameAr: "إيران" },
  { name: "Iraq", code: "IQ", nameAr: "العراق" },
  { name: "Ireland", code: "IE", nameAr: "أيرلندا" },
  { name: "Italy", code: "IT", nameAr: "إيطاليا" },
  { name: "Japan", code: "JP", nameAr: "اليابان" },
  { name: "Kenya", code: "KE", nameAr: "كينيا" },
  { name: "South Korea", code: "KR", nameAr: "كوريا الجنوبية" },
  { name: "Libya", code: "LY", nameAr: "ليبيا" },
  { name: "Malaysia", code: "MY", nameAr: "ماليزيا" },
  { name: "Mexico", code: "MX", nameAr: "المكسيك" },
  { name: "Morocco", code: "MA", nameAr: "المغرب" },
  { name: "Netherlands", code: "NL", nameAr: "هولندا" },
  { name: "New Zealand", code: "NZ", nameAr: "نيوزيلندا" },
  { name: "Nigeria", code: "NG", nameAr: "نيجيريا" },
  { name: "Norway", code: "NO", nameAr: "النرويج" },
  { name: "Pakistan", code: "PK", nameAr: "باكستان" },
  { name: "Palestine", code: "PS", nameAr: "فلسطين" },
  { name: "Peru", code: "PE", nameAr: "بيرو" },
  { name: "Philippines", code: "PH", nameAr: "الفلبين" },
  { name: "Poland", code: "PL", nameAr: "بولندا" },
  { name: "Portugal", code: "PT", nameAr: "البرتغال" },
  { name: "Romania", code: "RO", nameAr: "رومانيا" },
  { name: "Russia", code: "RU", nameAr: "روسيا" },
  { name: "Singapore", code: "SG", nameAr: "سنغافورة" },
  { name: "South Africa", code: "ZA", nameAr: "جنوب أفريقيا" },
  { name: "Spain", code: "ES", nameAr: "إسبانيا" },
  { name: "Sri Lanka", code: "LK", nameAr: "سريلانكا" },
  { name: "Sudan", code: "SD", nameAr: "السودان" },
  { name: "Sweden", code: "SE", nameAr: "السويد" },
  { name: "Switzerland", code: "CH", nameAr: "سويسرا" },
  { name: "Syria", code: "SY", nameAr: "سوريا" },
  { name: "Thailand", code: "TH", nameAr: "تايلاند" },
  { name: "Tunisia", code: "TN", nameAr: "تونس" },
  { name: "Turkey", code: "TR", nameAr: "تركيا" },
  { name: "Ukraine", code: "UA", nameAr: "أوكرانيا" },
  { name: "United Kingdom", code: "GB", nameAr: "المملكة المتحدة" },
  { name: "United States", code: "US", nameAr: "الولايات المتحدة" },
  { name: "Venezuela", code: "VE", nameAr: "فنزويلا" },
  { name: "Vietnam", code: "VN", nameAr: "فيتنام" },
  { name: "Yemen", code: "YE", nameAr: "اليمن" },
];

export const getCountryByCode = (code: string): Country | undefined => {
  return countries.find(country => country.code === code);
};

export const getCountryByName = (name: string): Country | undefined => {
  return countries.find(country => country.name === name);
};
