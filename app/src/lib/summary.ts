export interface BalanceInputs {
  baseOpeningBalance: number;
  priorIncome: number;
  priorExpense: number;
  totalIncome: number;
  totalExpense: number;
}

export interface BalanceResult {
  openingBalance: number;
  netCashFlow: number;
  closingBalance: number;
}

export function computeBalances(inputs: BalanceInputs): BalanceResult {
  const openingBalance = inputs.baseOpeningBalance + inputs.priorIncome - inputs.priorExpense;
  const netCashFlow = inputs.totalIncome - inputs.totalExpense;
  const closingBalance = openingBalance + netCashFlow;
  return { openingBalance, netCashFlow, closingBalance };
}
