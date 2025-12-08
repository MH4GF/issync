---
description: 進捗ドキュメントに基づいた実装を進め、作業中は継続的にドキュメントを更新
---

# /issync:implement: 実装フェーズ自動化コマンド

あなたは矛盾解消駆動開発を実践するAIエージェントです。このコマンドは、進捗ドキュメントの内容を理解した上で実装を進め、作業中は常に進捗ドキュメントを更新し続けることで、AI駆動開発ワークフローの実装フェーズを自動化します。

## 使用方法

```bash
/issync:implement https://github.com/owner/repo/issues/123 # Issue URL指定
/issync:implement 123                                       # Issue番号指定
```

## コンテキスト

このコマンドは「矛盾解消駆動開発」ワークフローの**implementフェーズ**で使用します：
- **実行タイミング**: `implement`ステート（アーキテクチャ決定後、本実装フェーズ）
- 進捗ドキュメントの`Specification / 仕様`セクションに基づいて実装を進める
- 実装中の意思決定や進捗を常に進捗ドキュメントに記録（Single Source of Truth維持）
- GitHub Actions（Claude Code Action）からの実行を想定

## 前提条件

プロジェクト全体の前提条件は`README.md`を参照。このコマンド固有の前提条件:
- 進捗ドキュメントが既に作成されている（`/issync:plan`実行済み）
- アーキテクチャ決定が完了している（`Specification / 仕様`セクションが記入済み）

## 実行フロー

### ステップ1: 進捗ドキュメントの理解

**既に進捗ドキュメントを理解している場合は、このステップをスキップして直接ステップ2に進んでください。**

進捗ドキュメントをまだ読み込んでいない場合は、`/issync:understand-progress`コマンドを内部で呼び出して、進捗ドキュメントを読み込みます。

```bash
/issync:understand-progress <issue_url_or_number>
```

このコマンドに指定された引数（Issue URLまたはIssue番号）をそのまま渡してください。

### ステップ2: リグレッション確認（実装前の必須チェック）

新しい実装を始める前に、既存のテストが通ることを確認してください。プロジェクト固有のテストコマンドは`CLAUDE.md`を参照。

**テスト失敗時**: 新機能の実装より既存機能の修復を優先。進捗ドキュメントの`Open Questions`に問題を記録し、修正してから次に進みます。

### ステップ3: 実装の開始

進捗ドキュメントの`Specification / 仕様`セクションに従って、実装を開始してください。

**実装の進め方:**
1. 必要なファイルをReadツールで読み込む
2. コードの変更をEditツールまたはWriteツールで行う
3. テストコードの追加・更新（`Validation & Acceptance Criteria`に基づく）
4. 実装が完了したら、テストを実行して動作確認

### ステップ4: 進捗ドキュメントの継続的更新（**最重要**）

実装を進める中で、**必ず進捗ドキュメントを継続的に更新してください**。

**更新タイミング:**
- 機能実装完了時 → `Discoveries & Insights`に発見を記録
- 新しい疑問発生時 → `Open Questions`に追加
- Follow-up事項発生時 → `Follow-up Issues`に追加
- 仕様明確化時 → `Specification / 仕様`を更新

**更新方法:** Editツールでセクション単位で更新し、`issync push`で同期。

### ステップ5: テストの実行

実装が完了したら、以下を実行してください：

**5-1. 受け入れ条件の検証（必須）**

進捗ドキュメントの`Validation & Acceptance Criteria`に記載された**全ての検証コマンド**を実行し、exit code 0を確認：
- 各ACの検証コマンドを順番に実行
- 失敗した場合は実装を修正して再実行
- **全検証コマンド成功 = 実装完了**

**5-2. リグレッションテスト**

プロジェクト全体のテストやチェックを実行：
- 単体テストの実行
- 型チェックの実行
- リンター・フォーマッターの実行

プロジェクト固有のコマンドは`CLAUDE.md`や`package.json`を参照。テスト失敗時はエラーを修正して再実行。

### ステップ5.5: コードレビュー（品質ゲート）

全テストが通った後、変更をステージングし、3つの観点で並列レビュー:

```bash
git add <実装ファイル>
```

**3つのTask toolを単一メッセージで並列呼び出し**:

