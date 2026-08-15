# RailShot AI

RailShot AIは、撮りたい列車・時間・条件から「いつ、どこへ行けばよいか」を逆算する鉄道撮影支援AIです。現在はハッカソン向けMVPのWebアプリ基盤を構築した段階です。

## セットアップ

必要環境:

- Node.js 20.19以上、22.13以上、または24以上
- npm

依存パッケージをインストールします。

```bash
npm install
```

環境変数のひな形をコピーします。

```bash
cp .env.example .env.local
```

## 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## ORCAROUTER_API_KEYの設定場所

ローカル開発では、リポジトリ直下の `.env.local` に設定します。

```dotenv
ORCAROUTER_API_KEY=your_api_key_here
```

`.env.local` はGit管理対象外です。実際のAPIキーを `.env.example` やソースコードへ記載しないでください。

AI自然言語解析では、OrcaRouterをOpenAI互換APIとして次の設定で利用します。

- Base URL: `https://api.orcarouter.ai/v1`
- Model: `orcarouter/auto`

呼び出しはサーバー側の `POST /api/ai/parse-request` からだけ行い、APIキーをブラウザへ送りません。

## 地図の初期表示設定

初期座標、ズーム、地図スタイルは `src/config/map.ts` で変更できます。背景地図はアプリ内で定義したMapLibre styleから、APIキー不要のCARTO Voyagerラスタタイルを直接読み込みます。

## 現在実装済みの機能

- Next.js App RouterとTypeScriptによるWebアプリ基盤
- PC横長画面を優先した地図約70%・情報パネル約30%のレイアウト
- MapLibre GL JSによる地図表示
- SQLiteのGTFS shapeから生成した鉄道路線GeoJSONの表示
- デモ路線全体への自動ズームと駅ポイント・駅名ポップアップ
- 線路クリック時の最寄りLineString上へのスナップと選択マーカー表示
- 選択したroute / shape、緯度経度、始点からの累積距離・shape全長の表示
- 前後駅の距離比による、サービス日経過秒ベースの推定通過時刻エンジン
- `shape_dist_traveled`優先・欠損時の駅座標投影フォールバック
- `POST /api/passages`による営業日・時間帯別の通過列車検索
- 日付と検索時間帯を変更できる通過列車一覧パネル
- `GET /api/trips/[tripId]`による列車・路線・全駅時刻の取得
- 列車詳細タイムライン、選択地点の推定通過時刻、選択shapeの地図強調
- `GET /api/shooting-spots`による承認済み撮影候補地点の取得
- 承認済み撮影地点3件と、初期非表示の地図マーカー切替
- `POST /api/planner/search`による車両・列車、営業日、時間帯、徒歩条件の決定的な撮影プラン検索
- `POST /api/ai/parse-request`によるOrcaRouter経由の自然言語から検索条件への変換
- AIが理解した条件と、決定的検索エンジンによる撮影候補を表示する入力パネル
- 路線一覧・路線shape API
- `MapView`、`SidePanel`、`AppLayout` のコンポーネント分割
- 地図とページの最低限のLoading / Error表示
- 狭い画面で縦並びになる最低限のレスポンシブ対応

AIは検索条件の構造化だけを担当し、ダイヤ、距離、通過時刻、撮影地点、スコアは既存の決定的ロジックで処理します。LLMによる推薦理由生成は未実装です。

## 品質確認

```bash
npm run lint
npm run typecheck
npm run build
```

## デモGTFSのインポート

リポジトリ内の架空デモGTFSを、ローカルSQLiteへ取り込みます。

```bash
npm run gtfs:import
```

既定の入力は `data/gtfs/demo/` と `data/shooting_spots.json`、出力は `data/railshot.sqlite` です。出力DBは生成物としてGit管理対象外です。別のパスを使う場合は、入力ディレクトリ、出力DB、撮影地点JSONの順に指定できます。

```bash
npm run gtfs:import -- path/to/gtfs path/to/output.sqlite path/to/shooting_spots.json
```
