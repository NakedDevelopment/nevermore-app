import { Assets as NavigationAssets } from '@react-navigation/elements';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Asset } from 'expo-asset';
import * as SplashScreen from 'expo-splash-screen';
import * as React from 'react';
import { useColorScheme } from 'react-native';
import { useFonts, Cinzel_400Regular, Cinzel_600SemiBold, Cinzel_900Black,  } from '@expo-google-fonts/cinzel';
import { useFonts as useRobotoFonts, Roboto_400Regular, Roboto_500Medium, Roboto_600SemiBold, Roboto_700Bold } from '@expo-google-fonts/roboto';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Navigation } from './navigation';
import { AudioPlayerProvider } from './contexts/AudioPlayerProvider';
import { ExpoImageSplashScreen } from './components/ExpoImageSplashScreen';
import { useAuthStore } from './store/authStore';
import { useSubscriptionStore } from './store/subscriptionStore';
import { iapService } from './services/iap.service';

SplashScreen.preventAutoHideAsync();

export function App() {
  const colorScheme = useColorScheme();
  const [cinzelFontsLoaded] = useFonts({
    Cinzel_400Regular,
    Cinzel_600SemiBold,
    Cinzel_900Black,
  });

  const [robotoFontsLoaded] = useRobotoFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_600SemiBold,
    Roboto_700Bold,
  });
  const [showSplash, setShowSplash] = React.useState(true);
  const [assetsLoaded, setAssetsLoaded] = React.useState(false);
  const [authChecked, setAuthChecked] = React.useState(false);
  const { checkAuth } = useAuthStore();

  const theme = colorScheme === 'dark' ? {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: '#131313',
    },
  } : {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: '#131313',
    },
  }

  React.useEffect(() => {
    Asset.loadAsync([
      ...NavigationAssets,
      require('./assets/newspaper.png'),
      require('./assets/App_Icon.png'),
      require('./assets/splash-bg.png'),
      require('./assets/main-bg.png'),
      require('./assets/card-bg.png'),
      require('./assets/bookmark-empty.png'),
      require('./assets/task.png'),
    ]).then(() => {
      setAssetsLoaded(true);
    }).catch(() => {
    });
  }, []);

  React.useEffect(() => {
    const initAuth = async () => {
      await checkAuth();
      setAuthChecked(true);
    };

    if (cinzelFontsLoaded && robotoFontsLoaded && assetsLoaded) {
      initAuth();
      iapService.setSubscriptionUpdater((value: boolean) => {
        useSubscriptionStore.getState().setSubscribed(value);
      });
      iapService.init().then(() => {
        useSubscriptionStore.getState().checkSubscription();
      });
    }
  }, [cinzelFontsLoaded, robotoFontsLoaded, assetsLoaded, checkAuth]);

  React.useEffect(() => {
    if (cinzelFontsLoaded && robotoFontsLoaded && assetsLoaded && authChecked) {
        setShowSplash(false);
        SplashScreen.hideAsync();
    }
  }, [cinzelFontsLoaded, robotoFontsLoaded, assetsLoaded, authChecked]);

  if (!cinzelFontsLoaded || !robotoFontsLoaded || !assetsLoaded || !authChecked || showSplash) {
    return <ExpoImageSplashScreen />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AudioPlayerProvider>
        <Navigation
          theme={theme}
        />
      </AudioPlayerProvider>
    </GestureHandlerRootView>
  );
}
