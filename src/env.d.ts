declare module '@env' {
  export const APPWRITE_ENDPOINT: string;
  export const APPWRITE_PROJECT_ID: string;
  export const APPWRITE_DATABASE_ID: string;
  export const APPWRITE_CATEGORY_COLLECTION_ID: string;
  export const APPWRITE_USER_PROFILES_COLLECTION_ID: string;
  export const APPWRITE_CONTENT_COLLECTION_ID: string;
  export const APPWRITE_SUPPORT_COLLECTION_ID: string;
  export const APPWRITE_SETTINGS_COLLECTION_ID: string;
  export const APPWRITE_INVITATIONS_COLLECTION_ID: string;
  export const APPWRITE_WELCOME_QUOTE_COLLECTION_ID: string;
  export const APPWRITE_PLATFORM: string;
  export const APPWRITE_STORAGE_BUCKET_ID: string;
  /** In-App Purchase: product ID for monthly subscription (must match App Store Connect / Google Play Console). Optional; if unset, placeholder is used. */
  export const IAP_PRODUCT_ID_MONTHLY: string;
  /** In-App Purchase: product ID for yearly subscription (second plan; must match App Store Connect / Google Play Console). Optional; if unset, placeholder is used. */
  export const IAP_PRODUCT_ID_YEARLY: string;
  /** RevenueCat public SDK key. Public by design; may be a Test Store key for development. */
  export const REVENUECAT_API_KEY: string;
  /** RevenueCat public iOS app key. Prefer this for production iOS builds. */
  export const REVENUECAT_API_KEY_IOS: string;
  /** RevenueCat public Android app key. Prefer this for production Android builds. */
  export const REVENUECAT_API_KEY_ANDROID: string;
}
