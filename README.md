# Graduate History FA循環保管・画像ダウンロード版

## 追加内容

- 通常FAと成人向けFAを合計2500件まで保管
- 新しいFAの承認で2500件を超えた場合、承認日時が古いFAから超過分と同数を削除
- 削除対象の公開FA行と承認済み申請履歴を整理し、Google Drive画像は完全削除を試行（失敗時はゴミ箱へ移動）
- トップのFA欄へ再掲載のお願いを追加
- 「みんなのファンアート」をスマホでも常に1行表示
- 管理画面のFA申請と公開FAに「画像をダウンロード」ボタンを追加

## GitHub
`index.html`、`admin.html`、`admin.js`、`styles.css` を上書きしてください。

## Apps Script
`AppsScript-Code.gs` へ全部置き換え、既存ウェブアプリを新バージョンで再デプロイしてください。
`setupSheets` の再実行は不要です。
