# issync 開発計画

この実行計画は生きたドキュメントです。新しい情報が出るたびに各セクションを更新してください。各セクションは、事前知識のない初めての貢献者へのガイダンスとして扱ってください。

**重要**: このドキュメントの更新ガイドライン

- **簡潔さ重視**: 各セクションは必要最小限の情報のみを記載
- **段階的更新**: 変更が必要な部分のみを更新し、複数セクションの大幅な書き換えは避ける
- **冗長性の排除**: 重複する説明や過度な詳細化を避ける

---

## Purpose / Overview

**📝 記入タイミング**: before-plan
**✍️ 記入内容**: タスクの目的、解決する問題、コアバリューを明確に定義。AIエージェントがこのタスクの方向性を理解するための最重要セクション

issync は、GitHub Issue のコメントとローカルファイル間でテキストを同期する CLI ツールです。AI エージェントが GitHub Issue 内で生きたドキュメント(plans.md など)を単一の信頼できる情報源として維持できるようにし、複数のローカルセッション(git worktree、Devin など)が同じドキュメントを同時に読み書きできるようにします。

**コアバリュー:**

- 共有コンテキストを持つ並行 AI 開発セッションを可能にする
- ドキュメントファイルでの git コンフリクトを回避する
- 環境間で進捗ドキュメントを同期し続ける

---

## Context & Direction

**📝 記入タイミング**: before-plan
**✍️ 記入内容**: 問題の背景、設計哲学を記述。コードベース調査や既存ドキュメント確認の結果を反映

**問題のコンテキスト:**

- 並行する AI / 人間セッションが plan.md を共有すると、Git コンフリクトや書き戻し漏れが頻発する
- Issue コメントとローカルファイルの乖離により、最新情報の所在が不明瞭になる
- AI エージェントに余計な同期手順を要求すると、生産性と成功率が大幅に低下する

**インスピレーション元:**

- Feler の plans.md 運用: 長時間の AI セッションで単一ドキュメントを継続更新
- Notion / Dropbox Paper によるセクション単位の共同編集体験
- CRDT (yjs, Automerge) が提供する eventually consistent な分散同期

**設計哲学:**

- **エージェント透過性**: エージェントは普段どおり Read/Edit を使い、同期は watch モードが肩代わりする
- **安全優先の同期**: ハッシュベースの楽観ロックと 3-way 比較で上書きリスクを抑え、衝突時は明示的に停止する
- **軽量導入**: 追加インフラ不要で GitHub PAT のみを要求し、CLI 1 本で導入できる
- **段階的拡張**: 初期は Issue コメントを SSoT とし、必要に応じて CRDT や専用サーバーに移行する

---

## Validation & Acceptance Criteria

**📝 記入タイミング**: before-planで初期記入 → before-architecture-decisionで妥当性検証・更新
**✍️ 記入内容**: テスト可能な受け入れ基準を定義。POC後に実現可能性を確認し、必要に応じて調整

**受け入れ基準:**

- `issync init` が既存 state を検出して二重初期化を防ぎ、成功時に `.issync/state.yml` を生成
- `issync push` が last_synced_hash を検証し、リモート差分がある場合に OptimisticLockError を返す
- `issync pull` がディレクトリ作成とパス検証を行い、取得後に hash / timestamp を更新する
- `issync watch` が 3-way セーフティチェックで両側更新を検出し、片側差分は自動 push / pull で解決する
- `bun test`, `bun run check:ci` がグリーンである（テスト・lint・型チェックを網羅）

**テストシナリオ:**

- `src/commands/watch.unit.test.ts`: 3-way セーフティチェックの分岐（自動 push / pull / コンフリクト）を検証
- `src/commands/push.test.ts`: 楽観ロック違反時のエラーと GitHub API 呼び出しの振る舞いを確認
- `src/lib/config.test.ts`: YAML 読み書き、ディレクトリ生成、パス検証を網羅
- 手動 QA: watch 起動 → リモート更新 → pull→push ループが発生しないかログで確認

---

## Specification / 仕様

**📝 記入タイミング**: before-architecture-decision
**✍️ 記入内容**: POCの知見を基にシステム仕様、アーキテクチャ、設計方針を具体化

