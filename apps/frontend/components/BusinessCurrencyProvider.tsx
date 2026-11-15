"use client";

import { createContext, useContext } from "react";
import { formatBusinessCurrency } from "@/lib/business-localization";

const BusinessCurrencyContext = createContext("NGN");

export function BusinessCurrencyProvider({
  currencyCode,
  children,
}: {
  currencyCode: string;
  children: React.ReactNode;
}) {
  return (
    <BusinessCurrencyContext.Provider value={currencyCode}>
      {children}
    </BusinessCurrencyContext.Provider>
  );
}

export function useBusinessCurrency() {
  const currencyCode = useContext(BusinessCurrencyContext);
  return {
    currencyCode,
    formatCurrency: (amount: number | string | null | undefined) =>
      formatBusinessCurrency(amount, currencyCode),
  };
}
