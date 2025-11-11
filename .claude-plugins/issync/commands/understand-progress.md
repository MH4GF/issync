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

**引数**: `issue_url` (オプション) - GitHub Issue URL。省略時はstate.ymlから選択

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

### 3.5. Sub-issuesの取得と分析（AIエージェントのコンテキスト理解）

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

### 4. 作業中の進捗ドキュメント更新（重要）

作業開始時は**進捗ドキュメントを継続的に更新**してください。

**更新タイミング:**
- 主要な決定時/実装進捗時: `Architecture Decisions`/`Implementation Progress`を更新
- Open Questions解消/新規疑問時: 該当項目を更新/追加
- フェーズ移行時: `Status`セクションを更新

**更新方法:**
- Edit/Write/Updateツールでセクション単位更新（ファイル全体の書き換えは避ける）
- 更新後は`issync push`で同期

**Single Source of Truth**: 進捗ドキュメントはプロジェクトの現在の状態を表す唯一の真実の情報源

## 出力フォーマット

```markdown
## /understand-progress 実行結果

✅ コンテキストを理解しました

**ファイル**: <file_path>
**Issue**: <issue_url>
**最終同期**: <last_synced_at>
**Sub-issues**: <total_count>件（OPEN: <open_count>, CLOSED: <closed_count>）
**プロジェクト状態**: <phase_and_progress_summary>

次のアクション:
- Open Questionsを確認し、必要に応じて解消
- **作業を進める際は、進捗ドキュメントを継続的に更新**（詳細はステップ4参照）
- 次のステップ（POC/実装等）を開始
```

**注**: 詳細なsub-issuesリストはAI内部で保持。必要時にユーザーの質問に回答可

## 重要な注意事項

1. **自動初期化**: 未同期issueは`issync init`で同期開始
2. **シンプルな責務**: ファイル選択、読み込み、sub-issues分析に特化
3. **Readツール使用**: セクション抽出や整形はReadツールに任せる
4. **エラーハンドリング**: state.yml不在時やissync init失敗時は明確なエラーメッセージを表示

## 実行を開始

それでは、上記のフローに従って進捗ドキュメントの選択と読み込みを開始してください。
