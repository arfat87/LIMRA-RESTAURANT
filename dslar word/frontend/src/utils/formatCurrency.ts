/**
 * Format a paise amount to Indian Rupee display string
 * @param paise - amount in paise (e.g. 3299900 = ₹32,999)
 */
export const formatCurrency = (paise: number): string => {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rupees);
};

/**
 * Format paise to compact string e.g. ₹32,999
 */
export const formatPrice = (paise: number): string => formatCurrency(paise);

/**
 * Format to rupees number without symbol e.g. "32,999"
 */
export const formatNumber = (paise: number): string => {
  return new Intl.NumberFormat('en-IN').format(paise / 100);
};

/**
 * Calculate discount percentage
 */
export const calcDiscount = (mrp: number, price: number): number => {
  if (!mrp || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
};