### アーキテクチャ概要

- **SSoT**: GitHub Issue Comment (Issue 本文ではない)
- **同期戦略**: Pull 重視 + オンデマンド push
- **マージ戦略**: セクションベースの自動マージとコンフリクト検出（Phase 2 実装予定）
- **コンフリクト解決**: 楽観的ロックと手動フォールバック
- **メタデータ保存**: プロジェクトルートの `.issync/state.yml`

### 技術スタック

- **言語・ランタイム**: Bun + TypeScript
- **テストフレームワーク**: Bun Test（ゼロ設定、Jest互換）
- **Formatter/Linter**: Biome + typescript-eslint
- **Git フック管理**: Lefthook
- **GitHub API**: Octokit
- **ファイル監視**: chokidar

### watch モードの設計

- **リモートポーリング**: setInterval でリモートコメントを定期取得（デフォルト10秒）
- **ローカルファイル監視**: chokidar でファイル変更を検知
- **grace period**: pull 直後の 1000ms はファイル変更を無視し、pull→push ループを防止
- **3-way セーフティチェック**: 起動時に last_synced_hash・ローカル・リモートを比較し、コンフリクトを事前検出

### 状態管理

`.issync/state.yml` で複数syncを配列管理（v0.2.0以降）:

```yaml
syncs:
  - issue_url: https://github.com/owner/repo/issues/123
    comment_id: 123456789
    local_file: docs/plan.md
    last_synced_hash: abc123def
    last_synced_at: 2025-10-14T09:00:00Z
    poll_interval: 10
```

---

## Tasks

**📝 記入タイミング**: before-planで初期タスク → before-poc以降で継続更新
**✍️ 記入内容**: 実装者が「次に何をすべきか」を具体的に把握するための実行可能なタスクリスト

**GitHub Issueとの対応:**
- **大きなタスク**（複数日、複数PR）→ サブissue化し`(#123)`形式でIssue番号を記載
- **小さなタスク**（1-2時間で完結）→ このissue内で管理、Issue番号なし
- **サブissue化検討中** → `(未Issue化)`と記載

**記法:**
- `- [ ] タスク名` - 未完了の小タスク
- `- [ ] タスク名 (#123)` - サブissueとして管理中
- `- [ ] タスク名 (未Issue化)` - サブissue化を検討中
- `- [x] タスク名` - 完了済みタスク

---

**Phase 2 残タスク:**
- [ ] docs/plan.md を git 管理から除外
- [ ] watch --daemon / issync stop / issync status の実装
- [ ] セクションベースのマージ戦略とコンフリクト解決フロー

**Phase 3 タスク:**
- [ ] 包括的なテストの追加
- [ ] エラーハンドリングとリトライ戦略
- [ ] ドキュメント作成

---

## Open Questions / 残論点

**📝 記入タイミング**: before-plan/before-pocで記入 → 各フェーズで解決
**✍️ 記入内容**: 未解決の重要な問い。before-implementまでに実装に必要な質問を全て解決。**優先度が高い（先に解消すべき）問いを上に配置**

**Q1: issync側で同期中のドキュメント一覧を表示するコマンドの追加**

- **背景**: `/add-question` や `/resolve-question` を引数なしで実行する場合、`.issync/state.yml` から同期中のファイルを選択する仕組みに変更した
- **検討事項**: 現在のところ、同期中のドキュメント一覧を確認するには `.issync/state.yml` を直接読むか、各コマンドを実行する必要がある
- **選択肢**:
  - **A**: `issync list` コマンドを追加し、同期中のファイル・Issue URL・最終同期時刻を一覧表示
  - **B**: `issync status` コマンドを拡張し、一覧表示機能を含める（現在Phase 2で実装予定）
  - **C**: 現状維持（`.issync/state.yml` を直接確認）

---

## Follow-up Issues / フォローアップ課題

**📝 記入タイミング**: Open Questions解消時、または実装中に発見した際
**✍️ 記入内容**: 今回のスコープでは対応しないが、将来的に別issueとして扱うべき事項

