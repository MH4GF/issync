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

### ステップ2: 実装の開始

進捗ドキュメントの`Specification / 仕様`セクションに従って、実装を開始してください。

**実装の進め方:**
1. 必要なファイルをReadツールで読み込む
2. コードの変更をEditツールまたはWriteツールで行う
3. テストコードの追加・更新（`Validation & Acceptance Criteria`に基づく）
4. 実装が完了したら、テストを実行して動作確認

### ステップ3: 進捗ドキュメントの継続的更新（**最重要**）

実装を進める中で、**必ず進捗ドキュメントを継続的に更新してください**。

**更新タイミング:**
- 機能実装完了時 → `Discoveries & Insights`に発見を記録
- 新しい疑問発生時 → `Open Questions`に追加
- Follow-up事項発生時 → `Follow-up Issues`に追加
- 仕様明確化時 → `Specification / 仕様`を更新

**更新方法:** Editツールでセクション単位で更新し、`issync push`で同期。進捗ドキュメントはSingle Source of Truthであり、他のセッションや将来の作業でコンテキストを正確に把握するための唯一の情報源です。

### ステップ4: テストの実行

実装が完了したら、プロジェクトのテストやチェックを実行してください：
- 単体テストの実行
- 型チェックの実行
- リンター・フォーマッターの実行

テスト失敗時はエラーを修正して再実行。プロジェクト固有のコマンドは`package.json`の`scripts`セクションや、プロジェクトの`CLAUDE.md`を参照してください。

### ステップ5: 進捗ドキュメントの最終同期

すべての実装とテストが完了したら、進捗ドキュメントの変更をGitHub Issueに同期してください。

```bash
issync push
```

### ステップ6: Git commitとPR作成

1. 変更をステージング:
   ```bash
   git add <変更したファイル>
   ```

2. コミットを作成:
   ```bash
   git commit -m "<コミットメッセージ>

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>"
   ```

3. リモートにプッシュ:
   ```bash
   git push origin <ブランチ名>
   ```

4. PRを作成（GitHub Actionsから実行の場合は、PR URLを提供）

## 重要な注意事項

1. **進捗ドキュメント駆動**: `Specification / 仕様`に基づいて実装
2. **継続的更新**: 実装中は常に進捗ドキュメントを更新（最重要）
3. **テスト駆動**: `Validation & Acceptance Criteria`に基づいてテスト追加・実行
4. **issync連携**: 作業後は`issync push`で同期
5. **Status変更なし**: GitHub Projects Statusの変更は行わない（PRマージ時に自動変更）

## 実行を開始

それでは、上記のフローに従って実装を開始してください。
