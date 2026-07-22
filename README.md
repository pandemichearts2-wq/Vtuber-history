# Graduate History 管理人おすすめ表示機能

## 追加内容
- 公開トップのタイトル右側に「Administrator's Pick / おすすめ表示スペース」を追加
- 管理人おすすめを5秒ごとにランダム表示
- 新しいサムネイルが重なり、古い表示が徐々に消える切り替え
- サムネイルクリックで該当YouTube動画を新しいタブで開く
- スマートフォンでもタイトルとサムネイルを横並びで維持
- 管理画面に「管理人おすすめ編集」タブを追加
- 管理人おすすめ歌みた／管理人おすすめ歌枠の登録、編集、公開切替、削除

## 更新方法
1. GitHubへ index.html / app.js / admin.html / admin.js / styles.css を上書き
2. Apps Scriptを AppsScript-Code.gs に全置換
3. setupSheets を一度実行（GH管理人おすすめシートを作成）
4. Apps Scriptを新バージョンで再デプロイ
