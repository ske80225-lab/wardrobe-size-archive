"""
Wardrobe Size Archive — ローカル保存サーバー

サイトの配信と、投稿の保存をまとめて行う（Python 標準ライブラリ＋Pillow）。
  - 画像   → images/items/<id>.webp（Pillow で webp に変換して保存）
  - データ → data/posts.json
  - 削除した投稿の画像は images/items/.trash/ に移す（完全には消さない）

起動：
  python3 tools/server.py            # http://127.0.0.1:8123/
  python3 tools/server.py 8200       # ポート指定
"""

import base64
import io
import json
import re
import shutil
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
ITEMS_DIR = ROOT / "images" / "items"
TRASH_DIR = ITEMS_DIR / ".trash"
POSTS_FILE = ROOT / "data" / "posts.json"
WEBP_QUALITY = 85
MAX_BODY = 30 * 1024 * 1024
ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def read_posts():
    if not POSTS_FILE.exists():
        return []
    return json.loads(POSTS_FILE.read_text(encoding="utf-8"))


def write_posts(posts):
    POSTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = POSTS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(posts, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(POSTS_FILE)


def save_webp(item_id, b64):
    """受け取った画像（形式は問わない）を webp に変換して保存し、サイトからのパスを返す"""
    img = Image.open(io.BytesIO(base64.b64decode(b64)))
    img = ImageOps.exif_transpose(img)  # スマホ写真の向きを補正
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
    ITEMS_DIR.mkdir(parents=True, exist_ok=True)
    path = ITEMS_DIR / f"{item_id}.webp"
    img.save(path, "WEBP", quality=WEBP_QUALITY, method=6)
    return f"images/items/{path.name}"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    # 開発中に古い CSS/JS が残らないようキャッシュさせない
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, status, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split("?")[0] == "/api/items":
            return self.send_json(200, {"ok": True, "items": read_posts()})
        return super().do_GET()

    def do_POST(self):
        if self.path != "/api/items":
            return self.send_json(404, {"ok": False, "error": "not found"})
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length > MAX_BODY:
                return self.send_json(413, {"ok": False, "error": "画像が大きすぎます"})
            body = json.loads(self.rfile.read(length))
            item = body["item"]
            if not ID_RE.match(item.get("id", "")):
                return self.send_json(400, {"ok": False, "error": "不正な ID です"})
            image = body.get("image")
            item["image"] = save_webp(item["id"], image["data"]) if image else ""
            posts = read_posts()
            posts.append(item)
            write_posts(posts)
            return self.send_json(200, {"ok": True, "item": item})
        except Exception as err:  # noqa: BLE001 — エラー内容はそのまま画面に出す
            return self.send_json(500, {"ok": False, "error": f"保存に失敗しました：{err}"})

    def do_DELETE(self):
        m = re.match(r"^/api/items/([A-Za-z0-9_-]{1,64})$", self.path)
        if not m:
            return self.send_json(404, {"ok": False, "error": "not found"})
        item_id = m.group(1)
        posts = read_posts()
        write_posts([p for p in posts if p.get("id") != item_id])
        img = ITEMS_DIR / f"{item_id}.webp"
        if img.exists():
            TRASH_DIR.mkdir(parents=True, exist_ok=True)
            shutil.move(str(img), str(TRASH_DIR / img.name))
        return self.send_json(200, {"ok": True})


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    print(f"Wardrobe Size Archive: http://127.0.0.1:{port}/")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
