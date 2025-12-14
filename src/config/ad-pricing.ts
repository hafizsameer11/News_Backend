/**
 * Ad Pricing Configuration
 * Defines pricing rates for different ad types
 */

export interface AdPricingRates {
  [key: string]: number; // Daily rate in EUR
}

/**
 * Default pricing rates per ad type (EUR per day)
 */
export const AD_PRICING_RATES: AdPricingRates = {
  BANNER_TOP: 50,
  BANNER_SIDE: 25,
  INLINE: 15,
  FOOTER: 20,
  SLIDER: 30,
  TICKER: 10,
  POPUP: 40,
  STICKY: 35,
};

/**
 * Minimum ad duration in days
 */
export const MIN_AD_DURATION_DAYS = 1;

/**
 * Maximum ad duration in days
 */
export const MAX_AD_DURATION_DAYS = 365;

/**
 * Calculate ad price based on type and duration
 * @param adType - Type of ad
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Calculated price in EUR
 */
export function calculateAdPrice(adType: string, startDate: Date, endDate: Date): number {
  const dailyRate = AD_PRICING_RATES[adType] || AD_PRICING_RATES.INLINE;
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));

  return days * dailyRate;
}

/**
 * Get daily rate for an ad type
 * @param adType - Type of ad
 * @returns Daily rate in EUR
 */
export function getDailyRate(adType: string): number {
  return AD_PRICING_RATES[adType] || AD_PRICING_RATES.INLINE;
}
