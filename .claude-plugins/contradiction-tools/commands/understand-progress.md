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

### 1. 引数の判定と処理

**引数がある場合** (Issue URL指定):

1. `issync list` コマンドを実行して、同期中のファイル一覧を取得
2. 引数のIssue URLと一致する同期設定を検索
3. **見つかった場合**: そのlocal_fileをステップ3で使用
4. **見つからない場合**: `issync init <issue_url>` を実行して新規同期を開始
   ```bash
   issync init https://github.com/owner/repo/issues/123
   ```
   - init後、再度 `issync list` で local_file を確認
   - 取得したlocal_fileをステップ3で使用

**引数がない場合**: 次のステップ2へ進む

### 2. state.ymlからの選択（引数がない場合のみ）

`issync list` コマンドを実行して、同期中のファイル一覧を取得してください。

```bash
issync list
```

このコマンドは state.yml から全同期設定を読み込み、人間が読みやすいテーブル形式で表示します。
出力から issue_url と local_file の情報を取得できます。

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

選択されたファイルをClaude CodeのReadツールで読み込んでください。

```
選択された進捗ドキュメントを読み込みます: <file_path>
```

そして、Readツールを使用してファイルを読み込んでください。

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

**注**: この概要表示は任意です。ファイルが大きい場合やユーザーが要求した場合のみ表示してください。

## 出力フォーマット

ファイル選択と読み込み完了後、簡潔なサマリーを提供してください：

```markdown
## /understand-progress 実行結果

✅ 進捗ドキュメントを読み込みました

**ファイル**: <file_path>
**Issue**: <issue_url>
**最終同期**: <last_synced_at>

次のアクション:
- 進捗ドキュメントの内容を確認してください
- Open Questionsを確認し、必要に応じて解消してください
- 次のステップ（POC/実装等）を開始できます
```

## 重要な注意事項

1. **Issue URL指定**: 引数指定時はGitHub Issue URL形式で指定
2. **自動初期化**: Issue URLが未同期の場合、`issync init` を自動実行して同期を開始
3. **state.yml優先**: 引数がない場合はstate.ymlから選択
4. **Readツール使用**: セクション抽出や整形はClaude CodeのReadツールに任せる
5. **シンプルな責務**: このコマンドはファイル選択と読み込みを担当
6. **エラーハンドリング**: state.yml不在時やissync initの失敗時は明確なエラーメッセージを表示

## 実行を開始

それでは、上記のフローに従って進捗ドキュメントの選択と読み込みを開始してください。