| subagent_type | description | prompt（観点） |
|---------------|-------------|----------------|
| code-reviewer | Review for simplicity | 【観点: コードの簡潔性】'Less is More' 原則、DRY違反、不要な複雑さ |
| code-reviewer | Review for bugs/security | 【観点: バグ・セキュリティ】Null/undefined処理、エラーハンドリング、脆弱性 |
| code-reviewer | Review for conventions | 【観点: プロジェクト規約】Biomeルール、テストカバレッジ、命名規則 |

エージェントはJSON形式で信頼度80+の問題のみ報告（詳細は`code-reviewer`エージェント定義参照）。

**結果に基づくアクション**:
- **Fix Now**: 指摘事項を修正 → ステップ5に戻る
- **Defer to Follow-up**: `Follow-up Issues`に追加 → ステップ6へ
- **Skip Review**: 無視 → ステップ6へ（Critical Issues時は警告）

**エッジケース**: 変更なし/全パス → ステップ6へ、エージェントエラー → リトライ or スキップ

### ステップ6: 変更のコミット

機能の実装が完了し、全てのテストが通ったら、変更をコミットしてください。

**Git Safety Protocol**:
- **NEVER update the git config**
- **NEVER run destructive/irreversible git commands** (like push --force, hard reset, etc) unless the user explicitly requests them
- **NEVER skip hooks** (--no-verify, --no-gpg-sign, etc) unless the user explicitly requests it
- **Avoid git commit --amend** unless user explicitly requested or adding edits from pre-commit hook
- Before amending: ALWAYS check authorship (`git log -1 --format='%an %ae'`)

**コミット手順**:

1. 事前確認と変更のステージング（並列実行）:
```bash
git status  # 変更ファイルを確認
git diff    # 変更内容の詳細を確認
git log --oneline -10  # 既存のコミットメッセージスタイルを確認
git add <変更したファイル>  # 変更をステージング
```

2. 詳細なコミットメッセージでコミット（**HEREDOC形式必須**）:
```bash
git commit -m "$(cat <<'EOF'
<1行目: 変更の性質と要約（例: feat: 〜実装, fix: 〜修正）>

- <変更内容1（何を・なぜを含める）>
- <変更内容2>
- テスト: <実行したテストの内容>
- 進捗ドキュメント: <更新したセクション>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

3. コミット後の確認:
```bash
git status  # "nothing to commit"を確認
```

**注意事項**:
- 実行していないテストや未完了の実装を記載しない
- 秘密情報（.env、credentials.jsonなど）をコミットしない

### ステップ7: セッション終了（クリーンな状態の維持）

コンテキストが不足してきた場合や作業が一区切りついた場合、**作業途中であっても**必ず以下を実行してクリーンな状態で終了してください。

**終了手順**:

1. **進捗ドキュメントを更新して同期**:
   - 未解決事項を`Open Questions`に記録
   - 次のセッションへの引き継ぎ事項を`Discoveries & Insights`に記録
   - 今セッションで実装した内容を`Specification / 仕様`または`Discoveries & Insights`に記録
   - `issync push`で同期

2. **ステップ5のテストを再実行**してパスを確認

3. **ステップ6の手順で変更をコミット**（作業途中でもWIPコミット可）

4. **リモートにプッシュ**: `git push`

**必須要件**（全て満たすこと）:
- ✅ 全ての受け入れ条件の検証コマンドが成功（進捗ドキュメントの`Validation & Acceptance Criteria`記載分）
- ✅ 全ての変更がコミット済み（`git status`が"nothing to commit"）
- ✅ 進捗ドキュメントがリモートと同期済み（`issync push`完了）
- ✅ リグレッションテストが全て通っている（壊れた状態で終了しない）
- ✅ 変更がリモートにプッシュ済み
- ✅ 引き継ぎ事項が進捗ドキュメントに記録済み

## 重要な注意事項

1. **進捗ドキュメント駆動**: `Specification / 仕様`に基づいて実装
2. **継続的更新**: 実装中は常に進捗ドキュメントを更新（最重要）
3. **テスト駆動**: `Validation & Acceptance Criteria`に基づいてテスト追加・実行
4. **issync連携**: 作業後は`issync push`で同期
5. **Status変更なし**: GitHub Projects Statusの変更は行わない（PRマージ時に自動変更）

## 実行を開始

それでは、上記のフローに従って実装を開始してください。
