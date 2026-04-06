import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Settings, FileText, Check } from "lucide-react";
import { prisma } from "@/lib/database";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { FAQ } from "./components/FAQ";

export const revalidate = 60;

async function getPlansWithPricing() {
  const service = await prisma.service.findUnique({
    where: { code: "buppan" },
  });

  if (!service) {
    return [];
  }

  const plans = await prisma.plan.findMany({
    where: {
      serviceId: service.id,
      isActive: true,
    },
    include: {
      pricings: {
        orderBy: { minQuantity: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return plans;
}

export default async function LandingPage() {
  const plans = await getPlansWithPricing();

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative pt-20 min-h-[80vh] flex items-center">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/user_pascal-7qlXFeFNv14-unsplash.jpg"
            alt="Hero background"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/50" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 py-20">
          <div className="max-w-2xl">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="text-white">仕入れの</span>
              <span className="text-gold">相棒。</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8">
              音声通話付きSIMを業界最安値でご提供。
              物販ビジネスに必要な回線を、シンプルな料金体系でお届けします。
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/apply">
                <Button
                  size="lg"
                  className="bg-gold-gradient text-black font-semibold hover:opacity-90 text-lg px-8"
                >
                  今すぐ申し込む
                </Button>
              </Link>
              <Link href="/#pricing">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-gold text-gold hover:bg-gold/10 text-lg px-8"
                >
                  料金を見る
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-card">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">
            <span className="text-gold">BUPPAN MOBILE</span>
            <span className="text-white">の特徴</span>
          </h2>
          <p className="text-muted-foreground text-center mb-12">
            物販ビジネスに最適化されたサービス
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-background border-border hover:border-gold/50 transition-colors">
              <CardHeader>
                <div className="h-14 w-14 bg-gold/10 rounded-lg flex items-center justify-center mb-4">
                  <Phone className="h-7 w-7 text-gold" />
                </div>
                <CardTitle className="text-white">音声通話込み</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  全プランに音声通話機能を標準搭載。追加料金なしで通話可能なSIMをご提供します。
                </p>
              </CardContent>
            </Card>

            <Card className="bg-background border-border hover:border-gold/50 transition-colors">
              <CardHeader>
                <div className="h-14 w-14 bg-gold/10 rounded-lg flex items-center justify-center mb-4">
                  <Settings className="h-7 w-7 text-gold" />
                </div>
                <CardTitle className="text-white">選べる設計</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  docomo・楽天モバイル回線をご用意。ビジネスニーズに合わせたSIMをご提供します。
                </p>
              </CardContent>
            </Card>

            <Card className="bg-background border-border hover:border-gold/50 transition-colors">
              <CardHeader>
                <div className="h-14 w-14 bg-gold/10 rounded-lg flex items-center justify-center mb-4">
                  <FileText className="h-7 w-7 text-gold" />
                </div>
                <CardTitle className="text-white">シンプルな請求</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  回線数に応じた明確な料金体系。隠れた費用は一切なく、予算管理も簡単です。
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">
            <span className="text-white">料金</span>
            <span className="text-gold">プラン</span>
          </h2>
          <p className="text-muted-foreground text-center mb-12">
            回線数に応じたボリュームディスカウント
          </p>

          {plans.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-8 max-w-5xl mx-auto">
              {plans.map((plan, index) => {
                const lowestPrice = plan.pricings[0]?.unitPrice;
                const isPopular = index === 0;

                return (
                  <Card
                    key={plan.id}
                    className={`bg-card border-2 w-full max-w-sm ${
                      isPopular ? "border-gold" : "border-border"
                    } relative overflow-hidden`}
                  >
                    {isPopular && (
                      <div className="absolute top-0 right-0 bg-gold text-black text-xs font-bold px-3 py-1">
                        人気
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle className="text-white">{plan.name}</CardTitle>
                      {plan.description && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {plan.description}
                        </p>
                      )}
                      {lowestPrice && (
                        <p className="text-3xl font-bold mt-4">
                          <span className="text-gold">
                            ¥{lowestPrice.toLocaleString()}
                          </span>
                          <span className="text-base font-normal text-muted-foreground">
                            /回線/月〜
                          </span>
                        </p>
                      )}
                    </CardHeader>
                    <CardContent>
                      {plan.pricings.length > 0 && (
                        <div className="mb-6">
                          <p className="text-sm text-muted-foreground mb-2">
                            価格表
                          </p>
                          <div className="space-y-1">
                            {plan.pricings.map((pricing) => (
                              <div
                                key={pricing.id}
                                className="flex justify-between text-sm"
                              >
                                <span className="text-muted-foreground">
                                  {pricing.maxQuantity
                                    ? `${pricing.minQuantity}〜${pricing.maxQuantity}回線`
                                    : `${pricing.minQuantity}回線〜`}
                                </span>
                                <span className="text-white font-medium">
                                  ¥{pricing.unitPrice.toLocaleString()}/回線
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {plan.features && plan.features.length > 0 && (
                        <ul className="space-y-2 mb-6">
                          {plan.features.map((feature: string, i: number) => (
                            <li key={i} className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-gold" />
                              <span className="text-muted-foreground">
                                {feature}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Link href={`/apply?plan=${plan.code}`}>
                        <Button
                          className={`w-full ${
                            isPopular
                              ? "bg-gold-gradient text-black font-semibold hover:opacity-90"
                              : "border-gold text-gold hover:bg-gold/10"
                          }`}
                          variant={isPopular ? "default" : "outline"}
                        >
                          このプランで申し込む
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                現在利用可能なプランがありません
              </p>
              <Link href="/apply">
                <Button className="bg-gold-gradient text-black font-semibold hover:opacity-90">
                  お問い合わせ
                </Button>
              </Link>
            </div>
          )}

          <div className="text-center mt-8">
            <p className="text-muted-foreground">
              大口契約やカスタムプランについては
              <Link href="/apply" className="text-gold hover:underline ml-1">
                お問い合わせください
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="relative py-20">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/call-71170_1920.jpg"
            alt="CTA background"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/80" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            <span className="text-white">今すぐ</span>
            <span className="text-gold">始めましょう</span>
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            お申し込みから最短翌営業日で発送。すぐにビジネスでご利用いただけます。
          </p>
          <Link href="/apply">
            <Button
              size="lg"
              className="bg-gold-gradient text-black font-semibold hover:opacity-90 text-lg px-12"
            >
              無料で申し込む
            </Button>
          </Link>
        </div>
      </section>

      {/* FAQ Section */}
      <FAQ />

      <Footer />
    </div>
  );
}
