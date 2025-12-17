---
description: planフェーズのプロセスを標準化し、コードベース調査を強制することで高品質な進捗ドキュメント作成を実現
---

# /issync:plan: plan実行ワークフロー

進捗ドキュメント（`.issync/docs/plan-{番号}-{slug}.md`）を初期作成するコマンドです。以下の7ステップを自動化します：

1. 前提条件確認 & ファイル名決定 & issync init実行 & Stage設定（In Progress）
2. GitHub Issue内容の確認
3. コードベース調査（CRITICAL）
4. 基本セクションの記入
5. Open Questionsの精査
6. issync pushで同期 & Stage更新（To Review）
7. GitHub Projects Status & Stage自動変更 & ラベル付与（implement, Stage → To Start）

**Note**: Template v7では、Tasksセクションが削除されています。タスクは `/issync:create-sub-issue` コマンドで作成します。

## コンテキスト

- **対象ステート**: plan（論点駆動開発ワークフロー）
- **ファイル命名**: `.issync/docs/plan-{番号}-{slug}.md`
  - 番号: Issue URLから抽出（例: `/issues/123` → `123`）
  - slug: Issueタイトルから生成（小文字・ハイフン区切り・2-4単語、例: `watch-daemon`）
- **コードベース調査優先**: Open Questionsを真に不明な点のみに絞るため、調査を先に実施

## 前提条件

- GitHub Issueが作成されている
- `ISSYNC_GITHUB_TOKEN` 環境変数が設定されている

## 実行ステップ

### ステップ1: 前提条件確認 & ファイル名決定 & issync init & Stage設定

**ファイル名決定**:
1. Issue URLを確認（例: `https://github.com/owner/repo/issues/123`）
2. 番号とslugを抽出・生成

**初期化**:
- **ケース A**: issync未初期化 → `issync init <Issue URL> --file .issync/docs/plan-{番号}-{slug}.md`
- **ケース B**: 進捗ドキュメント不存在 → 新規sync追加または `issync pull --issue <Issue URL>`
- **ケース C**: 準備完了 → 次へ

**Stage設定**: Projects連携モード有効時のみ、Stage→`in_progress`に設定。失敗時も処理継続。

```bash
issync projects set-stage "$ISSUE_URL" "in_progress"
```

**エラーハンドリング**: スクリプトが自動処理。環境変数未設定・認証不足・プロジェクト未発見時は警告表示し処理継続。

### ステップ2: GitHub Issue内容の確認

Issue内容を理解し、不明点をユーザーに確認。

### ステップ3: コードベース調査（CRITICAL）

⚠️ **最重要**: Open Questions記載前に必ず調査してください。

**調査アプローチの決定**:

Issue内容を分析し、以下2点を判定:

**1. コードベース調査の複雑度**:
| 複雑度 | エージェント数 | 対象 |
|--------|--------------|------|
| Simple | 1 | 類似機能の実装パターン |
| Moderate | 2 | + テスト戦略 |
| Complex | 3 | + 技術スタック分析 |

**2. 外部調査の必要性（Agent W追加条件）**:
- 外部ライブラリの新規導入 or APIの深い利用
- 新技術パターン（WebSocket、GraphQL等）の採用
- セキュリティ・パフォーマンスが重要な領域
- プロジェクト内に参考実装がない

**調査実行（Task toolによる並列実行）**:

**重要**: 必ず**単一メッセージで複数のTask tool呼び出し**を行うこと。

各エージェントに異なる調査対象を指示（フォーカスエリアはエージェントが柔軟に判断）:

