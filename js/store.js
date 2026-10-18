/* ==========================================================
   データの読み書き
   保存先は起動時に自動で決まる：
   - "server"：tools/server.py で開いているとき
               画像 → images/items/<id>.webp、データ → data/posts.json
   - "gas"   ：config.js に GAS_URL があるとき（Google ドライブ）
   - "demo"  ：どちらも無いとき（このブラウザの localStorage）
   ========================================================== */

(function () {
  const cfg = window.APP_CONFIG || {};
  const LS_KEY = "wardrobe-size-archive:items";
  const KEY_KEY = "wardrobe-size-archive:post-key"; // GAS の合言葉（公開ファイルには書かず端末に記憶）
  const API = "api/items";
  let mode = "demo";

  const readLocal = () => {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
    catch { return []; }
  };
  const writeLocal = (items) => localStorage.setItem(LS_KEY, JSON.stringify(items));

  async function readJson(res) {
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) throw new Error(json.error || "保存に失敗しました");
    return json;
  }

  // GAS へは text/plain で送る（CORS のプリフライトを避けるため）
  async function callGas(payload) {
    const res = await fetch(cfg.GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...payload, key: window.Store.postKey }),
    });
    return readJson(res);
  }

  // 長辺 IMAGE_MAX に縮小。webp で書き出せないブラウザは JPEG（サーバー側で webp に変換される）
  function resizeImage(file) {
    const max = cfg.IMAGE_MAX || 1200;
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        const webp = c.toDataURL("image/webp", 0.9);
        resolve(webp.startsWith("data:image/webp") ? webp : c.toDataURL("image/jpeg", 0.92));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("画像を読み込めませんでした")); };
      img.src = url;
    });
  }

  const newId = () => "p-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const seedItems = () => (window.SEED_ITEMS || []).map((x) => ({ ...x, source: "seed" }));

  window.Store = {
    get mode() { return mode; },

    get postKey() {
      try { return localStorage.getItem(KEY_KEY) || ""; } catch { return ""; }
    },
    set postKey(v) {
      try { localStorage.setItem(KEY_KEY, v); } catch { /* 記憶できなくても送信はできる */ }
    },

    async list() {
      if (cfg.GAS_URL) {
        mode = "gas";
        const json = await (await fetch(`${cfg.GAS_URL}?action=list`)).json();
        return [...seedItems(), ...(json.items || []).map((x) => ({ ...x, source: "gas" }))];
      }
      try {
        const res = await fetch(API, { cache: "no-store" });
        const json = await res.json();
        if (json.ok) {
          mode = "server";
          return [...seedItems(), ...json.items.map((x) => ({ ...x, source: "server" }))];
        }
      } catch { /* サーバーなし → デモモード */ }
      mode = "demo";
      return [...seedItems(), ...readLocal().map((x) => ({ ...x, source: "local" }))];
    },

    async create(item, file) {
      const dataUrl = file ? await resizeImage(file) : "";
      const base = { ...item, id: newId(), createdAt: new Date().toISOString() };
      const image = dataUrl ? { data: dataUrl.split(",")[1], mimeType: dataUrl.slice(5, dataUrl.indexOf(";")) } : null;

      if (mode === "server") {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item: base, image }),
        });
        return { ...(await readJson(res)).item, source: "server" };
      }
      if (mode === "gas") {
        const json = await callGas({ action: "create", item: base, image });
        return { ...json.item, source: "gas" };
      }
      const saved = { ...base, image: dataUrl };
      try {
        writeLocal([...readLocal(), saved]);
      } catch {
        throw new Error("ブラウザの保存容量を超えました（デモモード）");
      }
      return { ...saved, source: "local" };
    },

    async remove(item) {
      if (mode === "server") {
        await readJson(await fetch(`${API}/${encodeURIComponent(item.id)}`, { method: "DELETE" }));
        return;
      }
      if (mode === "gas") {
        await callGas({ action: "delete", id: item.id });
        return;
      }
      writeLocal(readLocal().filter((x) => x.id !== item.id));
    },
  };
})();
