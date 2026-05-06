/**
 * Multi-city dataset — frontend-only.
 *
 * Bundles Lisbon (the existing dataset) with Porto. Future cities go here.
 * Scenario A's `/lisbon` page continues to consume `lisbon-data.ts`
 * directly so this PR ships without touching the production page; new
 * surfaces (CommandPalette, DesignNav, future `/[city]` route) read
 * cities through this module.
 *
 * Coordinates `x` / `y` are SVG canvas units, NOT geographic.
 * `bestHours` are 0–23 local ints. `lastVerified` is ISO date-only.
 */

import {
  WEB_CATS,
  WEB_CITY as LISBON_CITY,
  WEB_EXPS as LISBON_EXPS,
  type WebCategoryId,
  type WebExperience,
} from "./lisbon-data";

export interface WebCityMapLabel {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly muted?: boolean;
}

/** Optional per-city overrides for WebCityMap. All path strings live in
 *  the same 1000×700 SVG canvas as the experience x/y coordinates. */
export interface WebCityMapConfig {
  /** Filled water polygon (river / sea / harbor). Should close into the
   *  bottom-right of the canvas to match the existing Lisbon framing. */
  readonly riverPath?: string;
  /** Single-stroke top edge of the water for the riverbank line. */
  readonly riverEdgePath?: string;
  /** Optional ribbon route (e.g. tram line) drawn dashed in amber. */
  readonly ribbonPath?: string;
  /** Neighborhood / landmark text labels rendered in mono uppercase. */
  readonly labels?: readonly WebCityMapLabel[];
  /** Single accent landmark icon placed at (x, y); used by Lisbon's castle. */
  readonly landmark?: {
    readonly x: number;
    readonly y: number;
    readonly d: string;
  };
  /** Optional concentric contour ellipses rendered behind the landmark. */
  readonly contour?: {
    readonly cx: number;
    readonly cy: number;
    readonly radii: readonly { readonly rx: number; readonly ry: number }[];
  };
}

export interface WebCity {
  readonly slug: string;
  readonly zh: string;
  readonly en: string;
  readonly country: string;
  readonly countryZh: string;
  readonly tagline: string;
  readonly taglineZh: string;
  readonly experienceCount: number;
  readonly experiences: readonly WebExperience[];
  readonly mapConfig?: WebCityMapConfig;
}

