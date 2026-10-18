# Wardrobe Size Archive（サイズ表ポータル）

手持ちの服の実寸サイズを一覧・並び替え・絞り込みし、新しいアイテムを投稿できる個人用ポータル。
**ユーザーへの返答は日本語で。**

- 元データ：Notion「サイズ表」ページのエクスポート
  `~/Downloads/6d553c7e-…_ExportBlock-…/サイズ表 1e14d039994e8151ae08e74f129dbebe.html`（23アイテム、画像は同階層の `サイズ表/` フォルダ）
- デザイントーン：ローカルの「エンブレム図鑑」（`~/Desktop/Claude Code Works/エンブレム図鑑`）を踏襲
- コード一式はこのフォルダ（`~/Desktop/Claude Code Works/サイズ表/`）。最初は `サイズ図鑑/` に作り、2026-10-18 にここへ移動
- 構成：素の HTML / CSS / JavaScript（ビルドなし・フレームワークなし）。`<script>` を順に読む
- 状況（2026-10-18）：プレビュー段階。`tools/server.py` で一覧・並び替え・絞り込み・投稿（webp 保存）・詳細・削除の動作確認済み
- **運用方針（2026-10-18 ユーザー決定）**：スマホでも投稿・閲覧したい／GitHub Pages で公開してどこからでも見たい
  → 公開サイトは **GitHub Pages ＋ Google ドライブ（GAS）保存**。`tools/server.py`（images/items に webp 保存）は Mac 上で使うローカル用として残す
- git：このフォルダで `git init` 済み（`main`）。GitHub リポジトリ作成・push・Pages 有効化は**ユーザー確認待ち**（アカウント `ske80225-lab`、エンブレム図鑑と同じ。無料プランの Pages は公開リポジトリ＝服の写真・サイズも公開になる）
- GAS のデプロイはユーザーの Google アカウントでの手作業（Claude からはできない）

## ファイル構成

| パス | 役割 |
|---|---|
| `index.html` | ヘッダー／右上固定の「＋（投稿）」「検索」ボタン／件数＋Sort バー／一覧グリッド／検索パネル／詳細 `<dialog>`／投稿フォーム `<dialog>` |
| `css/style.css` | 全スタイル（エンブレム図鑑の style.css をベースに改変） |
| `js/config.js` | `APP_CONFIG`：`GAS_URL`（入れると GAS 保存が優先）、`IMAGE_MAX`（投稿画像の長辺、既定 1200px）。**合言葉は書かない**（公開されるため） |
| `js/master.js` | `CATEGORIES`（key・英字・日本語名・実寸プリセット）、`MEASURE_KEYS`（入力候補）、`SORTS`、`SIZE_ALIAS`（MEDIUM→M 等）、`lookup()` |
| `js/data/items.js` | `window.SEED_ITEMS`：Notion から取り込んだ23件（上から古い順に `createdAt` を割り当て） |
| `js/store.js` | `Store.list / create / remove`、`Store.mode`、`Store.postKey`（GAS の合言葉。投稿フォームで入力し localStorage `wardrobe-size-archive:post-key` に記憶）。保存先を自動判定：`GAS_URL` あり→`gas`、`/api/items` が応答→`server`、どちらも無し→`demo`（localStorage、キー `wardrobe-size-archive:items`） |
| `js/app.js` | 一覧描画・並び替え・絞り込み・検索パネル開閉・詳細（ハッシュ `#/item/<id>`）・投稿フォーム・トースト |
| `tools/server.py` | 保存サーバー（標準ライブラリ＋Pillow）。サイトを配信し、`GET/POST /api/items`・`DELETE /api/items/<id>` を受ける。画像は Pillow で webp（quality 85）に変換して `images/items/<id>.webp`、データは `data/posts.json`。CSS/JS は `Cache-Control: no-store` |
| `data/posts.json` | 投稿データ（配列）。一覧は SEED_ITEMS ＋ これ |
| `gas/Code.gs` | Google Apps Script：画像→ドライブ、データ→スプレッドシート |
| `images/items/` | Notion から取り込んだ画像（`item-01.webp` など。番号は Notion の並び順。スマホ向けに全部 webp・長辺1200px 以下に変換済み、計約600KB）＋投稿画像（`p-xxxx.webp`）。削除した投稿の画像は `.trash/` に移す |
| `images/icons/` | ファビコン一式。元画像 `source-56.png`（ユーザー提供の「SIZE」56×56）から生成：`favicon.ico`（16/32/48、ルート）、`favicon-32.png`、`apple-touch-icon.png`（180）、`icon-192/512.png`。180以上は拡大なので少しぼやける → 大きい元画像があれば作り直す。ホーム画面用は角を地色 `#505050` で塗る |
| `site.webmanifest` | ホーム画面に追加したときの名前「Size」・アイコン・色 |
| `images/ui/` | エンブレム図鑑からコピーした UI アイコン（search / close / plus / btn-search） |

## アイテムデータの形

```js
{
  id: "seed-01", brand: "オーシバル", name: "シャンブレーシャツ",
  category: "shirt", size: "5",
  measurements: [{ key: "肩幅", value: "56.5" }, ...],  // 値は文字列（"75～97" のような範囲も可）。単位は cm
  image: "images/items/item-01.webp",                   // 外部URL・dataURL・ドライブURLも可
  note: "", createdAt: "2025-01-01T10:00:00+09:00",
}
```

