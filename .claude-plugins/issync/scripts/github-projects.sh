#!/usr/bin/env bash
set -euo pipefail

# GitHub Projects ヘルパースクリプト
# Usage:
#   github-projects.sh set-stage ISSUE_NUMBER "in progress"
#   github-projects.sh set-status ISSUE_NUMBER "poc"
#   github-projects.sh clear-stage ISSUE_NUMBER

# 環境変数チェック
check_env() {
  if [ -z "${GITHUB_PROJECTS_NUMBER:-}" ]; then
    echo "⚠️  GITHUB_PROJECTS_NUMBER が設定されていないため、GitHub Projects 連携をスキップします" >&2
    exit 0
  fi
}

# プロジェクト情報をキャッシュ
CACHE_FILE="${TMPDIR:-/tmp}/issync-github-projects-cache-${GITHUB_PROJECTS_NUMBER:-0}.json"
CACHE_TTL=300  # 5分

# プロジェクト情報を取得（キャッシュ有効期限内なら再利用）
get_project_info() {
  # キャッシュが有効なら使用
  if [ -f "$CACHE_FILE" ]; then
    local cache_age=$(($(date +%s) - $(stat -f %m "$CACHE_FILE" 2>/dev/null || stat -c %Y "$CACHE_FILE" 2>/dev/null)))
    if [ "$cache_age" -lt "$CACHE_TTL" ]; then
      cat "$CACHE_FILE"
      return 0
    fi
  fi

  # キャッシュがないか期限切れなら取得
  local owner_type="${GITHUB_PROJECTS_OWNER_TYPE:-user}"
  local owner_flag="@me"
  local owner_login

  if [ "$owner_type" = "org" ]; then
    owner_flag="${GITHUB_PROJECTS_OWNER}"
    owner_login="${GITHUB_PROJECTS_OWNER}"
  else
    owner_login=$(gh api user --jq '.login')
  fi

  # プロジェクト ID を取得
  local project_id
  project_id=$(gh project list --owner "$owner_flag" --format json 2>/dev/null | \
    jq -r ".projects[] | select(.number == ${GITHUB_PROJECTS_NUMBER}) | .id")

  if [ -z "$project_id" ] || [ "$project_id" = "null" ]; then
    echo "⚠️  プロジェクト番号 ${GITHUB_PROJECTS_NUMBER} が見つかりません" >&2
    exit 1
  fi

  # フィールド情報を取得
  local query_type="user"
  if [ "$owner_type" = "org" ]; then
    query_type="organization"
  fi

  local field_info
  field_info=$(gh api graphql -f query="
query {
  ${query_type}(login: \"$owner_login\") {
    projectV2(number: ${GITHUB_PROJECTS_NUMBER}) {
      id
      fields(first: 20) {
        nodes {
          ... on ProjectV2SingleSelectField {
            id
            name
            options {
              id
              name
            }
          }
        }
      }
    }
  }
}" 2>/dev/null)

  # キャッシュに保存
  echo "$field_info" | jq -c "{
    project_id: \"$project_id\",
    owner_flag: \"$owner_flag\",
    field_info: .
  }" > "$CACHE_FILE"

  cat "$CACHE_FILE"
}

# Issue のプロジェクト項目 ID を取得
get_item_id() {
  local issue_number="$1"
  local owner_flag
  owner_flag=$(get_project_info | jq -r '.owner_flag')

  gh project item-list "${GITHUB_PROJECTS_NUMBER}" --owner "$owner_flag" --format json --limit 100 2>/dev/null | \
    jq -r ".items[] | select(.content.number == ${issue_number}) | .id"
}

