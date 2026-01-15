import React from "react";

// Allow any string id to support custom user tags
export type TagId = string;

const emojiMap: Record<string, string> = {
  family: "👨‍👩‍👧",
  friends: "👯",
  date: "📅",
  exercise: "🏋️",
  sport: "🏆",
  relax: "😌",
  movies: "🎬",
  gaming: "🎮",
  reading: "📖",
  cleaning: "✨",
  shower: "🚿",
  sleep: "🌙",
  eat_healthy: "🥗",
  shopping: "🛒",
  study: "📚",
  work: "💼",
  music: "🎵",
  meditation: "🧘",
  nature: "🌳",
  travel: "✈️",
  cooking: "🍳",
  walk: "👟",
  socialize: "💬",
  coffee: "☕",
  love: "❤️",
  romance: "💕",
  spouse: "💑",
  prayer: "🤲",
  writing: "✍️",
  horse_riding: "🐴",
  fishing: "🎣",
};

// Intelligent custom tag emoji mapping with keyword matching
const customTagEmojis: Record<string, string> = {
  // Relationships
  wife: "👰", husband: "🤵", partner: "💑", spouse: "💑",
  kids: "👶", children: "👨‍👩‍👧‍👦", baby: "👶", son: "👦", daughter: "👧",
  mom: "👩", dad: "👨", mother: "👩", father: "👨", parents: "👨‍👩‍👧",
  brother: "👨", sister: "👧", sibling: "👥",
  
  // Pets
  pet: "🐾", dog: "🐕", cat: "🐈", puppy: "🐕", kitten: "🐈",
  bird: "🐦", fish: "🐟", hamster: "🐹",
  
  // Health & Fitness
  gym: "💪", workout: "💪", fitness: "💪", health: "❤️‍🩹",
  run: "🏃", running: "🏃", jog: "🏃",
  swim: "🏊", swimming: "🏊",
  bike: "🚴", cycling: "🚴", biking: "🚴",
  yoga: "🧘‍♀️", pilates: "🧘", stretch: "🧘",
  weight: "🏋️", lift: "🏋️", strength: "💪",
  cardio: "❤️", hiit: "💪", crossfit: "🏋️",
  
  // Food & Drink
  food: "🍽️", eat: "🍽️", meal: "🍽️", lunch: "🍽️", dinner: "🍱", breakfast: "🍳",
  pizza: "🍕", burger: "🍔", pasta: "🍝", sushi: "🍱",
  fruit: "🍎", apple: "🍎", banana: "🍌", orange: "🍊",
  veg: "🥗", vegetable: "🥗", salad: "🥗",
  drink: "🥤", water: "💧", juice: "🧃", tea: "🍵",
  wine: "🍷", beer: "🍺", cocktail: "🍹",
  dessert: "🍰", cake: "🍰", ice: "🍦", icecream: "🍦", candy: "🍬",
  
  // Transportation
  car: "🚗", drive: "🚗", driving: "🚗", vehicle: "🚗",
  bus: "🚌", train: "🚆", metro: "🚇", subway: "🚇",
  plane: "✈️", flight: "✈️", airport: "✈️",
  taxi: "🚕", uber: "🚕",
  
  // Activities & Hobbies
  art: "🎨", paint: "🎨", painting: "🎨", draw: "✏️", drawing: "✏️",
  photo: "📸", photography: "📸", camera: "📸", picture: "📸",
  video: "🎥", film: "🎥", movie: "🎬",
  game: "🎮", gaming: "🎮", videogame: "🎮",
  chess: "♟️", puzzle: "🧩", board: "🎲",
  craft: "✂️", sew: "🧵", knit: "🧶",
  garden: "🌱", plant: "🌱", flower: "🌸",
  
  // Work & Study
  code: "💻", coding: "💻", programming: "💻", developer: "💻",
  design: "🎨", designer: "🎨",
  write: "✍️", writing: "✍️", blog: "📝", journal: "📔",
  meeting: "👥", conference: "🎤", presentation: "📊",
  project: "📋", task: "✅", deadline: "⏰",
  
  // Entertainment
  concert: "🎵", show: "🎭", theater: "🎭", theatre: "🎭",
  party: "🎉", celebration: "🎊", birthday: "🎂",
  dance: "💃", dancing: "💃",
  
  // Self-care
  spa: "💆", massage: "💆", relax: "😌", rest: "🛌",
  bath: "🛁", shower: "🚿",
  nap: "😴", sleep: "🌙",
  beauty: "💄", makeup: "💄", hair: "💇",
  
  // Shopping
  shop: "🛍️", shopping: "🛍️", buy: "💳", mall: "🏬",
  groceries: "🛒", grocery: "🛒",
  clothes: "👗", fashion: "👗", outfit: "👔",
  
  // Nature & Outdoors
  hike: "🥾", hiking: "🥾", mountain: "⛰️",
  beach: "🏖️", ocean: "🌊", sea: "🌊",
  park: "🌳", forest: "🌲", camping: "⛺", camp: "⛺",
  sun: "☀️", sunset: "🌅", sunrise: "🌄",
  
  // Social
  date: "📅", dating: "💘",
  friend: "👋", hangout: "🤝", catch: "☕",
  call: "📞", phone: "📞", videocall: "📹", zoom: "💻",
  
  // Money
  money: "💰", cash: "💵", bank: "🏦", pay: "💳", bill: "💸",
  save: "🐷", savings: "🐷", invest: "📈",
  
  // Home
  home: "🏠", house: "🏡", apartment: "🏢",
  clean: "🧹", cleaning: "🧹", laundry: "🧺", wash: "🧼",
  repair: "🔧", fix: "🔨", tool: "🔧",
  organize: "📦", declutter: "🗑️",
};

