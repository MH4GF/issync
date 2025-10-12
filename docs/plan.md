# issync 開発計画

この実行計画は生きたドキュメントです。新しい情報が出るたびに `進捗状況`、`発見と気づき`、`決定ログ`、`成果と振り返り` を更新してください。各セクションは、事前知識のない初めての貢献者へのガイダンスとして扱ってください。

## 目的 / 全体像

issync は、GitHub Issue のコメントとローカルファイル間でテキストを同期する CLI ツールです。AI エージェントが GitHub Issue 内で生きたドキュメント(plans.md など)を単一の信頼できる情報源として維持できるようにし、複数のローカルセッション(git worktree、Devin など)が同じドキュメントを同時に読み書きできるようにします。

**コアバリュー:**
- 共有コンテキストを持つ並行 AI 開発セッションを可能にする
- ドキュメントファイルでの git コンフリクトを回避する
- 環境間で進捗ドキュメントを同期し続ける

## 進捗状況

- [x] プロジェクト名決定: `issync`
- [x] リポジトリ作成と初期化
- [x] 言語/ランタイムの選択: **Bun + TypeScript**
- [x] プロジェクト構造の定義
- [x] 基本的な CLI フレームワークの実装
- [ ] GitHub API クライアントの実装
- [ ] .issync.yml スキーマの実装
- [ ] init コマンドの実装
- [ ] pull コマンドの実装
- [ ] push コマンドの実装(楽観ロック含む)
- [ ] watch モードの実装(リモートポーリング)
- [ ] watch モードの実装(ローカルファイル監視)
- [ ] watch モードの実装(デーモン化)
- [ ] セクションベースのマージ戦略の実装
- [ ] コンフリクトの適切な処理
- [ ] テストの追加
- [ ] ドキュメント作成

## 発見と気づき

**2025-10-12: Claude Code の Edit() ツールを活用したコンフリクト検出**
- Claude Code の Edit() は Read() しないと動作しない
- Edit() は文字列置換に失敗すると(= ファイルが更新されていると)エラーになる
- この仕組みをそのまま活用すれば、AIエージェント側でコンフリクト検出が自然に起きる
- issync は透過的にバックグラウンドで動作し、AIエージェントは存在を意識しなくて済む

## 決定ログ

**2025-10-12: ツール命名**
- 候補: isync、plansync、ghmd、tether、clink、relay、plink、zync、comlink
- 採用: `issync` (issue + sync)
- 理由: 明確、機能的、利用可能

**2025-10-12: アーキテクチャ決定**
- SSoT: GitHub Issue Comment (Issue 本文ではない)
- 同期戦略: Pull 重視 + オンデマンド push
- マージ戦略: セクションベースの自動マージとコンフリクト検出
- コンフリクト解決: 楽観的ロックと手動フォールバック
- メタデータ保存: プロジェクトルートの .issync.yml

**2025-10-12: MVP の SSoT は GitHub Issue とする**
- 理由:
  - インフラ不要、GitHub の認証・認可をそのまま活用
  - 可視性・監査可能性が高い(Issue/PR の文脈と紐づく)
  - 運用負荷ゼロ(サーバー管理、DB、デプロイ不要)
  - 段階的拡張が可能(後から yjs など CRDT ベースに移行可能)
- yjs + 中央サーバーは将来の拡張として検討
  - ハイブリッド案: yjs をセッション中のみ起動し、定期的に Issue に永続化

**2025-10-12: AIエージェントに透過的な設計**
- **重要な要件**: AIコーディングエージェントは issync の存在を知らなくて済む
- AIエージェントは通常の Read()/Edit() ツールでファイルを操作
- issync は watch mode でバックグラウンド動作し、自動的に pull/push
- **コンフリクト検出の仕組み**:
  1. issync が watch mode でリモートの変更を pull し、ローカルファイルを更新
  2. AIエージェントが Edit() を試みる
  3. old_string が見つからず Edit() が失敗(ファイルが更新済みのため)
  4. AIエージェントは自然に Re-read して再試行(Claude Code の標準動作)
- **push 側の楽観ロック**:
  - ローカルファイル変更を検知(inotify/fswatch)
  - push 前に GitHub 側の comment hash を検証
  - 既に更新されていたら pull → マージ → 再 push or 手動解決

**2025-10-12: 言語選択 - Bun + TypeScript**
- 採用: **Bun + TypeScript**
- 理由:
  - **開発速度**: TypeScript で素早く MVP を実装できる
  - **GitHub API**: Octokit が最も成熟している
  - **ファイル監視**: chokidar など npm エコシステムを活用
  - **配布**: npm パッケージとして公開(`npm install -g issync`)
  - **ターゲットユーザー**: 開発者は Node.js/Bun を既に持っている
- 配布戦略:
  - Phase 1: npm パッケージ(ランタイム必要)
  - Phase 2: 必要に応じて単一バイナリ化 or Go への移行を検討
- 比較検討した候補: Go, Rust
  - Go: 単一バイナリ配布は優秀だが、開発速度で劣る
  - Rust: MVP には過剰、学習コストが高い

## 成果と振り返り

## コンテキストと方向性

**問題のコンテキスト:**
AI エージェント(Claude Code、Devin など)は、開発セッション中に生きたドキュメントを維持することで利益を得ます。しかし、ローカルファイルには問題があります:
1. 複数人チームでの Git コンフリクト
2. 並行セッション(git worktree)間でドキュメントを共有できない
3. ドキュメントの同期が困難

**インスピレーション元:**
Feler の手法: plans.md を生きたドキュメントとして使い、AI エージェントが長時間の開発セッション(7時間セッション、150M トークン、15K 行のリファクタリング)中に継続的に読み書きする。

