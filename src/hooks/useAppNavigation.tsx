import { useNavigation as useRNNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenNames } from '../constants/ScreenNames';

export type RootStackParamList = {
  [ScreenNames.WELCOME]: undefined;
  [ScreenNames.SIGN_IN]: undefined;
  [ScreenNames.SIGN_UP]: undefined;
  [ScreenNames.REDEEM_INVITE_CODE]: undefined;
  [ScreenNames.FORGOT_PASSWORD]: undefined;
  [ScreenNames.CREATE_NEW_PASSWORD]: {
    userId?: string;
    secret?: string;
  };
  [ScreenNames.SET_PASSWORD]: undefined;
  [ScreenNames.MAGIC_URL_VERIFY]: {
    userId?: string;
    secret?: string;
  };
  [ScreenNames.VERIFY_EMAIL]: {
    email: string;
    source?: 'signup' | 'forgot-password';
  };
  [ScreenNames.PERMISSION]: undefined;
  [ScreenNames.PURPOSE]: undefined;
  [ScreenNames.NICKNAME]: undefined;
  [ScreenNames.INVITE]: {
    token?: string;
    userId?: string;
    secret?: string;
    expire?: string;
    project?: string;
  } | undefined;
  [ScreenNames.INVITE_SEND]: {
    fromManageInvites?: boolean;
  } | undefined;
  [ScreenNames.TRIAL_WELCOME]: undefined;
  [ScreenNames.TRIAL_EXPIRED]: undefined;
  [ScreenNames.SUBSCRIPTION]: undefined;
  [ScreenNames.HOME_TABS]: undefined;
  [ScreenNames.HOME]: undefined;
  [ScreenNames.FORTY_DAY]: undefined;
  [ScreenNames.BOOKMARK]: undefined;
  [ScreenNames.TEMPTATION_DETAILS]: {
    contentId: string;
    temptationTitle: string;
    categoryId?: string;
    date?: string;
    audioUrl?: string;
  };
  [ScreenNames.TRANSCRIPT]: {
    title: string;
    transcript: string;
    audioUrl?: string;
    initialPositionSec?: number;
    resumePlaying?: boolean;
  };
  [ScreenNames.PROFILE]: undefined;
  [ScreenNames.MANAGE_INVITES]: undefined;
  [ScreenNames.PRIVACY_POLICY]: undefined;
  [ScreenNames.TERMS_CONDITIONS]: undefined;
  [ScreenNames.HELP_SUPPORT]: {
    preSelectedReason?: string;
  } | undefined;
  [ScreenNames.SETTINGS]: undefined;
  [ScreenNames.NOT_FOUND]: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const useAppNavigation = () => {
  const navigation = useRNNavigation<NavigationProp>();

  // RootStackParamList has grown past the size where TS reliably resolves
  // navigate()'s overloads directly (a known react-navigation/TS limit —
  // once a union gets this large, the type checker non-deterministically
  // fails to resolve ONE arbitrary member's overload, and which member
  // fails shifts around as the union's shape changes; it is not tied to
  // any specific screen being wrong). Routing every call through this one
  // generically-typed helper keeps every individual wrapper below fully
  // type-safe on its own params while resolving the overload exactly once.
  // Each public navigateToX wrapper below already declares its own precise
  // params type, so callers stay fully type-checked — nav() itself just
  // needs to escape the overload resolution TS can't reliably do at this
  // union size, which is safe since it's a private, internal-only helper.
  const navigateUnsafe = navigation.navigate as (screen: ScreenNames, params?: unknown) => void;
  function nav(screen: ScreenNames, params?: unknown): void {
    navigateUnsafe(screen, params);
  }

  return {
    goBack: () => navigation.goBack(),
    canGoBack: () => navigation.canGoBack(),
    navigate: navigation.navigate,
    navigateToWelcome: () => nav(ScreenNames.WELCOME),
    navigateToSignIn: () => nav(ScreenNames.SIGN_IN),
    navigateToSignUp: () => nav(ScreenNames.SIGN_UP),
    navigateToRedeemInviteCode: () => nav(ScreenNames.REDEEM_INVITE_CODE),
    navigateToForgotPassword: () => nav(ScreenNames.FORGOT_PASSWORD),
    navigateToCreateNewPassword: () => nav(ScreenNames.CREATE_NEW_PASSWORD),
    navigateToSetPassword: () => nav(ScreenNames.SET_PASSWORD),
    navigateToVerifyEmail: (params: { email: string; source?: 'signup' | 'forgot-password' }) =>
      nav(ScreenNames.VERIFY_EMAIL, params),
    navigateToPermission: () => nav(ScreenNames.PERMISSION),
    navigateToPurpose: () => nav(ScreenNames.PURPOSE),
    navigateToNickname: () => nav(ScreenNames.NICKNAME),
    navigateToInvite: () => nav(ScreenNames.INVITE),
    navigateToInviteSend: (params?: { fromManageInvites?: boolean }) =>
      nav(ScreenNames.INVITE_SEND, params),
    navigateToTrialWelcome: () => nav(ScreenNames.TRIAL_WELCOME),
    navigateToTrialExpired: () => nav(ScreenNames.TRIAL_EXPIRED),
    navigateToSubscription: () => nav(ScreenNames.SUBSCRIPTION),
    navigateToHome: () => nav(ScreenNames.HOME_TABS),
    navigateToHomeTabs: () => nav(ScreenNames.HOME_TABS),
    navigateToFortyDay: () => nav(ScreenNames.FORTY_DAY),
    navigateToBookmark: () => nav(ScreenNames.BOOKMARK),
    navigateToTemptationDetails: (params: {
      contentId: string;
      temptationTitle: string;
      categoryId?: string;
      date?: string;
      audioUrl?: string;
    }) => nav(ScreenNames.TEMPTATION_DETAILS, params),
    navigateToTranscript: (params: {
      title: string;
      transcript: string;
      audioUrl?: string;
      initialPositionSec?: number;
      resumePlaying?: boolean;
    }) => nav(ScreenNames.TRANSCRIPT, params),
    navigateToProfile: () => nav(ScreenNames.PROFILE),
    navigateToManageInvites: () => nav(ScreenNames.MANAGE_INVITES),
    navigateToPrivacyPolicy: () => nav(ScreenNames.PRIVACY_POLICY),
    navigateToTermsConditions: () => nav(ScreenNames.TERMS_CONDITIONS),
    navigateToHelpSupport: (params?: { preSelectedReason?: string }) =>
      nav(ScreenNames.HELP_SUPPORT, params),
    raw: navigation,
  };
};