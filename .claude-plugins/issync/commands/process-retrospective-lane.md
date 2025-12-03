---
description: Status="retrospective"の全issueに対して/issync:complete-sub-issueを自動実行
---

# /issync:process-retrospective-lane

GitHub ProjectsのStatus="retrospective"にある全issueに対して`/issync:complete-sub-issue`を自動実行します。

**使用方法**: `/issync:process-retrospective-lane`（引数なし）

## 前提条件

以下の環境変数が設定されている必要があります：

- `ISSYNC_GITHUB_PROJECTS_NUMBER`: プロジェクト番号（例: 4）
- `ISSYNC_GITHUB_PROJECTS_OWNER`: プロジェクトオーナー（例: MH4GF）
- `ISSYNC_GITHUB_TOKEN` または `GITHUB_TOKEN`: GitHub API認証トークン

## 実行ステップ

1. `issync projects list-issues --status=retrospective`でissue番号を取得（JSON配列）
2. 各issueに対して`/issync:complete-sub-issue`を実行
3. 実行結果サマリーを表示（処理件数、成功/失敗数）

```bash
for issueNumber in $(issync projects list-issues --status=retrospective | jq -r '.[]'); do
  /issync:complete-sub-issue $issueNumber
done
```

**`/issync:complete-sub-issue`の処理内容**:
- 進捗ドキュメント読み込み
- Outcomes & Retrospectivesセクション判定
- 記入済み → Status="done"へ遷移
- 未記入 → 振り返り生成・ドキュメント更新
- `issync remove`で同期設定削除

## エラーハンドリング

各issue処理は独立しており、1件の失敗が他に影響しません：

- **環境変数未設定**: GitHubProjectsNotConfiguredError → 環境変数設定を促す
- **プロジェクト未検出**: ProjectNotFoundError → プロジェクト番号・オーナー名を確認
- **GraphQL API失敗**: エラー表示して処理中断
- **個別issue処理失敗**: `/issync:complete-sub-issue`に委譲、次のissueを継続処理

## 実装上の注意

- **GraphQLクエリ制限**: 最大100件取得（ページネーション未対応）
- **API効率化**: GitHubProjectsClientは5分TTLキャッシュを使用
- **Status判定**: GraphQL responseで`ProjectV2ItemFieldSingleSelectValue`の`field.name="Status"`を確認

## 実行例

```bash
export ISSYNC_GITHUB_PROJECTS_NUMBER=4
export ISSYNC_GITHUB_PROJECTS_OWNER=MH4GF

/issync:process-retrospective-lane
```

出力例:
```
Status="retrospective"のissueを取得中...
取得完了: 8件 [62,66,68,69,73,76,78,81]

issue #62 を処理中...
✓ issue #62 完了
...

retrospectiveレーン処理完了
処理件数: 8件（成功: 8件、失敗: 0件）
```