**設計哲学:**
- **AIエージェントに透過的**: エージェントは issync の存在を意識せず、通常のファイル操作(Read/Edit)で動作
- **バックグラウンド同期**: watch mode がリモートとローカルを自動的に同期
- **既存ツールの活用**: Claude Code の Edit() の失敗メカニズムをコンフリクト検出に利用
- **段階的拡張**: MVP は Issue SSoT、将来的に CRDT ベース(yjs)へ移行可能

## 作業計画

### フェーズ 1: MVP(コア機能)
- 言語の選択とプロジェクト構造のセットアップ
- GitHub API 統合の実装(コメントの読み書き)
- init、pull、push コマンドの実装
- 基本的なコンフリクト検出(ハッシュベース + 楽観ロック)
- **watch mode の実装（MVP の核心機能）**:
  - リモート変更の定期的な pull(ポーリング)
  - ローカルファイル変更の検知と自動 push(inotify/fswatch)
  - バックグラウンドプロセス管理

### フェーズ 2: スマートマージ
- セクションベースの Markdown パース
- 追記専用セクションの自動マージ
- コンフリクト解決 UI

### フェーズ 3: 安定性と最適化
- レート制限処理の改善
- エラーハンドリング
- リトライ戦略
- ローカルバックアップ機能

### フェーズ 4: 仕上げ
- テスト
- ドキュメント
- リリース自動化

## 具体的なステップ

1. 言語/ランタイムを決定
2. 基本的な CLI 構造をセットアップ
3. GitHub API クライアントを実装
4. .issync.yml スキーマを作成
5. init コマンドを実装(Issue URL → .issync.yml 生成)
6. pull ロジックを実装(リモート comment → ローカルファイル)
7. push ロジックを実装(ローカルファイル → リモート comment + 楽観ロック)
8. **watch モードを実装**:
   - リモートポーリング(定期的に pull)
   - ローカルファイル監視(inotify/fswatch/chokidar)
   - 変更検知時の自動 push
   - バックグラウンドプロセス管理(デーモン化)
9. ハッシュベースのコンフリクト検出を追加
10. セクションベースのマージを追加(フェーズ2)
11. テストを書く

## 検証と受け入れ基準

**受け入れ基準:**
- Issue コメント URL で初期化できる
- リモートの変更をローカルファイルに pull できる
- ローカルの変更をリモートコメントに push できる
- **AIエージェントが通常の Read()/Edit() で透過的に動作する**:
  - watch mode がバックグラウンドで動作中
  - AIエージェントが Edit() を試行
  - リモート更新があった場合、Edit() が失敗し、再 Read() が促される
  - issync の存在を意識せずに動作する
- Watch モードがリモート変更時にローカルファイルを自動更新する
- ローカルファイル変更時に自動的に push される
- 同じ Issue で複数の worktree 間で動作する
- 楽観ロックが機能し、コンフリクトを適切に検出・処理する

**テストシナリオ:**
- 単一ユーザー、単一セッション
- 単一ユーザー、複数 worktree(同時編集)
- 複数ユーザー、追記専用更新
- コンフリクトシナリオ(両側が同じセクションを編集)
- **AIエージェント透過性**:
  - Claude Code で watch mode 起動
  - Claude Code が plan.md を Read/Edit
  - 別セッション(or 手動)でリモート更新
  - Claude Code の Edit が自然に失敗し、再試行する

## べき等性と復旧

- Pull 操作はべき等(複数回安全に実行可能)
- Push は書き込み前にリモートハッシュを検証
- Watch モードは API 失敗を適切に処理
- マージコンフリクト前にローカルバックアップを作成

## 成果物とメモ

**主要コマンド:**
```bash
# 初期化: Issue URL を .issync.yml に保存
issync init <issue-url> [--file path/to/file]

# 手動同期
issync pull                    # リモート → ローカル
issync push [-m "message"]     # ローカル → リモート

# バックグラウンド同期(MVP の核心機能)
issync watch [--interval 10]  # リモートを10秒ごとにポーリング + ローカル変更を自動push
issync watch --daemon          # デーモンとして起動
issync stop                    # watch mode を停止

# 状態確認
issync status                  # 同期状態、last synced hash、watch mode の状態
```

**典型的な使用フロー:**
```bash
# セッション開始時
issync init https://github.com/owner/repo/issues/123 --file docs/plan.md
issync watch --daemon

# AIエージェント(Claude Code)がファイルを操作
# → issync が透過的にバックグラウンドで同期

# セッション終了時
issync stop
```

**設定フォーマット(.issync.yml):**
```yaml
issue_url: https://github.com/owner/repo/issues/123
comment_id: 123456789               # 最初の sync で自動設定
local_file: docs/plan.md
last_synced_hash: abc123def         # リモートの最終 hash(楽観ロック用)
last_synced_at: 2025-10-12T10:30:00Z
poll_interval: 10                   # リモートポーリング間隔(秒)
merge_strategy: section-based       # フェーズ2で実装
watch_daemon_pid: 12345             # watch mode のプロセスID(起動中のみ)
```

**GitHub API 考慮事項:**
- レート制限: 5000 リクエスト/時間(認証済み)
- 10秒間隔でのポーリング = 360 リクエスト/時間(watch プロセスあたり)
- 403/429 レスポンスの処理が必要
- **楽観ロックの実装**:
  - GET /repos/{owner}/{repo}/issues/comments/{comment_id} でコメント取得
  - body の hash を計算し、.issync.yml に保存
  - PATCH で更新する前に再度 GET して hash を比較
  - hash が一致しなければコンフリクト(pull → マージ → 再試行)
- Issue comment の更新は PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}
