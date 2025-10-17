<!-- Template Version: 7 (2025-10-17) -->

# issync 開発計画

この実行計画は生きたドキュメントです。新しい情報が出るたびに各セクションを更新してください。各セクションは、事前知識のない初めての貢献者へのガイダンスとして扱ってください。

<!--
**重要**: このドキュメントの更新ガイドライン

- **簡潔さ重視**: 各セクションは必要最小限の情報のみを記載
- **段階的更新**: 変更が必要な部分のみを更新し、複数セクションの大幅な書き換えは避ける
- **冗長性の排除**: 重複する説明や過度な詳細化を避ける
-->

---

## Purpose / Overview

<!--
📝 記入タイミング: plan
✍️ 記入内容: タスクの目的、解決する問題、コアバリューを明確に定義。AIエージェントがこのタスクの方向性を理解するための最重要セクション
-->

issync は、GitHub Issue のコメントとローカルファイル間でテキストを同期する CLI ツールです。AI エージェントが GitHub Issue 内で生きたドキュメント(plan.md など)を単一の信頼できる情報源として維持できるようにし、複数のローカルセッション(git worktree、Devin など)が同じドキュメントを同時に読み書きできるようにします。

**コアバリュー:**

- 共有コンテキストを持つ並行 AI 開発セッションを可能にする
- ドキュメントファイルでの git コンフリクトを回避する
- 環境間で進捗ドキュメントを同期し続ける

---

## Context & Direction

<!--
📝 記入タイミング: plan
✍️ 記入内容: 問題の背景、設計哲学を記述。コードベース調査や既存ドキュメント確認の結果を反映
-->

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

<!--
📝 記入タイミング: planで初期記入 → architecture-decisionで妥当性検証・更新
✍️ 記入内容: テスト可能な受け入れ基準を定義。POC後に実現可能性を確認し、必要に応じて調整
-->

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

<!--
📝 記入タイミング: architecture-decision
✍️ 記入内容: POCの知見を基にシステム仕様、アーキテクチャ、設計方針を具体化
-->

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

- **リモートポーリング**: setInterval でリモートコメントを定期取得（デフォルト30秒）
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
    poll_interval: 30
