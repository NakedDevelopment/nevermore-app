/**
 * RevenueCat subscription service.
 *
 * RevenueCat is the source of truth for purchase state. Appwrite user profiles
 * are synced from the resulting entitlement status by subscriptionStore.
 */

import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  type CustomerInfoUpdateListener,
  type PurchasesOffering,
  type PurchasesPackage,
  type PurchasesStoreProduct,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import appwriteConfig from './appwrite.config';

export type SubscriptionProduct = {
  productId: string;
  displayPrice: string;
  price?: number;
  currency?: string;
  title?: string;
  description?: string;
};

export type SubscriptionPlan = 'monthly' | 'yearly';
export type RestorePurchaseStatus = 'active' | 'previous-expired' | 'none';

export type SubscriptionProducts = {
  monthly: SubscriptionProduct | null;
  yearly: SubscriptionProduct | null;
};

export const REVENUECAT_ENTITLEMENT_ID = 'Lou Knows LLC Pro';

const ENTITLEMENT_IDS = [
  REVENUECAT_ENTITLEMENT_ID,
  'lou_knows_llc_pro',
  'lou-knows-llc-pro',
  'pro',
];

const REVENUECAT_PRODUCT_IDS: Record<SubscriptionPlan, string> = {
  monthly: 'monthly',
  yearly: 'yearly',
};

let configured = false;
let customerInfoListener: CustomerInfoUpdateListener | null = null;
let updateSubscription: ((value: boolean) => void) | null = null;

export function setSubscriptionUpdater(updater: (value: boolean) => void) {
  updateSubscription = updater;
}

export function getIAPProductIds(): { monthly: string; yearly: string } {
  return REVENUECAT_PRODUCT_IDS;
}

function isWeb(): boolean {
  return Platform.OS === 'web';
}

function getRevenueCatApiKey(): string {
  if (Platform.OS === 'ios') {
    return appwriteConfig.revenueCatApiKeyIos || appwriteConfig.revenueCatApiKey || '';
  }
  if (Platform.OS === 'android') {
    return appwriteConfig.revenueCatApiKeyAndroid || appwriteConfig.revenueCatApiKey || '';
  }
  return appwriteConfig.revenueCatApiKey || '';
}

function isInvalidProductionRevenueCatKey(apiKey: string): boolean {
  return !__DEV__ && apiKey.startsWith('test_');
}

function getActiveEntitlement(customerInfo: CustomerInfo | null | undefined) {
  if (!customerInfo) return null;
  for (const entitlementId of ENTITLEMENT_IDS) {
    const entitlement = customerInfo.entitlements.active[entitlementId];
    if (entitlement?.isActive) {
      return entitlement;
    }
  }
  return null;
}

function hasActiveEntitlement(customerInfo: CustomerInfo | null | undefined): boolean {
  return Boolean(getActiveEntitlement(customerInfo));
}

function getPlanForProductId(productId?: string | null): SubscriptionPlan | null {
  if (!productId) return null;
  const normalizedProductId = productId.toLowerCase();
  if (normalizedProductId.includes(REVENUECAT_PRODUCT_IDS.yearly)) return 'yearly';
  if (normalizedProductId.includes(REVENUECAT_PRODUCT_IDS.monthly)) return 'monthly';
  return null;
}

function getActivePlanFromCustomerInfo(customerInfo: CustomerInfo | null | undefined): SubscriptionPlan | null {
  const entitlement = getActiveEntitlement(customerInfo);
  const entitlementPlan = getPlanForProductId(entitlement?.productIdentifier);
  if (entitlementPlan) return entitlementPlan;

  const activeSubscription = customerInfo?.activeSubscriptions.find((productId) =>
    getPlanForProductId(productId)
  );
  return getPlanForProductId(activeSubscription);
}

function getPreviousPlanFromCustomerInfo(customerInfo: CustomerInfo | null | undefined): SubscriptionPlan | null {
  const purchasedProduct = customerInfo?.allPurchasedProductIdentifiers.find((productId) =>
    getPlanForProductId(productId)
  );
  return getPlanForProductId(purchasedProduct);
}