- `category` キー：`shirt` `tee` `sweat` `jacket` `vest` `coat` `pants` `other`
- 一部の画像は外部URLの直リンク（imgz.jp ×2、roco2web、uniqlo）
- 取り込み時に項目名を統一：肩 幅/肩巾→肩幅、身 幅/胸巾/身巾→身幅、総丈/身丈→着丈（パンツの総丈はそのまま）、ソデ丈/そで丈→袖丈、裾（足）口巾→裾幅、前股上→股上、首周り→首回り
- 無印の「胸囲・胴囲・裾回り」は周囲の長さなので身幅には寄せず、別項目のまま
- `.gitignore`：`data/`・`images/items/p-*.webp`・`.trash/`（ローカル投稿は公開しない）
- 投稿の `id` は `p-` ＋ 時刻（36進）＋乱数。画像ファイル名にもそのまま使う
- `source`：`seed`（初期データ・削除不可）／`server`（images/items に保存した投稿）／`local`（デモ投稿）／`gas`（GAS 投稿）

## 機能

- **並び替え**：新着順／ブランド名／着丈／身幅／肩幅／袖丈／ウエスト。右のボタンで昇順・降順を切り替え。実寸で並べると、その項目が無いアイテムは常に最後
- **絞り込み**（検索パネル）：キーワード、カテゴリ、ブランド（表記ゆれをまとめ件数順。例：Sunny Sports / SUNNY SPORTS）、サイズ。絞り込み中は検索ボタンに白い点
- **投稿**：画像（クリック or ドラッグ＆ドロップ。ブラウザで長辺1200pxに縮小 → webp、書き出せないブラウザは JPEG で送り、サーバーで必ず webp に変換。EXIF の向きも補正）、ブランド（既存ブランドを候補表示）、アイテム名、カテゴリ、サイズ表記、実寸（カテゴリに応じて項目をプリセット。手を付けた後は入れ替えない）、メモ
- **詳細**：画像＋カテゴリ・サイズのタグ、実寸は Notion と同じ横並びの表（1列目サイズ → 各項目。列が多いときは表だけ横スクロール）。投稿したものだけ削除可（画像は完全には消さず、server は `images/items/.trash/`、GAS はドライブのゴミ箱へ）

## デザイン（エンブレム図鑑から引き継いだもの）

- 背景 `#2c3437`、パネル `#5b6468`、白カードの正方形グリッド（4列・gap 4px、1700px以上5列、1024px以下3列、700px以下2列）
- タイトル Inter SemiBold 24px 大文字中央（SPは16px左寄せ）。和文は Noto Sans JP
- カードのホバー：3.38%浮き上がり＋影＋右上の＋
- カードはブランド名＋アイテム名（2行まで）のみ。カテゴリ・サイズなどの meta 行は置かない（ユーザー指定）。画像エリアは上からブランド名の直前まで（縦の flex で残りを埋める）
- 検索パネルは右からスライド。白枠のピル、白塗りの丸ボタン
- モーダルは白（`#f4f4f2` の面、角丸14px）
- 商品写真は `mix-blend-mode: multiply` で白背景をなじませる

## Google ドライブ連携（公開サイトの保存先・未設定）

1. 新しいスプレッドシート →「拡張機能 > Apps Script」に `gas/Code.gs` を貼る
2. スクリプトプロパティに `FOLDER_ID`（画像フォルダ）と `POST_KEY`（合言葉。公開するので必須）
3. ウェブアプリとしてデプロイ（実行：自分／アクセス：全員）
4. 発行 URL を `js/config.js` の `GAS_URL` に。合言葉はサイトの投稿フォーム（GAS モードのときだけ表示）で入力し、端末ごとに記憶
5. GAS 側で webp の形式を保つ（ブラウザで webp に変換して送る。webp を書き出せない端末は JPEG のまま保存）

- 送信は `Content-Type: text/plain`（CORS のプリフライト回避）
- 画像は「リンクを知っている全員が閲覧可」にして `https://lh3.googleusercontent.com/d/<fileId>=w1200` で表示
- 一覧は SEED_ITEMS ＋ スプレッドシートの行を合わせて表示

## プレビュー

- 投稿を `images/items` に保存するには `tools/server.py` で開く（`python3 -m http.server` だとデモモードになる）
- Claude の Browser ペインの dev server はサンドボックスで別フォルダを開けない → Bash でバックグラウンド起動して `http://127.0.0.1:8123/` を開く
- 古い JS がキャッシュされているとデモモードのまま動くことがある → 再読み込み

```bash
cd "/Users/yosukekobayashi/Desktop/Claude Code Works/サイズ表" && python3 tools/server.py
```

## 未対応・次の候補

- 投稿アイテムの編集
- 外部URL画像（初期データ4件）はリンク切れの可能性あり。images/items に webp で取り込むかは未決定
- GitHub リポジトリ作成・push・Pages 有効化（ユーザー確認待ち）
- GAS のデプロイと、スマホ（iPhone Safari）での投稿・webp 変換の実機確認
