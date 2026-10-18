/* ==========================================================
   一覧・並び替え・絞り込み・詳細・投稿
   詳細は URL ハッシュ（#/item/<id>）で開く
   ========================================================== */

(function () {
  const state = {
    items: [],
    categories: new Set(),
    brands: new Set(),
    sizes: new Set(),
    query: "",
    sort: "new",
    dir: "desc",
  };

  const $ = (sel) => document.querySelector(sel);
  const el = {
    grid: $("#itemGrid"),
    count: $("#resultCount"),
    empty: $("#emptyState"),
    sortKey: $("#sortKey"),
    sortDir: $("#sortDir"),
    category: $("#filterCategory"),
    brand: $("#filterBrand"),
    size: $("#filterSize"),
    search: $("#searchInput"),
    clear: $("#clearFilters"),
    searchApply: $("#searchApply"),
    toggle: $("#searchToggle"),
    panel: $("#searchPanel"),
    panelClose: $("#searchClose"),
    overlay: $("#searchOverlay"),
    modal: $("#itemModal"),
    modalBody: $("#modalBody"),
    postToggle: $("#postToggle"),
    postModal: $("#postModal"),
    postForm: $("#postForm"),
    footer: $("#footerNote"),
    toast: $("#toast"),
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const normalize = (s) =>
    (s || "").normalize("NFKC").toLowerCase()
      .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
      .replace(/[・\s'’.\-]/g, "");
  // ブランドは表記ゆれ（Sunny Sports / SUNNY SPORTS、Goodwear / Good wear）をまとめる
  const brandKey = (b) => normalize(b);
  const sizeLabel = (s) => {
    const n = (s || "").normalize("NFKC").trim().toUpperCase();
    return SIZE_ALIAS[n] || n;
  };
  const categoryOf = (item) => lookup(CATEGORIES, item.category) || lookup(CATEGORIES, "other");
  const measureOf = (item, key) => item.measurements?.find((m) => m.key === key);
  const num = (v) => {
    const n = parseFloat(String(v ?? "").normalize("NFKC"));
    return Number.isFinite(n) ? n : null;
  };

  /* ---------- 並び替え ---------- */

  function buildSort() {
    el.sortKey.innerHTML = SORTS.map((s) => `<option value="${s.key}">${s.name}</option>`).join("");
    el.sortKey.value = state.sort;
    renderSortDir();
    el.sortKey.addEventListener("change", () => {
      const s = lookup(SORTS, el.sortKey.value);
      state.sort = s.key;
      state.dir = s.dir;
      renderSortDir();
      render();
    });
    el.sortDir.addEventListener("click", () => {
      state.dir = state.dir === "asc" ? "desc" : "asc";
      renderSortDir();
      render();
    });
  }

  function renderSortDir() {
    const s = lookup(SORTS, state.sort);
    const labels = s.key === "new"
      ? { desc: "新しい順", asc: "古い順" }
      : s.key === "brand"
        ? { asc: "A → Z", desc: "Z → A" }
        : { desc: "長い順", asc: "短い順" };
    el.sortDir.textContent = labels[state.dir];
    el.sortDir.dataset.dir = state.dir;
  }

  function sortItems(list) {
    const s = lookup(SORTS, state.sort);
    const sign = state.dir === "asc" ? 1 : -1;
    const coll = new Intl.Collator("ja", { sensitivity: "base", numeric: true });
    return [...list].sort((a, b) => {
      if (s.measure) {
        const va = num(measureOf(a, s.measure)?.value);
        const vb = num(measureOf(b, s.measure)?.value);
        if (va === null && vb === null) return 0;
        if (va === null) return 1; // 項目が無いものは常に最後
        if (vb === null) return -1;
        return (va - vb) * sign;
      }
      if (s.key === "brand") {
        return coll.compare(a.brand, b.brand) * sign || coll.compare(a.name, b.name);
      }
      return (new Date(a.createdAt) - new Date(b.createdAt)) * sign;
    });
  }

  /* ---------- 絞り込み ---------- */

  function buildFilters() {
    const used = new Set(state.items.map((i) => i.category));
    el.category.innerHTML = CATEGORIES.filter((c) => used.has(c.key)).map((c) => `
      <button type="button" class="pill" data-group="categories" data-key="${c.key}"
              aria-pressed="${state.categories.has(c.key)}">${c.name}</button>`).join("");

    // ブランド：表記ゆれをまとめ、件数の多い順
    const brands = new Map();
    state.items.forEach((i) => {
      const k = brandKey(i.brand);
      const b = brands.get(k) || { key: k, name: i.brand, count: 0 };
      b.count++;
      brands.set(k, b);
    });
    el.brand.innerHTML = [...brands.values()]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"))
      .map((b) => `
        <button type="button" class="pill" data-group="brands" data-key="${esc(b.key)}"
                aria-pressed="${state.brands.has(b.key)}">${esc(b.name)}<span class="pill__count">${b.count}</span></button>`).join("");

    const order = ["XS", "S", "M", "L", "XL", "XXL"];
    const sizes = [...new Set(state.items.map((i) => sizeLabel(i.size)).filter(Boolean))]
      .sort((a, b) => {
        const ia = order.indexOf(a), ib = order.indexOf(b);
        if (ia >= 0 && ib >= 0) return ia - ib;
        if (ia >= 0) return -1;
        if (ib >= 0) return 1;
        return a.localeCompare(b, "ja", { numeric: true });
      });
    el.size.innerHTML = sizes.map((s) => `
      <button type="button" class="pill pill--sm" data-group="sizes" data-key="${esc(s)}"
              aria-pressed="${state.sizes.has(s)}">${esc(s)}</button>`).join("");

    $("#brandList").innerHTML = [...brands.values()].map((b) => `<option value="${esc(b.name)}">`).join("");
  }

  function filtered() {
    const q = normalize(state.query);
    return state.items.filter((i) => {
      if (state.categories.size && !state.categories.has(i.category)) return false;
      if (state.brands.size && !state.brands.has(brandKey(i.brand))) return false;
      if (state.sizes.size && !state.sizes.has(sizeLabel(i.size))) return false;
      if (q && !normalize(`${i.brand}${i.name}${categoryOf(i).name}${i.note}`).includes(q)) return false;
      return true;
    });
  }

  /* ---------- 一覧 ---------- */

  function cardHTML(item) {
    const img = item.image
      ? `<img src="${esc(item.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
      : `<span class="card__noimage">No Image</span>`;
    return `
      <li>
        <a class="card" href="#/item/${encodeURIComponent(item.id)}" aria-label="${esc(item.brand)} ${esc(item.name)}">
          <svg class="card__plus" viewBox="0 0 33 33" aria-hidden="true"><path d="M15.28 4.9h2.44v23.2h-2.44zM4.9 15.28h23.2v2.44H4.9z"/></svg>
          <div class="card__image">${img}</div>
          <div class="card__info">
            <p class="card__brand">${esc(item.brand)}</p>
            <p class="card__name">${esc(item.name)}</p>
          </div>
        </a>
      </li>`;
  }

  function render() {
    const list = sortItems(filtered());
    el.grid.innerHTML = list.map(cardHTML).join("");
    el.empty.hidden = list.length > 0;
    el.count.innerHTML = `<b>${list.length}</b> Items` +
      (list.length !== state.items.length ? `<span> / ${state.items.length}</span>` : "");
    const active = state.categories.size + state.brands.size + state.sizes.size + (state.query ? 1 : 0);
    el.toggle.classList.toggle("has-filter", active > 0);
  }

  /* ---------- 検索メニュー ---------- */

  function openPanel(open) {
    el.panel.classList.toggle("is-open", open);
    el.panel.setAttribute("aria-hidden", String(!open));
    el.panel.inert = !open;
    el.overlay.hidden = !open;
    el.toggle.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("is-search-open", open);
    if (open) setTimeout(() => el.search.focus(), 300);
  }

  function bindPanel() {
    el.toggle.addEventListener("click", () => openPanel(!el.panel.classList.contains("is-open")));
    el.panelClose.addEventListener("click", () => openPanel(false));
    el.overlay.addEventListener("click", () => openPanel(false));
    el.searchApply.addEventListener("click", () => openPanel(false));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && el.panel.classList.contains("is-open")) openPanel(false);
    });

    el.panel.addEventListener("click", (e) => {
      const btn = e.target.closest(".pill[data-group]");
      if (!btn) return;
      const set = state[btn.dataset.group];
      const key = btn.dataset.key;
      set.has(key) ? set.delete(key) : set.add(key);
      btn.setAttribute("aria-pressed", String(set.has(key)));
      render();
    });
    el.search.addEventListener("input", () => { state.query = el.search.value; render(); });
    el.clear.addEventListener("click", () => {
      state.categories.clear(); state.brands.clear(); state.sizes.clear();
      state.query = ""; el.search.value = "";
      el.panel.querySelectorAll(".pill[aria-pressed]").forEach((b) => b.setAttribute("aria-pressed", "false"));
      render();
    });
  }

  /* ---------- 詳細 ---------- */

  function detailHTML(item) {
    const cat = categoryOf(item);
    const date = new Date(item.createdAt);
    const ms = (item.measurements || []).filter((m) => m.value !== "");
    const deletable = item.source !== "seed";
    return `
      <article class="detail">
        <div class="detail__image">
          ${item.image ? `<img src="${esc(item.image)}" alt="${esc(item.name)}" referrerpolicy="no-referrer">` : `<span class="card__noimage">No Image</span>`}
        </div>
        <div class="detail__body">
          <div class="detail__tags">
            <span class="tag">${cat.name}</span>
            ${item.size ? `<span class="tag tag--line">Size ${esc(item.size)}</span>` : ""}
          </div>
          <p class="detail__brand">${esc(item.brand)}</p>
          <h2 class="detail__name" id="modalTitle">${esc(item.name)}</h2>

          <section class="detail__section">
            <h3 class="detail__heading">実寸（cm）</h3>
            ${ms.length ? `
              <div class="measures">
                <table class="measure-table">
                  <thead>
                    <tr>
                      <th scope="col">サイズ</th>
                      ${ms.map((m) => `<th scope="col">${esc(m.key)}</th>`).join("")}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>${esc(item.size || "—")}</td>
                      ${ms.map((m) => `<td>${esc(m.value)}</td>`).join("")}
                    </tr>
                  </tbody>
                </table>
              </div>` : `<p class="detail__none">登録なし</p>`}
          </section>

          ${item.note ? `
            <section class="detail__section">
              <h3 class="detail__heading">メモ</h3>
              <p class="detail__note">${esc(item.note)}</p>
            </section>` : ""}

          <div class="detail__foot">
            <span>${isNaN(date) ? "" : `登録 ${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`}</span>
            ${deletable ? `<button type="button" class="text-btn text-btn--danger" data-delete="${esc(item.id)}">このアイテムを削除</button>` : ""}
          </div>
        </div>
      </article>`;
  }

  function openFromHash() {
    const m = location.hash.match(/^#\/item\/(.+)$/);
    if (!m) { if (el.modal.open) el.modal.close(); return; }
    const item = state.items.find((i) => i.id === decodeURIComponent(m[1]));
    if (!item) return;
    el.modalBody.innerHTML = detailHTML(item);
    if (!el.modal.open) el.modal.showModal();
  }

  function bindModal() {
    window.addEventListener("hashchange", openFromHash);
    el.modal.addEventListener("close", () => {
      if (location.hash.startsWith("#/item/")) history.pushState("", "", location.pathname + location.search);
    });
    el.modal.addEventListener("click", async (e) => {
      if (e.target === el.modal || e.target.closest("[data-close]")) return el.modal.close();
      const del = e.target.closest("[data-delete]");
      if (!del) return;
      const item = state.items.find((i) => i.id === del.dataset.delete);
      if (!item || !confirm(`「${item.brand} ${item.name}」を削除しますか？`)) return;
      if (Store.mode === "gas" && !Store.postKey) {
        const key = prompt("合言葉を入力してください");
        if (!key) return;
        Store.postKey = key;
      }
      del.disabled = true;
      try {
        await Store.remove(item);
        state.items = state.items.filter((i) => i !== item);
        el.modal.close();
        buildFilters();
        render();
        toast("削除しました");
      } catch (err) {
        del.disabled = false;
        alert(err.message);
      }
    });
  }

  /* ---------- 投稿 ---------- */

  const form = {
    image: $("#postImage"),
    preview: $("#postPreview"),
    hint: $("#dropHint"),
    drop: $("#dropzone"),
    brand: $("#postBrand"),
    name: $("#postName"),
    category: $("#postCategory"),
    size: $("#postSize"),
    note: $("#postNote"),
    list: $("#measureList"),
    add: $("#addMeasure"),
    error: $("#postError"),
    submit: $("#postSubmit"),
    mode: $("#postMode"),
    keyField: $("#postKeyField"),
    key: $("#postKey"),
  };
  let pendingFile = null;
  let measuresTouched = false;

  function measureRow(key = "", value = "") {
    const row = document.createElement("div");
    row.className = "measure-row";
    row.innerHTML = `
      <input class="field__input" list="measureKeys" value="${esc(key)}" placeholder="項目" aria-label="項目名">
      <input class="field__input field__input--num" inputmode="decimal" value="${esc(value)}" placeholder="0.0" aria-label="寸法（cm）">
      <button type="button" class="measure-row__remove" aria-label="この項目を削除">×</button>`;
    return row;
  }

  function setPreset(catKey) {
    const keys = lookup(CATEGORIES, catKey)?.preset || [];
    form.list.innerHTML = "";
    (keys.length ? keys : [""]).forEach((k) => form.list.append(measureRow(k)));
  }

  function setFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    pendingFile = file;
    form.preview.src = URL.createObjectURL(file);
    form.preview.hidden = false;
    form.hint.hidden = true;
    form.drop.classList.add("has-image");
  }

  function resetForm() {
    el.postForm.reset();
    pendingFile = null;
    measuresTouched = false;
    form.preview.hidden = true;
    form.preview.removeAttribute("src");
    form.hint.hidden = false;
    form.drop.classList.remove("has-image");
    form.error.hidden = true;
    form.category.value = "shirt";
    setPreset("shirt");
    form.key.value = Store.postKey;
  }

  function bindPost() {
    form.category.innerHTML = CATEGORIES.map((c) => `<option value="${c.key}">${c.name}</option>`).join("");
    $("#measureKeys").innerHTML = MEASURE_KEYS.map((k) => `<option value="${k}">`).join("");
    resetForm();

    el.postToggle.addEventListener("click", () => {
      openPanel(false);
      resetForm();
      el.postModal.showModal();
      form.brand.focus();
    });
    el.postModal.addEventListener("click", (e) => {
      if (e.target === el.postModal || e.target.closest("[data-close]")) el.postModal.close();
    });

    form.image.addEventListener("change", () => setFile(form.image.files[0]));
    ["dragenter", "dragover"].forEach((t) => form.drop.addEventListener(t, (e) => {
      e.preventDefault(); form.drop.classList.add("is-over");
    }));
    ["dragleave", "drop"].forEach((t) => form.drop.addEventListener(t, (e) => {
      e.preventDefault(); form.drop.classList.remove("is-over");
    }));
    form.drop.addEventListener("drop", (e) => setFile(e.dataTransfer.files[0]));

    // 実寸に手を付けていなければ、カテゴリに合わせて項目を入れ替える
    form.category.addEventListener("change", () => { if (!measuresTouched) setPreset(form.category.value); });
    form.list.addEventListener("input", () => { measuresTouched = true; });
    form.add.addEventListener("click", () => {
      const row = measureRow();
      form.list.append(row);
      row.querySelector("input").focus();
    });
    form.list.addEventListener("click", (e) => {
      const rm = e.target.closest(".measure-row__remove");
      if (rm) { rm.parentElement.remove(); measuresTouched = true; }
    });

    el.postForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const brand = form.brand.value.trim();
      const name = form.name.value.trim();
      if (!brand || !name) return showError("ブランドとアイテム名を入力してください。");
      if (Store.mode === "gas") {
        if (!form.key.value) return showError("合言葉を入力してください。");
        Store.postKey = form.key.value;
      }

      const measurements = [...form.list.querySelectorAll(".measure-row")]
        .map((r) => {
          const [k, v] = r.querySelectorAll("input");
          return { key: k.value.trim(), value: v.value.normalize("NFKC").trim() };
        })
        .filter((m) => m.key && m.value);

      form.submit.disabled = true;
      form.submit.textContent = Store.mode === "demo" ? "保存中…" : "アップロード中…";
      form.error.hidden = true;
      try {
        const item = await Store.create({
          brand, name,
          category: form.category.value,
          size: form.size.value.trim(),
          measurements,
          note: form.note.value.trim(),
        }, pendingFile);
        state.items.push(item);
        buildFilters();
        render();
        el.postModal.close();
        toast("投稿しました");
      } catch (err) {
        showError(err.message);
      } finally {
        form.submit.disabled = false;
        form.submit.textContent = "投稿する";
      }
    });
  }

  function showError(msg) {
    form.error.textContent = msg;
    form.error.hidden = false;
  }

  let toastTimer;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.toast.hidden = true; }, 2400);
  }

  /* ---------- 起動 ---------- */

  // 保存先（Store.mode）ごとの案内文
  const MODE_TEXT = {
    server: {
      footer: "※ 個人利用のためのサイズ表です。投稿画像は images/items に webp で保存しています。",
      form: "画像は webp に変換して <code>images/items</code> に保存されます。",
    },
    gas: {
      footer: "※ 個人利用のためのサイズ表です。投稿画像は Google ドライブに保存しています。",
      form: "画像は Google ドライブに保存されます。",
    },
    demo: {
      footer: "※ 個人利用のためのサイズ表です。（デモモード：投稿はこのブラウザ内に保存）",
      form: "<b>デモモード</b>：投稿はこのブラウザ内にだけ保存されます。<code>python3 tools/server.py</code> で開くと <code>images/items</code> に保存されます。",
    },
  };

  async function init() {
    buildSort();
    bindPanel();
    bindModal();
    bindPost();
    try {
      state.items = await Store.list();
    } catch (err) {
      state.items = (window.SEED_ITEMS || []).map((x) => ({ ...x, source: "seed" }));
      toast("投稿データを読み込めませんでした");
    }
    el.footer.textContent = MODE_TEXT[Store.mode].footer;
    form.mode.innerHTML = MODE_TEXT[Store.mode].form;
    form.keyField.hidden = Store.mode !== "gas";
    buildFilters();
    render();
    openFromHash();
  }

  init();
})();