function toSubscriptionProduct(product: PurchasesStoreProduct): SubscriptionProduct {
  const anyProduct = product as any;
  return {
    productId: product.identifier,
    displayPrice:
      anyProduct.priceString ??
      anyProduct.localizedPriceString ??
      anyProduct.localizedPrice ??
      anyProduct.pricePerMonthString ??
      '',
    price: product.price,
    currency: anyProduct.currencyCode ?? anyProduct.currency ?? undefined,
    title: product.title,
    description: product.description,
  };
}

function findPackageForPlan(offering: PurchasesOffering | null | undefined, plan: SubscriptionPlan): PurchasesPackage | null {
  if (!offering) return null;
  const expectedProductId = REVENUECAT_PRODUCT_IDS[plan];
  const predefinedPackage = plan === 'monthly' ? offering.monthly : offering.annual;
  if (predefinedPackage) return predefinedPackage;

  return (
    offering.availablePackages.find((pkg) => {
      const packageIdentifier = pkg.identifier.toLowerCase();
      const productIdentifier = pkg.product.identifier.toLowerCase();
      return packageIdentifier.includes(plan) || productIdentifier.includes(expectedProductId);
    }) ?? null
  );
}

async function ensureConfigured(): Promise<boolean> {
  if (isWeb()) {
    return false;
  }

  if (configured) {
    return true;
  }

  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    console.warn('[RevenueCat] Missing API key. Subscriptions are disabled.');
    return false;
  }

  if (isInvalidProductionRevenueCatKey(apiKey)) {
    console.warn('[RevenueCat] Test Store API keys cannot be used in production builds. Subscriptions are disabled.');
    return false;
  }

  try {
    await Purchases.setLogLevel(__DEV__ ? Purchases.LOG_LEVEL.DEBUG : Purchases.LOG_LEVEL.WARN);
    Purchases.configure({ apiKey });
    configured = true;

    customerInfoListener = (customerInfo) => {
      updateSubscription?.(hasActiveEntitlement(customerInfo));
    };
    Purchases.addCustomerInfoUpdateListener(customerInfoListener);
    return true;
  } catch (err) {
    console.warn('[RevenueCat] configure error:', err);
    return false;
  }
}

async function getCustomerInfo(): Promise<CustomerInfo | null> {
  const ready = await ensureConfigured();
  if (!ready) return null;

  try {
    return await Purchases.getCustomerInfo();
  } catch (err) {
    console.warn('[RevenueCat] getCustomerInfo error:', err);
    return null;
  }
}

async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  const ready = await ensureConfigured();
  if (!ready) return null;

  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? Object.values(offerings.all)[0] ?? null;
  } catch (err) {
    console.warn('[RevenueCat] getOfferings error:', err);
    return null;
  }
}

async function getPackageForPlan(plan: SubscriptionPlan): Promise<PurchasesPackage | null> {
  const offering = await getCurrentOffering();
  return findPackageForPlan(offering, plan);
}

async function getActiveSubscriptionPlan(): Promise<SubscriptionPlan | null> {
  const customerInfo = await getCustomerInfo();
  return getActivePlanFromCustomerInfo(customerInfo);
}