```
# Agent 1: 類似機能の実装パターンを調査
Task(
  subagent_type="general-purpose",
  description="Find similar features and trace implementation patterns",
  prompt="""You are executing the codebase-explorer agent.
Read and follow: .claude-plugins/issync/agents/codebase-explorer.md

**調査対象**: [Issue機能]に類似する既存機能を見つけ、その実装パターンを包括的にトレースしてください。

**Investigation Context**:
- Issue: [Issue URL]
- Issue Title: [タイトル]
- Issue Description: [要約]

コードを包括的にトレースし、アーキテクチャ、抽象化、制御フローの理解に集中してください。
必ず5-10個の重要なファイルリストを含めてください。"""
)

# Agent 2: アーキテクチャと抽象化をマッピング（Moderate以上）
Task(
  subagent_type="general-purpose",
  description="Map architecture and abstractions for the feature area",
  prompt="""You are executing the codebase-explorer agent.
Read and follow: .claude-plugins/issync/agents/codebase-explorer.md

**調査対象**: [関連領域]のアーキテクチャと抽象化をマッピングし、コードを包括的にトレースしてください。

**Investigation Context**:
- Issue: [Issue URL]
- Issue Title: [タイトル]

テスト戦略、UIパターン、拡張ポイントなど、[Issue機能]に関連するパターンを特定してください。
必ず5-10個の重要なファイルリストを含めてください。"""
)

# Agent 3: 現在の実装を分析（Complexのみ）
Task(
  subagent_type="general-purpose",
  description="Analyze current implementation of related area",
  prompt="""You are executing the codebase-explorer agent.
Read and follow: .claude-plugins/issync/agents/codebase-explorer.md

**調査対象**: [既存機能/領域]の現在の実装を分析し、コードを包括的にトレースしてください。

**Investigation Context**:
- Issue: [Issue URL]
- Issue Title: [タイトル]

依存関係、技術スタック、制約などを特定してください。
必ず5-10個の重要なファイルリストを含めてください。"""
)

# Agent 4: 外部ベストプラクティス調査（条件付き）
Task(
  subagent_type="general-purpose",
  description="Research external best practices and documentation",
  prompt="""**調査対象**: [ライブラリ/技術名]の公式ドキュメントとベストプラクティス

**Context**:
- Issue: [Issue URL]
- 調査理由: [例: "Chokidar v4のAPI変更点", "GitHub APIレート制限対策"]

**調査方法**:
1. WebSearchで公式ドキュメント・技術記事を検索
2. Context7ツール（mcp__context7__resolve-library-id → mcp__context7__get-library-docs）でライブラリドキュメント取得

**出力**:
- 公式推奨パターン（コード例）
- アンチパターン
- パフォーマンス/セキュリティ注意点
- 参照URL一覧"""
)
```

**調査結果の集約**:

1. 各エージェントの調査結果を確認
2. **エージェントが特定した全ファイルを読んで深い理解を構築**
3. 重複する発見を統合、矛盾があれば優先順位付け
4. 統合結果を「Discoveries & Insights」セクションに記録:

```markdown
## Discoveries & Insights

### Investigation Summary (YYYY-MM-DD)

**調査した観点**: [調査対象1] / [調査対象2] / [調査対象3] / [外部調査（該当時）]

[Agent 1の調査結果をペースト]

[Agent 2の調査結果をペースト（存在する場合）]

[Agent 3の調査結果をペースト（存在する場合）]

[Agent 4の調査結果をペースト（存在する場合）]

### Synthesis & Key Takeaways

**Primary Pattern to Follow**: [最も重要なパターン]
**Test Strategy**: [テスト戦略のサマリー]
**Constraints**: [実装上の制約]
**External Best Practices**: [外部調査からの知見（該当時）]
```

### ステップ4: 基本セクションの記入

テンプレートに従い記入：
- Purpose/Overview
- Context & Direction
- Validation & Acceptance Criteria
  - **シナリオ形式で記述**（実装軸NG: 「関数実装」→ OK: 「操作すると結果表示」）
  - **各ACに必ず検証方法を記載**（ステップ4調査結果に基づく）
  - **CRITICAL: 検証方法は必ずBashツールで実行可能なコマンドとして定義**
    - AIエージェントが自動実行できる形式にする
    - exit code 0 = 成功、非0 = 失敗で判定可能にする
  - **検証方法の優先順位**:
    1. 既存テストフレームワーク（Vitest/Jest/Bun Test等）- `bun test watch.test.ts`
    2. E2Eフレームワーク（Playwright等）- `pnpm test:e2e` - ブラウザ検証が必要な場合
    3. シェルスクリプト - `tsx scripts/verify.ts` - 継続的テスト化が困難な場合のみ（最終手段）
  - **目的**: 実装完了の明確な基準を設ける。全検証コマンドが成功 = 実装完了
  - **テスト困難な場合**: メモし、ステップ5でOpen Questionsへ

**記入不要**（サンプル維持）: Specification, Decision Log, Outcomes & Retrospectives

### ステップ5: Open Questionsの精査

**記載基準**:

| 記載すべき ✅ | 記載すべきでない ❌ |
|-------------|------------------|
| アーキテクチャ上の選択肢 | コードを読めばわかる実装詳細 |
| 仕様の曖昧性 | ドキュメント記載済みの情報 |
| 外部システム連携方法 | 簡単な調査で解決可能な疑問 |
| パフォーマンス考慮事項 | |
| **受け入れ条件のテスト方法が不明** | |
| **既存パターンでカバーできないテストシナリオ** | |

**目標**: 5-10項目に絞る

