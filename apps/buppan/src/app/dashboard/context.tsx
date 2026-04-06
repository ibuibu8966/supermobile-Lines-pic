"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";

interface KycImage {
  id: string;
  type: string;
  status: string;
  expiryDate: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

interface Customer {
  id: string;
  type: string;
  email: string;
  phone: string;
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  birthDate: string | null;
  postalCode: string;
  prefecture: string;
  city: string;
  address: string;
  building: string | null;
  companyName: string | null;
  companyNameKana: string | null;
  establishedDate: string | null;
  companyPostalCode: string | null;
  companyPrefecture: string | null;
  companyCity: string | null;
  companyAddress: string | null;
  companyBuilding: string | null;
  representativeLastName: string | null;
  representativeFirstName: string | null;
  representativeLastNameKana: string | null;
  representativeFirstNameKana: string | null;
  kycImages: KycImage[];
}

interface ApplicationLine {
  id: string;
  lineNumber: number;
  status: string;
  simId: string | null;
  msisdn: string | null;
}

interface Application {
  id: string;
  applicationNumber: string;
  status: string;
  lineCount: number;
  totalAmount: number;
  createdAt: string;
  plan: {
    id: string;
    name: string;
    code: string;
  };
  lines: ApplicationLine[];
}

interface LineStats {
  active: number;
  pending: number;
  cancelled: number;
}

export interface DashboardData {
  customer: Customer | null;
  applications: Application[];
  lineStats: LineStats;
}

interface DashboardContextType {
  data: DashboardData | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType>({
  data: null,
  loading: true,
  refresh: async () => {},
});

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      // sessionStorageのキャッシュを先にチェック
      const cached = sessionStorage.getItem("dashboardCache");
      if (cached && !data) {
        try {
          setData(JSON.parse(cached));
          setLoading(false);
          sessionStorage.removeItem("dashboardCache");
        } catch {
          // パース失敗は無視
        }
      }

      const res = await fetch("/api/customer/dashboard");
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (res.ok) {
        const freshData = await res.json();
        setData(freshData);
      }
    } catch (error) {
      console.error("Dashboard data fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <DashboardContext.Provider value={{ data, loading, refresh: fetchData }}>
      {children}
    </DashboardContext.Provider>
  );
}

export const useDashboard = () => useContext(DashboardContext);
