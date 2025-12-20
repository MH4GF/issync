---
description: コードベースを調査し、人間の判断が必要な論点を整理した進捗ドキュメントを作成
---

# /issync:plan: plan実行ワークフロー

進捗ドキュメント（`.issync/docs/plan-{番号}-{slug}.md`）を初期作成するコマンドです。以下の7ステップを自動化します：

1. 前提条件確認 & ファイル名決定 & issync init実行 & Stage設定（In Progress）
2. GitHub Issue内容の確認
3. コードベース調査（CRITICAL）
4. 基本セクションの記入
5. Open Questionsのフィルタリング
6. issync pushで同期 & Stage更新（To Review）
7. GitHub Projects Status & Stage自動変更 & ラベル付与（implement, Stage → To Start）

## 前提条件

- GitHub Issueが作成されている
- `ISSYNC_GITHUB_TOKEN` 環境変数が設定されている

## 実行ステップ

### ステップ1: 前提条件確認 & ファイル名決定 & issync init & Stage設定

**同期状態の確認**:
```bash
issync status <Issue URL>
```
→ 設定あり（`local_file`パス取得）→ ケースC
→ 設定なし → ケースA/B

**ファイル名決定**（ケースA/Bのみ）:
1. Issue URLから番号を抽出（例: `https://github.com/owner/repo/issues/123` → `123`）
2. Issueタイトルからslugを生成（小文字・ハイフン区切り・2-4単語）

**初期化**:
- **ケース A**: issync未初期化 → `issync init <Issue URL> --file .issync/docs/plan-{番号}-{slug}.md`
- **ケース B**: 進捗ドキュメント不存在 → 新規sync追加または `issync pull --issue <Issue URL>`
- **ケース C**: 準備完了 → 次へ

**Stage設定**: Projects連携モード有効時のみ、Stage→`in_progress`に設定。失敗時も処理継続。

```bash
issync projects set-stage "$ISSUE_URL" "in_progress"
```

**エラーハンドリング**: 環境変数未設定・認証不足・プロジェクト未発見時は警告表示し処理継続。

### ステップ2: GitHub Issue内容の確認

Issue内容を理解し、不明点をユーザーに確認。

### ステップ3: コードベース調査（CRITICAL）

**調査アプローチの決定**:

Issue内容を分析し、以下2点を判定:

**1. コードベース調査の複雑度**:
| 複雑度 | エージェント数 | 対象 |
|--------|--------------|------|
| Simple | 1 | 類似機能の実装パターン |
| Moderate | 2 | + テスト戦略 |
| Complex | 3 | + 技術スタック分析 |

**2. 外部調査の必要性（Agent 4追加条件）**:
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
  - **各ACに必ず検証方法を記載**（ステップ3調査結果に基づく）
  - **CRITICAL: 検証方法は必ずBashツールで実行可能なコマンドとして定義**
    - AIエージェントが自動実行できる形式にする
    - exit code 0 = 成功、非0 = 失敗で判定可能にする
  - **検証方法の優先順位**:
    1. 既存テストフレームワーク（Vitest/Jest/Bun Test等）- `bun test watch.test.ts`
    2. E2Eフレームワーク（Playwright等）- `pnpm test:e2e` - ブラウザ検証が必要な場合
    3. シェルスクリプト - `tsx scripts/verify.ts` - 継続的テスト化が困難な場合のみ（最終手段）
  - **テスト困難な場合**: メモし、ステップ5でOpen Questionsへ

**記入不要**（サンプル維持）: Specification, Decision Log, Outcomes & Retrospectives

### ステップ5: Open Questionsのフィルタリング

**人間の判断が必要な論点のみ**を抽出する。

**判断フロー**:
```
コードベース調査で解決可能？ → Yes → 記載しない
ドキュメント/Issue内に答えがある？ → Yes → 記載しない
実装時に自然と決まる詳細？ → Yes → 記載しない
→ Open Questionとして記載
```

**記載すべき論点**: アーキテクチャの分岐点、仕様の曖昧性、外部システム連携、テスト戦略が不明なAC

**目標**: 5-10項目

**自信度**（推奨案のみ）:

| 自信度 | 基準 | 例 |
|--------|------|-----|
| 🟢高 | 同一パターン確認済み | 「既存のXと同じ方式」 |
| 🟡中 | 類似パターンあり | 「Yを参考に調整」 |
| 🔴低 | 前例なし/外部依存/性能不明 | 「新規API」→ `⚠️検証項目`併記 |

**フォーマット**:
```markdown
**Q1: [質問タイトル]**

**検討案:**
- **[選択肢A]（推奨 🟢）**: [説明]
- **[選択肢B]**: [説明]
  - トレードオフ: [制約]
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

**エラーハンドリング**: 失敗時は警告表示し処理継続。

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
