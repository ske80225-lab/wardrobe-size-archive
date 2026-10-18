/* ==========================================================
   マスターデータ：カテゴリ・実寸の項目・並び替え
   ========================================================== */

const TOPS_KEYS = ["肩幅", "身幅", "着丈", "袖丈"];

const CATEGORIES = [
  { key: "shirt",  en: "Shirt",  name: "シャツ",              preset: TOPS_KEYS },
  { key: "tee",    en: "Tee",    name: "Tシャツ・カットソー", preset: TOPS_KEYS },
  { key: "sweat",  en: "Sweat",  name: "スウェット",          preset: TOPS_KEYS },
  { key: "jacket", en: "Jacket", name: "ジャケット",          preset: TOPS_KEYS },
  { key: "vest",   en: "Vest",   name: "ベスト",              preset: ["肩幅", "身幅", "着丈"] },
  { key: "coat",   en: "Coat",   name: "コート",              preset: TOPS_KEYS },
  { key: "pants",  en: "Pants",  name: "パンツ",              preset: ["ウエスト", "ヒップ", "股上", "股下", "ワタリ", "裾幅"] },
  { key: "other",  en: "Other",  name: "その他",              preset: [] },
];

// 入力候補（datalist）に出す実寸の項目
const MEASURE_KEYS = [
  "肩幅", "身幅", "着丈", "袖丈", "裄丈", "胸囲", "胴囲", "裾回り", "首回り", "袖口",
  "ウエスト", "ヒップ", "股上", "股下", "ワタリ", "裾幅", "総丈",
];

// 並び替え。measure は実寸の項目名（無いアイテムは最後尾）
const SORTS = [
  { key: "new",   name: "新着順",     dir: "desc" },
  { key: "brand", name: "ブランド名", dir: "asc" },
  { key: "m:着丈", name: "着丈",      dir: "desc", measure: "着丈" },
  { key: "m:身幅", name: "身幅",      dir: "desc", measure: "身幅" },
  { key: "m:肩幅", name: "肩幅",      dir: "desc", measure: "肩幅" },
  { key: "m:袖丈", name: "袖丈",      dir: "desc", measure: "袖丈" },
  { key: "m:ウエスト", name: "ウエスト", dir: "desc", measure: "ウエスト" },
];

// サイズ表記をまとめるための正規化（MEDIUM→M など）
const SIZE_ALIAS = { SMALL: "S", MEDIUM: "M", LARGE: "L" };

function lookup(list, key) {
  return list.find((x) => x.key === key);
}
