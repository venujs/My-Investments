import { daysBetween, yearsBetween, today } from '../utils/date.js';

function compoundingPeriodsPerYear(compounding: string): number {
  switch (compounding) {
    case 'monthly': return 12;
    case 'quarterly': return 4;
    case 'half_yearly': return 2;
    case 'yearly': return 1;
    default: return 4;
  }
}

// FD: A = P * (1 + r/n)^(n*t)
export function calculateFDValue(principalPaise: number, interestRate: number, compounding: string, startDate: string, asOfDate?: string): number {
  const n = compoundingPeriodsPerYear(compounding);
  const r = interestRate / 100;
  const t = yearsBetween(startDate, asOfDate || today());
  if (t <= 0) return principalPaise;
  const amount = principalPaise * Math.pow(1 + r / n, n * t);
  return Math.round(amount);
}

// FD maturity value
export function calculateFDMaturityValue(principalPaise: number, interestRate: number, compounding: string, startDate: string, maturityDate: string): number {
  return calculateFDValue(principalPaise, interestRate, compounding, startDate, maturityDate);
}

// RD: Sum of each installment compounded from its payment date to asOfDate.
// Installments are counted by calendar months (same day-of-month as startDate),
// which avoids the yearsBetween*12 floating-point undercount.
export function calculateRDValue(monthlyInstallmentPaise: number, interestRate: number, compounding: string, startDate: string, asOfDate?: string): number {
  const n = compoundingPeriodsPerYear(compounding);
  const r = interestRate / 100;
  const end = new Date(asOfDate || today());
  const start = new Date(startDate);
  if (end < start) return 0;

  let totalValue = 0;
  const d = new Date(start);
  while (d <= end) {
    // Exact compounding time in years from this installment's date to the evaluation date
    const yearsCompounded = (end.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    totalValue += monthlyInstallmentPaise * Math.pow(1 + r / n, n * yearsCompounded);
    d.setMonth(d.getMonth() + 1);
  }
  return Math.round(totalValue);
}

// Loan outstanding balance
export function calculateLoanOutstanding(principalPaise: number, interestRate: number, emiPaise: number, startDate: string, asOfDate?: string): number {
  const effectiveDate = asOfDate || today();
  const monthsPassed = Math.max(0, Math.floor(yearsBetween(startDate, effectiveDate) * 12));
  const monthlyRate = (interestRate / 100) / 12;

  let balance = principalPaise;
  for (let i = 0; i < monthsPassed; i++) {
    if (balance <= 0) break;
    const interest = Math.round(balance * monthlyRate);
    const principal = emiPaise - interest;
    balance -= principal;
  }
  return Math.max(0, Math.round(balance));
}

// Fixed asset appreciation
export function calculateAssetValue(purchasePricePaise: number, inflationRate: number, purchaseDate: string, asOfDate?: string): number {
  const years = yearsBetween(purchaseDate, asOfDate || today());
  if (years <= 0) return purchasePricePaise;
  return Math.round(purchasePricePaise * Math.pow(1 + inflationRate / 100, years));
}

// Gold value
export function calculateGoldValue(weightGrams: number, purity: string, currentPricePerGramPaise: number): number {
  const purityFactor = purity === '24K' ? 1.0 : purity === '22K' ? 22 / 24 : 18 / 24;
  return Math.round(weightGrams * currentPricePerGramPaise * purityFactor);
}

// XIRR calculation (Newton-Raphson)
export function calculateXIRR(cashflows: { date: string; amount: number }[]): number | null {
  if (cashflows.length < 2) return null;

  const d0 = new Date(cashflows[0].date);

  function f(rate: number): number {
    let sum = 0;
    for (const cf of cashflows) {
      const days = (new Date(cf.date).getTime() - d0.getTime()) / (1000 * 60 * 60 * 24);
      const t = days / 365.25;
      sum += cf.amount / Math.pow(1 + rate, t);
    }
    return sum;
  }

  function df(rate: number): number {
    let sum = 0;
    for (const cf of cashflows) {
      const days = (new Date(cf.date).getTime() - d0.getTime()) / (1000 * 60 * 60 * 24);
      const t = days / 365.25;
      sum -= t * cf.amount / Math.pow(1 + rate, t + 1);
    }
    return sum;
  }

  let rate = 0.1; // Initial guess 10%
  for (let i = 0; i < 100; i++) {
    const fVal = f(rate);
    const dfVal = df(rate);
    if (Math.abs(dfVal) < 1e-10) break;
    const newRate = rate - fVal / dfVal;
    if (Math.abs(newRate - rate) < 1e-7) return newRate;
    rate = newRate;
    if (rate < -0.99) rate = -0.99; // Prevent divergence
  }
  return rate;
}

// Pension (PPF/EPF) compound interest
export function calculatePensionValue(totalDepositsPaise: number, interestRate: number, startDate: string, asOfDate?: string): number {
  // Simplified: treat as annual compounding on total deposits
  const years = yearsBetween(startDate, asOfDate || today());
  if (years <= 0) return totalDepositsPaise;
  return Math.round(totalDepositsPaise * Math.pow(1 + interestRate / 100, years));
}
