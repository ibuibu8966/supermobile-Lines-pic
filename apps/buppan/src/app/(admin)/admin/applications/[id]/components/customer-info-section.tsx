'use client'

interface Customer {
  id: string
  type: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  companyName?: string | null
  companyNameKana?: string | null
  email: string
  phone: string
  postalCode: string
  prefecture: string
  city: string
  address: string
  building?: string | null
  companyPostalCode?: string | null
  companyPrefecture?: string | null
  companyCity?: string | null
  companyAddress?: string | null
  companyBuilding?: string | null
}

interface CustomerInfoSectionProps {
  customer: Customer
  planName: string
  lineCount: number
  totalAmount: number
}

export function CustomerInfoSection({ customer, planName, lineCount, totalAmount }: CustomerInfoSectionProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">申し込み情報</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">申し込みタイプ</label>
          <p className="mt-1 text-gray-900">
            {customer.type === 'INDIVIDUAL' ? '個人' : '法人'}
          </p>
        </div>

        {customer.type === 'INDIVIDUAL' ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">名前</label>
              <p className="mt-1 text-gray-900">
                {customer.lastName} {customer.firstName}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">カナ</label>
              <p className="mt-1 text-gray-900">
                {customer.lastNameKana} {customer.firstNameKana}
              </p>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">会社名</label>
              <p className="mt-1 text-gray-900">{customer.companyName}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">会社名カナ</label>
              <p className="mt-1 text-gray-900">{customer.companyNameKana}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">担当者名</label>
              <p className="mt-1 text-gray-900">
                {customer.lastName} {customer.firstName}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">担当者名カナ</label>
              <p className="mt-1 text-gray-900">
                {customer.lastNameKana} {customer.firstNameKana}
              </p>
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">電話番号</label>
          <p className="mt-1 text-gray-900">{customer.phone}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">メールアドレス</label>
          <p className="mt-1 text-gray-900">{customer.email}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">郵便番号</label>
          <p className="mt-1 text-gray-900">{customer.postalCode}</p>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">住所</label>
          <p className="mt-1 text-gray-900">
            {customer.prefecture}{customer.city}{customer.address}
            {customer.building && ` ${customer.building}`}
          </p>
        </div>

        {customer.type === 'CORPORATE' && customer.companyPostalCode && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">法人郵便番号</label>
              <p className="mt-1 text-gray-900">{customer.companyPostalCode}</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">法人住所</label>
              <p className="mt-1 text-gray-900">
                {customer.companyPrefecture}{customer.companyCity}{customer.companyAddress}
                {customer.companyBuilding && ` ${customer.companyBuilding}`}
              </p>
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">プラン</label>
          <p className="mt-1 text-gray-900">{planName}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">申込回線数</label>
          <p className="mt-1 text-gray-900">{lineCount}回線</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">合計金額</label>
          <p className="mt-1 text-gray-900">&yen;{totalAmount.toLocaleString()}</p>
        </div>
      </div>
    </div>
  )
}