// Smart keyword matching function
function getSmartEmoji(id: string): string {
  // Check exact match first
  if (customTagEmojis[id]) return customTagEmojis[id];
  
  // Check if tag contains any keywords
  const lowerTag = id.toLowerCase();
  
  // Relationships
  if (lowerTag.includes("wife") || lowerTag.includes("bride")) return "👰";
  if (lowerTag.includes("husband") || lowerTag.includes("groom")) return "🤵";
  if (lowerTag.includes("partner") || lowerTag.includes("relationship")) return "💑";
  if (lowerTag.includes("kid") || lowerTag.includes("child")) return "👶";
  if (lowerTag.includes("family") || lowerTag.includes("fam")) return "👨‍👩‍👧";
  
  // Pets
  if (lowerTag.includes("dog") || lowerTag.includes("pup")) return "🐕";
  if (lowerTag.includes("cat") || lowerTag.includes("kitten")) return "🐈";
  if (lowerTag.includes("pet")) return "🐾";
  
  // Fitness
  if (lowerTag.includes("gym") || lowerTag.includes("workout") || lowerTag.includes("fitness")) return "💪";
  if (lowerTag.includes("run") || lowerTag.includes("jog")) return "🏃";
  if (lowerTag.includes("swim")) return "🏊";
  if (lowerTag.includes("bike") || lowerTag.includes("cycl")) return "🚴";
  if (lowerTag.includes("yoga") || lowerTag.includes("meditation")) return "🧘";
  if (lowerTag.includes("sport")) return "⚽";
  
  // Food
  if (lowerTag.includes("food") || lowerTag.includes("eat") || lowerTag.includes("meal")) return "🍽️";
  if (lowerTag.includes("coffee") || lowerTag.includes("cafe")) return "☕";
  if (lowerTag.includes("pizza")) return "🍕";
  if (lowerTag.includes("burger")) return "🍔";
  if (lowerTag.includes("drink")) return "🥤";
  
  // Work
  if (lowerTag.includes("work") || lowerTag.includes("job") || lowerTag.includes("office")) return "💼";
  if (lowerTag.includes("code") || lowerTag.includes("program")) return "💻";
  if (lowerTag.includes("meeting")) return "👥";
  
  // Study
  if (lowerTag.includes("study") || lowerTag.includes("learn") || lowerTag.includes("school")) return "📚";
  if (lowerTag.includes("read") || lowerTag.includes("book")) return "📖";
  if (lowerTag.includes("write") || lowerTag.includes("writing")) return "✍️";
  
  // Entertainment
  if (lowerTag.includes("game") || lowerTag.includes("gaming")) return "🎮";
  if (lowerTag.includes("movie") || lowerTag.includes("film")) return "🎬";
  if (lowerTag.includes("music") || lowerTag.includes("song")) return "🎵";
  if (lowerTag.includes("party") || lowerTag.includes("celebration")) return "🎉";
  
  // Transportation
  if (lowerTag.includes("car") || lowerTag.includes("drive")) return "🚗";
  if (lowerTag.includes("plane") || lowerTag.includes("flight")) return "✈️";
  if (lowerTag.includes("travel") || lowerTag.includes("trip")) return "✈️";
  
  // Nature
  if (lowerTag.includes("beach") || lowerTag.includes("ocean")) return "🏖️";
  if (lowerTag.includes("mountain") || lowerTag.includes("hike")) return "⛰️";
  if (lowerTag.includes("nature") || lowerTag.includes("outdoor")) return "🌳";
  
  // Shopping
  if (lowerTag.includes("shop")) return "🛍️";
  if (lowerTag.includes("buy") || lowerTag.includes("purchase")) return "💳";
  
  // Default
  return "🏷️";
}

export function TagIcon({ id, className }: { id: string; className?: string }) {
  const emoji = emojiMap[id] || getSmartEmoji(id);
  return <span className={className} style={{ fontSize: '1.1rem', lineHeight: '1' }}>{emoji}</span>;
}
