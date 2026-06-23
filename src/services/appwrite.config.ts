import { Client, Account, TablesDB, ID } from 'react-native-appwrite';
import {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  APPWRITE_DATABASE_ID,
  APPWRITE_CATEGORY_COLLECTION_ID,
  APPWRITE_USER_PROFILES_COLLECTION_ID,
  APPWRITE_INVITATIONS_COLLECTION_ID,
  APPWRITE_WELCOME_QUOTE_COLLECTION_ID,
  APPWRITE_STORAGE_BUCKET_ID,
  APPWRITE_PLATFORM,
  IAP_PRODUCT_ID_MONTHLY,
  IAP_PRODUCT_ID_YEARLY,
  REVENUECAT_API_KEY,
  REVENUECAT_API_KEY_ANDROID,
  REVENUECAT_API_KEY_IOS,
} from '@env';

const appwriteConfig = {
  endpoint: APPWRITE_ENDPOINT || '',
  projectId: APPWRITE_PROJECT_ID || '',
  databaseId: APPWRITE_DATABASE_ID || '',
  collectionId: APPWRITE_CATEGORY_COLLECTION_ID || '',
  userProfilesCollectionId: APPWRITE_USER_PROFILES_COLLECTION_ID || '',
  invitationsCollectionId: APPWRITE_INVITATIONS_COLLECTION_ID || '',
  welcomeQuoteCollectionId: APPWRITE_WELCOME_QUOTE_COLLECTION_ID || '',
  storageBucketId: APPWRITE_STORAGE_BUCKET_ID || '',
  platform: APPWRITE_PLATFORM || '',
  iapProductIdMonthly: IAP_PRODUCT_ID_MONTHLY || '',
  iapProductIdYearly: IAP_PRODUCT_ID_YEARLY || '',
  revenueCatApiKey: REVENUECAT_API_KEY || '',
  revenueCatApiKeyIos: REVENUECAT_API_KEY_IOS || REVENUECAT_API_KEY || '',
  revenueCatApiKeyAndroid: REVENUECAT_API_KEY_ANDROID || REVENUECAT_API_KEY || '',
};


const client = new Client()
  .setEndpoint(appwriteConfig.endpoint)
  .setProject(appwriteConfig.projectId)
  .setPlatform(appwriteConfig.platform);

export const account = new Account(client);
export const tablesDB = new TablesDB(client);
export { ID, client };

export default appwriteConfig;
