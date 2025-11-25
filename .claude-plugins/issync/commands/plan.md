---
description: planフェーズのプロセスを標準化し、コードベース調査を強制することで高品質な進捗ドキュメント作成を実現
---

# /issync:plan: plan実行ワークフロー

進捗ドキュメント（`.issync/docs/plan-{番号}-{slug}.md`）を初期作成するコマンドです。以下の8ステップを自動化します：

1. 環境変数確認 & モード決定
2. 前提条件確認 & ファイル名決定 & issync init実行 & Stage設定（In Progress）
3. GitHub Issue内容の確認
4. コードベース調査（CRITICAL）
5. 基本セクションの記入
6. Open Questionsの精査
7. issync pushで同期 & Stage更新（To Review）
8. GitHub Projects Status & Stage自動変更（自信度低あり → poc / なし → implement, Stage → To Start）

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

### ステップ1: 環境変数確認 & モード決定

GitHub Projects連携とラベル自動付与の有効化状態を確認し、以降のステップで使用するモードフラグを設定。

**環境変数**:
```bash
ISSYNC_GITHUB_PROJECTS_NUMBER         # Projects連携モード (例: "1")
ISSYNC_GITHUB_PROJECTS_OWNER_TYPE     # "user" または "org" (デフォルト: "user")
ISSYNC_LABELS_AUTOMATION               # ラベル自動付与モード ("true" で有効)
```

**モード決定**:
- **GitHub Projects連携**: `ISSYNC_GITHUB_PROJECTS_NUMBER`が設定されていれば有効 (未設定時はステップ2, 7, 8をスキップ)
- **ラベル自動付与**: `ISSYNC_LABELS_AUTOMATION="true"`で有効 (未設定時はステップ8のラベル付与をスキップ)

**出力**: 設定状態をユーザーに表示
```markdown
## Environment Check
**GitHub Projects Integration**: {有効/無効} - Project Number: {番号}, Owner Type: {タイプ}
**Label Automation**: {有効/無効}
```

### ステップ2: 前提条件確認 & ファイル名決定 & issync init & Stage設定

**ファイル名決定**:
1. Issue URLを確認（例: `https://github.com/owner/repo/issues/123`）
2. 番号とslugを抽出・生成

**初期化**:
- **ケース A**: issync未初期化 → `issync init <Issue URL> --file .issync/docs/plan-{番号}-{slug}.md`
- **ケース B**: 進捗ドキュメント不存在 → 新規sync追加または `issync pull --issue <Issue URL>`
- **ケース C**: 準備完了 → 次へ

**Stage設定**: Projects連携モード有効時のみ、Stage→`In Progress`に設定。失敗時も処理継続。

```bash
issync projects set-stage "$ISSUE_URL" "In Progress"
```

**エラーハンドリング**: スクリプトが自動処理。環境変数未設定・認証不足・プロジェクト未発見時は警告表示し処理継続。

### ステップ3: GitHub Issue内容の確認

Issue内容を理解し、不明点をユーザーに確認。

### ステップ4: コードベース調査（CRITICAL）

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

### ステップ5: 基本セクションの記入

テンプレートに従い記入：
- Purpose/Overview
- Context & Direction
- Validation & Acceptance Criteria (ステップ4で調査したテスト戦略に基づくテスト要件を含める)

**planフェーズでは記入しないセクション**（テンプレートのサンプルテキストを残す）：
- Specification / 仕様
- Decision Log
- Outcomes & Retrospectives

### ステップ6: Open Questionsの精査

**記載基準**:

| 記載すべき ✅ | 記載すべきでない ❌ |
|-------------|------------------|
| アーキテクチャ上の選択肢 | コードを読めばわかる実装詳細 |
| 仕様の曖昧性 | ドキュメント記載済みの情報 |
| 外部システム連携方法 | 簡単な調査で解決可能な疑問 |
| パフォーマンス考慮事項 | |

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
```

### ステップ7: GitHub Issueへの同期 & Stage更新

進捗ドキュメントをGitHub Issueに同期。

```bash
issync push
```

**Stage更新**: Projects連携モード有効時のみ、Stage→`To Review`に設定。失敗時も処理継続。

```bash
issync projects set-stage "$ISSUE_URL" "To Review"
```

### ステップ8: GitHub Projects Status & Stage自動変更 & ラベル付与

Projects連携モード有効時のみ、StatusとStageを自動変更。

**Status決定**: Open Questionsに自信度低(🔴)あり → `poc` / なし → `implement`
**Stage**: 常に `To Start`

```bash
issync projects set-status "$ISSUE_URL" "<poc または implement>"
issync projects set-stage "$ISSUE_URL" "To Start"
```

**ラベル自動付与**: ラベル自動付与モード有効時、Statusに応じたラベルを付与。

```bash
# Status=poc の場合
gh issue edit $ISSUE_NUMBER --add-label "issync:poc"

