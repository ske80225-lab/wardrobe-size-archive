/**
 * Wardrobe Size Archive — 保存用 Google Apps Script
 *
 * 画像 → Google ドライブのフォルダ、データ → このスクリプトのスプレッドシート
 *
 * セットアップ：
 *  1. 新しいスプレッドシートを作り「拡張機能 > Apps Script」にこのファイルを貼る
 *  2. プロジェクトの設定 > スクリプトプロパティに
 *       FOLDER_ID … 画像を入れるドライブフォルダの ID（URL の folders/ の後ろ）
 *       POST_KEY  … 投稿・削除用の合言葉（公開するなら必ず設定。サイトの投稿フォームで入力する）
 *  3. デプロイ > 新しいデプロイ > 種類「ウェブアプリ」
 *       実行ユーザー：自分 ／ アクセスできるユーザー：全員
 *  4. 発行された URL を js/config.js の GAS_URL に貼る
 */

const SHEET_NAME = "items";
const HEADERS = ["id", "brand", "name", "category", "size", "measurements", "image", "fileId", "note", "createdAt"];

function doGet(e) {
  return json_({ ok: true, items: readItems_() });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const key = PropertiesService.getScriptProperties().getProperty("POST_KEY");
    if (key && body.key !== key) return json_({ ok: false, error: "合言葉が違います" });

    if (body.action === "create") return json_({ ok: true, item: createItem_(body.item, body.image) });
    if (body.action === "delete") { deleteItem_(body.id); return json_({ ok: true }); }
    return json_({ ok: false, error: "unknown action" });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function createItem_(item, image) {
  let fileId = "";
  let imageUrl = "";
  if (image && image.data) {
    const folderId = PropertiesService.getScriptProperties().getProperty("FOLDER_ID");
    const folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
    // ブラウザで webp に変換済み（webp を書き出せない端末は JPEG）。形式はそのまま保存する
    const mime = image.mimeType === "image/webp" ? "image/webp" : "image/jpeg";
    const ext = mime === "image/webp" ? "webp" : "jpg";
    const blob = Utilities.newBlob(Utilities.base64Decode(image.data), mime,
      `${item.id}_${item.brand}_${item.name}.${ext}`.replace(/[\\/:*?"<>|]/g, "_"));
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    fileId = file.getId();
    imageUrl = `https://lh3.googleusercontent.com/d/${fileId}=w1200`;
  }
  const saved = Object.assign({}, item, { image: imageUrl, fileId: fileId });
  sheet_().appendRow(HEADERS.map((h) => h === "measurements" ? JSON.stringify(saved.measurements || []) : (saved[h] || "")));
  return saved;
}

function deleteItem_(id) {
  const sh = sheet_();
  const values = sh.getDataRange().getValues();
  for (let r = values.length - 1; r >= 1; r--) {
    if (values[r][0] === id) {
      const fileId = values[r][HEADERS.indexOf("fileId")];
      if (fileId) DriveApp.getFileById(fileId).setTrashed(true); // ゴミ箱へ（完全削除はしない）
      sh.deleteRow(r + 1);
    }
  }
}

function readItems_() {
  const values = sheet_().getDataRange().getValues();
  return values.slice(1).filter((row) => row[0]).map((row) => {
    const o = {};
    HEADERS.forEach((h, i) => { o[h] = row[i]; });
    try { o.measurements = JSON.parse(o.measurements || "[]"); } catch (e) { o.measurements = []; }
    if (o.createdAt instanceof Date) o.createdAt = o.createdAt.toISOString();
    return o;
  });
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