const PORTO_EXPS: readonly WebExperience[] = [
  {
    id: "porto-livraria-lello",
    title: "Climb the red staircase before the photographers arrive",
    titleZh: "在拍照人群到来之前爬上那道红楼梯",
    place: "Livraria Lello",
    placeZh: "莱罗书店",
    cat: "bookshop",
    x: 420,
    y: 320,
    walkMin: 9,
    neighborhood: "Vitória",
    bestHours: [9, 10],
    durationMin: 30,
    why: "The most photographed bookshop in the world. Open at 9, get in line at 8:50, and you'll have the staircase to yourself for ten minutes.",
    whyZh: "世界上被拍最多的书店。九点开门，八点五十排队，你能独享那道楼梯十分钟。",
    moment: "There's a tiny brass plaque on the third step. Most people miss it.",
    momentZh: "第三级踏板上有一块小铜片。多数人不会注意到。",
    crowd: "calm",
    soloScore: 8,
    sources: 11,
    lastVerified: "2026-04-19",
    aiReason:
      "You spent time in Bertrand in Lisbon. Lello is the next page of that conversation — same century, different argument.",
    aiReasonZh:
      "你在里斯本的贝特朗书店停留过。Lello 是同一段对话的下一页——同一个世纪，不同的论点。",
    tags: ["early", "queue", "5€ refundable"],
    tagsZh: ["早起", "需排队", "5 欧可退"],
    pricePill: "€5",
  },
  {
    id: "porto-ribeira-walk",
    title: "Walk the Douro at golden hour",
    titleZh: "在金色时分沿杜罗河走一程",
    place: "Ribeira",
    placeZh: "里贝拉河岸",
    cat: "walk",
    x: 540,
    y: 540,
    walkMin: 12,
    neighborhood: "Ribeira",
    bestHours: [18, 19, 20],
    durationMin: 60,
    why: "The river bends and the buildings on the opposite bank turn copper. Cross the Dom Luís bridge on the upper deck — the view is the entire city.",
    whyZh: "河水转弯，对岸的楼变成铜色。从 Dom Luís 桥的上层走过去——视野是整座城市。",
    moment: "A man with an accordion plays at the bend. Drop a coin, don't stop.",
    momentZh: "一个拉手风琴的人在转弯处演奏。放一枚硬币，别停下脚步。",
    crowd: "busy",
    soloScore: 9,
    sources: 17,
    lastVerified: "2026-04-26",
    aiReason:
      "You walked the Tagus at sunset. The Douro does the same trick, but the bridge does it better.",
    aiReasonZh: "你在日落时沿 Tagus 河走过。Douro 是同一招，但那座桥让它更好看。",
    tags: ["sunset", "free", "no booking"],
    tagsZh: ["日落", "免费", "不用预订"],
    pricePill: "€0",
  },
  {
    id: "porto-majestic-cafe",
    title: "Order a tostada mista like it's 1921",
    titleZh: "像 1921 年那样点一份热三明治",
    place: "Café Majestic",
    placeZh: "马杰斯蒂克咖啡馆",
    cat: "cafe",
    x: 480,
    y: 360,
    walkMin: 8,
    neighborhood: "Santa Catarina",
    bestHours: [10, 11, 16, 17],
    durationMin: 45,
    why: "Art-Nouveau interior since 1921. Yes, J.K. Rowling wrote here. Order the tostada mista; the coffee is fine but the room is the point.",
    whyZh:
      "1921 年至今的新艺术风格内饰。是的，J.K. 罗琳曾在这里写作。点一份 tostada mista——咖啡尚可，但重要的是这个房间。",
    moment: "The waiter will fold your napkin three times before he leaves.",
    momentZh: "服务员离开前会把你的餐巾叠三遍。",
    crowd: "calm",
    soloScore: 7,
    sources: 9,
    lastVerified: "2026-04-15",
    aiReason:
      "Origin stories again. This one is shorter than Pastéis de Belém, but more people sat with their notebooks open here.",
    aiReasonZh: "又一个起源故事。比贝伦蛋挞短，但有更多人在这里摊开过笔记本。",
    tags: ["heritage", "indoors", "rainy day"],
    tagsZh: ["历史建筑", "室内", "下雨天"],
    pricePill: "€8–14",
  },
  {
    id: "porto-azulejos",
    title: "Read the entire history of a country in tiles",
    titleZh: "在瓷砖上读完一个国家的历史",
    place: "São Bento Station",
    placeZh: "圣本图火车站",
    cat: "hidden",
    x: 460,
    y: 380,
    walkMin: 6,
    neighborhood: "Aliados",
    bestHours: [8, 9, 17, 18],
    durationMin: 25,
    why: "20,000 azulejo tiles, painted between 1905 and 1916, telling Portugal's history. It's a working train station; you don't need a ticket to look up.",
    whyZh:
      "两万块阿苏莱霍瓷砖，1905 到 1916 年绘制，讲述葡萄牙的历史。这是一座运营中的火车站，不需要票就能抬头看。",
    moment: "Find the panel with the queen — she's looking the wrong way on purpose.",
    momentZh: "找那块画着王后的瓷砖——她故意看错了方向。",
    crowd: "calm",
    soloScore: 9,
    sources: 8,
    lastVerified: "2026-04-21",
    aiReason:
      "You linger on details. This is a place where the detail IS the place — there's nothing to do but read.",
    aiReasonZh: "你喜欢停留在细节上。这里的细节就是这个地方——除了读，什么都不用做。",
    tags: ["free", "any weather", "5 minutes works"],
    tagsZh: ["免费", "全天气", "五分钟也行"],
    pricePill: "free",
  },
  {
    id: "porto-vinho-do-porto",
    title: "Cross the river for a port tasting",
    titleZh: "过河喝一杯波特酒",
    place: "Taylor's · Vila Nova de Gaia",
    placeZh: "泰勒酒窖 · 加亚新城",
    cat: "food",
    x: 580,
    y: 600,
    walkMin: 22,
    neighborhood: "Gaia",
    bestHours: [15, 16, 17],
    durationMin: 75,
    why: "Cellars older than the United States. The standard tasting is fine; the vintage tasting is what people fly here for. Reserve online — walk-ins wait.",
    whyZh: "比美国还老的酒窖。普通品鉴还行；年份品鉴才是人们飞来这里的理由。网上预订——临时来要等。",
    moment:
      "The guide will tell you to look for caramel in the 30-year. Don't agree out loud unless you mean it.",
    momentZh: "导览员会让你在 30 年陈酒里找焦糖味。别勉强附和——除非你真的尝到了。",
    crowd: "calm",
    soloScore: 8,
    sources: 14,
    lastVerified: "2026-04-23",
    aiReason:
      "You picked Tasca do Chico in Lisbon — places where solo at the bar works. The cellar tasting room is shaped like that, only standing.",
    aiReasonZh: "你在里斯本选了 Tasca do Chico——独自坐吧台的地方。这家品鉴室是同款，只是站着。",
    tags: ["reservation", "afternoon", "Vintage"],
    tagsZh: ["需预订", "下午", "年份酒"],
    pricePill: "€18–45",
  },
];

