/**
 * In-App Purchase service (Apple IAP / Google Play Billing).
 * Uses react-native-iap for native purchases.
 *
 * Product IDs must match exactly what you create in:
 * - iOS: App Store Connect → Your App → Subscriptions
 * - Android: Google Play Console → Your App → Monetize → Subscriptions
 *
 * Set IAP_PRODUCT_ID_MONTHLY and IAP_PRODUCT_ID_YEARLY in your .env. Both are required; the app will throw at runtime if they are missing.
 */

import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  requestPurchase,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  fetchProducts,
  type Purchase,
  type PurchaseError,
  type ProductSubscription,
} from 'react-native-iap';

import appwriteConfig from './appwrite.config';

export type SubscriptionProduct = {
  productId: string;
  displayPrice: string;
  price?: number;
  currency?: string;
  title?: string;
  description?: string;
};

export type SubscriptionProducts = {
  monthly: SubscriptionProduct | null;
  yearly: SubscriptionProduct | null;
};

let warnedMissingProductIds = false;

function getSubscriptionProductIds(): { monthly: string; yearly: string } {
  const monthly = appwriteConfig.iapProductIdMonthly?.trim() ?? '';
  const yearly = appwriteConfig.iapProductIdYearly?.trim() ?? '';

  if ((!monthly || !yearly) && !warnedMissingProductIds) {
    warnedMissingProductIds = true;
    console.warn(
      '[IAP] IAP_PRODUCT_ID_MONTHLY / IAP_PRODUCT_ID_YEARLY are not set. ' +
        'Subscriptions will be disabled until both are configured in your .env file.'
    );
  }

  return { monthly, yearly };
}

function hasConfiguredProductIds(): boolean {
  const { monthly, yearly } = getSubscriptionProductIds();
  return Boolean(monthly && yearly);
}

/** Product IDs used for subscription (monthly, yearly). Use these when starting a purchase. */
export function getIAPProductIds(): { monthly: string; yearly: string } {
  return getSubscriptionProductIds();
}

function getSubscriptionSkus(): string[] {
  const { monthly, yearly } = getSubscriptionProductIds();
  return [monthly, yearly].filter((sku): sku is string => Boolean(sku));
}

let purchaseResolve: ((value: boolean) => void) | null = null;
let purchaseReject: ((reason: Error) => void) | null = null;

let updateSubscription: ((value: boolean) => void) | null = null;

export function setSubscriptionUpdater(updater: (value: boolean) => void) {
  updateSubscription = updater;
}

async function hasActiveSubscription(): Promise<boolean> {
  try {
    const purchases = await getAvailablePurchases();
    if (!purchases || purchases.length === 0) return false;
    const skus = getSubscriptionSkus();
    return purchases.some(
      (p) => p.productId && skus.includes(p.productId)
    );
  } catch {
    return false;
  }
}

function handlePurchaseUpdate(purchase: Purchase) {
  const skus = getSubscriptionSkus();
  const valid =
    purchase.productId && skus.includes(purchase.productId);
  if (valid) {
    updateSubscription?.(true);
    purchaseResolve?.(true);
  }
  finishTransaction({ purchase, isConsumable: false }).catch(() => {});
  purchaseResolve = null;
  purchaseReject = null;
}

function handlePurchaseError(error: PurchaseError) {
  purchaseReject?.(new Error(error.message || 'Purchase failed'));
  purchaseResolve = null;
  purchaseReject = null;
}

function toSubscriptionProduct(p: ProductSubscription): SubscriptionProduct {
  const anyP = p as any;
  const numericPrice =
    typeof anyP.price === 'number'
      ? anyP.price
      : typeof anyP.priceAmount === 'number'
        ? anyP.priceAmount
        : undefined;
  return {
    productId: anyP.id ?? anyP.productId ?? '',
    displayPrice:
      anyP.displayPrice ?? anyP.localizedPrice ?? anyP.formattedPrice ?? '',
    price: numericPrice,
    currency: anyP.currency ?? anyP.priceCurrencyCode ?? undefined,
    title: anyP.displayNameIOS ?? anyP.nameAndroid ?? anyP.title ?? undefined,
    description: anyP.description ?? undefined,
  };
}

export const iapService = {
  setSubscriptionUpdater,

  async fetchSubscriptionProducts(): Promise<SubscriptionProducts> {
    if (Platform.OS === 'web') {
      return { monthly: null, yearly: null };
    }
    if (!hasConfiguredProductIds()) {
      return { monthly: null, yearly: null };
    }
    const { monthly, yearly } = getSubscriptionProductIds();
    try {
      const result = await fetchProducts({
        skus: [monthly, yearly],
        type: 'subs',
      });
      const list = (Array.isArray(result) ? result : []) as ProductSubscription[];
      const findById = (id: string) =>
        list.find((p: any) => (p?.id ?? p?.productId) === id) ?? null;
      const m = findById(monthly);
      const y = findById(yearly);
      return {
        monthly: m ? toSubscriptionProduct(m) : null,
        yearly: y ? toSubscriptionProduct(y) : null,
      };
    } catch (err) {
      console.warn('IAP fetchProducts error:', err);
      return { monthly: null, yearly: null };
    }
  },

  async init(): Promise<void> {
    try {
      await initConnection();
      purchaseUpdatedListener(handlePurchaseUpdate);
      purchaseErrorListener(handlePurchaseError);
    } catch (err) {
      console.warn('IAP initConnection error:', err);
    }
  },

  async endConnection(): Promise<void> {
    try {
      await endConnection();
    } catch (err) {
      console.warn('IAP endConnection error:', err);
    }
  },

  async checkSubscription(): Promise<boolean> {
    try {
      return await hasActiveSubscription();
    } catch {
      return false;
    }
  },

  async purchaseSubscription(productId: string): Promise<boolean> {
    return new Promise<boolean>(async (resolve, reject) => {
      purchaseResolve = resolve;
      purchaseReject = reject;
      try {
        if (Platform.OS === 'web') {
          purchaseReject = null;
          purchaseResolve = null;
          reject(
            new Error(
              'In-app purchases are not available in the web preview. Please use the iOS or Android app.'
            )
          );
          return;
        }
        if (!productId || !hasConfiguredProductIds()) {
          purchaseReject = null;
          purchaseResolve = null;
          reject(
            new Error(
              'Subscription products are not configured. Please contact support.'
            )
          );
          return;
        }
        await requestPurchase({
          request: {
            apple: { sku: productId },
            google: { skus: [productId] },
          },
          type: 'subs',
        });
        // Result will come via purchaseUpdatedListener or purchaseErrorListener
      } catch (err) {
        purchaseReject = null;
        purchaseResolve = null;
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  },

  async restorePurchases(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        return false;
      }
      const active = await hasActiveSubscription();
      if (active) {
        updateSubscription?.(true);
      }
      return active;
    } catch {
      return false;
    }
  },
};
