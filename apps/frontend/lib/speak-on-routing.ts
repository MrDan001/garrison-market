type Role = "owner" | "staff";

export const resolveSpeakOnRequest = (text: string, role: Role): { reply: string; href?: string; label?: string } => {
  const q = text.toLowerCase();
  if (/\b(add|create|new)\b.*\b(product|item)\b/.test(q)) {
    return role === "owner"
      ? { reply: "I’ll take you to the existing Add Product form. You can review and complete the fields there before saving.", href: "/owner/inventory/add", label: "Open Add Product" }
      : { reply: "Only the owner can add a new product. Please ask the owner to add this product for the store." };
  }
  if (/\b(restock|add stock|receive stock|stock in)\b/.test(q)) {
    return role === "owner"
      ? { reply: "Choose the product first, then use its existing Add Stock form. I won’t guess which product or quantity.", href: "/owner/inventory", label: "Open Inventory" }
      : { reply: "Only the owner can add or restock inventory. Please ask the owner to handle this." };
  }
  if (/\b(expense|spent|spending|log.*cost)\b/.test(q)) {
    return { reply: "Open the existing expense form. Enter the amount and any category or note, then save when you’re satisfied.", href: role === "owner" ? "/owner/expenses" : "/staff/expenses", label: "Open Expenses" };
  }
  if (/\b(wastage|wasted|spoilt|spoiled|damaged)\b/.test(q)) {
    return { reply: role === "owner" ? "Open the wastage page to review and approve or decline staff submissions." : "Open the existing wastage form to submit the item, quantity, unit and reason. The owner must approve it before stock changes.", href: role === "owner" ? "/owner/wastage" : "/staff/wastage", label: "Open Wastage" };
  }
  if (/\b(consignment|sign.?out|settle.*consignment)\b/.test(q)) {
    return { reply: "Open the existing consignment workflow. It will ask for the recipient and item quantities, or the sold and returned quantities when settling.", href: role === "owner" ? "/owner/consignments" : "/staff/consignment", label: "Open Consignments" };
  }
  if (/\b(debt|debtor|owe|payment.*customer|customer.*pay)\b/.test(q)) {
    return { reply: "Open the existing debt records. Select the correct customer and debt, then enter the payment amount and method.", href: role === "owner" ? "/owner/customers" : "/staff/debts", label: "Open Debtors" };
  }
  if (/\b(sale|sell|checkout|sold)\b/.test(q)) {
    return { reply: "Open the inventory and use its existing sales/checkout controls. Select the exact products, quantities and payment details there.", href: role === "owner" ? "/owner/inventory" : "/staff/inventory", label: "Open Inventory & Sales" };
  }
  if (/\b(inventory|stock|products|items)\b/.test(q)) {
    return { reply: "Here is your inventory. Choose the item and use the existing controls available to your account.", href: role === "owner" ? "/owner/inventory" : "/staff/inventory", label: "Open Inventory" };
  }
  return { reply: "I can help you reach the right Garrison Market workflow. Try saying: record a sale, log an expense, submit wastage, settle a consignment, record a debt payment, or open inventory. I’ll keep the existing forms and their checks in place." };
};
