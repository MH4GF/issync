#!/usr/bin/env bash
set -euo pipefail

# AI駆動開発ワークフローのステートマシンラベルを作成するスクリプト

echo "Creating state machine labels for AI-driven development workflow..."

# ラベルが既に存在する場合はスキップ、存在しない場合は作成
create_label_if_not_exists() {
  local name="$1"
  local color="$2"
  local description="$3"

  if gh label list --json name --jq '.[].name' | grep -q "^${name}$"; then
    echo "✓ Label '${name}' already exists, skipping..."
  else
    gh label create "${name}" --color "${color}" --description "${description}"
    echo "✓ Created label '${name}'"
  fi
}

# plan: 計画フェーズ
create_label_if_not_exists \
  "plan" \
  "d4c5f9" \
  "進捗ドキュメント(plan.md)のセットアップ。Purpose/Overview、Context & Direction、Validation & Acceptance Criteriaを記入"

# poc: 検証フェーズ
create_label_if_not_exists \
  "poc" \
  "fbca04" \
  "技術検証のための実装。技術的実現可能性・複雑性・制約を明らかにする（POC後はPRをclose）"

# architecture-decision: 設計決定（人間承認必要）
create_label_if_not_exists \
  "architecture-decision" \
  "0e8a16" \
  "アーキテクチャ・設計方針の決定。POCで得た知見をもとにDecision Logを記録（人間承認必要）"

# implement: 実装フェーズ
create_label_if_not_exists \
  "implement" \
  "1d76db" \
  "本実装開始前のチェック。Work Plan・Acceptance Criteria充足度を確認し、CI成功までを完了条件とする"

# merge: レビューフェーズ（人間承認必要）
create_label_if_not_exists \
  "merge" \
  "0e8a16" \
  "実装完了後のレビュー。CI通過後、人間がコードレビューを実施（人間承認必要）"

# retrospective: 振り返りフェーズ
create_label_if_not_exists \
  "retrospective" \
  "5319e7" \
  "振り返りと知見の記録。Discoveries & Insights、Outcomes & Retrospectivesを更新"

# failed: 失敗（人間介入必要）
create_label_if_not_exists \
  "failed" \
  "d93f0b" \
  "失敗・技術的ブロック。CI失敗や技術的制約により進行不可能（人間介入必須）"

# done: 完了
create_label_if_not_exists \
  "done" \
  "0e8a16" \
  "タスク完了。振り返りも記録された状態"

echo ""
echo "All state machine labels are ready!"
echo "View labels at: $(gh repo view --json url -q .url)/labels"
