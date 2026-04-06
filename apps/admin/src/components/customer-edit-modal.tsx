"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Customer {
  id: string;
  type: string;
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  email: string;
  phone: string;
  birthDate: string | null;
  postalCode: string;
  prefecture: string;
  city: string;
  address: string;
  building: string | null;
  companyName: string | null;
  companyNameKana: string | null;
  establishedDate: string | null;
  representativeLastName: string | null;
  representativeFirstName: string | null;
  representativeLastNameKana: string | null;
  representativeFirstNameKana: string | null;
  companyPostalCode: string | null;
  companyPrefecture: string | null;
  companyCity: string | null;
  companyAddress: string | null;
  companyBuilding: string | null;
}

interface CustomerEditModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function CustomerEditModal({ customer, isOpen, onClose, onSaved }: CustomerEditModalProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && customer) {
      setForm({
        lastName: customer.lastName,
        firstName: customer.firstName,
        lastNameKana: customer.lastNameKana,
        firstNameKana: customer.firstNameKana,
        email: customer.email,
        phone: customer.phone,
        birthDate: customer.birthDate ? String(customer.birthDate).split("T")[0] : "",
        postalCode: customer.postalCode,
        prefecture: customer.prefecture,
        city: customer.city,
        address: customer.address,
        building: customer.building || "",
        companyName: customer.companyName || "",
        companyNameKana: customer.companyNameKana || "",
        establishedDate: customer.establishedDate ? String(customer.establishedDate).split("T")[0] : "",
        representativeLastName: customer.representativeLastName || "",
        representativeFirstName: customer.representativeFirstName || "",
        representativeLastNameKana: customer.representativeLastNameKana || "",
        representativeFirstNameKana: customer.representativeFirstNameKana || "",
        companyPostalCode: customer.companyPostalCode || "",
        companyPrefecture: customer.companyPrefecture || "",
        companyCity: customer.companyCity || "",
        companyAddress: customer.companyAddress || "",
        companyBuilding: customer.companyBuilding || "",
      });
    }
  }, [isOpen, customer]);

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!customer) return;
    setSaving(true);
    try {
      const body: Record<string, string | null> = {};
      // 個人情報
      body.lastName = form.lastName;
      body.firstName = form.firstName;
      body.lastNameKana = form.lastNameKana;
      body.firstNameKana = form.firstNameKana;
      body.email = form.email;
      body.phone = form.phone;
      body.birthDate = form.birthDate || null;
      body.postalCode = form.postalCode;
      body.prefecture = form.prefecture;
      body.city = form.city;
      body.address = form.address;
      body.building = form.building || null;

      // 法人情報
      if (customer.type === "CORPORATE") {
        body.companyName = form.companyName || null;
        body.companyNameKana = form.companyNameKana || null;
        body.establishedDate = form.establishedDate || null;
        body.representativeLastName = form.representativeLastName || null;
        body.representativeFirstName = form.representativeFirstName || null;
        body.representativeLastNameKana = form.representativeLastNameKana || null;
        body.representativeFirstNameKana = form.representativeFirstNameKana || null;
        body.companyPostalCode = form.companyPostalCode || null;
        body.companyPrefecture = form.companyPrefecture || null;
        body.companyCity = form.companyCity || null;
        body.companyAddress = form.companyAddress || null;
        body.companyBuilding = form.companyBuilding || null;
      }

      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "更新に失敗しました");
      }

      toast.success("顧客情報を更新しました");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (!customer) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>顧客情報の編集</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 個人情報 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-1">個人情報</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="姓（カナ）" value={form.lastNameKana} onChange={(v) => handleChange("lastNameKana", v)} />
              <Field label="名（カナ）" value={form.firstNameKana} onChange={(v) => handleChange("firstNameKana", v)} />
              <Field label="姓（漢字）" value={form.lastName} onChange={(v) => handleChange("lastName", v)} />
              <Field label="名（漢字）" value={form.firstName} onChange={(v) => handleChange("firstName", v)} />
              <Field label="メールアドレス" value={form.email} onChange={(v) => handleChange("email", v)} type="email" className="col-span-2" />
              <Field label="電話番号" value={form.phone} onChange={(v) => handleChange("phone", v)} />
              <Field label="生年月日" value={form.birthDate} onChange={(v) => handleChange("birthDate", v)} type="date" />
              <Field label="郵便番号" value={form.postalCode} onChange={(v) => handleChange("postalCode", v)} />
              <Field label="都道府県" value={form.prefecture} onChange={(v) => handleChange("prefecture", v)} />
              <Field label="市区郡町村" value={form.city} onChange={(v) => handleChange("city", v)} className="col-span-2" />
              <Field label="町名・丁目・番地" value={form.address} onChange={(v) => handleChange("address", v)} className="col-span-2" />
              <Field label="マンション／ビル名・部屋番号" value={form.building} onChange={(v) => handleChange("building", v)} className="col-span-2" />
            </div>
          </div>

          {/* 法人情報 */}
          {customer.type === "CORPORATE" && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 border-b pb-1">法人情報</h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label="会社名" value={form.companyName} onChange={(v) => handleChange("companyName", v)} className="col-span-2" />
                <Field label="会社名（カナ）" value={form.companyNameKana} onChange={(v) => handleChange("companyNameKana", v)} className="col-span-2" />
                <Field label="設立日" value={form.establishedDate} onChange={(v) => handleChange("establishedDate", v)} type="date" />
                <div />
                <Field label="代表者 姓" value={form.representativeLastName} onChange={(v) => handleChange("representativeLastName", v)} />
                <Field label="代表者 名" value={form.representativeFirstName} onChange={(v) => handleChange("representativeFirstName", v)} />
                <Field label="代表者 姓（カナ）" value={form.representativeLastNameKana} onChange={(v) => handleChange("representativeLastNameKana", v)} />
                <Field label="代表者 名（カナ）" value={form.representativeFirstNameKana} onChange={(v) => handleChange("representativeFirstNameKana", v)} />
                <Field label="法人郵便番号" value={form.companyPostalCode} onChange={(v) => handleChange("companyPostalCode", v)} />
                <Field label="法人都道府県" value={form.companyPrefecture} onChange={(v) => handleChange("companyPrefecture", v)} />
                <Field label="法人市区町村" value={form.companyCity} onChange={(v) => handleChange("companyCity", v)} className="col-span-2" />
                <Field label="法人町名・番地" value={form.companyAddress} onChange={(v) => handleChange("companyAddress", v)} className="col-span-2" />
                <Field label="法人ビル名・部屋番号" value={form.companyBuilding} onChange={(v) => handleChange("companyBuilding", v)} className="col-span-2" />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  className = "",
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs text-gray-500">{label}</Label>
      <Input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-sm mt-0.5"
      />
    </div>
  );
}