- **CRDT ベースのリアルタイム同期**: GitHub Issue 以外のデータソース連携（Phase 3以降）
- **GitHub 以外のデータソース連携**: GitLab, Bitbucket などへの対応（Phase 3以降）

---

## Discoveries & Insights

**📝 記入タイミング**: before-poc以降、継続的に記入
**✍️ 記入内容**: 実装中に発見した技術的制約・複雑性・新たなタスク。失敗時は失敗原因も記録

**2025-10-14: CLI の --version が package.json と同期されていない問題**
- 解決: `fs.readFileSync` で package.json を動的に読み込み、`.version(packageJson.version)` で参照
- メリット: package.json のバージョン更新時に cli.ts を手動で更新する必要がなくなる

**2025-10-14: 複数sync管理時のpush/pullコマンドのUX課題**
- 問題: 複数syncが登録されている場合、`issync push` を実行すると「--file か --issue を指定してください」というエラーが出る
- 解決方針: オプション未指定時はwatchと同様に全syncを対象とし、特定のsyncだけ操作したい場合にオプションを使う設計に変更

**2025-10-14: AI エージェントによるコミット時の品質チェック不足**
- 原因: AI エージェントは「lint エラーは現在の変更と無関係」と判断してスキップする傾向
- 解決: Lefthook で pre-commit フックを導入し、コミット前に自動で品質チェックを強制

**2025-10-13: watch 起動前の 3-way セーフティチェック**
- watch 起動時に last_synced_hash・ローカル・リモートの 3-way 比較を実装
- 両側で差分がある場合に起動をブロック、片側差分は自動 push/pull でベースラインを復旧

**2025-10-12: watch モードの無限ループバグ発見と修正**
- 問題: pull 時のファイル書き込みを chokidar が検知し、push がトリガーされ無限ループ
- 解決: grace period (1000ms) 実装により、pull 直後の変更通知を無視

**2025-10-12: watch モード使用時の前提条件とワークフロー**
- 問題事例: watch を起動せずに編集したため、実際に 45 行の進捗記録が消失（git checkout で復元）
- 根本原因: MVP 版の pull は無条件上書きするため、リモートが最新でないと必ずデータロスが起きる
- 対処: CLAUDE.md に使用手順を明記、Phase 2 でセクションベースマージ実装予定

**2025-10-12: Claude Code の Edit() ツールを活用したコンフリクト検出**
- Claude Code の Edit() は old_string が見つからないとエラーになる
- この仕組みをそのまま活用すれば、AI エージェント側でコンフリクト検出が自然に起きる
- issync は透過的にバックグラウンドで動作し、AI エージェントは存在を意識しなくて済む

---

## Decision Log

**📝 記入タイミング**: before-architecture-decision
**✍️ 記入内容**: POCの知見を基に技術選定、アーキテクチャ決定、トレードオフを記録

**2025-10-14: Biome の noUnusedVariables 自動修正を無効化**
- Biome の `noUnusedVariables` ルールは未使用変数に自動的に `_` プレフィックスを追加する unsafe fix を持つ
- `biome.json` で `fix: "none"` に設定し、リントエラーは報告するが自動修正は無効化

**2025-10-14: CLI バージョンを package.json から動的に読み込む**
- **採用**: `fs.readFileSync` で package.json を動的に読み込み、version フィールドを参照
- **理由**: package.json を Single Source of Truth として扱う、バージョンアップ時の手動更新ミスを防止

**2025-10-14: push/pull コマンドのデフォルト動作を全sync対象に変更**
- **採用**: オプション未指定時は全てのsyncを対象とし、Promise.allSettled で並列実行
- **理由**: watch コマンドと動作を統一し、一貫性を向上。「全てpush/pull」がより一般的なユースケース

**2025-10-14: init コマンドのテンプレートURL対応とデフォルト設定**
- **採用**: `--template` オプションでURLを受け取り、HTTPリクエストでテンプレートを取得
- **デフォルト**: オプション未指定かつファイル不在時は `https://raw.githubusercontent.com/MH4GF/issync/refs/heads/main/docs/plan-template.md` を使用
- **理由**: プロジェクト開始時にローカルにテンプレートを用意する手間を削減、公式テンプレートの最新版を常に使用できる