const PORTO_CITY: WebCity = {
  slug: "porto",
  zh: "波尔图",
  en: "Porto",
  country: "Portugal",
  countryZh: "葡萄牙",
  tagline: "A river, six bridges, and a wine that takes its name from the city.",
  taglineZh: "一条河，六座桥，一种以这座城市命名的酒。",
  experienceCount: PORTO_EXPS.length,
  experiences: PORTO_EXPS,
  mapConfig: {
    // Douro flows roughly W-E on the south of the city; Porto sits on
    // the north bank. The drawn river is wider/lower than Lisbon's.
    riverPath:
      "M -20 580 C 200 565, 400 580, 600 600 C 760 615, 880 622, 1020 624 L 1020 720 L -20 720 Z",
    riverEdgePath: "M -20 580 C 200 565, 400 580, 600 600 C 760 615, 880 622, 1020 624",
    // Dom Luís bridge — short straight line spanning the river near Ribeira.
    ribbonPath: "M 460 540 L 600 590",
    labels: [
      { text: "VITÓRIA", x: 420, y: 300 },
      { text: "ALIADOS", x: 470, y: 360 },
      { text: "STA. CATARINA", x: 520, y: 340 },
      { text: "RIBEIRA", x: 540, y: 510 },
      { text: "GAIA", x: 620, y: 640, muted: true },
      { text: "RIO DOURO", x: 800, y: 615, muted: true },
    ],
  },
};

const LISBON_AS_CITY: WebCity = {
  slug: LISBON_CITY.slug,
  zh: LISBON_CITY.zh,
  en: LISBON_CITY.en,
  country: LISBON_CITY.country,
  countryZh: LISBON_CITY.countryZh,
  tagline: LISBON_CITY.tagline,
  taglineZh: LISBON_CITY.taglineZh,
  experienceCount: LISBON_EXPS.length,
  experiences: LISBON_EXPS,
  mapConfig: {
    // River Tagus — bottom-right curve, matches the original Lisbon map.
    riverPath:
      "M -20 540 C 200 530, 380 555, 560 590 C 720 620, 880 640, 1020 645 L 1020 720 L -20 720 Z",
    riverEdgePath: "M -20 540 C 200 530, 380 555, 560 590 C 720 620, 880 640, 1020 645",
    // Tram 28 historic loop.
    ribbonPath: "M 240 410 Q 380 380 480 410 Q 580 430 700 360 Q 760 320 800 250",
    labels: [
      { text: "CASTELO", x: 640, y: 245 },
      { text: "CHIADO", x: 430, y: 380 },
      { text: "BAIRRO ALTO", x: 490, y: 450 },
      { text: "ALFAMA", x: 700, y: 335 },
      { text: "GRAÇA", x: 610, y: 270 },
      { text: "BELÉM", x: 240, y: 540, muted: true },
      { text: "RIO TEJO", x: 800, y: 618, muted: true },
    ],
    landmark: {
      x: 640,
      y: 290,
      d: "M -16 0 L -16 -10 L -10 -10 L -10 -14 L -4 -14 L -4 -10 L 4 -10 L 4 -14 L 10 -14 L 10 -10 L 16 -10 L 16 0 Z",
    },
    contour: {
      cx: 640,
      cy: 290,
      radii: [
        { rx: 80, ry: 55 },
        { rx: 60, ry: 42 },
        { rx: 40, ry: 28 },
      ],
    },
  },
};

export const CITIES: Readonly<Record<string, WebCity>> = {
  lisbon: LISBON_AS_CITY,
  porto: PORTO_CITY,
};

export const CITY_ORDER: readonly string[] = ["lisbon", "porto"];

export function findCity(slug: string): WebCity | undefined {
  return CITIES[slug];
}

export function findExperienceAcrossCities(
  expId: string,
): { readonly city: WebCity; readonly exp: WebExperience } | undefined {
  for (const slug of CITY_ORDER) {
    const city = CITIES[slug];
    if (!city) continue;
    const exp = city.experiences.find((e) => e.id === expId);
    if (exp) return { city, exp };
  }
  return undefined;
}

export { WEB_CATS, type WebCategoryId, type WebExperience };
