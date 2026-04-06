import Link from "next/link";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-8">
            <span className="text-white">プライバシー</span>
            <span className="text-gold">ポリシー</span>
          </h1>

          <div className="bg-card border border-border rounded-lg p-8 space-y-8">
            <section>
              <p className="text-muted-foreground">
                合同会社ピーチ（以下「当社」といいます）は、BUPPAN
                MOBILEサービス（以下「本サービス」といいます）において、
                お客様の個人情報を適切に取り扱うことを重要な責務と認識し、以下のとおりプライバシーポリシーを定めます。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gold mb-4">
                1. 収集する個人情報
              </h2>
              <p className="text-muted-foreground mb-2">
                当社は、本サービスの提供にあたり、以下の個人情報を収集します。
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>氏名、フリガナ</li>
                <li>生年月日</li>
                <li>住所</li>
                <li>電話番号</li>
                <li>メールアドレス</li>
                <li>本人確認書類の画像</li>
                <li>法人の場合：会社名、登記情報</li>
                <li>クレジットカード情報（決済代行会社を通じて処理）</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gold mb-4">
                2. 個人情報の利用目的
              </h2>
              <p className="text-muted-foreground mb-2">
                収集した個人情報は、以下の目的で利用します。
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>本サービスの提供、運営</li>
                <li>本人確認</li>
                <li>SIMカードの発送</li>
                <li>料金の請求、決済</li>
                <li>お問い合わせへの対応</li>
                <li>サービスに関するお知らせの送信</li>
                <li>サービス改善のための分析</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gold mb-4">
                3. 個人情報の第三者提供
              </h2>
              <p className="text-muted-foreground">
                当社は、以下の場合を除き、お客様の同意なく個人情報を第三者に提供しません。
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4 mt-2">
                <li>法令に基づく場合</li>
                <li>
                  人の生命、身体または財産の保護のために必要がある場合であって、本人の同意を得ることが困難であるとき
                </li>
                <li>
                  業務委託先（配送業者、決済代行会社等）に必要な範囲で提供する場合
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gold mb-4">
                4. 個人情報の安全管理
              </h2>
              <p className="text-muted-foreground">
                当社は、個人情報の漏洩、滅失または毀損を防止するため、適切な安全管理措置を講じます。
                また、個人情報を取り扱う従業員に対して、適切な監督を行います。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gold mb-4">
                5. 個人情報の開示・訂正・削除
              </h2>
              <p className="text-muted-foreground">
                お客様は、当社が保有する自己の個人情報について、開示、訂正、削除を請求することができます。
                請求の際は、本人確認を行った上で、合理的な期間内に対応いたします。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gold mb-4">
                6. Cookieの使用
              </h2>
              <p className="text-muted-foreground">
                本サービスでは、サービスの利便性向上、アクセス解析のためにCookieを使用しています。
                お客様はブラウザの設定によりCookieを無効にすることができますが、
                一部の機能が利用できなくなる場合があります。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gold mb-4">
                7. プライバシーポリシーの変更
              </h2>
              <p className="text-muted-foreground">
                当社は、必要に応じて本プライバシーポリシーを変更することがあります。
                変更後のプライバシーポリシーは、本ページに掲載した時点から効力を生じます。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gold mb-4">
                8. お問い合わせ窓口
              </h2>
              <p className="text-muted-foreground">
                個人情報の取り扱いに関するお問い合わせは、以下までご連絡ください。
              </p>
              <p className="text-muted-foreground mt-2">
                メールアドレス: info@example.com
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
