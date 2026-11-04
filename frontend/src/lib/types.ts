export type Facing = "NORTH" | "NORTH_EAST" | "EAST" | "SOUTH_EAST" | "SOUTH" | "SOUTH_WEST" | "WEST" | "NORTH_WEST";
export type Relation = "SPOUSE" | "SON" | "DAUGHTER" | "FATHER" | "MOTHER" | "SIBLING" | "RELATIVE" | "OTHER";
export type DocType = "PHOTO" | "LEASE_FORM" | "POLICE_VERIFICATION" | "NID_COPY" | "OTHER";
export type LeaseStatus = "ACTIVE" | "NOTICE" | "ENDED";
export type InvoiceStatus = "UNPAID" | "PARTIAL" | "PAID" | "VOID";
export type DisplayStatus = InvoiceStatus | "OVERDUE";
export type PaymentMethod = "CASH" | "BANK" | "BKASH" | "NAGAD" | "ROCKET" | "CHEQUE" | "OTHER";
export type LineType = "RENT" | "SERVICE_CHARGE" | "ELECTRICITY" | "WATER" | "GAS" | "OTHER" | "DISCOUNT" | "ROUNDING";

export interface Ref {
  id: string;
  number?: string;
  fullName?: string;
  phone?: string;
}

export interface Apartment {
  id: string;
  number: string;
  floor: number | null;
  rooms: number;
  toilets: number;
  balconies: number;
  facing: Facing;
  sizeSqft: number | null;
  meterNo: string | null;
  defaultRent: number | null;
  defaultServiceCharge: number | null;
  underMaintenance: boolean;
  notes: string | null;
  status: "VACANT" | "OCCUPIED" | "MAINTENANCE";
  currentLease: {
    id: string;
    status: LeaseStatus;
    rent: number;
    serviceCharge: number;
    startDate: string;
    moveOutDate: string | null;
    tenant: { id: string; fullName: string; phone: string };
  } | null;
}

export interface MeterReading {
  id: string;
  period: string;
  readingDate: string;
  previous: number;
  current: number;
  units: number;
  amount: number;
  isReset: boolean;
  isInitial: boolean;
}

export interface ApartmentDetail extends Apartment {
  leaseHistory: {
    id: string;
    status: LeaseStatus;
    startDate: string;
    endedAt: string | null;
    rent: number;
    tenant: { id: string; fullName: string; phone: string };
  }[];
  meterReadings: MeterReading[];
  income: { period: string; collected: number }[];
}

export interface TenantListItem {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  nidMasked: string;
  familyCount: number;
  archivedAt: string | null;
  photoId: string | null;
  hasPoliceVerification: boolean;
  hasLeaseForm: boolean;
  apartment: { id: string; number: string } | null;
  leaseStatus: LeaseStatus | null;
  due: number;
}

export interface FamilyMember {
  id: string;
  name: string;
  relation: Relation;
  phone: string | null;
}

export interface Doc {
  id: string;
  type: DocType;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  supersededAt: string | null;
}

export interface Lease {
  id: string;
  tenantId: string;
  apartmentId: string;
  startDate: string;
  endDate: string | null;
  rent: number;
  serviceCharge: number;
  securityDeposit: number;
  depositReceivedAt: string | null;
  noticeMonths: number;
  status: LeaseStatus;
  noticeGivenAt: string | null;
  noticeBy: "TENANT" | "LANDLORD" | null;
  moveOutDate: string | null;
  endedAt: string | null;
  notes: string | null;
  apartment?: { id: string; number: string; floor: number | null };
  tenant?: { id: string; fullName: string; phone: string };
}

export interface Balance {
  due: number;
  overdue: number;
  credit: number;
}

export interface TenantDetail {
  id: string;
  fullName: string;
  nid: string;
  phone: string;
  email: string | null;
  permanentAddress: string;
  occupation: string | null;
  dateOfBirth: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  notes: string | null;
  archivedAt: string | null;
  familyMembers: FamilyMember[];
  documents: Doc[];
  leases: Lease[];
  activeLease: Lease | null;
  photoId: string | null;
  balance: Balance;
}

export interface LedgerEntry {
  kind: "invoice" | "payment";
  id: string;
  ref: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  status: InvoiceStatus | null;
}

export interface InvoiceLine {
  id: string;
  type: LineType;
  description: string;
  amount: number;
  meterReadingId: string | null;
}

export interface Invoice {
  id: string;
  number: string;
  period: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  displayStatus: DisplayStatus;
  voidReason: string | null;
  total: number;
  paidAmount: number;
  balance: number;
  tenant: { id: string; fullName: string; phone: string; email: string | null };
  apartment: { id: string; number: string };
  leaseId: string;
  lines: InvoiceLine[];
  payments: { id: string; number: string; date: string; method: PaymentMethod; reference: string | null; amount: number }[];
  /** When the latest bill SMS was sent (null if never). */
  notifiedAt: string | null;
  notifyCount: number;
}

export interface SmsStatus {
  configured: boolean;
  devOverride: boolean;
  devNumber: string | null;
  balance: number | null;
}

export interface NotifyResult {
  sent: number;
  failed: number;
  skipped: number;
  devOverride: boolean;
  devNumber: string | null;
  gatewayError: string | null;
  results: { invoiceId: string; tenantName: string; status: "SENT" | "FAILED" | "SKIPPED"; error?: string }[];
}

export interface Payment {
  id: string;
  number: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  note: string | null;
  tenant: { id: string; fullName: string; phone: string };
  allocated: number;
  unallocated: number;
  allocations: { invoice: { id: string; number: string; period: string }; amount: number }[];
}

export interface DuesRow {
  tenantId: string;
  fullName: string;
  phone: string;
  apartment: string | null;
  oldestPeriod: string;
  oldestDue: string;
  invoices: number;
  rent: number;
  service: number;
  electricity: number;
  other: number;
  total: number;
  overdue: number;
  current: number;
  d30: number;
  d60: number;
  d90: number;
  d90plus: number;
}

export interface TypeRow {
  type: LineType;
  billed: number;
  paid: number;
  due: number;
}

export interface TrendPoint {
  period: string;
  expected: number;
  collected: number;
  settled: number;
}

export interface Dashboard {
  period: string;
  dueDate: string;
  daysToDue: number;
  kpis: {
    expected: number;
    settled: number;
    collectedThisMonth: number;
    paymentsThisMonth: number;
    outstanding: number;
    overdueAmount: number;
    overdueTenants: number;
    invoicesThisMonth: number;
    apartments: number;
    occupied: number;
    vacant: number;
    maintenance: number;
    occupancyRate: number;
    missingPoliceVerification: number;
  };
  trend: TrendPoint[];
  byType: TypeRow[];
  dues: DuesRow[];
  upcoming: {
    leaseId: string;
    status: LeaseStatus;
    tenant: { id: string; fullName: string };
    apartment: { id: string; number: string };
    date: string;
  }[];
}

export interface Settings {
  propertyName: string;
  propertyAddress: string;
  dueDay: number;
  invoicePrefix: string;
  receiptPrefix: string;
  defaultNoticeMonths: number;
  currency: string;
  contactPhone: string;
  contactEmail: string;
  invoiceNote: string;
  paymentMethods: PaymentMethod[];
  smsTemplate: string;
  storage: "s3" | "local";
  electricity: {
    slabs: { upTo: number | null; rate: number }[];
    demandCharge: number;
    vatPercent: number;
    flatRate: { enabled: boolean; maxUnits: number; rate: number };
  };
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "TENANT";
}
