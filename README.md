# 🛋️ AIR LAB NEWS

広告ゼロの自分用ニュース。SmartNewsのトップ画面から広告だけ抜いたもの。

- 画面: `index.html`（このリポジトリ、GitHub Pages で配信）
- 集める側: `Code.gs`（Google Apps Script。30分ごとにRSSを集めて `?api=data` でJSONを返す）
- タブ: トップ / 鳥取県 / 国内 / ポケモンGO / テクノロジー / ギズモード / ロケニュー / デリッシュキッチン / メンズスタイル / 自動車 / ホビー / ファッション / K-POP
- 上に北栄町の天気と雨雲。天気は気象庁（予報は鳥取県中・西部、いまの気温は倉吉アメダス）。
  前は Open-Meteo だったが、Apps Script は Google の共有 IP から出るので他人の分まで合算されて
  1 日の上限（429）に当たり、出ない時間帯が多かった（2026-09-26 に切り替え）
- 国内は複数媒体が同じ話を書いてたら「いま大きい話」にまとめる
- ミュート語と既読は端末の中だけ（localStorage）

Built by iller with Claude — 2026