# Stage を設定
set_stage() {
  local issue_number="$1"
  local stage_name="$2"

  local project_info
  project_info=$(get_project_info)

  local project_id
  project_id=$(echo "$project_info" | jq -r '.project_id')

  local stage_field_id
  stage_field_id=$(echo "$project_info" | jq -r '.field_info.data.user.projectV2.fields.nodes[] // .field_info.data.organization.projectV2.fields.nodes[] | select(.name == "Stage") | .id')

  local stage_option_id
  stage_option_id=$(echo "$project_info" | jq -r --arg name "$stage_name" '.field_info.data.user.projectV2.fields.nodes[] // .field_info.data.organization.projectV2.fields.nodes[] | select(.name == "Stage") | .options[] | select(.name == $name) | .id')

  if [ -z "$stage_field_id" ] || [ "$stage_field_id" = "null" ]; then
    echo "⚠️  Stage フィールドが見つかりません" >&2
    exit 1
  fi

  if [ -z "$stage_option_id" ] || [ "$stage_option_id" = "null" ]; then
    echo "⚠️  Stage オプション '${stage_name}' が見つかりません" >&2
    exit 1
  fi

  local item_id
  item_id=$(get_item_id "$issue_number")

  if [ -z "$item_id" ] || [ "$item_id" = "null" ]; then
    echo "⚠️  Issue #${issue_number} がプロジェクトに見つかりません" >&2
    exit 1
  fi

  gh project item-edit \
    --id "$item_id" \
    --project-id "$project_id" \
    --field-id "$stage_field_id" \
    --single-select-option-id "$stage_option_id" >/dev/null 2>&1

  echo "✅ Stage を '${stage_name}' に設定しました"
}

# Status を設定
set_status() {
  local issue_number="$1"
  local status_name="$2"

  local project_info
  project_info=$(get_project_info)

  local project_id
  project_id=$(echo "$project_info" | jq -r '.project_id')

  local status_field_id
  status_field_id=$(echo "$project_info" | jq -r '.field_info.data.user.projectV2.fields.nodes[] // .field_info.data.organization.projectV2.fields.nodes[] | select(.name == "Status") | .id')

  local status_option_id
  status_option_id=$(echo "$project_info" | jq -r --arg name "$status_name" '.field_info.data.user.projectV2.fields.nodes[] // .field_info.data.organization.projectV2.fields.nodes[] | select(.name == "Status") | .options[] | select(.name == $name) | .id')

  if [ -z "$status_field_id" ] || [ "$status_field_id" = "null" ]; then
    echo "⚠️  Status フィールドが見つかりません" >&2
    exit 1
  fi

  if [ -z "$status_option_id" ] || [ "$status_option_id" = "null" ]; then
    echo "⚠️  Status オプション '${status_name}' が見つかりません" >&2
    exit 1
  fi

  local item_id
  item_id=$(get_item_id "$issue_number")

  if [ -z "$item_id" ] || [ "$item_id" = "null" ]; then
    echo "⚠️  Issue #${issue_number} がプロジェクトに見つかりません" >&2
    exit 1
  fi

  gh project item-edit \
    --id "$item_id" \
    --project-id "$project_id" \
    --field-id "$status_field_id" \
    --single-select-option-id "$status_option_id" >/dev/null 2>&1

  echo "✅ Status を '${status_name}' に設定しました"
}

# Stage をクリア
clear_stage() {
  local issue_number="$1"

  local project_info
  project_info=$(get_project_info)

  local project_id
  project_id=$(echo "$project_info" | jq -r '.project_id')

  local stage_field_id
  stage_field_id=$(echo "$project_info" | jq -r '.field_info.data.user.projectV2.fields.nodes[] // .field_info.data.organization.projectV2.fields.nodes[] | select(.name == "Stage") | .id')

  local item_id
  item_id=$(get_item_id "$issue_number")

  gh api graphql -f query="
mutation {
  clearProjectV2ItemFieldValue(input: {
    projectId: \"$project_id\"
    itemId: \"$item_id\"
    fieldId: \"$stage_field_id\"
  }) {
    projectV2Item {
      id
    }
  }
}" >/dev/null 2>&1

  echo "✅ Stage をクリアしました"
}

# メイン処理
main() {
  check_env

  local command="${1:-}"
  shift || true

  case "$command" in
    set-stage)
      if [ $# -lt 2 ]; then
        echo "Usage: $0 set-stage ISSUE_NUMBER STAGE_NAME" >&2
        exit 1
      fi
      set_stage "$1" "$2"
      ;;
    set-status)
      if [ $# -lt 2 ]; then
        echo "Usage: $0 set-status ISSUE_NUMBER STATUS_NAME" >&2
        exit 1
      fi
      set_status "$1" "$2"
      ;;
    clear-stage)
      if [ $# -lt 1 ]; then
        echo "Usage: $0 clear-stage ISSUE_NUMBER" >&2
        exit 1
      fi
      clear_stage "$1"
      ;;
    *)
      echo "Usage: $0 {set-stage|set-status|clear-stage} ..." >&2
      exit 1
      ;;
  esac
}

# エラーハンドリング
trap 'echo "⚠️  エラーが発生しましたが、処理を継続します" >&2; exit 0' ERR

main "$@"
