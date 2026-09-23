import { ObjectId } from "mongodb";
import type { InvestmentApi, InvestmentHoldingType, InvestmentSummaryResponse, InvestmentValuationApi } from "@/lib/types";
import { investmentHoldingTypes } from "@/lib/validation";

export interface InvestmentDoc {
  _id: ObjectId;
  name: string;
  holdingType: InvestmentHoldingType;
  currentValuePaise: number;
  investedValuePaise: number | null;
  valuationDate: string;
  maturityDate: string | null;
  interestRateAnnualBps: number | null;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvestmentValuationDoc {
  _id: ObjectId;
  investmentId: ObjectId;
  valuationDate: string;
  valuePaise: number;
  createdAt: Date;
}

export function serializeInvestment(doc: InvestmentDoc): InvestmentApi {
  return {
    id: doc._id.toString(),
    name: doc.name,
    holdingType: doc.holdingType,
    currentValuePaise: doc.currentValuePaise,
    investedValuePaise: doc.investedValuePaise,
    valuationDate: doc.valuationDate,
    maturityDate: doc.maturityDate,
    interestRateAnnualBps: doc.interestRateAnnualBps,
    note: doc.note,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function serializeInvestmentValuation(doc: InvestmentValuationDoc): InvestmentValuationApi {
  return {
    id: doc._id.toString(),
    investmentId: doc.investmentId.toString(),
    valuationDate: doc.valuationDate,
    valuePaise: doc.valuePaise,
    createdAt: doc.createdAt.toISOString(),
  };
}

export interface InvestmentLike {
  holdingType: InvestmentHoldingType;
  currentValuePaise: number;
  investedValuePaise: number | null;
}

export function computeInvestmentSummary(investments: InvestmentLike[]): InvestmentSummaryResponse {
  const byType = investmentHoldingTypes.reduce(
    (acc, type) => {
      acc[type] = 0;
      return acc;
    },
    {} as Record<InvestmentHoldingType, number>
  );

  let totalCurrentValuePaise = 0;
  let totalInvestedValuePaise = 0;
  let hasKnownInvestedValue = false;

  for (const investment of investments) {
    totalCurrentValuePaise += investment.currentValuePaise;
    byType[investment.holdingType] += investment.currentValuePaise;

    if (investment.investedValuePaise !== null) {
      totalInvestedValuePaise += investment.investedValuePaise;
      hasKnownInvestedValue = true;
    }
  }

  return {
    totalCurrentValuePaise,
    totalInvestedValuePaise,
    gainLossPaise: hasKnownInvestedValue ? totalCurrentValuePaise - totalInvestedValuePaise : null,
    byType,
  };
}