**推奨案の自信度**: 推奨案のみに付与（非推奨案は不要）

- 🟢 **自信度:高** - 既存パターン確認済み、実装実績あり
- 🟡 **自信度:中** - 類似パターンあり、慎重に実装
- 🔴 **自信度:低** - 新アプローチ/外部連携/性能影響不明 → 実装時に慎重な検証が必要

**フォーマット例**:
```markdown
**Q1: [質問タイトル]**
- [質問の詳細]

**検討案:**
- **[選択肢A]（推奨 自信度:高🟢）**: [説明 + 推奨理由]
- **[選択肢B]**: [説明]
  - トレードオフ: [制約]

**Q2: [別の質問（自信度低の場合）]**
**検討案:**
- **[選択肢C]（推奨 自信度:低🔴）**: [説明]
  - **⚠️ 実装時に慎重な検証が必要**: [検証項目]

**Q3: AC2のテスト方法**
- [受け入れ条件の内容]を自動テストで検証する方法が不明

**検討案:**
- **[テスト手法A]（推奨 自信度:中🟡）**: [説明]
  - トレードオフ: [テストできない範囲や制約]
- **[テスト手法B]**: [説明]
  - トレードオフ: [実行時間やメンテナンス性の問題]
```

### ステップ6: GitHub Issueへの同期 & Stage更新

進捗ドキュメントをGitHub Issueに同期。

```bash
issync push
```

**Stage更新**: Projects連携モード有効時のみ、Stage→`to_review`に設定。失敗時も処理継続。

```bash
issync projects set-stage "$ISSUE_URL" "to_review"
```

### ステップ7: GitHub Projects Status & Stage自動変更 & ラベル付与

Projects連携モード有効時のみ、StatusとStageを自動変更。

**Status決定**: 常に `implement`
**Stage**: 常に `to_start`

```bash
issync projects set-status "$ISSUE_URL" "implement"
issync projects set-stage "$ISSUE_URL" "to_start"
```

**ラベル自動付与**: `issync:implement`ラベルを常に付与。

```bash
gh issue edit $ISSUE_NUMBER --add-label "issync:implement"
```

**エラー時**: ステップ1のエラーハンドリングと同様。

## 出力フォーマット

全ステップ完了後、以下の形式で作業成果を要約して表示：

```markdown
## Plan Phase Complete

**Progress Document**: {issue_url}

### Key Discoveries
- {ステップ3で発見した技術スタック、既存パターン、テスト戦略を2-3項目で具体的に要約}
- {参考になる既存実装やアーキテクチャの特徴}
- {プロジェクト固有の重要な制約や慣習}

### Open Questions ({総数N}件{自信度低がある場合: " | 🔴自信度低: {M}件"})
{Open Questionsの主要なテーマや懸念点を1-2文で要約。自信度低の項目がある場合は、実装時に慎重な検証が必要な理由を明記}

### Next Steps
1. Review document on GitHub and resolve Open Questions
2. Create sub-issues with `/issync:create-sub-issue` and begin implementation
   `issync:implement` label added → Auto-plan workflow triggered

**Status**: plan → implement (Stage: To Start)
```

**重要**: Key Discoveriesは実際の調査結果を具体的に記載。Open Questionsは優先レビュー論点を明示。Next Stepsは状況に応じて2または3を選択。

## 重要な注意事項

- **コードベース調査**: ステップ3を省略しない（省略すると不要なOpen Questionsが大量発生）
- **Open Questions**: コードで確認可能な情報は記載しない、5-10項目に絞る

## 補足: ステートマシンとの統合

**ワークフロー**:
```
GitHub Issue作成（Status: plan, Stage: To Start）
   ↓
/plan実行開始
   ↓
ステップ1: Stage自動変更（To Start → In Progress）※GitHub Projects連携モード有効時のみ
   ↓
ステップ2-5: コードベース調査 → 進捗ドキュメント作成
   ↓
ステップ6: issync push → Stage自動変更（In Progress → To Review）※GitHub Projects連携モード有効時のみ
   ↓
ステップ7: Status & Stage自動変更（Status: plan → implement, Stage: To Review → To Start）※GitHub Projects連携モード有効時のみ
   ↓
ステップ7: issync:implementラベル自動付与
   ↓
人間レビュー → サブissue作成 → 実装開始（Devin起動） または Devin自動起動
```

**重要**:
- Projects連携モード有効時のみ、StatusとStageを自動変更（人間の手動変更不要）
- Status変更で次フェーズを明示（implement = サブissue作成・実装）
- `issync:implement`ラベルを自動付与 → Devinが自動起動
