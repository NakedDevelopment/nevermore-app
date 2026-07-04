import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import React, { useEffect, useMemo, useRef } from 'react';
import { Linking } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useOnboardingStore } from '../store/onboardingStore';
import { ScreenNames } from '../constants/ScreenNames';
import { FortyDay } from './screens/FortyDay';
import { Bookmark } from './screens/Bookmark';
import { Welcome } from './screens/Welcome';
import { SignIn } from './screens/SignIn';
import { SignUp } from './screens/SignUp';
import { ForgotPassword } from './screens/ForgotPassword';
import { CreateNewPassword } from './screens/CreateNewPassword';
import { SetPassword } from './screens/SetPassword';
import { MagicURLVerify } from './screens/MagicURLVerify';
import { VerifyEmail } from './screens/VerifyEmail';
import { Permission } from './screens/Permission';
import { Purpose } from './screens/Purpose';
import { Nickname } from './screens/Nickname';
import { Invite } from './screens/Invite';
import { InviteSend } from './screens/InviteSend';
import { TrialWelcome } from './screens/TrialWelcome';
import { TrialExpired } from './screens/TrialExpired';
import { Subscription } from './screens/Subscription';
import TemptationDetails from './screens/TemptationDetails';
import Transcript from './screens/Transcript';
import Profile from './screens/Profile';
import ManageInvites from './screens/ManageInvites';
import PrivacyPolicy from './screens/PrivacyPolicy';
import TermsAndConditions from './screens/TermsAndConditions';
import HelpSupport from './screens/HelpSupport';
import HomeIcon from '../assets/icons/home';
import HomeActiveIcon from '../assets/icons/home-active';
import CalendarIcon from '../assets/icons/calendar';
import CalendarActiveIcon from '../assets/icons/calendar-active';
import BookmarkIcon from '../assets/icons/bookmark';
import BookmarkActiveIcon from '../assets/icons/bookmark-active';
import { CustomDrawerContent } from '../components/DrawerMenu';
import Home from './screens/Home';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { useTrialStore } from '../store/trialStore';
import { useSharedAccessStore } from '../store/sharedAccessStore';

const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

function HomeTabs() {
  return (
    <Tab.Navigator
      initialRouteName={ScreenNames.FORTY_DAY}
      detachInactiveScreens={false}
      screenOptions={{
        animation: 'none',
        lazy: false,
        tabBarStyle: {
          backgroundColor: '#131313',
          borderTopColor: 'transparent',
          height: 100,
          paddingBottom: 12,
          paddingTop: 12,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: '#8B5CF6',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 4,
          fontFamily: 'Roboto',
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
        headerShown: false,
        tabBarHideOnKeyboard: true,
        sceneStyle: {
          backgroundColor: '#131313',
        },
      }}
    >
      <Tab.Screen
        name={ScreenNames.HOME}
        component={Home}
        options={{
          title: 'Temptations',
          tabBarIcon: ({ color, size, focused }) => {
            const Icon = focused ? HomeActiveIcon : HomeIcon;
            return <Icon color={color} width={size} height={size} />;
          },
        }}
      />
      <Tab.Screen
        name={ScreenNames.FORTY_DAY}
        component={FortyDay}
        options={{
          title: '40 Day',
          tabBarIcon: ({ color, size, focused }) => {
            const Icon = focused ? CalendarActiveIcon : CalendarIcon;
            return <Icon color={color} width={size} height={size} />;
          },
        }}
      />
      <Tab.Screen
        name={ScreenNames.BOOKMARK}
        component={Bookmark}
        options={{
          title: 'Bookmark',
          tabBarIcon: ({ color, size, focused }) => {
            const Icon = focused ? <BookmarkActiveIcon color={color} width={14} height={18} /> : <BookmarkIcon color={color} width={14} height={17} />;
            return Icon;
          },
        }}
      />
    </Tab.Navigator>
  );
}

function DrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        drawerType: 'slide',
        overlayColor: 'rgba(0, 0, 0, 0.5)',
        drawerStyle: {
          width: '85%',
          backgroundColor: 'transparent',
        },
        headerShown: false,
        swipeEnabled: true,
        swipeEdgeWidth: 50,
      }}
    >
      <Drawer.Screen
        name={ScreenNames.HOME_TABS}
        component={HomeTabs}
        options={{
          drawerLabel: '',
          drawerItemStyle: { height: 0 },
        }}
      />
    </Drawer.Navigator>
  );
}

const Stack = createNativeStackNavigator();