# Status=implement の場合
gh issue edit $ISSUE_NUMBER --add-label "issync:implement"
```

**エラー時**: ステップ2のエラーハンドリングと同様。

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
   {ISSYNC_LABELS_AUTOMATION=trueの場合} `issync:poc` label added → Devin will auto-start
3. {自信度低の項目がない場合} Create sub-issues with `/issync:create-sub-issue` and begin implementation
   {ISSYNC_LABELS_AUTOMATION=trueの場合} `issync:implement` label added → Devin will auto-start

**Status**: plan → {自信度低あり: poc / なし: implement} (Stage: To Start)
```

**重要**: Key Discoveriesは実際の調査結果を具体的に記載。Open Questionsは優先レビュー論点を明示。Next Stepsは状況に応じて2または3を選択。

## 重要な注意事項

- **環境変数確認**: ステップ1を必ず実行し、モードフラグに基づいて各ステップの処理を制御する
- **コードベース調査**: ステップ4を省略しない（省略すると不要なOpen Questionsが大量発生）
- **Open Questions**: コードで確認可能な情報は記載しない、5-10項目に絞る

## 補足: ステートマシンとの統合

**ワークフロー（自信度低の項目がある場合）**:
```
GitHub Issue作成（Status: plan, Stage: To Start）
   ↓
/plan実行開始 → ステップ1: 環境変数確認 & モード決定
   ↓
ステップ2: Stage自動変更（To Start → In Progress）※GitHub Projects連携モード有効時のみ
   ↓
ステップ3-6: コードベース調査 → 進捗ドキュメント作成 → 自信度低(🔴)の項目を検出
   ↓
ステップ7: issync push → Stage自動変更（In Progress → To Review）※GitHub Projects連携モード有効時のみ
   ↓
ステップ8: Status & Stage自動変更（Status: plan → poc, Stage: To Review → To Start）※GitHub Projects連携モード有効時のみ
   ↓
ステップ8: issync:pocラベル自動付与 ※ラベル自動付与モード有効時のみ
   ↓
人間レビュー → {ラベルなし} POC開始（Devin起動）
             → {ラベルあり} Devin自動起動
```

**ワークフロー（自信度低の項目がない場合）**:
```
GitHub Issue作成（Status: plan, Stage: To Start）
   ↓
/plan実行開始 → ステップ1: 環境変数確認 & モード決定
   ↓
ステップ2: Stage自動変更（To Start → In Progress）※GitHub Projects連携モード有効時のみ
   ↓
ステップ3-6: コードベース調査 → 進捗ドキュメント作成 → 自信度低の項目なし
   ↓
ステップ7: issync push → Stage自動変更（In Progress → To Review）※GitHub Projects連携モード有効時のみ
   ↓
ステップ8: Status & Stage自動変更（Status: plan → implement, Stage: To Review → To Start）※GitHub Projects連携モード有効時のみ
   ↓
ステップ8: issync:implementラベル自動付与 ※ラベル自動付与モード有効時のみ
   ↓
人間レビュー → {ラベルなし} サブissue作成 → 実装開始（Devin起動）
             → {ラベルあり} Devin自動起動
```

**重要**:
- ステップ1で2つのモード（Projects連携、ラベル自動付与）の有効/無効を決定
- Projects連携モード有効時のみ、StatusとStageを自動変更（人間の手動変更不要）
- Status変更で次フェーズを明示（poc = PoC検証、implement = サブissue作成・実装）
- ラベル自動付与モード有効時、Statusに応じたラベルを自動付与（`issync:poc` または `issync:implement`）→ Devinが自動起動
