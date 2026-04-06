import Link from "next/link";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-8">
            <span className="text-white">特定商取引法に基づく</span>
            <span className="text-gold">表記</span>
          </h1>

          <div className="bg-card border border-border rounded-lg p-8 space-y-6">
            <section>
              <h2 className="text-lg font-semibold text-gold mb-2">
                販売業者
              </h2>
              <p className="text-muted-foreground">
                合同会社ピーチ（BUPPAN MOBILE運営）
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gold mb-2">
                代表責任者
              </h2>
              <p className="text-muted-foreground">宮崎　忍</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gold mb-2">所在地</h2>
              <p className="text-muted-foreground">
                〒290-0242 千葉県市原市荻作530-4
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gold mb-2">
                電話番号
              </h2>
              <p className="text-muted-foreground">
                050-8890-8892（平日10:00-18:00）
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gold mb-2">
                メールアドレス
              </h2>
              <p className="text-muted-foreground">
                peach.2023.7.19@gmail.com
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gold mb-2">
                商品代金以外の必要料金
              </h2>
              <ul className="text-muted-foreground space-y-1 list-disc list-inside ml-2">
                <li>ユニバーサルサービス料: 2円/月</li>
                <li>電話リレーサービス料: 1円/月</li>
                <li>追加データ: 500MB 770円、1GB 1,320円</li>
                <li>従量通話: 11円/30秒（税込）</li>
                <li>各種通話定額オプション</li>
                <li>銀行振込の場合: 振込手数料（お客様負担）</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gold mb-2">
                申込方法
              </h2>
              <p className="text-muted-foreground">
                Webサイトからのオンライン申込
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gold mb-2">
                支払方法
              </h2>
              <ul className="text-muted-foreground space-y-1 list-disc list-inside ml-2">
                <li>クレジットカード決済</li>
                <li>銀行振込（請求書対応可）</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gold mb-2">
                支払時期
              </h2>
              <ul className="text-muted-foreground space-y-1 list-disc list-inside ml-2">
                <li>月末締め翌月請求</li>
                <li>従量通話などの従量課金分は翌々月に合算</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gold mb-2">
                引き渡し時期
              </h2>
              <p className="text-muted-foreground">
                物理SIM: 申込後1〜5営業日で発送、到着後の開通手続で利用開始
                <br />
                ※eSIMは非対応
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gold mb-2">
                返品・交換・解約
              </h2>
              <ul className="text-muted-foreground space-y-1 list-disc list-inside ml-2">
                <li>返品: 通信サービスの性質上、開通後の返品は不可</li>
                <li>交換: 不良SIMの場合は再発行（手数料あり）</li>
                <li>
                  解約: 解約金なし。当月解約申請で当月末解約（日割りなし）
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gold mb-2">
                役務提供条件
              </h2>
              <p className="text-muted-foreground">
                電波状況、設備保守、天災等により一時的にサービスを利用できない場合があります。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gold mb-2">
                クーリング・オフ
              </h2>
              <p className="text-muted-foreground">
                本サービスは通信役務・通信販売に該当するため、クーリング・オフの適用外です。
              </p>
            </section>
          </div>

          {/* 電気通信事業法に基づく表示 */}
          <h2
            id="telecom-law"
            className="text-2xl font-bold mt-12 mb-6 scroll-mt-24"
          >
            <span className="text-white">電気通信事業法に基づく</span>
            <span className="text-gold">表示</span>
          </h2>

          <div className="bg-card border border-border rounded-lg p-8 space-y-6">
            <section>
              <h2 className="text-lg font-semibold text-gold mb-2">
                電気通信事業者
              </h2>
              <p className="text-muted-foreground">合同会社ピーチ</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gold mb-2">
                届出番号
              </h2>
              <p className="text-muted-foreground">
                A-07-22969（総務省 届出受理済）
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gold mb-2">
                受理通知
              </h2>
              <p className="text-muted-foreground">
                総務省より受理された届出書の受理通知（令和7年10月6日付）
              </p>
              <a
                href="/documents/20251022133036857.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold hover:underline text-sm mt-1 inline-block"
              >
                受理通知PDF（A-07-22969）を確認する
              </a>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gold mb-2">
                提供区域
              </h2>
              <p className="text-muted-foreground">
                日本国内（NTTドコモ網の提供エリアに準拠）
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gold mb-2">
                緊急通報（110/118/119）
              </h2>
              <p className="text-muted-foreground">発信可能</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gold mb-2">
                通話定額の対象外番号
              </h2>
              <ul className="text-muted-foreground space-y-1 list-disc list-inside ml-2">
                <li>0570（ナビダイヤル）</li>
                <li>0180（テレドーム）</li>
                <li>104（番号案内）</li>
                <li>衛星電話・衛星船舶電話</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gold mb-2">
                フェアユースポリシー（速度制御）
              </h2>
              <p className="text-muted-foreground mb-3">
                各プランに3日間合計の上限があり、超過時は当該期間256kbpsに速度制御されます。
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-gold font-semibold">
                        プラン
                      </th>
                      <th className="text-left py-2 px-3 text-gold font-semibold">
                        3日間データ上限
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3">1GBプラン</td>
                      <td className="py-2 px-3">100MB/3日</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3">3GBプラン</td>
                      <td className="py-2 px-3">500MB/3日</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3">7.5GBプラン</td>
                      <td className="py-2 px-3">1GB/3日</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3">10GBプラン</td>
                      <td className="py-2 px-3">1.5GB/3日</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3">20GBプラン</td>
                      <td className="py-2 px-3">3GB/3日</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3">100GB目安プラン</td>
                      <td className="py-2 px-3">10GB/3日</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gold mb-2">
                通信速度（ベストエフォート）
              </h2>
              <ul className="text-muted-foreground space-y-1 list-disc list-inside ml-2">
                <li>下り最大: 375Mbps</li>
                <li>上り最大: 50Mbps</li>
              </ul>
              <p className="text-sm text-muted-foreground/70 mt-2">
                実際の速度は通信環境や混雑状況により変動します。記載の速度は技術規格上の最大値であり、実効速度を保証するものではありません。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gold mb-2">
                使用ネットワーク
              </h2>
              <p className="text-muted-foreground">NTTドコモ網系MVNO</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gold mb-2">
                サービス提供時間
              </h2>
              <p className="text-muted-foreground">
                24時間365日（設備保守・障害時を除く）
              </p>
              <p className="text-muted-foreground">
                回線切替操作: 10:00-19:00
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gold mb-2">
                最低利用期間・解約金
              </h2>
              <ul className="text-muted-foreground space-y-1 list-disc list-inside ml-2">
                <li>最低利用期間: なし</li>
                <li>解約金: 0円</li>
              </ul>
              <p className="text-sm text-muted-foreground/70 mt-2">
                ※初回3ヶ月パックは返金不可
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gold mb-2">
                お問い合わせ
              </h2>
              <p className="text-muted-foreground">
                メール: peach.2023.7.19@gmail.com
              </p>
              <p className="text-muted-foreground">
                受付時間: 平日10:00-18:00
              </p>
            </section>
          </div>

          <div className="mt-8 text-center">
            <Link href="/" className="text-gold hover:underline">
              トップページに戻る
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
