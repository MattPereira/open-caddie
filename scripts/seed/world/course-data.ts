export type CoursePlan = {
  name: string;
  handle: string;
  character: string;
  pars: number[];
  handicaps: number[];
  tees: {
    name: string;
    color: string;
    rating: string;
    slope: number;
    yardages: number[];
  }[];
};

export const COURSE_PLANS = {
  pebbleBeach: {
    name: "Pebble Beach Golf Links",
    handle: "pebble-beach",
    character:
      "Monterey coastline: tiny seventh green above rocky ocean cliffs, cypress trees, rolling Pacific surf",
    pars: [4, 5, 4, 4, 3, 5, 3, 4, 4, 4, 4, 3, 4, 5, 4, 4, 3, 5],
    handicaps: [6, 10, 12, 16, 14, 2, 18, 4, 8, 3, 9, 17, 7, 1, 13, 11, 15, 5],
    tees: [
      {
        name: "Blue",
        color: "#1d4ed8",
        rating: "74.9",
        slope: 144,
        yardages: [
          378, 509, 397, 333, 189, 498, 107, 416, 483, 444, 370, 202, 401, 559,
          392, 400, 182, 541,
        ],
      },
      {
        name: "Gold",
        color: "#ca8a04",
        rating: "73.4",
        slope: 137,
        yardages: [
          349, 491, 381, 314, 145, 490, 98, 388, 463, 428, 349, 187, 390, 545,
          368, 378, 176, 531,
        ],
      },
      {
        name: "White",
        color: "#e5e7eb",
        rating: "71.7",
        slope: 135,
        yardages: [
          337, 458, 340, 295, 134, 465, 94, 364, 436, 408, 338, 176, 370, 490,
          338, 368, 166, 506,
        ],
      },
    ],
  },
  sawgrass: {
    name: "TPC Sawgrass — THE PLAYERS Stadium Course",
    handle: "tpc-sawgrass",
    character:
      "Florida stadium golf: island seventeenth green, blue water, white bunkers, palms and pines",
    pars: [4, 5, 3, 4, 4, 4, 4, 3, 5, 4, 5, 4, 3, 4, 4, 5, 3, 4],
    handicaps: [11, 15, 17, 9, 3, 13, 1, 7, 5, 12, 8, 16, 18, 4, 6, 10, 14, 2],
    tees: [
      {
        name: "Blue",
        color: "#1d4ed8",
        rating: "73.9",
        slope: 148,
        yardages: [
          394, 507, 160, 359, 446, 360, 407, 195, 546, 392, 519, 332, 156, 436,
          421, 486, 128, 426,
        ],
      },
      {
        name: "White",
        color: "#e5e7eb",
        rating: "70.8",
        slope: 138,
        yardages: [
          360, 469, 134, 324, 422, 333, 382, 168, 522, 351, 469, 296, 141, 377,
          366, 470, 115, 387,
        ],
      },
      {
        name: "Green",
        color: "#15803d",
        rating: "65.8",
        slope: 116,
        yardages: [
          292, 381, 97, 263, 360, 269, 329, 121, 453, 247, 395, 243, 109, 334,
          288, 410, 92, 336,
        ],
      },
    ],
  },
  kapalua: {
    name: "Kapalua Plantation Course",
    handle: "kapalua-plantation",
    character:
      "Maui hillside: sweeping downhill fairways, tropical greenery and distant islands across the Pacific",
    pars: [4, 3, 4, 4, 5, 4, 4, 3, 5, 4, 3, 4, 4, 4, 5, 4, 4, 5],
    handicaps: [1, 17, 3, 11, 13, 15, 5, 9, 7, 12, 16, 14, 4, 18, 6, 10, 2, 8],
    tees: [
      {
        name: "Championship",
        color: "#92400e",
        rating: "75.5",
        slope: 140,
        yardages: [
          470, 219, 379, 382, 526, 397, 522, 199, 514, 348, 161, 424, 383, 301,
          541, 369, 513, 636,
        ],
      },
      {
        name: "Regular",
        color: "#ca8a04",
        rating: "72.8",
        slope: 134,
        yardages: [
          433, 199, 363, 310, 484, 375, 491, 186, 492, 308, 161, 366, 347, 271,
          500, 354, 462, 599,
        ],
      },
      {
        name: "Resort",
        color: "#e5e7eb",
        rating: "70.0",
        slope: 127,
        yardages: [
          433, 173, 345, 212, 445, 312, 480, 170, 440, 277, 144, 321, 296, 263,
          464, 302, 452, 548,
        ],
      },
    ],
  },
  maunaKea: {
    name: "Mauna Kea Golf Course",
    handle: "mauna-kea",
    character:
      "Hawaii Kohala coast: third-hole green across a rocky ocean inlet, black lava, palms, turquoise Pacific",
    pars: [4, 4, 3, 4, 5, 4, 3, 5, 4, 5, 3, 4, 4, 4, 3, 4, 5, 4],
    handicaps: [7, 11, 13, 1, 3, 17, 15, 5, 9, 2, 10, 12, 18, 4, 16, 6, 8, 14],
    tees: [
      {
        name: "Championship",
        color: "#111827",
        rating: "76.8",
        slope: 143,
        yardages: [
          374, 380, 272, 438, 600, 338, 218, 547, 430, 567, 250, 392, 374, 425,
          211, 484, 620, 450,
        ],
      },
      {
        name: "Tournament",
        color: "#1d4ed8",
        rating: "74.0",
        slope: 140,
        yardages: [
          374, 357, 205, 385, 560, 338, 198, 526, 375, 534, 214, 373, 337, 425,
          188, 425, 561, 431,
        ],
      },
      {
        name: "Resort",
        color: "#e5e7eb",
        rating: "71.9",
        slope: 137,
        yardages: [
          353, 336, 179, 357, 518, 315, 188, 493, 342, 509, 206, 340, 326, 405,
          171, 397, 538, 385,
        ],
      },
    ],
  },
  bethpage: {
    name: "Bethpage Black",
    handle: "bethpage-black",
    character:
      "Long Island parkland: towering deciduous trees, huge sculpted bunkers, thick rough and elevated greens",
    pars: [4, 4, 3, 5, 4, 4, 5, 3, 4, 4, 4, 4, 5, 3, 4, 4, 3, 4],
    handicaps: [7, 13, 17, 1, 3, 11, 9, 15, 5, 8, 10, 4, 6, 18, 2, 12, 14, 16],
    tees: [
      {
        name: "Blue",
        color: "#1d4ed8",
        rating: "78.0",
        slope: 155,
        yardages: [
          430, 389, 230, 517, 478, 408, 553, 210, 460, 502, 435, 516, 608, 158,
          484, 490, 207, 411,
        ],
      },
      {
        name: "White",
        color: "#e5e7eb",
        rating: "74.6",
        slope: 149,
        yardages: [
          429, 354, 158, 461, 423, 386, 525, 191, 385, 434, 421, 432, 559, 149,
          430, 457, 195, 368,
        ],
      },
      {
        name: "Yellow",
        color: "#eab308",
        rating: "72.0",
        slope: 144,
        yardages: [
          426, 346, 128, 438, 401, 376, 489, 152, 293, 377, 412, 403, 472, 136,
          417, 431, 178, 332,
        ],
      },
    ],
  },
  royalCountyDown: {
    name: "Royal County Down — Championship Links",
    handle: "royal-county-down",
    character:
      "Northern Ireland links: dunes, purple heather, golden gorse, bearded bunkers, Mourne Mountains and Dundrum Bay",
    pars: [5, 4, 4, 3, 4, 4, 3, 4, 4, 3, 4, 5, 4, 3, 4, 4, 4, 5],
    handicaps: [13, 9, 3, 15, 7, 11, 17, 1, 5, 18, 8, 16, 4, 12, 2, 14, 10, 6],
    tees: [
      {
        name: "Blue",
        color: "#1d4ed8",
        rating: "75.9",
        slope: 145,
        yardages: [
          539, 444, 475, 229, 440, 396, 144, 429, 483, 196, 442, 545, 446, 212,
          468, 337, 433, 548,
        ],
      },
      {
        name: "White",
        color: "#e5e7eb",
        rating: "74.8",
        slope: 136,
        yardages: [
          523, 424, 475, 215, 429, 369, 135, 424, 427, 188, 430, 525, 423, 202,
          454, 318, 416, 548,
        ],
      },
    ],
  },
} satisfies Record<string, CoursePlan>;
