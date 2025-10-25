---
description: progress-document-template.md更新時にMIGRATION_GUIDE.mdの新エントリを半自動生成
---

# /upgrade-progress-document-template: テンプレート更新とマイグレーションガイド生成

あなたは @progress-document-template.md の更新をサポートし、 @MIGRATION_GUIDE.md の新しいバージョンエントリを半自動で生成します。このコマンドは以下のワークフローを自動化します：
1. progress-document-template.mdの変更内容の分析
2. MIGRATION_GUIDE.mdへの新バージョンエントリの追加
3. バージョン番号の更新

## コンテキスト

progress-document-template.mdのバージョン管理を支援します：
- テンプレート変更時には既存プロジェクトへのマイグレーション手順が必要
- AIによる初期ドラフト生成 + 人間のレビューで品質と効率のバランスを取る

## 実行タイミング

progress-document-template.mdを更新したい時に実行します。ユーザーからどのように更新したいかを聞き、progress-document-template.mdを更新し、その後MIGRATION_GUIDE.mdに新エントリを生成します。

## 前提条件

- ユーザーがprogress-document-template.mdの更新内容を説明できる

## 実行ステップ

### ステップ1: 現在のバージョン情報を確認

1. **バージョン番号を取得**
   - progress-document-template.mdの先頭行 `<!-- Template Version: X (YYYY-MM-DD) -->` から現在のバージョンを取得
   - MIGRATION_GUIDE.mdの最新エントリで次のバージョン番号（X+1）を決定

2. **ユーザーに確認**
   - 「現在のバージョン: X、新しいバージョン: X+1 でよろしいですか？」

### ステップ2: 変更内容を分析

1. **git diffで差分を取得**
   ```bash
   git diff HEAD -- docs/progress-document-template.md
   ```

2. **変更を分類し影響を分析**
   - 追加/削除/変更されたセクション
   - 既存のplan.mdファイルへのマイグレーション手順の必要性

### ステップ3: MIGRATION_GUIDE.mdの新エントリを生成

MIGRATION_GUIDE.mdに以下の形式で新しいバージョンエントリを追加：

```markdown
## Version X (YYYY-MM-DD)

### 変更内容

**概要**: [変更の概要を1-2文で記述]

**追加されたセクション:**
- [新セクション名]: [説明]

**削除されたセクション:**
- [旧セクション名]: [削除理由]

**変更されたセクション:**
- [セクション名]: [変更内容の説明]

**理由:**
- [変更の背景や目的]

### マイグレーション手順

#### 手動マイグレーション

既存のplan.mdをバージョンXに移行する手順:

1. [ステップ1の説明]
2. [ステップ2の説明]
3. [ステップ3の説明]

**変更前:**
```markdown
[変更前のコード例]
```

**変更後:**
```markdown
[変更後のコード例]
```

**注意事項:**
- [重要な注意点]

---
```

### ステップ4: progress-document-template.mdのバージョンヘッダーを更新

progress-document-template.mdの先頭行を新しいバージョン番号と日付に更新：

```markdown
<!-- Template Version: X (YYYY-MM-DD) -->
```

### ステップ5: レビューと確認

生成した内容をユーザーに提示し、確認を求める：

1. **変更内容のサマリー**
2. **生成したMIGRATION_GUIDE.mdエントリ**
3. **更新したバージョンヘッダー**

ユーザーの承認後、ファイルを更新します。

## 出力フォーマット

更新完了後、以下の形式でサマリーを提供：

```markdown
## /upgrade-progress-document-template 実行結果

### 更新内容
- ✅ progress-document-template.mdのバージョンを X → Y に更新 (docs/progress-document-template.md:1)
- ✅ MIGRATION_GUIDE.mdに Version Y のエントリを追加 (docs/MIGRATION_GUIDE.md:[line_number])

### 変更サマリー
- **追加されたセクション**: [セクション名一覧]
- **削除されたセクション**: [セクション名一覧]
- **変更されたセクション**: [セクション名一覧]

### 次のアクション
- [ ] MIGRATION_GUIDE.mdの内容をレビューし、必要に応じて編集
- [ ] マイグレーション手順の明確さと実行可能性を確認
- [ ] 変更をコミット
```

## 重要な注意事項

- 変更前に**progress-document-template.mdとMIGRATION_GUIDE.mdを読む**
- **git diff**で実際の変更内容を正確に把握
- マイグレーション手順は**具体的で実行可能**な形式で記述
- **変更前/変更後のコード例**を必ず含める
- ユーザーの承認なしに**ファイルを更新しない**
- バージョン番号: **整数で連番**（1, 2, 3...）、日付: **YYYY-MM-DD形式**（今日の日付）

## 実行例

**ユーザー:** `/upgrade-progress-document-template`

**アシスタント:** "progress-document-template.mdの更新をサポートします。

まず、現在の状態を確認します。"

[progress-document-template.mdとMIGRATION_GUIDE.mdを読み、git diffで差分を確認]

**アシスタント:** "progress-document-template.mdの変更を検出しました。

- 現在のバージョン: 2 (2025-10-15)
- 提案する新バージョン: 3 (2025-10-15)

検出された変更:
- 更新ガイドラインセクションをHTMLコメント化
- Purpose / Overviewセクションのガイダンスを追加

この内容でMIGRATION_GUIDE.mdのエントリを生成しますか？"

**ユーザー:** "はい"

**アシスタント:** [MIGRATION_GUIDE.mdに新エントリを生成、progress-document-template.mdのバージョンを更新、サマリーを提示]

## エラーハンドリング

以下の場合はエラーを報告してユーザーにガイダンスを求めます：

- **git diffで差分が見つからない場合**: "progress-document-template.mdに変更が検出されませんでした。先にprogress-document-template.mdを編集してください。"
- **バージョンヘッダーが見つからない場合**: "progress-document-template.mdのバージョンヘッダーが見つかりません。手動で追加してください。"
- **MIGRATION_GUIDE.mdが存在しない場合**: "MIGRATION_GUIDE.mdが見つかりません。新規作成しますか？"
