---
description: 新規タスクをGitHub Issueとして作成し、親issueとのリンクを自動管理。進捗ドキュメントのTasksセクションは不使用
---

# /issync:create-sub-issue: サブissue作成オペレーション

新規タスクをGitHub Issueとして作成し、以下を自動化：
1. タスク概要入力（インタラクティブ: 1つ / 引数: 複数可）
2. 親issue情報取得（`.issync/state.yml`）
3. LLMによるタイトル・本文生成
4. Issue作成（`ISSYNC_LABELS_AUTOMATION=true`の場合、`issync:plan`ラベル自動付与）
5. Sub-issues API連携（親issue紐づけ + 順序維持）

## コンテキスト

**横断的オペレーション** - どのステートでも実行可能（plan、poc、architecture-decision、implement）

**設計原則**:
- GitHub Sub-issuesを完全なSSOTとする（進捗ドキュメントのTasksセクション不使用）
- ユーザー入力は簡潔な概要のみ（LLMが適切なタイトル・本文を自動生成）
- Sub-issues APIで親issueと自動リンク、順序維持

## 使用方法

```bash
/issync:create-sub-issue                             # インタラクティブモード（1つ）
/issync:create-sub-issue "概要1" "概要2"            # 引数モード（複数可）
```

**入力例**: "Status変更時の自動アクション" "コマンド実装" など簡潔でOK

**推奨ワークフロー**:
- 基本: 1つずつ作成 → `/issync:plan`で詳細化 → 必要に応じて孫issue作成
- 複数の独立タスクが明確な場合のみ引数モードで一括作成

## 前提条件

- `.issync/state.yml`存在（`issync init`完了済み）
- `ISSYNC_GITHUB_TOKEN`環境変数設定
- `gh` CLIインストール済み
- `ISSYNC_LABELS_AUTOMATION=true`設定時: リポジトリに`issync:plan`ラベルが存在すること

## 実行ステップ

### ステップ1: 環境変数確認 & モード決定

ラベル自動付与の有効化状態を確認し、以降のステップで使用するモードフラグを設定。

**環境変数**:
```bash
ISSYNC_LABELS_AUTOMATION               # ラベル自動付与モード ("true" で有効)
```

**モード決定**:
- **ラベル自動付与**: `ISSYNC_LABELS_AUTOMATION="true"`で有効 (未設定時はステップ6のラベル付与をスキップ)

**出力**: 設定状態をユーザーに表示
```markdown
## Environment Check
**Label Automation**: {有効/無効}
```

### ステップ2: タスク概要の入力

- **インタラクティブモード**: プロンプトでタスク概要を1つ入力
- **引数モード**: コマンドライン引数から複数取得

### ステップ3: 親issue情報を取得

`issync status <親issue URL>`を実行し、以下を取得:
- `issue_url`: 親issueのURL
- `local_file`: 進捗ドキュメントのパス

### ステップ4: 親issueコンテキスト抽出

進捗ドキュメント全体を読み込み、LLMが以下を理解:
- Purpose/Overview: 目的、コアバリュー
- Context & Direction: 背景、設計哲学
- Specification: 仕様、アーキテクチャ（存在時）

### ステップ5: タイトル・本文生成

**タイトル**: 「{動詞} + {対象}」形式、10-30文字、親issueのスタイルに合わせる

**本文テンプレート**:
```markdown
Part of #{親issue番号}

## 目的
{タスクの具体的な目的（1-2文）}

## 背景
{親issueから関連情報を抽出・要約}

## 完了条件
- [ ] {完了条件（3-5項目）}
- [ ] コードレビュー完了
- [ ] ドキュメント更新完了

## 関連
- 親issue: #{親issue番号}
- 詳細: [親issueを見る]({親issueのURL})
```

### ステップ5.5: 既存issueの重複チェック

類似タスクが既に存在しないか検索し、重複作成を防ぐ。

**検索実行**:
```bash
gh search issues --repo {owner}/{repo} "{キーワード1} {キーワード2}" \
  --json number,title,url,state,labels --limit 5
```
- LLMがタイトルから主要キーワード抽出（動詞・名詞中心、2-3語）
- 検索対象: リポジトリ内全issue（open/closed）、親issueのsub-issues優先

**類似issue検出時の確認**:
```
⚠️  類似する既存issueが見つかりました:
#123 [open]: Status変更時の自動通知機能を実装

このまま新規issue作成を続けますか？ (y/n)
```
- `y`: ステップ6へ進む
- `n`: キャンセル、既存issue利用を推奨