export const iapService = {
  setSubscriptionUpdater,

  async init(): Promise<void> {
    await ensureConfigured();
  },

  async identifyUser(appUserId: string, email?: string | null, displayName?: string | null): Promise<CustomerInfo | null> {
    const ready = await ensureConfigured();
    if (!ready || !appUserId) return null;

    try {
      const result = await Purchases.logIn(appUserId);
      if (email) {
        await Purchases.setEmail(email).catch(() => {});
      }
      if (displayName) {
        await Purchases.setDisplayName(displayName).catch(() => {});
      }
      updateSubscription?.(hasActiveEntitlement(result.customerInfo));
      return result.customerInfo;
    } catch (err) {
      console.warn('[RevenueCat] logIn error:', err);
      return getCustomerInfo();
    }
  },

  async logOut(): Promise<void> {
    if (!configured || isWeb()) return;
    try {
      await Purchases.logOut();
    } catch (err) {
      console.warn('[RevenueCat] logOut error:', err);
    }
  },

  async endConnection(): Promise<void> {
    if (customerInfoListener) {
      Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
      customerInfoListener = null;
    }
  },

  async fetchSubscriptionProducts(): Promise<SubscriptionProducts> {
    if (isWeb()) {
      return { monthly: null, yearly: null };
    }

    const offering = await getCurrentOffering();
    const monthlyPackage = findPackageForPlan(offering, 'monthly');
    const yearlyPackage = findPackageForPlan(offering, 'yearly');

    return {
      monthly: monthlyPackage ? toSubscriptionProduct(monthlyPackage.product) : null,
      yearly: yearlyPackage ? toSubscriptionProduct(yearlyPackage.product) : null,
    };
  },

  async checkSubscription(): Promise<boolean> {
    const customerInfo = await getCustomerInfo();
    return hasActiveEntitlement(customerInfo);
  },

  async getCustomerInfo(): Promise<CustomerInfo | null> {
    return getCustomerInfo();
  },

  async getActiveSubscriptionPlan(): Promise<SubscriptionPlan | null> {
    return getActiveSubscriptionPlan();
  },

  async getPreviousSubscriptionPlan(): Promise<SubscriptionPlan | null> {
    const customerInfo = await getCustomerInfo();
    return getPreviousPlanFromCustomerInfo(customerInfo);
  },

  async getRestorePurchaseStatus(): Promise<RestorePurchaseStatus> {
    if (isWeb()) {
      return 'none';
    }

    const customerInfo = await getCustomerInfo();
    if (hasActiveEntitlement(customerInfo)) {
      return 'active';
    }

    return getPreviousPlanFromCustomerInfo(customerInfo) ? 'previous-expired' : 'none';
  },

  async purchaseSubscription(productId: string): Promise<boolean> {
    if (isWeb()) {
      throw new Error('In-app purchases are not available in the web preview. Please use the iOS or Android app.');
    }

    const plan = getPlanForProductId(productId);
    if (!plan) {
      throw new Error('Subscription products are not configured in RevenueCat.');
    }

    const pkg = await getPackageForPlan(plan);
    if (!pkg) {
      throw new Error(`RevenueCat offering is missing the ${plan} package.`);
    }

    try {
      const result = await Purchases.purchasePackage(pkg);
      const active = hasActiveEntitlement(result.customerInfo);
      updateSubscription?.(active);
      return active;
    } catch (err: any) {
      if (err?.userCancelled || err?.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        return false;
      }
      throw err instanceof Error ? err : new Error(err?.message || 'Purchase failed');
    }
  },

  async restorePurchases(): Promise<boolean> {
    if (isWeb()) {
      return false;
    }

    try {
      const customerInfo = await Purchases.restorePurchases();
      const active = hasActiveEntitlement(customerInfo);
      updateSubscription?.(active);
      return active;
    } catch (err) {
      console.warn('[RevenueCat] restorePurchases error:', err);
      return false;
    }
  },

  async presentPaywall(): Promise<boolean> {
    if (isWeb()) {
      throw new Error('RevenueCat Paywalls are not available in the web preview. Please use the iOS or Android app.');
    }

    const ready = await ensureConfigured();
    if (!ready) {
      throw new Error('RevenueCat is not configured.');
    }

    const existingCustomerInfo = await getCustomerInfo();
    if (hasActiveEntitlement(existingCustomerInfo)) {
      updateSubscription?.(true);
      return true;
    }

    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: REVENUECAT_ENTITLEMENT_ID,
      displayCloseButton: true,
    });

    const customerInfo = await getCustomerInfo();
    const active = hasActiveEntitlement(customerInfo);
    updateSubscription?.(active);

    if (result === PAYWALL_RESULT.ERROR) {
      throw new Error('Unable to complete the RevenueCat paywall flow.');
    }

    return active || result === PAYWALL_RESULT.NOT_PRESENTED;
  },

  async presentCustomerCenter(): Promise<void> {
    if (isWeb()) {
      throw new Error('RevenueCat Customer Center is not available in the web preview. Please use the iOS or Android app.');
    }

    const ready = await ensureConfigured();
    if (!ready) {
      throw new Error('RevenueCat is not configured.');
    }

    await RevenueCatUI.presentCustomerCenter({
      callbacks: {
        onRestoreCompleted: ({ customerInfo }) => {
          updateSubscription?.(hasActiveEntitlement(customerInfo));
        },
        onPromotionalOfferSucceeded: ({ customerInfo }) => {
          updateSubscription?.(hasActiveEntitlement(customerInfo));
        },
      },
    });
  },
};
