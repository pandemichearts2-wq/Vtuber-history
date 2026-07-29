# Graduate History 情報登録ページ統合版

## 変更内容
- トップページの登録導線は「情報登録ページを開く」1つだけに統一
- 情報登録ページへ「思い出の動画を登録する」タブを追加
- 動画登録のVTuber検索、動画種別、URL、タイトル、補足、規約同意を統合
- トップの「思い出の動画」は削除せず、公開済み動画のダイジェスト・おすすめ紹介ブロックとして維持
- 「思い出の動画」内の「動画の登録をする」ボタンは削除
- 旧 `video-register.html` は統合ページの動画タブへ自動転送
- Apps Scriptの動画種類に「歌ってみた」「オリジナルソング」を追加

## GitHubへ上書き
- `index.html`
- `register.html`
- `register.js`
- `styles.css`
- `video-register.html`

## Apps Script
1. `AppsScript-Code.gs` の内容で現在のコードを全置換
2. 保存
3. 新バージョンで再デプロイ

`setupSheets` の再実行は、今回の変更だけなら必須ではありません。
