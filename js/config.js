/* ==========================================================
   設定
   保存先は自動で決まる（js/store.js）：
   - python3 tools/server.py で開く → images/items に webp で保存（通常はこれ）
   - GAS_URL を入れる → Google ドライブ（gas/Code.gs）
   - どちらも無い → デモモード（このブラウザの localStorage）
   GAS の合言葉はここに書かない（公開されるため）。投稿フォームで入力し、端末に記憶する
   ========================================================== */

window.APP_CONFIG = {
  GAS_URL: "",      // 例: "https://script.google.com/macros/s/XXXXXXXX/exec"
  IMAGE_MAX: 1200,  // 投稿画像の長辺（px）。アップロード前に縮小する
};
