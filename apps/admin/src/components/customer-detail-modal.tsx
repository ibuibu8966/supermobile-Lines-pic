import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CustomerDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: {
    type: string;
    lastName: string;
    firstName: string;
    lastNameKana?: string | null;
    firstNameKana?: string | null;
    companyName?: string | null;
    companyNameKana?: string | null;
    birthDate?: Date | null;
    postalCode?: string | null;
    prefecture?: string | null;
    city?: string | null;
    address?: string | null;
    building?: string | null;
    companyPostalCode?: string | null;
    companyPrefecture?: string | null;
    companyCity?: string | null;
    companyAddress?: string | null;
    companyBuilding?: string | null;
    email?: string | null;
    phone?: string | null;
  };
}

export function CustomerDetailModal({
  open,
  onOpenChange,
  customer,
}: CustomerDetailModalProps) {
  const isIndividual = customer.type === "INDIVIDUAL";

  // Format birthDate to Japanese date format (yyyy年MM月dd日)
  const formatDate = (date: Date | null | undefined) => {
    if (!date) return null;
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${year}年${month}月${day}日`;
  };

  // Render field if value exists
  const renderField = (label: string, value: string | null | undefined) => {
    if (!value) return null;
    return (
      <div>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div>{value}</div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>顧客情報</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isIndividual ? (
            <>
              {/* 個人契約 */}
              {renderField("連絡先メールアドレス", customer.email)}
              {renderField("姓（フリガナ）", customer.lastNameKana)}
              {renderField("名（フリガナ）", customer.firstNameKana)}
              {renderField("姓（漢字）", customer.lastName)}
              {renderField("名（漢字）", customer.firstName)}
              {renderField("生年月日（西暦）", formatDate(customer.birthDate))}
              {renderField("住所（郵便番号）", customer.postalCode)}
              {renderField("住所（都道府県）", customer.prefecture)}
              {renderField("住所（市区郡町村）", customer.city)}
              {renderField("住所（町名・丁目・番地）", customer.address)}
              {renderField("住所（マンション/ビル名・部屋番号）", customer.building)}
              {renderField("連絡先電話番号", customer.phone)}
            </>
          ) : (
            <>
              {/* 法人契約 */}
              {renderField("連絡先メールアドレス", customer.email)}
              {renderField("会社名または屋号（フリガナ）", customer.companyNameKana)}
              {renderField("会社名または屋号（漢字）", customer.companyName)}
              {renderField("代表者姓（フリガナ）", customer.lastNameKana)}
              {renderField("代表者名（フリガナ）", customer.firstNameKana)}
              {renderField("代表者姓（漢字）", customer.lastName)}
              {renderField("代表者名（漢字）", customer.firstName)}
              {renderField("住所（郵便番号）", customer.companyPostalCode)}
              {renderField("住所（都道府県）", customer.companyPrefecture)}
              {renderField("住所（市区郡町村）", customer.companyCity)}
              {renderField("住所（町名・丁目・番地）", customer.companyAddress)}
              {renderField("住所（マンション/ビル名・部屋番号）", customer.companyBuilding)}
              {renderField("連絡先電話番号", customer.phone)}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