**2025-10-14: Lefthook 導入 - Git フック管理とコミット前品質保証**
- **採用**: Lefthook (高速な Git フック管理ツール)
- **理由**: 品質保証の強制、AI エージェントとの統合、高速性、設定の簡潔さ
- **設定方針**: pre-commit フックで `bun run check:ci` を実行（lint, format, type-check, test を包括）

**2025-10-13: 複数Issue同時管理のサポート (Phase 2)**
- **採用**: 単一状態ファイルで配列管理
- **理由**: 1ファイルで全体管理、watch が複数ファイルを一括監視可能、現在の設計を最小限の変更で拡張可能

**2025-10-13: init コマンドのテンプレートサポート (Phase 2)**
- **採用**: init コマンドに `--template` オプションを追加
- **メリット**: テンプレートからの新規プロジェクト開始がスムーズ、ディレクトリ作成も自動化

**2025-10-12: watch 起動時の安全性チェック (Phase 2)**
- **採用**: watch 起動時に 3-way comparison でコンフリクト検出を実装
- **実装方針**: 両方が変更されている = コンフリクト（起動ブロック）、どちらか一方のみ = 自動同期
- **メリット**: データロスを事前に防止、ユーザーに明示的な選択肢を提示

**2025-10-12: Knip 導入 - 不要コード検出**
- **採用**: Knip (不要な依存関係、エクスポート、ファイルを検出)
- **理由**: 保守性の向上、パフォーマンス改善、コードベースの健全性、Bun サポート

**2025-10-12: TypeScript ESLint の追加導入**
- **追加採用**: typescript-eslint (Biome と併用)
- **理由**: Biome で検出できないルール、型情報を活用したリント
- **役割分担**: Biome (フォーマット + 基本的なリント)、typescript-eslint (型情報ベースの高度なリント)

**2025-10-12: Formatter/Linter - Biome 採用**
- **採用**: Biome (formatter + linter)
- **理由**: 高速（Rust製）、ゼロ設定、統合（フォーマットとリントを単一ツールで実行）

**2025-10-12: CLAUDE.md での運用ガイドライン提供**
- **採用**: issync を使うプロジェクトは CLAUDE.md に使用手順を記載
- **理由**: Phase 2 実装まで、この運用ルールで MVP の制約をカバー

**2025-10-12: 状態管理に `.issync/` ディレクトリを採用**
- **採用**: `.issync/state.yml` で状態を管理
- **理由**: 設定 vs 状態の明確な分離、`.git/` との類似性、gitignore の自然さ、将来の拡張性

**2025-10-12: MVP スコープの明確化 - ドッグフーディング優先**
- **ゴール**: docs/plan.md を実際の GitHub Issue と同期し、issync 自体の開発に使う
- **理由**: 早期にドッグフーディングを開始し、実際の使用感を確認する

**2025-10-12: 言語・ツールスタック**
- **採用**: Bun + TypeScript, Bun Test
- **理由**: MVP の高速実装を優先。Octokit (GitHub API) と chokidar (ファイル監視) の成熟したエコシステムを活用。

**2025-10-12: AI エージェントに透過的な設計**
- **重要な要件**: AI コーディングエージェントは issync の存在を知らなくて済む
- **コンフリクト検出の仕組み**: issync が watch mode でリモートの変更を pull → AI エージェントが Edit() を試みる → old_string が見つからず失敗 → AI エージェントは自然に Re-read して再試行

**2025-10-12: MVP の SSoT は GitHub Issue とする**
- **理由**: インフラ不要、可視性・監査可能性が高い、運用負荷ゼロ、段階的拡張が可能
- **将来**: yjs + 中央サーバーは将来の拡張として検討

**2025-10-12: アーキテクチャ決定**
- SSoT: GitHub Issue Comment、同期戦略: Pull 重視 + オンデマンド push
- マージ戦略: セクションベースの自動マージとコンフリクト検出
- コンフリクト解決: 楽観的ロックと手動フォールバック
- メタデータ保存: プロジェクトルートの `.issync/state.yml`

