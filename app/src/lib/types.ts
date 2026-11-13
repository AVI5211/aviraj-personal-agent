export type Module = "shop" | "personal";
export type TransactionType = "income" | "expense";
export type PaymentMethod = "bharatpe" | "cash" | "bank_transfer" | "other";
export type Period = "today" | "yesterday" | "week" | "month" | "year" | "fy" | "custom" | "all";
export type AccountType = "bank" | "cash" | "investment" | "pf" | "other_asset" | "loan";
export type SalaryStatus = "expected" | "received";

export interface TransactionApi {
  id: string;
  module: Module;
  type: TransactionType;
  amountPaise: number;
  category: string;
  paymentMethod: PaymentMethod;
  source: string;
  transactionDate: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionListResponse {
  transactions: TransactionApi[];
  total: number;
  page: number;
  pageSize: number;
}

export type ReceivableStatus = "pending" | "returned";
export interface ReceivableApi {
  id: string;
  personName: string;
  amountPaise: number;
  givenDate: string;
  expectedReturnDate: string | null;
  status: ReceivableStatus;
  returnedDate: string | null;
  createdAt: string;
}

export interface SummaryResponse {
  range: { from: string | null; to: string | null };
  totalIncome: number;
  totalExpense: number;
  netCashFlow: number;
  openingBalance: number;
  closingBalance: number;
  incomeByMethod: Record<string, number>;
  expenseByMethod: Record<string, number>;
  expenseByCategory: Record<string, number>;
  totalReceivables?: number;
}

export interface TrendPoint {
  month: string;
  income: number;
  expense: number;
  moneyLent?: number;
}

export interface AccountApi {
  id: string;
  name: string;
  type: AccountType;
  balancePaise: number;
  updatedAt: string;
}

export interface SalaryRecordApi {
  id: string;
  month: string;
  grossPaise: number;
  deductionsPaise: number;
  pfEmployeePaise: number;
  pfEmployerPaise: number;
  tdsPaise: number;
  otherCtcComponentsPaise: number;
  recurringPf: boolean;
  recurringTds: boolean;
  totalDeductionsPaise: number;
  ctcPaise: number;
  netPaise: number;
  status: SalaryStatus;
  receivedDate: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryOverviewResponse {
  totalGrossPaise: number;
  totalCtcPaise: number;
  totalInHandPaise: number;
  totalPfEmployeePaise: number;
  totalPfEmployerPaise: number;
  totalTdsPaise: number;
  totalOtherDeductionsPaise: number;
  totalOtherCtcComponentsPaise: number;
  totalDeductionsPaise: number;
  totalTaxPaidPaise: number;
  recordCount: number;
}

export type InvestmentHoldingType = "equity" | "mutual_fund" | "fixed_deposit" | "savings" | "other";

export interface InvestmentApi {
  id: string;
  name: string;
  holdingType: InvestmentHoldingType;
  currentValuePaise: number;
  investedValuePaise: number | null;
  valuationDate: string;
  maturityDate: string | null;
  interestRateAnnualBps: number | null;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvestmentValuationApi {
  id: string;
  investmentId: string;
  valuationDate: string;
  valuePaise: number;
  createdAt: string;
}

export interface InvestmentSummaryResponse {
  totalCurrentValuePaise: number;
  totalInvestedValuePaise: number;
  gainLossPaise: number | null;
  byType: Record<InvestmentHoldingType, number>;
}

export type LoanStatus = "active" | "closed";
export type LoanPaymentStatus = "scheduled" | "paid";

export interface LoanSummary {
  paidCount: number;
  pendingCount: number;
  totalPaidPaise: number;
  scheduledRemainingPaise: number;
}

export interface LoanApi extends LoanSummary {
  id: string;
  lender: string;
  originalPrincipalPaise: number;
  outstandingPrincipalPaise: number;
  monthlyEmiPaise: number;
  dueDayOfMonth: number;
  startDate: string;
  interestRateAnnualBps: number | null;
  status: LoanStatus;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoanPaymentApi {
  id: string;
  loanId: string;
  dueDate: string;
  amountPaise: number;
  principalPaise: number | null;
  interestPaise: number | null;
  feesPaise: number | null;
  status: LoanPaymentStatus;
  paidDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoanDetailResponse {
  loan: LoanApi;
  payments: LoanPaymentApi[];
}

export interface RecurringExpenseApi {
  id: string;
  name: string;
  monthlyAmountPaise: number;
  dueDayOfMonth: number;
  startDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ClientCurrency = "USD" | "INR";
export type InvoiceStatus = "issued" | "paid";
export type LeadExpenseCategory = "contract_commission" | "upwork_connects" | "subscription" | "other";

export interface ClientApi {
  id: string;
  name: string;
  currency: ClientCurrency;
  hourlyRateMinor: number;
  contractNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface EpicApi {
  id: string;
  clientId: string;
  name: string;
  createdAt: string;
}

export interface WorkLogApi {
  id: string;
  clientId: string;
  epicId: string | null;
  date: string;
  billableHours: number;
  nonBillableHours: number;
  description: string;
  notes: string;
  invoiced: boolean;
  invoiceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PaymentPlatform = "upwork" | "deel" | "other";

export interface InvoiceApi {
  id: string;
  clientId: string;
  issueDate: string;
  workLogIds: string[];
  hours: number;
  currency: ClientCurrency;
  paymentPlatform: PaymentPlatform;
  grossAmountMinor: number;
  feesMinor: number;
  exchangeRateToInr: number;
  netInrPaise: number;
  taxPaidPaise: number;
  inHandPaise: number;
  status: InvoiceStatus;
  paidDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadExpenseApi {
  id: string;
  date: string;
  amountPaise: number;
  category: LeadExpenseCategory;
  description: string;
  createdAt: string;
}

export interface FreelanceSummaryResponse {
  range: { from: string | null; to: string | null };
  /** Paid invoice amount before platform/service fees and tax. */
  grossEarnedPaise: number;
  receivedPaise: number;
  inHandReceivedPaise: number;
  taxPaidPaise: number;
  feesPaidPaise: number;
  pendingPaise: number;
  unbilledHours: number;
  unbilledAmountEstimatePaise: number;
  leadExpensesPaise: number;
  contractCommissionsPaise: number;
  byPlatform: Record<PaymentPlatform, number>;
  usdInrRate: number;
}
export interface AdminOverviewResponse {
  range: { from: string | null; to: string | null };
  netWorth: number;
  /** Calendar-year gross earnings, intentionally not affected by the overview filter. */
  totalMoneyEarned: number;
  cashAndBank: number;
  investmentsTotal: number;
  pfTotal: number;
  otherAssetsTotal: number;
  liabilitiesTotal: number;
  monthlyIncome: number;
  monthlyExpense: number;
  incomeAverage: { label: string; value: number } | null;
  incomeSources: {
    salary: number;
    salaryInHand: number;
    shop: number;
    freelance: number;
    otherPersonal: number;
    securityDepositsGiven: number;
  };
  shopNetCashFlow: number;
  receivables: number;
  personalReceivables: number;
}

export type VehicleKind = "ev" | "petrol";
export type ChargerType = "home" | "public_ac" | "dc_fast";
/** How home charging sessions are entered for an EV: exact kWh, or battery % before/after. */
export type HomeChargeInput = "kwh" | "soc";

export interface VehicleApi {
  id: string;
  name: string;
  kind: VehicleKind;
  registrationNumber: string;
  trackingStartDate: string;
  startOdometerKm: number | null;
  tankCapacityLitres: number | null;
  batteryCapacityKwh: number | null;
  homeTariffPaisePerKwh: number | null;
  homeChargeInput: HomeChargeInput;
}

export interface VehicleLogApi {
  id: string;
  vehicleId: string;
  date: string;
  odometerKm: number;
  /** Litres for petrol, kWh for EV. */
  quantity: number;
  amountPaise: number;
  fullTank: boolean;
  chargerType: ChargerType | null;
  socStartPct: number | null;
  socEndPct: number | null;
  quantityEstimated: boolean;
  location: string;
  note: string;
  /** Km since the previous entry (or the tracking-start odometer). */
  distanceKm: number | null;
  /** km/L for petrol (full tank to full tank), km/kWh for EV. */
  efficiency: number | null;
}

export interface VehicleChargerSplit {
  quantity: number;
  amountPaise: number;
}

export interface VehicleSummary {
  vehicleId: string;
  entries: number;
  spendPaise: number;
  quantity: number;
  kmDriven: number;
  efficiency: number | null;
  avgUnitPricePaise: number | null;
  costPerKmPaise: number | null;
  latestOdometerKm: number | null;
  monthlySpendPaise: number | null;
  monthlyKm: number | null;
  byChargerType: Record<ChargerType, VehicleChargerSplit> | null;
}

export interface VehicleTrendPoint {
  month: string;
  spendPaise: Record<string, number>;
  km: Record<string, number>;
}

export interface VehiclesDashboardResponse {
  range: { from: string | null; to: string | null };
  vehicles: VehicleApi[];
  summaries: VehicleSummary[];
  logs: VehicleLogApi[];
  trend: VehicleTrendPoint[];
}
