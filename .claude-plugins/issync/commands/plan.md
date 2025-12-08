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
7. GitHub Projects Status & Stage自動変更 & ラベル付与（自信度低あり → poc / なし → implement, Stage → To Start）

**Note**: Template v7では、Tasksセクションが削除されています。タスクは `/issync:create-sub-issue` コマンドで作成します。

## コンテキスト

- **対象ステート**: plan（矛盾解消駆動開発ワークフロー）
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

**調査項目**:
- 類似機能・既存の実装パターン
- 使用している技術スタック・ライブラリ
- テストコードの存在と構造
  - **プロジェクトのテスト戦略を理解する**:
    - 使用しているテストフレームワーク（単体テスト、統合テスト、E2E）
    - 既存のテストパターン（ファイル配置、命名規則、カバレッジ）
    - UIコンポーネントの検証方法（Storybook等の有無）
- 関連ファイル・モジュール
- ドキュメント（README、CLAUDE.md、進捗ドキュメント等）

**調査方法** (状況に応じて選択):
```
ファイル・コード探索:
  Glob: **/*[関連するキーワード]*
  Grep: "関連する関数名やクラス名"
  Read: README.md, CLAUDE.md, docs/

設定ファイル確認:
  Read: package.json, pyproject.toml, Cargo.toml等

テストファイル確認:
  Glob: **/*.test.*, **/*.spec.*, **/*_test.*, test/**/*

実行による確認(必要に応じて):
  Bash: [テストコマンド/リントコマンド/ビルドコマンド等]
  ※ 実際のコマンドはプロジェクトの設定ファイルやREADMEから判断
```

**記録**: 発見内容をDiscoveries & Insightsセクションに記録

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
- 🔴 **自信度:低** - 新アプローチ/外部連携/性能影響不明 → **pocフェーズで検証必須**

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
  - **⚠️ PoC必須**: [検証項目]

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

**Status決定**: Open Questionsに自信度低(🔴)あり → `poc` / なし → `implement`
**Stage**: 常に `to_start`

```bash
issync projects set-status "$ISSUE_URL" "<poc または implement>"
issync projects set-stage "$ISSUE_URL" "to_start"
```

**ラベル自動付与**: Statusに応じたラベルを常に付与。

```bash
# Status=poc の場合
gh issue edit $ISSUE_NUMBER --add-label "issync:poc"

# Status=implement の場合
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
{Open Questionsの主要なテーマや懸念点を1-2文で要約。自信度低の項目がある場合は、POC検証が必要な理由と検証項目を明記}

### Next Steps
1. Review document on GitHub and resolve Open Questions
2. {自信度低の項目がある場合} Start POC to validate {具体的な検証項目（例: "performance impact of polling approach", "feasibility of GraphQL mutation")}
   `issync:poc` label added → Auto-plan workflow triggered
3. {自信度低の項目がない場合} Create sub-issues with `/issync:create-sub-issue` and begin implementation
   `issync:implement` label added → Auto-plan workflow triggered

**Status**: plan → {自信度低あり: poc / なし: implement} (Stage: To Start)
```

**重要**: Key Discoveriesは実際の調査結果を具体的に記載。Open Questionsは優先レビュー論点を明示。Next Stepsは状況に応じて2または3を選択。

## 重要な注意事項

- **コードベース調査**: ステップ3を省略しない（省略すると不要なOpen Questionsが大量発生）
- **Open Questions**: コードで確認可能な情報は記載しない、5-10項目に絞る

## 補足: ステートマシンとの統合

**ワークフロー（自信度低の項目がある場合）**:
```
GitHub Issue作成（Status: plan, Stage: To Start）
   ↓
/plan実行開始
   ↓
ステップ1: Stage自動変更（To Start → In Progress）※GitHub Projects連携モード有効時のみ
   ↓
ステップ2-5: コードベース調査 → 進捗ドキュメント作成 → 自信度低(🔴)の項目を検出
   ↓
ステップ6: issync push → Stage自動変更（In Progress → To Review）※GitHub Projects連携モード有効時のみ
   ↓
ステップ7: Status & Stage自動変更（Status: plan → poc, Stage: To Review → To Start）※GitHub Projects連携モード有効時のみ
   ↓
ステップ7: issync:pocラベル自動付与
   ↓
人間レビュー → POC開始（Devin起動） または Devin自動起動
```

**ワークフロー（自信度低の項目がない場合）**:
```
GitHub Issue作成（Status: plan, Stage: To Start）
   ↓
/plan実行開始
   ↓
ステップ1: Stage自動変更（To Start → In Progress）※GitHub Projects連携モード有効時のみ
   ↓
ステップ2-5: コードベース調査 → 進捗ドキュメント作成 → 自信度低の項目なし
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
- Status変更で次フェーズを明示（poc = PoC検証、implement = サブissue作成・実装）
- Statusに応じたラベルを常に自動付与（`issync:poc` または `issync:implement`）→ Devinが自動起動