**2025-10-12: ツール命名**
- **採用**: `issync` (issue + sync)
- **理由**: 明確、機能的、利用可能

---

## Outcomes & Retrospectives

**📝 記入タイミング**: before-retrospective
**✍️ 記入内容**: 実装完了内容、品質改善、発見、次のステップ。プロジェクト改善提案も含む

**v0.2.0 リリース完了 (2025-10-14) - 複数Issue同時管理サポート**
- **実装完了**: state.yml を配列形式に移行、既存設定の自動マイグレーション、複数Issue/ファイルの同時管理対応
- **CLI改善**: `--file` / `--issue` オプションでターゲットsync選択、単一syncの場合は自動選択
- **watch コマンド拡張**: 全syncを監視（並列実行）、部分的失敗モード（Promise.allSettled）
- **セキュリティ改善**: パストラバーサル攻撃防止の包括的なテスト、エラーハンドリング改善
- **テンプレート改善**: 各セクションの記入タイミングガイダンス追加
- **品質保証**: 72テスト全て合格、後方互換性維持
- **次のステップ**: watch デーモン化、セクションベースマージ、stop コマンド

**Phase 1 MVP 完了 (2025-10-12)**
- init / pull / push / watch コマンドの MVP 実装を完了、Bun Test で TDD を徹底
- `.issync/state.yml` に last_synced_hash と timestamp を保存、楽観ロックを確立
- watch モードの pull→push ループを grace period (1000ms) で抑止
- CLAUDE.md と AGENTS.md に運用ガイドラインを整備
- **発見**: watch 起動前の編集でデータロス発生 (45 行消失、git checkout で復元)
- **対処**: CLAUDE.md に運用ガイドライン追加、Phase 2 でセクションベースマージを実装予定

---

## Deliverables & Notes

**📝 記入タイミング**: 随時更新
**✍️ 記入内容**: コマンドリファレンス、設定ファイルフォーマット、重要な考慮事項

**コマンドリファレンス:**

```bash
# 開発時 (Bun 経由)
bun run dev init <issue-url> [--file path/to/file] [--template path/to/template-or-url]
bun run dev pull [--file path/to/file] [--issue issue-url]
bun run dev push [--file path/to/file] [--issue issue-url]
bun run dev watch [--interval 10] [--file path/to/file] [--issue issue-url]

# ビルド後 CLI (npm 公開済み)
issync init <issue-url> [--file path/to/file] [--template path/to/template-or-url]
issync pull [--file path/to/file] [--issue issue-url]
issync push [--file path/to/file] [--issue issue-url]
issync watch [--interval 10] [--file path/to/file] [--issue issue-url]

# init コマンドのテンプレート指定例
issync init <issue-url>                                          # デフォルトテンプレート使用
issync init <issue-url> --template ./my-template.md             # ローカルファイル
issync init <issue-url> --template https://example.com/tpl.md   # カスタムURL

# 実装予定
issync watch --daemon    # デーモン化 (Phase 2)
issync stop              # デーモン停止 (Phase 2)
issync status            # 同期状態確認 (Phase 2)
```

**`.gitignore` への追加推奨:**

```gitignore
# issync ローカル状態
.issync/
```

**GitHub API 考慮事項:**

- レート制限: 5000 リクエスト/時間(認証済み)
- 10 秒間隔でのポーリング = 360 リクエスト/時間(watch プロセスあたり)
- 403/429 レスポンスの処理が必要
- **楽観ロックの実装**: GET でコメント取得 → body の hash 計算 → PATCH 前に再度 GET して hash 比較 → 一致しなければコンフリクト

**べき等性と復旧:**

- `issync pull` は同一コメント内容であれば再実行してもファイル内容・ハッシュが変わらず、冪等に動作
- `issync push` は last_synced_hash が一致しない限り書き込みを拒否、失敗時は `pull → 手動マージ → push` で回復
- watch モードは AbortController と grace period により、安全に停止・再開できる
- `.issync/state.yml` を誤って削除した場合でも、`issync init` で再生成し `issync pull` で最新状態を復旧可能