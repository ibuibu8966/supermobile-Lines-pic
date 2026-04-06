/**
 * Additional application entity (追加申込)
 */

export interface AdditionalApplicationInput {
  planId: string;
  lineCount: number;
  couponCode?: string;
}

export interface AdditionalApplicationResult {
  success: boolean;
  applicationNumber: string;
}