function RootStack({ initialRouteName }: { initialRouteName: string }) {
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 300,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    >
      <Stack.Screen
        name={ScreenNames.WELCOME}
        component={Welcome}
        options={{
          title: 'Welcome',
        }}
      />
      <Stack.Screen
        name={ScreenNames.SIGN_IN}
        component={SignIn}
        options={{
          title: 'Sign In',
        }}
      />
      <Stack.Screen
        name={ScreenNames.SIGN_UP}
        component={SignUp}
        options={{
          title: 'Sign Up',
        }}
      />
      <Stack.Screen
        name={ScreenNames.FORGOT_PASSWORD}
        component={ForgotPassword}
        options={{
          title: 'Forgot Password',
        }}
      />
      <Stack.Screen
        name={ScreenNames.CREATE_NEW_PASSWORD}
        component={CreateNewPassword}
        options={{
          title: 'Create New Password',
        }}
      />
      <Stack.Screen
        name={ScreenNames.SET_PASSWORD}
        component={SetPassword}
        options={{
          title: 'Set Password',
        }}
      />
      <Stack.Screen
        name={ScreenNames.MAGIC_URL_VERIFY}
        component={MagicURLVerify}
        options={{
          title: 'Verify Magic URL',
        }}
      />
      <Stack.Screen
        name={ScreenNames.VERIFY_EMAIL}
        component={VerifyEmail}
        options={{
          title: 'Verify Email',
        }}
      />
      <Stack.Screen
        name={ScreenNames.PERMISSION}
        component={Permission}
        options={{
          title: 'Permission',
        }}
      />
      <Stack.Screen
        name={ScreenNames.PURPOSE}
        component={Purpose}
        options={{
          title: 'Purpose',
        }}
      />
      <Stack.Screen
        name={ScreenNames.NICKNAME}
        component={Nickname}
        options={{
          title: 'Nickname',
        }}
      />
      <Stack.Screen
        name={ScreenNames.INVITE}
        component={Invite}
        options={{
          title: 'Invite',
        }}
      />
      <Stack.Screen
        name={ScreenNames.INVITE_SEND}
        component={InviteSend}
        options={{
          title: 'Invite Send',
        }}
      />
      <Stack.Screen
        name={ScreenNames.TRIAL_WELCOME}
        component={TrialWelcome}
        options={{
          title: 'Trial Welcome',
        }}
      />
      <Stack.Screen
        name={ScreenNames.TRIAL_EXPIRED}
        component={TrialExpired}
        options={{
          title: 'Trial Expired',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name={ScreenNames.SUBSCRIPTION}
        component={Subscription}
        options={{
          title: 'Subscription',
        }}
      />
      <Stack.Screen
        name={ScreenNames.HOME_TABS}
        component={DrawerNavigator}
        options={{
          title: 'Home',
        }}
      />
      <Stack.Screen
        name={ScreenNames.TEMPTATION_DETAILS}
        component={TemptationDetails}
        options={{
          title: 'Temptation Details',
          animation: 'slide_from_bottom',
          animationDuration: 400,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name={ScreenNames.TRANSCRIPT}
        component={Transcript}
        options={{
          title: 'Transcript',
        }}
      />
      <Stack.Screen
        name={ScreenNames.PROFILE}
        component={Profile}
        options={{
          title: 'Profile',
        }}
      />
      <Stack.Screen
        name={ScreenNames.MANAGE_INVITES}
        component={ManageInvites}
        options={{
          title: 'Manage Invites',
        }}
      />
      <Stack.Screen
        name={ScreenNames.PRIVACY_POLICY}
        component={PrivacyPolicy}
        options={{
          title: 'Privacy Policy',
        }}
      />
      <Stack.Screen
        name={ScreenNames.TERMS_CONDITIONS}
        component={TermsAndConditions}
        options={{
          title: 'Terms & Conditions',
        }}
      />
      <Stack.Screen
        name={ScreenNames.HELP_SUPPORT}
        component={HelpSupport}
        options={{
          title: 'Help & Support',
        }}
      />
    </Stack.Navigator>
  );
}

const linking = {
  prefixes: [
    'nevermoreapp://',
    'https://nevermoreapp.com',
    'https://nevermore-admin-app-seven.vercel.app',
    'https://nevermore-admin-app.vercel.app',
  ],
  config: {
    screens: {
      [ScreenNames.CREATE_NEW_PASSWORD]: {
        path: 'reset-password',
        parse: {
          userId: (userId: string) => userId,
          secret: (secret: string) => secret,
        },
      },
      [ScreenNames.MAGIC_URL_VERIFY]: {
        path: 'verify-magic-url',
        parse: {
          userId: (userId: string) => userId,
          secret: (secret: string) => secret,
        },
      },
      [ScreenNames.WELCOME]: '',
      [ScreenNames.SIGN_IN]: 'signin',
      [ScreenNames.SIGN_UP]: 'signup',
      [ScreenNames.FORGOT_PASSWORD]: 'forgot-password',
      [ScreenNames.INVITE]: {
        path: 'invite',
        parse: {
          token: (token: string) => token,
          userId: (userId: string) => userId,
          secret: (secret: string) => secret,
          expire: (expire: string) => expire,
          project: (project: string) => project,
        },
      },
      [ScreenNames.HOME_TABS]: {
        path: 'home',
        screens: {
          [ScreenNames.HOME]: 'feed',
          [ScreenNames.FORTY_DAY]: 'forty-day',
          [ScreenNames.BOOKMARK]: 'bookmarks',
        },
      },
    },
  },
};

const ONBOARDING_STACK_ORDER: string[] = [
  ScreenNames.PERMISSION,
  ScreenNames.PURPOSE,
  ScreenNames.NICKNAME,
  ScreenNames.INVITE,
  ScreenNames.INVITE_SEND,
  ScreenNames.TRIAL_WELCOME,
];

function getParamsFromUrl(url: string): Record<string, string> {
  const queryStart = url.indexOf('?');
  if (queryStart < 0) return {};

  const query = url.slice(queryStart + 1);
  const params = new URLSearchParams(query);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function getPathFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const schemePath = parsed.protocol === 'nevermoreapp:'
      ? `${parsed.hostname}${parsed.pathname}`
      : parsed.pathname;

    return schemePath.replace(/^\/+/, '').split('/')[0];
  } catch {
    const withoutQuery = url.split('?')[0] ?? '';
    return withoutQuery
      .replace(/^nevermoreapp:\/+/, '')
      .replace(/^https?:\/\/[^/]+\//, '')
      .replace(/^\/+/, '')
      .split('/')[0];
  }
}

function getRouteFromDeepLink(url: string): { name: ScreenNames; params?: Record<string, string> } | null {
  const path = getPathFromUrl(url);
  const params = getParamsFromUrl(url);

  if (path === 'invite') {
    return { name: ScreenNames.INVITE, params };
  }

  if (path === 'reset-password' || path === 'create-new-password') {
    return { name: ScreenNames.CREATE_NEW_PASSWORD, params };
  }

  if (path === 'verify-magic-url') {
    return { name: ScreenNames.MAGIC_URL_VERIFY, params };
  }

  return null;
}

function buildOnboardingStackRoutes(currentStep: string) {
  const idx = ONBOARDING_STACK_ORDER.indexOf(currentStep);
  const names = idx >= 0 ? ONBOARDING_STACK_ORDER.slice(0, idx + 1) : [currentStep];
  return names.map((name) => ({ name }));
}

export function Navigation(props?: any) {
  const { isAuthenticated } = useAuthStore();
  const { isOnboardingComplete, currentOnboardingStep, completeOnboarding } = useOnboardingStore();
  const isSubscribed = useSubscriptionStore((s) => s.isSubscribed);
  const isSharedAccessActive = useSharedAccessStore((s) => s.isSharedAccessActive);
  const refreshSharedAccess = useSharedAccessStore((s) => s.refreshSharedAccess);
  const trialStartDate = useTrialStore((s) => s.trialStartDate);
  const isTrialExpired = useTrialStore((s) => s.isTrialExpired);
  const navigationRef = useNavigationContainerRef();
  const didRestoreOnboardingStackRef = useRef(false);
  const pendingDeepLinkRouteRef = useRef<{ name: ScreenNames; params?: Record<string, string> } | null>(null);

  const navigateToDeepLinkRoute = React.useCallback((url: string) => {
    const route = getRouteFromDeepLink(url);
    if (!route) return false;

    if (!navigationRef.isReady()) {
      pendingDeepLinkRouteRef.current = route;
      return true;
    }

    pendingDeepLinkRouteRef.current = null;
    navigationRef.reset({
      index: 0,
      routes: [{ name: route.name as any, params: route.params }],
    } as any);
    return true;
  }, [navigationRef]);

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) {
        navigateToDeepLinkRoute(url);
      }
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      navigateToDeepLinkRoute(url);
    });

    return () => subscription.remove();
  }, [navigateToDeepLinkRoute]);

  // Determine initial route based on auth and onboarding status
  const getInitialRouteName = (): string => {
    if (!isAuthenticated) {
      return ScreenNames.WELCOME;
    }

    if (isOnboardingComplete && !isSubscribed && !isSharedAccessActive && isTrialExpired()) {
      return ScreenNames.TRIAL_EXPIRED;
    }

    // If authenticated and onboarding is explicitly complete, go to home
    if (isOnboardingComplete) {
      return ScreenNames.HOME_TABS;
    }

    // Authenticated but onboarding not complete: always start the onboarding stack
    // from the beginning. If we have a saved step, we'll restore the full stack
    // (including history) after the navigator is ready.
    return ScreenNames.PERMISSION;
  };

  const initialRouteName = getInitialRouteName();

  const onboardingResetState = useMemo(() => {
    if (!isAuthenticated || isOnboardingComplete || !currentOnboardingStep) return null;
    const routes = buildOnboardingStackRoutes(currentOnboardingStep);
    return { index: routes.length - 1, routes };
  }, [isAuthenticated, isOnboardingComplete, currentOnboardingStep]);

  // Rehydrate onboarding stack history on cold start / relaunch.
  // Without this, resuming directly to a deep onboarding screen creates a stack
  // with no previous routes, so iOS back/gesture can't navigate.
  useEffect(() => {
    if (pendingDeepLinkRouteRef.current) return;
    if (!onboardingResetState) return;
    if (!navigationRef.isReady()) return;
    if (didRestoreOnboardingStackRef.current) return;

    navigationRef.reset(onboardingResetState as any);
    didRestoreOnboardingStackRef.current = true;
  }, [navigationRef, onboardingResetState]);

  // If onboarding becomes complete (or user logs out), allow future restores.
  useEffect(() => {
    if (!isAuthenticated || isOnboardingComplete || !currentOnboardingStep) {
      didRestoreOnboardingStackRef.current = false;
    }
  }, [isAuthenticated, isOnboardingComplete, currentOnboardingStep]);

  // Mark onboarding complete if user signs in (existing users skip onboarding)
  // Only do this if they're going to HOME_TABS and onboarding isn't already marked complete
  useEffect(() => {
    if (isAuthenticated && initialRouteName === ScreenNames.HOME_TABS && !isOnboardingComplete && !currentOnboardingStep) {
      // This handles existing users who sign in - they've completed onboarding before
      completeOnboarding();
    }
  }, [isAuthenticated, initialRouteName, isOnboardingComplete, currentOnboardingStep, completeOnboarding]);

  useEffect(() => {
    if (!isAuthenticated || !isOnboardingComplete) return;

    refreshSharedAccess();
    const intervalId = setInterval(refreshSharedAccess, 60 * 1000);
    return () => clearInterval(intervalId);
  }, [isAuthenticated, isOnboardingComplete, refreshSharedAccess]);

  // If the trial expires while user is in the app, hard-block with TrialExpired.
  useEffect(() => {
    const maybeBlockExpiredTrial = () => {
      if (!isAuthenticated) return;
      if (!isOnboardingComplete) return;
      if (isSubscribed) return;
      if (isSharedAccessActive) return;
      if (!navigationRef.isReady()) return;
      if (!isTrialExpired()) return;

      const currentRouteName = navigationRef.getCurrentRoute()?.name;
      if (currentRouteName === ScreenNames.TRIAL_EXPIRED) return;

      navigationRef.reset({
        index: 0,
        routes: [{ name: ScreenNames.TRIAL_EXPIRED as any }],
      } as any);
    };

    maybeBlockExpiredTrial();
    const intervalId = setInterval(maybeBlockExpiredTrial, 60 * 1000);
    return () => clearInterval(intervalId);
  }, [isAuthenticated, isOnboardingComplete, isSubscribed, isSharedAccessActive, isTrialExpired, trialStartDate, navigationRef]);

  // The block above only ever navigates TO TrialExpired, never away from it.
  // A subscriber who lands there from a slow/stale subscription check (or
  // whose entitlement is granted while sitting on the screen, e.g. restored
  // on another device) would otherwise be stuck until they manually tap
  // Restore Purchase. Release the hard block automatically once isSubscribed
  // (or shared access) becomes true.
  useEffect(() => {
    if (!isSubscribed && !isSharedAccessActive) return;
    if (!navigationRef.isReady()) return;

    const currentRouteName = navigationRef.getCurrentRoute()?.name;
    if (currentRouteName !== ScreenNames.TRIAL_EXPIRED) return;

    navigationRef.reset({
      index: 0,
      routes: [{ name: ScreenNames.HOME_TABS as any }],
    } as any);
  }, [isSubscribed, isSharedAccessActive, navigationRef]);

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        if (pendingDeepLinkRouteRef.current) {
          const route = pendingDeepLinkRouteRef.current;
          pendingDeepLinkRouteRef.current = null;
          navigationRef.reset({
            index: 0,
            routes: [{ name: route.name as any, params: route.params }],
          } as any);
        }
      }}
      linking={linking}
      initialState={(onboardingResetState as any) ?? undefined}
      {...props}
    >
      <RootStack initialRouteName={initialRouteName} />
    </NavigationContainer>
  );
}
