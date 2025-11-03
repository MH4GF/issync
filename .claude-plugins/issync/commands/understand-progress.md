---
description: 進捗ドキュメントを選択してコンテキストを理解
---

# /understand-progress: 進捗ドキュメントコンテキスト読み込みコマンド

あなたは矛盾解消駆動開発を実践するAIエージェントです。このコマンドは、セッション開始時にstate.ymlから読み込むべき進捗ドキュメントを選択し、Claude CodeのReadツールで効率的に読み込むサポートをします。

## 使用方法

```bash
/understand-progress                                          # 引数なし: state.ymlから選択
/understand-progress https://github.com/owner/repo/issues/123 # Issue URL指定
```

**引数**:
- `issue_url` (オプション): GitHub Issue URL
  - 省略時: state.ymlから同期中のファイルを選択
  - Issue URL指定: `/understand-progress https://github.com/owner/repo/issues/123`

## 実行フロー

### 1. 引数の判定

- **引数あり** (Issue URL指定): `issync list`で一致する設定を検索。未同期の場合は`issync init <issue_url>`で同期を開始
- **引数なし**: ステップ2へ進む

### 2. state.ymlからの選択（引数がない場合のみ）

`issync list`で同期中のファイル一覧を取得:

```bash
issync list
```

**複数ファイルがある場合**: 選択を促してください
```
読み込む進捗ドキュメントを選択してください:
1. .issync/docs/plan-5829.md (最終同期: 2025-10-21T03:20:34Z, Issue: route06/liam-internal/issues/5829)
2. .issync/docs/plan-5883-context-reader-command.md (最終同期: 2025-10-21T03:30:00Z, Issue: route06/liam-internal/issues/5883)

番号を入力してください (1-2):
```

**1つのみの場合**: 確認を表示して自動選択
```
読み込む進捗ドキュメント: .issync/docs/plan-5883-context-reader-command.md
  最終同期: 2025-10-21T03:30:00Z
  Issue: route06/liam-internal/issues/5883

このファイルを読み込みますか? (y/n)
```

### 3. 進捗ドキュメントの読み込み

選択されたファイルをReadツールで読み込む。

### 4. コンテキスト理解のサポート（オプション）

ファイル読み込み後、以下の情報を簡潔に表示すると便利です：

```markdown
## 進捗ドキュメントの概要

**Issue**: [issue_url]
**最終同期**: [last_synced_at]

**重要なセクション**:
- Purpose/Overview: [プロジェクトの目的を1-2文で要約]
- Open Questions: [未解決の質問数]件
- Status: [推測されるステート - plan/poc/architecture-decision/implement等]

必要に応じて、特定のセクションを再度Readツールで詳細確認できます。
```

**注**: 概要表示は任意（ファイルが大きい場合やユーザー要求時のみ）。

### 5. 作業中の進捗ドキュメント更新（重要）

進捗ドキュメントを読み込んだ後、ユーザーの指示を受けて作業を開始する場合は、**必ず進捗ドキュメントを継続的に更新しながら作業を進めてください**。

**更新タイミング:**
- **主要な決定時**: アーキテクチャ決定や設計方針が決まった際は、`Architecture Decisions`セクションを更新
- **実装進捗時**: コード変更や機能実装が完了した際は、`Implementation Progress`セクションを更新
- **Open Questions解消時**: 未解決の質問が解消されたら、該当項目を削除または回答を記録
- **新しい疑問発生時**: 作業中に新たな問題や疑問が発生したら、`Open Questions`に追加
- **フェーズ移行時**: POC完了、実装開始などのフェーズ移行時は、`Status`セクションを更新

**更新方法:**
- EditツールまたはWrite/Updateツールを使用して進捗ドキュメントを更新
- セクション単位での部分更新を推奨（ファイル全体の書き換えは避ける）
- 更新後は`issync push`を実行してGitHub Issueに同期する

**進捗ドキュメントはSingle Source of Truth**: GitHub Issueコメントと同期される進捗ドキュメントは、プロジェクトの現在の状態を表す唯一の真実の情報源です。継続的な更新により、他のセッションや将来の作業でコンテキストを正確に把握できます。

## 出力フォーマット

ファイル選択と読み込み完了後、簡潔なサマリーを提供してください：

```markdown
## /understand-progress 実行結果

✅ 進捗ドキュメントを読み込みました

**ファイル**: <file_path>
**Issue**: <issue_url>
**最終同期**: <last_synced_at>

次のアクション:
- 進捗ドキュメントの内容を確認
- Open Questionsを確認し、必要に応じて解消
- **作業を進める際は、進捗ドキュメントを継続的に更新**（詳細はステップ5参照）
- 次のステップ（POC/実装等）を開始
```

## 重要な注意事項

1. **Issue URL指定**: GitHub Issue URL形式で指定
2. **自動初期化**: 未同期の場合は`issync init`で同期を開始
3. **state.yml優先**: 引数なしの場合はstate.ymlから選択
4. **Readツール使用**: セクション抽出や整形はReadツールに任せる
5. **シンプルな責務**: ファイル選択と読み込みを担当
6. **進捗ドキュメント更新**: 作業中は継続的に更新（EditツールまたはWrite/Updateツール）
7. **エラーハンドリング**: state.yml不在時やissync init失敗時は明確なエラーメッセージを表示

## 実行を開始

それでは、上記のフローに従って進捗ドキュメントの選択と読み込みを開始してください。
