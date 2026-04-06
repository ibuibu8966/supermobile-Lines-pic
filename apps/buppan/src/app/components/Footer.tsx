import Link from "next/link";

export function Footer() {
  const serviceLinks = [
    { href: "/#pricing", label: "料金プラン" },
    { href: "/#features", label: "特徴" },
    { href: "/apply", label: "お申し込み" },
    { href: "/dashboard", label: "マイページ" },
  ];

  const legalLinks = [
    { href: "/terms", label: "利用規約" },
    { href: "/privacy", label: "プライバシーポリシー" },
    { href: "/legal", label: "特定商取引法に基づく表記" },
  ];

  return (
    <footer className="bg-black border-t border-border py-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-1 mb-4">
              <span className="text-xl font-bold text-white">BUPPAN</span>
              <span className="text-xl font-bold text-gold">MOBILE</span>
            </div>
            <p className="text-muted-foreground text-sm mb-4">
              モバイル回線レンタルサービス
            </p>
            <p className="text-muted-foreground text-sm">
              運営: 合同会社ピーチ
            </p>
          </div>

          {/* Service Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">サービス</h3>
            <ul className="space-y-2">
              {serviceLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-gold transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">法的情報</h3>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-gold transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 text-center">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} BUPPAN MOBILE. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
