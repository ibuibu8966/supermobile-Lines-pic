import Link from "next/link";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-8">
            <span className="text-white">利用</span>
            <span className="text-gold">規約</span>
          </h1>

          <div className="bg-card border border-border rounded-lg p-8 space-y-8">
            <section>
              <p className="text-muted-foreground">
                この利用規約（以下「本規約」といいます）は、合同会社ピーチ（以下「当社」といいます）が提供する
                BUPPAN
                MOBILEサービス（以下「本サービス」といいます）の利用条件を定めるものです。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gold mb-4">
                第1条（適用）
              </h2>
              <p className="text-muted-foreground">
                本規約は、お客様と当社との間の本サービスの利用に関わる一切の関係に適用されるものとします。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gold mb-4">
                第2条（利用登録）
              </h2>
              <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  本サービスの利用を希望する者は、本規約に同意の上、当社の定める方法によって利用登録を申請するものとします。
                </li>
                <li>
                  当社は、利用登録の申請者に以下の事由があると判断した場合、利用登録の申請を承認しないことがあります。
                  <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                    <li>虚偽の事項を届け出た場合</li>
                    <li>本規約に違反したことがある者からの申請である場合</li>
                    <li>反社会的勢力等に該当する場合</li>
                    <li>その他、当社が利用登録を相当でないと判断した場合</li>
                  </ul>
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gold mb-4">
                第3条（サービス内容）
              </h2>
              <p className="text-muted-foreground">
                本サービスは、モバイル回線（SIMカード）のレンタルサービスです。
                お客様は、当社が提供するSIMカードを利用して、音声通話およびデータ通信を行うことができます。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gold mb-4">
                第4条（料金および支払方法）
              </h2>
              <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  お客様は、本サービスの対価として、当社が別途定める利用料金を支払うものとします。
                </li>
                <li>
                  利用料金の支払いは、クレジットカードによるものとします。
                </li>
                <li>
                  お客様が利用料金の支払いを遅滞した場合、年14.6%の割合による遅延損害金を支払うものとします。
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gold mb-4">
                第5条（最低利用期間）
              </h2>
              <p className="text-muted-foreground">
                本サービスの最低利用期間は3ヶ月とします。最低利用期間内に解約する場合、
                残存期間分の利用料金をお支払いいただきます。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gold mb-4">
                第6条（SIMカードの取り扱い）
              </h2>
              <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  SIMカードは当社の所有物であり、お客様に貸与するものです。
                </li>
                <li>
                  お客様は、SIMカードを善良な管理者の注意をもって保管するものとします。
                </li>
                <li>
                  解約時は、SIMカードを当社に返却するものとします。返却がない場合、または破損・紛失の場合は、
                  SIMカード再発行手数料をお支払いいただく場合があります。
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gold mb-4">
                第7条（禁止事項）
              </h2>
              <p className="text-muted-foreground mb-2">
                お客様は、本サービスの利用にあたり、以下の行為をしてはなりません。
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>法令または公序良俗に違反する行為</li>
                <li>犯罪行為に関連する行為</li>
                <li>当社のサーバーまたはネットワークの機能を破壊・妨害する行為</li>
                <li>当社のサービスの運営を妨害するおそれのある行為</li>
                <li>他のお客様に関する個人情報等を収集・蓄積する行為</li>
                <li>他のお客様に成りすます行為</li>
                <li>反社会的勢力に対して直接・間接に利益を供与する行為</li>
                <li>SIMカードの転売、第三者への貸与</li>
                <li>その他、当社が不適切と判断する行為</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gold mb-4">
                第8条（サービスの停止・中断）
              </h2>
              <p className="text-muted-foreground">
                当社は、以下のいずれかの事由があると判断した場合、お客様に事前に通知することなく
                本サービスの全部または一部の提供を停止または中断することができるものとします。
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4 mt-2">
                <li>
                  本サービスにかかるシステムの保守点検または更新を行う場合
                </li>
                <li>
                  地震、落雷、火災、停電または天災などの不可抗力により、本サービスの提供が困難となった場合
                </li>
                <li>その他、当社が本サービスの提供が困難と判断した場合</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gold mb-4">
                第9条（解約）
              </h2>
              <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  お客様は、当社の定める方法により、本サービスを解約することができます。
                </li>
                <li>
                  当社は、お客様が本規約のいずれかの条項に違反した場合、直ちに本サービスの利用を停止し、
                  または解約することができるものとします。
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gold mb-4">
                第10条（免責事項）
              </h2>
              <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  当社は、本サービスに事実上または法律上の瑕疵がないことを明示的にも黙示的にも保証しておりません。
                </li>
                <li>
                  当社は、本サービスに起因してお客様に生じたあらゆる損害について一切の責任を負いません。
                  ただし、当社の故意または重過失による場合はこの限りではありません。
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gold mb-4">
                第11条（規約の変更）
              </h2>
              <p className="text-muted-foreground">
                当社は、必要と判断した場合には、お客様に通知することなくいつでも本規約を変更することができるものとします。
                変更後の本規約は、当社ウェブサイトに掲示された時点から効力を生じるものとします。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gold mb-4">
                第12条（準拠法・管轄裁判所）
              </h2>
              <p className="text-muted-foreground">
                本規約の解釈にあたっては、日本法を準拠法とします。
                本サービスに関して紛争が生じた場合には、当社の本店所在地を管轄する裁判所を専属的合意管轄とします。
              </p>
            </section>

            <section className="pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                制定日: 2024年1月1日
              </p>
              <p className="text-sm text-muted-foreground">
                最終更新日: 2024年1月1日
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