```

---

## Tasks

<!--
📝 記入タイミング: architecture-decision（planフェーズではタスクを作成しない。Open Questionsとアーキテクチャ決定を解決した後に作成）
✍️ 記入内容: 実装者が「次に何をすべきか」を具体的に把握するための実行可能なタスクリスト

**GitHub Issueとの対応:**
- **大きなタスク**（複数日、複数PR）→ サブissue化し`(#123)`形式でIssue番号を記載
- **小さなタスク**（1-2時間で完結）→ このissue内で管理、Issue番号なし
- **サブissue化検討中** → `(未Issue化)`と記載

**記法:**
- `- [ ] タスク名` - 未完了の小タスク
- `- [ ] タスク名 (#123)` - サブissueとして管理中
- `- [ ] タスク名 (未Issue化)` - サブissue化を検討中
- `- [x] タスク名` - 完了済みタスク
-->

**Phase 2 残タスク:**
- [ ] `init`コマンドのデフォルトパスを`.issync/docs/plan-{number}.md`に変更 (#6)
- [ ] 関連するテストの更新（デフォルトパス変更に伴う）
- [ ] ドキュメント（CLAUDE.md、README等）の更新（デフォルトパス変更に伴う）
- [ ] watch --daemon / issync stop / issync status の実装 (#7)
- [ ] セクションベースのマージ戦略とコンフリクト解決フロー (#8)

**Phase 3 タスク:**
- [ ] 包括的なテストの追加
- [ ] エラーハンドリングとリトライ戦略
- [ ] ドキュメント作成

---

## Open Questions / 残論点

<!--
📝 記入タイミング: plan/pocで記入 → 各フェーズで解決
✍️ 記入内容: 未解決の重要な問い。implementまでに実装に必要な質問を全て解決。優先度が高い（先に解消すべき）問いを上に配置
-->

現在、未解決の質問はありません。

### 解決済み（アーカイブ）

**Q3: start/endマーカー方式を単一マーカー方式に変更すべきか？** ✅ 解決済み (2025-10-16)
- **回答**: コメント先頭の単一マーカー（`<!-- issync:v1 -->`）方式に変更
- **詳細**: Decision Log参照

**Q1: watchモードのポーリング間隔のデフォルト値は適切か？** ✅ 解決済み (2025-10-15)
- **回答**: デフォルトを30秒に変更。APIレート制限への心配を軽減しつつ、十分な同期頻度を維持
- **詳細**: Decision Log参照

**Q2: `init`コマンドのデフォルトパスをIssue番号ベース（`.issync/docs/plan-{number}.md`）に変更すべきか？** ✅ 解決済み (2025-10-15)
- **回答**: `.issync/docs/plan-{number}.md`をデフォルトパスに採用。issyncの設計意図に沿い、git管理外での運用が自然になる
- **詳細**: Decision Log参照

---

## Follow-up Issues / フォローアップ課題

<!--
📝 記入タイミング: Open Questions解消時、または実装中に発見した際
✍️ 記入内容: 今回のスコープでは対応しないが、将来的に別issueとして扱うべき事項
-->

- **CRDT ベースのリアルタイム同期**: GitHub Issue 以外のデータソース連携（Phase 3以降）
- **GitHub 以外のデータソース連携**: GitLab, Bitbucket などへの対応（Phase 3以降）

---

## Discoveries & Insights

<!--
📝 記入タイミング: poc以降、継続的に記入
✍️ 記入内容: 実装中に発見した技術的制約・複雑性・新たなタスク。失敗時は失敗原因も記録
-->

**2025-10-16: start/endマーカー方式の設計上の脆弱性**
- 問題: ドキュメント内でマーカーについて説明すると、実際のマーカーとして誤検出される
- 根本原因: start/endで囲む設計により、コンテンツ内にマーカー文字列があると誤検出するリスクが高い
- 対処: 単一マーカー方式への設計変更を決定（Q3として記録）

**2025-10-14: CLI --version と package.json の自動同期**
- 解決: `fs.readFileSync` で package.json を動的に読み込み、`.version(packageJson.version)` で参照
- メリット: package.json のバージョン更新時に cli.ts を手動で更新する必要がなくなる

**2025-10-14: 複数sync管理時のUX改善**
- 解決方針: オプション未指定時は全syncを対象とし、特定のsyncだけ操作したい場合にオプションを使う設計に変更

**2025-10-14: Lefthook で pre-commit 品質チェック強制**
- 原因: AI エージェントは「lint エラーは現在の変更と無関係」と判断してスキップする傾向
- 解決: Lefthook で pre-commit フックを導入し、コミット前に自動で品質チェックを強制

**2025-10-12-13: watch モードの安全性向上**
- 3-way セーフティチェック: 起動時に両側差分を検出しコンフリクトを事前防止
- grace period (1000ms): pull後の変更通知を無視し無限ループを防止
- AI透過性: Claude CodeのEdit()失敗を活用した自然なコンフリクト検出
- データロス事例から運用ガイドライン整備

---

## Decision Log

<!--
📝 記入タイミング: architecture-decision
✍️ 記入内容: POCの知見を基に技術選定、アーキテクチャ決定、トレードオフを記録
-->

**2025-10-16: 単一マーカー方式への変更（破壊的変更）**
- **採用**: start/end マーカーを廃止し、コメント先頭の単一マーカー `<!-- issync:v1 -->` のみに変更
- **理由**: 実際の運用では「コメント全体 = issync管理対象」という1:1関係のみで、範囲指定の必要性がない。start/endで囲む設計はコンテンツ内にマーカー文字列があると誤検出する脆弱性がある
- **マイグレーション**: 既存の start/end マーカー形式も読み取り可能にし、次回 push 時に新形式に自動変換

**2025-10-15: plan-template.md にissyncマーカーを含める**
- **採用**: `docs/plan-template.md` に issync マーカーを含める
- **理由**: issync以外のツールから開始（手動でGitHubに貼り付けてから開始）した場合に対応できる。HTMLコメントなのでGitHub UIでは見えない

**2025-10-15: `init`コマンドのデフォルトパスをIssue番号ベースに変更**
- **採用**: デフォルトパスを`docs/plan.md`から`.issync/docs/plan-{number}.md`に変更
- **理由**: issyncの設計意図に沿う（GitHub Issueが単一真実源、ローカルは一時ファイル）。`.issync/`配下でgit管理外になり、意図通りの運用が自然になる

**2025-10-15: watchモードのポーリング間隔デフォルト値を30秒に変更**
- **採用**: デフォルトのポーリング間隔を10秒から30秒に変更
- **理由**: APIレート制限への心配を軽減（360 req/h → 120 req/h）。ユーザーの心理的負担を軽減しつつ、十分な同期頻度を維持

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

**2025-10-13: 複数Issue同時管理のサポート**
- **採用**: 単一状態ファイルで配列管理
- **理由**: 1ファイルで全体管理、watch が複数ファイルを一括監視可能、現在の設計を最小限の変更で拡張可能

**2025-10-13: init コマンドのテンプレートサポート**
- **採用**: init コマンドに `--template` オプションを追加
- **メリット**: テンプレートからの新規プロジェクト開始がスムーズ、ディレクトリ作成も自動化

**2025-10-12: watch 起動時の安全性チェック**
- **採用**: watch 起動時に 3-way comparison でコンフリクト検出を実装
- **実装方針**: 両方が変更されている = コンフリクト（起動ブロック）、どちらか一方のみ = 自動同期
- **メリット**: データロスを事前に防止、ユーザーに明示的な選択肢を提示

**2025-10-12: 技術スタックとツール選定**
- **言語**: Bun + TypeScript, Bun Test（高速実装、成熟したエコシステム）
- **品質保証**: Biome (formatter/linter)、typescript-eslint (型ベースlint)、Knip (不要コード検出)
- **設計**: AI透過性、GitHub Issue SSoT、`.issync/state.yml`での状態管理、楽観ロック

---

## Outcomes & Retrospectives

<!--
📝 記入タイミング: retrospective
✍️ 記入内容: 実装完了内容、品質改善、発見、次のステップ。プロジェクト改善提案も含む
-->

**v0.2.0 リリース完了 (2025-10-14) - 複数Issue同時管理サポート**
- **実装完了**: state.yml を配列形式に移行、既存設定の自動マイグレーション、複数Issue/ファイルの同時管理対応、単一マーカー方式への移行、watchモードのデフォルトポーリング間隔を30秒に変更
- **CLI改善**: `--file` / `--issue` オプションでターゲットsync選択、単一syncの場合は自動選択
- **watch コマンド拡張**: 全syncを監視（並列実行）、部分的失敗モード（Promise.allSettled）
- **セキュリティ改善**: パストラバーサル攻撃防止の包括的なテスト、エラーハンドリング改善
- **テンプレート改善**: 各セクションの記入タイミングガイダンス追加
- **品質保証**: 72テスト全て合格、後方互換性維持
- **次のステップ**: watch デーモン化、セクションベースマージ、stop コマンド

**Phase 1 MVP 完了 (2025-10-12)**
- MVP実装完了（init/pull/push/watch）、楽観ロック確立、grace period実装
- データロス事例から運用ガイドライン整備、Phase 2でマージ戦略実装予定

---

## Deliverables & Notes

<!--
📝 記入タイミング: 随時更新
✍️ 記入内容: コマンドリファレンス、設定ファイルフォーマット、重要な考慮事項
-->

**コマンドリファレンス:**

```bash
# 開発時 (Bun 経由)
bun run dev init <issue-url> [--file path/to/file] [--template path/to/template-or-url]
bun run dev pull [--file path/to/file] [--issue issue-url]
bun run dev push [--file path/to/file] [--issue issue-url]
bun run dev watch [--interval 30] [--file path/to/file] [--issue issue-url]

# ビルド後 CLI (npm 公開済み)
issync init <issue-url> [--file path/to/file] [--template path/to/template-or-url]
issync pull [--file path/to/file] [--issue issue-url]
issync push [--file path/to/file] [--issue issue-url]
issync watch [--interval 30] [--file path/to/file] [--issue issue-url]

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
- 30 秒間隔でのポーリング = 120 リクエスト/時間(watch プロセスあたり)
- 403/429 レスポンスの処理が必要
- **楽観ロックの実装**: GET でコメント取得 → body の hash 計算 → PATCH 前に再度 GET して hash 比較 → 一致しなければコンフリクト

**べき等性と復旧:**

- `issync pull` は同一コメント内容であれば再実行してもファイル内容・ハッシュが変わらず、冪等に動作
- `issync push` は last_synced_hash が一致しない限り書き込みを拒否、失敗時は `pull → 手動マージ → push` で回復
- watch モードは AbortController と grace period により、安全に停止・再開できる
- `.issync/state.yml` を誤って削除した場合でも、`issync init` で再生成し `issync pull` で最新状態を復旧可能

---

## Inbox

<!--
📝 記入タイミング: 随時（人間のみ）
✍️ 記入内容: AIエージェントがまだ整理していない、人間が記入した未整理の情報。人間が適切なセクションに移動・整理する。AIはここに書き込まない
-->

<!-- 人間が整理前の情報をここに記入してください。AIエージェントはこのセクションに書き込みません。 -->
- [ ] CLAUDE.mdを圧縮