**エラー時**: 警告表示後、検索スキップして続行

### ステップ6: ユーザー確認

生成したタイトル・本文プレビューを提示し、承認後に作成（`y`/`n`）

### ステップ7: Issue作成とSub-issues連携

**ラベル付与**:
ステップ1で確認したラベル自動付与モードが有効な場合、`--label "issync:plan"`を付与してissue作成。
未設定の場合はラベルなしで作成。

**処理フロー**:
```bash
PREV_SUB_ISSUE_ID=""
for i in "${!GENERATED_TITLES[@]}"; do
  TITLE="${GENERATED_TITLES[$i]}"
  BODY="${GENERATED_BODIES[$i]}"

  # ISSYNC_LABELS_AUTOMATIONに応じてラベル付与
  ISSUE_URL=$(gh issue create --repo {owner}/{repo} --title "$TITLE" --body "$BODY")
  ISSUE_NUMBER=$(echo $ISSUE_URL | grep -o '[0-9]*$')
  SUB_ISSUE_ID=$(gh api /repos/{owner}/{repo}/issues/$ISSUE_NUMBER --jq .id)

  # Sub-issueとして紐づけ
  gh api --method POST /repos/{owner}/{repo}/issues/{親issue番号}/sub_issues \
    -F "sub_issue_id=$SUB_ISSUE_ID"

  # 2つ目以降は順序設定
  if [ -n "$PREV_SUB_ISSUE_ID" ]; then
    gh api --method PATCH /repos/{owner}/{repo}/issues/{親issue番号}/sub_issues/priority \
      --input - << EOF
{
  "sub_issue_id": $SUB_ISSUE_ID,
  "after_id": $PREV_SUB_ISSUE_ID
}
EOF
  fi

  PREV_SUB_ISSUE_ID=$SUB_ISSUE_ID
done
```

### ステップ8: GitHub Projects Status設定（オプション）

`gh issue edit`でStatus=planを設定（利用不可時は手動設定を案内）

## 出力フォーマット

完了後、以下を表示:
- 作成されたサブissueリスト（URL、タイトル）
- Sub-issues紐づけ結果
- `ISSYNC_LABELS_AUTOMATION=true`の場合:
  - `issync:plan`ラベル付与確認
  - **auto-planワークフロー自動実行**のため、手動`/issync:plan`実行不要
  - GitHub Actionsタブで実行状況確認可能
- 未設定の場合:
  - 手動で`/issync:plan`実行が必要

## 重要な注意事項

**必須要件**:
- ステップ1で環境変数を確認し、モードフラグを設定（以降のステップで参照）
- 親issueの進捗ドキュメント全体読み込み（`.issync/state.yml`のlocal_fileパス使用）
- タイトル・本文はLLM生成、ユーザー確認必須
- gh CLI使用、内部ID使用（`gh api .../issues/{番号} --jq .id`）
- `ISSYNC_LABELS_AUTOMATION=true`の場合、`issync:plan`ラベル自動付与
  - auto-planワークフローが自動トリガーされ、進捗ドキュメントが自動作成される

**Sub-issues API**:
- 処理順: Issue作成 → 内部ID取得 → Sub-issues紐づけ → 順序設定（`after_id`）
- JSON payload使用、エラー時は処理継続して報告

**その他**:
- 進捗ドキュメント非変更（Tasksセクション削除済み、タスク管理はGitHub Sub-issuesに完全移行）
- エラーハンドリング: `state.yml`/`gh` CLI不在時は終了、Issue作成失敗時は部分成功も記録

## 実行例

**インタラクティブモード**: `/issync:create-sub-issue`
1. タスク概要入力: "Status変更時の自動アクション"
2. LLMがタイトル生成（例: "Status変更時の自動アクション機能を設計"）
3. ユーザー確認 → Issue作成
4. `ISSYNC_LABELS_AUTOMATION=true`の場合:
   - `issync:plan`ラベル付き → auto-planワークフロー自動実行 → 進捗ドキュメント作成

**引数モード**: `/issync:create-sub-issue "自動アクション設計" "/issync:create-sub-issue実装"`
1. 複数タスクを一括作成
2. Sub-issues順序設定で作成順序維持
3. `ISSYNC_LABELS_AUTOMATION=true`の場合:
   - 各サブissueに対しauto-planワークフロー順次実行
