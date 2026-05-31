/**
 * Liste des modèles disponibles dans DriftDeckX.
 *
 * Chaque modèle référence une brand via `brandId` (cf. brands.js).
 * - `nameReal`  : nom IRL sans la marque (la brand est affichée dans l'accordéon)
 * - `nameCarx`  : nom in-game CarX (la commu reconnaît ses voitures par ce nom)
 *
 * Les `id` sont immuables (format : `{brandId}-{carxNameSlug}`).
 * Ne JAMAIS les modifier après mise en production — ils servent de clé étrangère
 * pour les presets stockés.
 */
export const MODELS = [
  // ─── Nissan ──────────────────────────────────────────────────────────────
  { id: "nissan-zephyr",       brandId: "nissan", nameReal: "Cefiro A31",        nameCarx: "Zephyr" },
  { id: "nissan-phoenix-nx",   brandId: "nissan", nameReal: "180SX",             nameCarx: "Phoenix NX" },
  { id: "nissan-pirate",       brandId: "nissan", nameReal: "Laurel C33",        nameCarx: "Pirate" },
  { id: "nissan-godzilla-r3",  brandId: "nissan", nameReal: "Skyline R33",       nameCarx: "Godzilla R3" },
  { id: "nissan-equator-d",    brandId: "nissan", nameReal: "Skyline 350GT",     nameCarx: "Equator D" },
  { id: "nissan-piranha-x",    brandId: "nissan", nameReal: "350Z",              nameCarx: "Piranha X" },
  { id: "nissan-wellington",   brandId: "nissan", nameReal: "Silvia S13",        nameCarx: "Wellington S20" },
  { id: "nissan-kaiju",        brandId: "nissan", nameReal: "Skyline GTS-R",     nameCarx: "Kaiju" },
  { id: "nissan-midnight",     brandId: "nissan", nameReal: "240Z",              nameCarx: "Midnight" },
  { id: "nissan-horizon-gt4",  brandId: "nissan", nameReal: "Skyline R34",       nameCarx: "Horizon GT4" },
  { id: "nissan-moon-knight",  brandId: "nissan", nameReal: "Skyline HCR32",     nameCarx: "Moon Knight" },
  { id: "nissan-fujin-sx",     brandId: "nissan", nameReal: "Silvia S14",        nameCarx: "Fujin SX" },
  { id: "nissan-gloriousxz",   brandId: "nissan", nameReal: "300ZX Z32",         nameCarx: "GloriousXZ" },
  { id: "nissan-kanniedood",   brandId: "nissan", nameReal: "Datsun 620",        nameCarx: "Kanniedood" },
  { id: "nissan-hakosuka",     brandId: "nissan", nameReal: "Skyline 2000GT-X",  nameCarx: "Hakosuka" },
  { id: "nissan-last-prince",  brandId: "nissan", nameReal: "Skyline R32",       nameCarx: "Last Prince" },
  { id: "nissan-flash",        brandId: "nissan", nameReal: "Skyline ER34",      nameCarx: "Flash" },
  { id: "nissan-spector-rs",   brandId: "nissan", nameReal: "Silvia S15",        nameCarx: "Spector RS" },
  { id: "nissan-atlas-gt",     brandId: "nissan", nameReal: "Skyline R35",       nameCarx: "Atlas GT" },
  { id: "nissan-zismo-z4",     brandId: "nissan", nameReal: "400Z",              nameCarx: "Zismo Z4" },
  { id: "nissan-zismo",        brandId: "nissan", nameReal: "370Z",              nameCarx: "Zismo" },
  { id: "nissan-spirax",       brandId: "nissan", nameReal: "300ZX",             nameCarx: "Spirax" },
  { id: "nissan-youkai",       brandId: "nissan", nameReal: "Laurel C35",        nameCarx: "Youkai" },

  // ─── Toyota ──────────────────────────────────────────────────────────────
  { id: "toyota-hachi-roku",   brandId: "toyota", nameReal: "Sprinter Trueno",   nameCarx: "Hachi-Roku" },
  { id: "toyota-hachi-go",     brandId: "toyota", nameReal: "Corolla Levin",     nameCarx: "Hachi-GO" },
  { id: "toyota-dacohosu",     brandId: "toyota", nameReal: "Celica A20",        nameCarx: "Dacohosu" },
  { id: "toyota-rina",         brandId: "toyota", nameReal: "Carina AA63",       nameCarx: "Rina" },
  { id: "toyota-mifune",       brandId: "toyota", nameReal: "Altezza",           nameCarx: "Mifune" },
  { id: "toyota-royal",        brandId: "toyota", nameReal: "Crown Majesta",     nameCarx: "Royal" },
  { id: "toyota-burner-jdm",   brandId: "toyota", nameReal: "Chaser JZX100",     nameCarx: "Burner JDM" },
  { id: "toyota-corona",       brandId: "toyota", nameReal: "Mark II GX81",      nameCarx: "Corona" },
  { id: "toyota-mira",         brandId: "toyota", nameReal: "MR2",               nameCarx: "Mira" },
  { id: "toyota-samurai-ii",   brandId: "toyota", nameReal: "Mark II JZX90",     nameCarx: "Samurai II" },
  { id: "toyota-asura-m1",     brandId: "toyota", nameReal: "GT86",              nameCarx: "Asura M1" },
  { id: "toyota-sensei",       brandId: "toyota", nameReal: "Cresta X100",       nameCarx: "Sensei" },
  { id: "toyota-rolla-zr",     brandId: "toyota", nameReal: "Corolla",           nameCarx: "Rolla ZR" },
  { id: "toyota-carrot-ii",    brandId: "toyota", nameReal: "Mark II JZX100",    nameCarx: "Carrot II" },
  { id: "toyota-wanderer-l30", brandId: "toyota", nameReal: "Supra MK4",         nameCarx: "Wanderer L30" },
  { id: "toyota-nomad-gt",     brandId: "toyota", nameReal: "Supra MK5",         nameCarx: "Nomad GT" },
  { id: "toyota-grace-gt",     brandId: "toyota", nameReal: "Yaris GR",          nameCarx: "Grace GT" },
  { id: "toyota-kizoku",       brandId: "toyota", nameReal: "Aristo",            nameCarx: "Kizoku" },
  { id: "toyota-asura-gxr",    brandId: "toyota", nameReal: "GR86",              nameCarx: "Asura GXR" },
  { id: "toyota-yakuza",       brandId: "toyota", nameReal: "Crown Athlete",     nameCarx: "Yakuza" },
  { id: "toyota-raijin-x",     brandId: "toyota", nameReal: "Mark II JZX110",    nameCarx: "Raijin X" },
  { id: "toyota-rz70",         brandId: "toyota", nameReal: "Supra MK3",         nameCarx: "RZ70" },
  { id: "toyota-x-truck",      brandId: "toyota", nameReal: "Tacoma",            nameCarx: "X truck" },

  // ─── BMW ─────────────────────────────────────────────────────────────────
  { id: "bmw-bimmy-p30",       brandId: "bmw",    nameReal: "E30",               nameCarx: "Bimmy P30" },
  { id: "bmw-wutend",          brandId: "bmw",    nameReal: "E36",               nameCarx: "Wutend" },
  { id: "bmw-dtm46",           brandId: "bmw",    nameReal: "E46",               nameCarx: "DTM46" },
  { id: "bmw-hunter",          brandId: "bmw",    nameReal: "M2 F87",            nameCarx: "Hunter" },
  { id: "bmw-udm-3",           brandId: "bmw",    nameReal: "E92",               nameCarx: "UDM 3" },
  { id: "bmw-bandit",          brandId: "bmw",    nameReal: "E34",               nameCarx: "Bandit" },
  { id: "bmw-thor-e8",         brandId: "bmw",    nameReal: "i8",                nameCarx: "Thor E8" },
  { id: "bmw-loki-4m",         brandId: "bmw",    nameReal: "M4 F82",            nameCarx: "Loki 4M" },
  { id: "bmw-shark-gt",        brandId: "bmw",    nameReal: "M5 E60",            nameCarx: "Shark GT" },
  { id: "bmw-loki-4gt",        brandId: "bmw",    nameReal: "M4 G82",            nameCarx: "Loki 4GT" },
  { id: "bmw-bimmy-p31",       brandId: "bmw",    nameReal: "E31",               nameCarx: "Bimmy P31" },
  { id: "bmw-bimmy-p24",       brandId: "bmw",    nameReal: "E24",               nameCarx: "Bimmy P24" },
  { id: "bmw-nimble",          brandId: "bmw",    nameReal: "E36 Compact",       nameCarx: "Nimble" },
  { id: "bmw-udm-4z",          brandId: "bmw",    nameReal: "Z4",                nameCarx: "UDM 4Z" },
  { id: "bmw-dtm-39",          brandId: "bmw",    nameReal: "M5 E39 Touring",    nameCarx: "DTM 39" },
  { id: "bmw-loki-f9",         brandId: "bmw",    nameReal: "M5 F90",            nameCarx: "Loki F9" },
  { id: "bmw-axis-g2",         brandId: "bmw",    nameReal: "M2 G87",            nameCarx: "Axis G2" },

  // ─── Dodge ───────────────────────────────────────────────────────────────
  { id: "dodge-thunderstrike", brandId: "dodge",  nameReal: "Charger R/T 68",    nameCarx: "Thunderstrike" },
  { id: "dodge-betsy",         brandId: "dodge",  nameReal: "Ram Van",           nameCarx: "Betsy" },
  { id: "dodge-inferno",       brandId: "dodge",  nameReal: "Charger LD",        nameCarx: "Inferno" },
  { id: "dodge-magnum-rt",     brandId: "dodge",  nameReal: "Challenger R/T",    nameCarx: "Magnum RT" },
  { id: "dodge-rattlesnake",   brandId: "dodge",  nameReal: "Viper SRT10",       nameCarx: "Rattlesnake" },
  { id: "dodge-voodoo",        brandId: "dodge",  nameReal: "Viper SRT10 VX",    nameCarx: "Voodoo" },

  // ─── Ford ────────────────────────────────────────────────────────────────
  { id: "ford-black-fox",      brandId: "ford",   nameReal: "Mustang Fox Body",  nameCarx: "Black Fox" },
  { id: "ford-cobra-gt530",    brandId: "ford",   nameReal: "Mustang GT350",     nameCarx: "Cobra GT530" },
  { id: "ford-blackjack-x22",  brandId: "ford",   nameReal: "Hoonicorn",         nameCarx: "Blackjack X22" },
  { id: "ford-shadow-xtr",     brandId: "ford",   nameReal: "Mustang Mach 1",    nameCarx: "Shadow XTR" },
  { id: "ford-warrior",        brandId: "ford",   nameReal: "Falcon XB",         nameCarx: "Warrior" },
  { id: "ford-blackjack-x150", brandId: "ford",   nameReal: "Hoonicorn F150",    nameCarx: "BlackJack X150" },
  { id: "ford-cobra-s650",     brandId: "ford",   nameReal: "Mustang GT650",     nameCarx: "Cobra S650" },
  { id: "ford-cobra-s",        brandId: "ford",   nameReal: "Mustang S197",      nameCarx: "Cobra S" },

  // ─── Mazda ───────────────────────────────────────────────────────────────
  { id: "mazda-panther-m5-90s", brandId: "mazda", nameReal: "MX-5 NA",           nameCarx: "Panther M5 90S" },
  { id: "mazda-panther-m5",     brandId: "mazda", nameReal: "MX-5 ND",           nameCarx: "Panther M5" },
  { id: "mazda-lynx",           brandId: "mazda", nameReal: "RX-8",              nameCarx: "Lynx" },
  { id: "mazda-falcon-fc-90s",  brandId: "mazda", nameReal: "RX-7 FC",           nameCarx: "Falcon FC 90S" },
  { id: "mazda-falcon-rz",      brandId: "mazda", nameReal: "RX-7 FD",           nameCarx: "Falcon RZ" },

  // ─── Mercedes-Benz ───────────────────────────────────────────────────────
  { id: "mercedes-benz-imperior",  brandId: "mercedes-benz", nameReal: "Evo II",   nameCarx: "Imperior" },
  { id: "mercedes-benz-warden",    brandId: "mercedes-benz", nameReal: "CLK63",    nameCarx: "Warden" },
  { id: "mercedes-benz-unicorn",   brandId: "mercedes-benz", nameReal: "S212",     nameCarx: "Unicorn" },
  { id: "mercedes-benz-cobra",     brandId: "mercedes-benz", nameReal: "E63",      nameCarx: "Cobra" },
  { id: "mercedes-benz-consul-gt", brandId: "mercedes-benz", nameReal: "C63",      nameCarx: "Consul GT" },
  { id: "mercedes-benz-patron-gt", brandId: "mercedes-benz", nameReal: "AMG GT",   nameCarx: "Patron GT" },

  // ─── Mitsubishi ──────────────────────────────────────────────────────────
  { id: "mitsubishi-solar",    brandId: "mitsubishi", nameReal: "Eclipse",         nameCarx: "Solar" },
  { id: "mitsubishi-eva-mr",   brandId: "mitsubishi", nameReal: "Evo IX",          nameCarx: "Eva MR" },
  { id: "mitsubishi-eva-x",    brandId: "mitsubishi", nameReal: "Evo X",           nameCarx: "Eva X" },
  { id: "mitsubishi-ronin-gt", brandId: "mitsubishi", nameReal: "3000GT",          nameCarx: "Ronin GT" },

  // ─── Subaru ──────────────────────────────────────────────────────────────
  { id: "subaru-lamberjack",   brandId: "subaru", nameReal: "Forester",           nameCarx: "Lamberjack" },
  { id: "subaru-syberia-swi",  brandId: "subaru", nameReal: "WRX STI",            nameCarx: "Syberia SWI" },
  { id: "subaru-syberia-wdc",  brandId: "subaru", nameReal: "WRX STI GR",         nameCarx: "Syberia WDC" },

  // ─── Chevrolet ───────────────────────────────────────────────────────────
  { id: "chevrolet-hornet-gt",  brandId: "chevrolet", nameReal: "Camaro SS",      nameCarx: "Hornet GT" },
  { id: "chevrolet-spark-zr",   brandId: "chevrolet", nameReal: "Corvette C6",    nameCarx: "Spark ZR" },
  { id: "chevrolet-karnage-7c", brandId: "chevrolet", nameReal: "Corvette C7",    nameCarx: "Karnage 7C" },
  { id: "chevrolet-hornet-s72", brandId: "chevrolet", nameReal: "Camaro 70",      nameCarx: "Hornet S72" },
  { id: "chevrolet-arkus",      brandId: "chevrolet", nameReal: "Corvette C3",    nameCarx: "Arkus" },
  { id: "chevrolet-flare-zr",   brandId: "chevrolet", nameReal: "Corvette C5",    nameCarx: "Flare ZR" },

  // ─── Lada ────────────────────────────────────────────────────────────────
  { id: "lada-vz-210",         brandId: "lada", nameReal: "2107",                 nameCarx: "VZ 210" },
  { id: "lada-vz-212",         brandId: "lada", nameReal: "2102",                 nameCarx: "VZ 212" },

  // ─── Pontiac ─────────────────────────────────────────────────────────────
  { id: "pontiac-penguin",     brandId: "pontiac", nameReal: "Solstice",          nameCarx: "Penguin" },
  { id: "pontiac-interstate",  brandId: "pontiac", nameReal: "Trans Am",          nameCarx: "Interstate" },

  // ─── Lexus ───────────────────────────────────────────────────────────────
  { id: "lexus-sorrow",        brandId: "lexus", nameReal: "SC300",               nameCarx: "Sorrow" },
  { id: "lexus-eleganto",      brandId: "lexus", nameReal: "RCF",                 nameCarx: "Eleganto" },
  { id: "lexus-spaceknight",   brandId: "lexus", nameReal: "LFA",                 nameCarx: "Spaceknight" },

  // ─── Audi ────────────────────────────────────────────────────────────────
  { id: "audi-vanguard",       brandId: "audi", nameReal: "RS6",                  nameCarx: "Vanguard" },
  { id: "audi-speedline-gt",   brandId: "audi", nameReal: "R8",                   nameCarx: "Speedline GT" },

  // ─── Autre ───────────────────────────────────────────────────────────────
  { id: "other-long-river",    brandId: "other", nameReal: "Volga 2410",       nameCarx: "Long River" },
  { id: "other-caravan-g6",    brandId: "other", nameReal: "245 Estate",       nameCarx: "Caravan G6" },
  { id: "other-interceptor",   brandId: "other", nameReal: "Grand Cherokee",   nameCarx: "Interceptor" },
  { id: "other-raven-rv8",     brandId: "other", nameReal: "Maloo",            nameCarx: "Raven RV8" },
  { id: "other-cargo",         brandId: "other", nameReal: "Cascadia",         nameCarx: "Cargo" },
  { id: "other-hot-rod",       brandId: "other", nameReal: "Hot Rod",          nameCarx: "Hot Rod" },
  { id: "other-hummel",        brandId: "other", nameReal: "Singer 911",       nameCarx: "Hummel" },
  { id: "other-kitsune",       brandId: "other", nameReal: "NSX",              nameCarx: "Kitsune" },
  { id: "other-prestigio",     brandId: "other", nameReal: "Huracán Evo",      nameCarx: "Prestigio" },
  { id: "other-flanker-f",     brandId: "other", nameReal: "Flanker F",        nameCarx: "Flanker F" },
  { id: "other-judge",         brandId: "other", nameReal: "VF Commodore",     nameCarx: "Judge" },
  { id: "other-kei-truck",     brandId: "other", nameReal: "Carry",            nameCarx: "Kei truck" },
  { id: "other-redline-s",     brandId: "other", nameReal: "S2000",            nameCarx: "Redline S" },
  { id: "other-precision-gt",  brandId: "other", nameReal: "Q60",              nameCarx: "Precision GT" },
  { id: "other-ridge-gt",      brandId: "other", nameReal: "F-Type",           nameCarx: "Ridge GT" },
  { id: "other-proton",        brandId: "other", nameReal: "911 GT3",          nameCarx: "Proton" },
  { id: "other-glider",        brandId: "other", nameReal: "Elise",            nameCarx: "Glider" },
];

/**
 * Helpers de consultation des modèles.
 */
export function getModelById(id) {
  return MODELS.find(model => model.id === id);
}

export function getModelsByBrand(brandId) {
  return MODELS.filter(model => model.brandId === brandId);
}