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

将来のAI機能では、OrcaRouterをOpenAI互換APIとして次の設定で利用する予定です。

- Base URL: `https://api.orcarouter.ai/v1`
- Model: `orcarouter/auto`

現在はOrcaRouterへのAPI呼び出しを実装していません。

## 地図の初期表示設定

初期座標、ズーム、地図スタイルは `src/config/map.ts` で変更できます。背景地図はアプリ内で定義したMapLibre styleから、APIキー不要のCARTO Voyagerラスタタイルを直接読み込みます。

## 現在実装済みの機能

- Next.js App RouterとTypeScriptによるWebアプリ基盤
- PC横長画面を優先した地図約70%・情報パネル約30%のレイアウト
- MapLibre GL JSによる地図表示
- `MapView`、`SidePanel`、`AppLayout` のコンポーネント分割
- 地図とページの最低限のLoading / Error表示
- 狭い画面で縦並びになる最低限のレスポンシブ対応

GTFS処理、鉄道路線表示、地点選択、列車検索、AI撮影プランナー、OrcaRouter API呼び出しは未実装です。

## 品質確認

```bash
npm run lint
npm run typecheck
npm run build
```
