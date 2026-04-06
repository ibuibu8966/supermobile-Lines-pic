/**
 * Customer lines entity
 */

export interface CustomerLine {
  id: string;
  lineNumber: number;
  phoneNumber: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  application: {
    id: string;
    applicationNumber: string;
    status: string;
    plan: {
      id: string;
      name: string;
    };
  };
}

export interface CustomerLinesResult {
  lines: CustomerLine[];
}
