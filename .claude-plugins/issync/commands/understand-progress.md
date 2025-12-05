---
description: 進捗ドキュメントを選択してコンテキストを理解
---

# /issync:understand-progress: 進捗ドキュメントコンテキスト読み込みコマンド

あなたは矛盾解消駆動開発を実践するAIエージェントです。このコマンドは、セッション開始時に同期中の進捗ドキュメントを選択し、Claude CodeのReadツールで効率的に読み込むサポートをします。

## 使用方法

```bash
/issync:understand-progress https://github.com/owner/repo/issues/123 # Issue URL指定（必須）
```

**引数**: `issue_url` (必須) - GitHub Issue URL

## 実行フロー

### 1. Issue URLの処理

`issync status <issue URL>`で設定を取得。未同期の場合は`issync init <issue_url>`で同期を開始します。

### 2. 進捗ドキュメントの読み込み

選択されたファイルをReadツールで読み込む。

### 3. Sub-issuesの取得と分析（AIエージェントのコンテキスト理解）

**目的**: AIエージェントがプロジェクトの全体像を把握するため、親issueに紐づくsub-issuesを取得・分析します。

#### Sub-issuesの取得

GitHub REST APIの専用エンドポイントを使用:

```bash
gh api "/repos/{owner}/{repo}/issues/{issue_number}/sub_issues" \
  --jq '.[] | {number, title, state, url}'
```

**注**: `{owner}`, `{repo}`, `{issue_number}`は進捗ドキュメントに紐づくissue URLから抽出してください。

#### AIエージェントによる内部分析

sub-issuesを分析してプロジェクトコンテキストを把握:
- CLOSED issues: 実装済み機能、解決済み問題（`Outcomes & Retrospectives`と照合）
- OPEN issues: 残タスク、優先度、次のアクション候補
- 完了度: 進捗状況とフェーズ（plan/poc/implement等）

**重要**: 詳細はAI内部で保持し、ユーザーには簡潔なサマリーのみを返す

#### 最近のコミット履歴の確認

プロジェクトの実装状況を理解するため、最近のコミット履歴を確認:

```bash
git log --oneline -20
```

### 4. 作業中の進捗ドキュメント更新（重要）

作業開始時は**進捗ドキュメントを継続的に更新**してください。

**更新タイミング:**
- 主要な決定時: `Decision Log`を更新
- 実装進捗/発見時: `Discoveries & Insights`を更新(技術的制約、複雑性、新たなタスクの発見、失敗・エラー含む)
- Open Questions解消/新規疑問時: 該当項目を更新/追加
- フェーズ完了時: `Outcomes & Retrospectives`を更新
- フェーズ移行時: `Current Status`セクションを更新

**更新方法:**
- Edit/Write/Updateツールでセクション単位更新（ファイル全体の書き換えは避ける）
- 更新後は`issync push`で同期
- **ユーザーへの確認は不要**: 更新判断はAIエージェントが自律的に行う
- **高頻度更新を推奨**: 小さな進捗でもこまめに記録する方が評価される

**Single Source of Truth**: 進捗ドキュメントはプロジェクトの現在の状態を表す唯一の真実の情報源

## 出力フォーマット

```markdown
## /issync:understand-progress 実行結果

✅ コンテキストを理解しました

**ファイル**: <file_path> (<total_lines>行)
**Issue**: <issue_url>
**最終同期**: <last_synced_at>
**Sub-issues**: <total_count>件（OPEN: <open_count>, CLOSED: <closed_count>）
**プロジェクト状態**: <phase_and_progress_summary>

[500行を超えている場合のみ表示]
⚠️ **ドキュメントサイズ警告**: 500行を超えています
`/compact-progress-document`で圧縮を推奨（テンプレート準拠、重複削減、完了タスク整理）

次のアクション:
- Open Questionsを確認し、必要に応じて解消
- **作業を進める際は、進捗ドキュメントを継続的に更新**（詳細はステップ4参照）
- 次のステップ（POC/実装等）を開始
```

**注**: 詳細なsub-issuesリストはAI内部で保持。必要時にユーザーの質問に回答可

## 重要な注意事項

1. **自動初期化**: 指定されたIssue URLが未同期の場合は`issync init`で同期開始
2. **シンプルな責務**: Issue URLからファイルを特定、読み込み、sub-issues分析に特化
3. **Readツール使用**: セクション抽出や整形はReadツールに任せる
4. **エラーハンドリング**: 同期設定が存在しない場合やissync init失敗時は明確なエラーメッセージを表示

## 実行を開始

それでは、上記のフローに従って進捗ドキュメントの選択と読み込みを開始してください。
