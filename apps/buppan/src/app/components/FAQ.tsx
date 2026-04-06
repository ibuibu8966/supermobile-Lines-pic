"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqItems = [
  {
    question: "申し込みから利用開始までどのくらいかかりますか？",
    answer:
      "本人確認書類の審査完了後、最短翌営業日に発送いたします。到着後すぐにご利用いただけます。",
  },
  {
    question: "法人契約は可能ですか？",
    answer:
      "はい、法人契約に対応しております。回線数に応じた割引もご用意しております。詳しくはお問い合わせください。",
  },
  {
    question: "どのキャリアの回線を使用していますか？",
    answer:
      "docomo回線および楽天モバイル回線をご用意しております。キャリアはプランにより異なります。",
  },
  {
    question: "契約期間の縛りはありますか？",
    answer:
      "最低利用期間はプランによって異なります。詳しくはお問い合わせください。",
  },
  {
    question: "MNP（番号ポータビリティ）には対応していますか？",
    answer:
      "MNP転出への対応はプランによって異なります。詳しくはお問い合わせください。",
  },
  {
    question: "支払い方法は何がありますか？",
    answer:
      "銀行振込でのお支払いとなります。",
  },
  {
    question: "SIMカードのサイズは選べますか？",
    answer:
      "nano SIM、micro SIM、標準SIMの3種類からお選びいただけます。",
  },
  {
    question: "解約時にSIMカードの返却は必要ですか？",
    answer:
      "基本的にSIMカードの返却は不要です。プランによって異なる場合がございますので、詳しくはお問い合わせください。",
  },
  {
    question: "ポケカ認証に使えますか？",
    answer:
      "はい、ポケカ認証用としてご利用いただけます。",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="py-20 bg-card">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-4">
          よくある<span className="text-gold">質問</span>
        </h2>
        <p className="text-muted-foreground text-center mb-12">
          お客様からよくいただくご質問をまとめました
        </p>

        <Accordion type="single" collapsible className="space-y-4">
          {faqItems.map((item, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="bg-background border border-border rounded-lg px-6"
            >
              <AccordionTrigger className="text-left hover:text-gold">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
