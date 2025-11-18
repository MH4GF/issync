---
description: 自信度を上げるための調査・検証を中心に行い、発見を進捗ドキュメントに記録
---

# /issync:poc: POC調査フェーズ自動化コマンド

あなたは矛盾解消駆動開発を実践するAIエージェントです。このコマンドは、進捗ドキュメントの内容を理解した上で調査・検証を進め、発見した知見を継続的にドキュメントに記録することで、AI駆動開発ワークフローのPOCフェーズを自動化します。

## 使用方法

```bash
/issync:poc                                          # state.ymlから選択
/issync:poc https://github.com/owner/repo/issues/123 # Issue URL指定
/issync:poc 123                                       # Issue番号指定
```

## コンテキスト

このコマンドは「矛盾解消駆動開発」ワークフローの**pocステート**で使用します：
- **実行タイミング**: `poc`ステート（自信度が低く、技術的検証が必要なフェーズ）
- 進捗ドキュメントの`Open Questions`や`Context & Direction`に基づいて調査・検証を進める
- **実装は破棄される前提** - コードよりも知見の獲得が目的
- 調査中の発見や疑問を常に進捗ドキュメントに記録（Single Source of Truth維持）
- 最終的にPOC PRを作成し、人間がレビュー後に`/issync:review-poc`で知見を整理

## 前提条件

プロジェクト全体の前提条件は`README.md`を参照。このコマンド固有の前提条件:
- 進捗ドキュメントが既に作成されている（`/issync:plan`実行済み）
- `Open Questions`に調査すべき論点が記載されている
- または、技術的な不確実性がある状態

## 実行フロー

### ステップ1: 進捗ドキュメントの理解

まず、`/issync:understand-progress`コマンドを内部で呼び出して、進捗ドキュメントを読み込みます。

```bash
/issync:understand-progress <issue_url_or_number>
```

引数が指定されている場合はそのまま渡し、指定されていない場合は引数なしで実行します。

### ステップ2: 進捗ドキュメントの確認

特に`Open Questions`（調査すべき論点）と`Context & Direction`を確認してください。

### ステップ3: 調査・検証の開始

`Open Questions`に基づいて調査・検証を開始してください。

**進め方:**
1. 技術調査（ドキュメント、API仕様、既存コード）
2. 実装による検証（小規模なコード作成、動作確認）
3. 発見を随時ドキュメントに記録

**重要**: 目的は知見の獲得です。コード品質は優先度が低いです。

### ステップ4: 進捗ドキュメントの継続的更新（**最重要**）

調査を進める中で、**必ず進捗ドキュメントを継続的に更新してください**。

**更新タイミング:**
- 技術的事実を発見 → `Discoveries & Insights`に記録
- 新しい疑問が発生 → `Open Questions`に追加
- 既存の質問が解決 → `Open Questions`から削除し、`Decision Log`に記録
- Follow-up事項発生 → `Follow-up Issues`に追加
- Acceptance Criteriaの達成/未達成が判明 → `Discoveries & Insights`に根拠を記録

**更新方法:** Editツールでセクション単位で更新し、`issync push`で同期。進捗ドキュメントはSingle Source of Truthであり、POCの知見を共有するための唯一の情報源です。

**Discoveries & Insights記入例:**
```markdown
## Discoveries & Insights

**YYYY-MM-DD: [発見のタイトル]**
- **発見**: [発見した技術的事実 - できる/できない、制約、特性など]
- **学び**: [この発見が実装にどう影響するか]
- **検証方法**: [どのように確認したか - コード実装、ドキュメント調査など]
```

**Open Questions更新例:**
```markdown
## Open Questions

### Q1: ~~解決済み: XXXは可能か？~~

**解決**: YYYによって実現可能と判明（YYYY-MM-DD）

---

### Q2: 新たな疑問: ZZZの最適な設定値は？

**背景**: POCでAAAを実装したところ、BBBの設定値によって挙動が変わることが判明
```

### ステップ5: テストの実行（オプショナル）

必要に応じて軽量なテスト実行。全テスト合格は必須ではありません。

```bash
bun test <検証したい機能のテストファイル>
```

### ステップ6: 進捗ドキュメントの最終同期

調査・検証が完了したら、進捗ドキュメントの変更をGitHub Issueに同期してください。

```bash
issync push
```

### ステップ7: Git commitとPR作成

POCの実装と発見を記録するため、PRを作成します。

```bash
git add <変更したファイル>
git commit -m "poc: <POCの目的や検証内容>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin <ブランチ名>

gh pr create --title "POC: <検証内容>" --body "$(cat <<'EOF'
## POCの目的
<調査・検証した内容>

## 主な発見
<Discoveries & Insightsのサマリー>

## 次のステップ
- [ ] PRレビュー後、`/issync:review-poc`で知見を整理
- [ ] アーキテクチャ決定後、このPRはクローズされます

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**重要**: このPRは人間がレビューするための差分確認用です（マージしません）。

## 出力フォーマット

```markdown
## /issync:poc 実行結果

✅ POC調査が完了しました
**Issue**: <issue_url> | **ファイル**: <progress_document_path>

### 調査内容と主な発見
- [調査項目と発見のサマリー]

### 進捗ドキュメント更新
- Discoveries & Insights: [X]件
- Open Questions: [Y]件追加/[Z]件解決

### 次のアクション
- [ ] POC PR (<PR URL>) をレビュー
- [ ] `/issync:review-poc <PR URL>`で知見を整理
- [ ] アーキテクチャ決定後、PRをクローズ
```

## 重要な注意事項

1. **調査優先**: コードの品質よりも知見の獲得を優先
2. **継続的更新**: 調査中は常に進捗ドキュメントを更新（最重要）
3. **破棄前提**: 実装は破棄される前提で、自由に試行錯誤
4. **issync連携**: 作業後は`issync push`で同期
5. **PR作成**: 人間が差分を確認できるようPRを作成（マージしない、後でクローズ）
6. **テストはオプショナル**: 全テスト合格は必須ではない
7. **Status変更なし**: GitHub Projects Statusの変更は行わない

## ワークフロー

```
/issync:poc → 調査・検証 → ドキュメント更新 → POC PR作成
   ↓
人間がPRレビュー
   ↓
/issync:review-poc → 知見整理 → Decision Log推奨案
   ↓
人間が意思決定・承認 → PRクローズ → Status変更(`implement`)
   ↓
/issync:implement（本実装）
```

## 実行を開始

それでは、上記のフローに従ってPOC調査を開始してください。
