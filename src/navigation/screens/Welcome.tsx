import { Cinzel_400Regular, Cinzel_600SemiBold, useFonts } from '@expo-google-fonts/cinzel';
import { Roboto_400Regular, Roboto_500Medium, Roboto_700Bold, useFonts as useRobotoFonts } from '@expo-google-fonts/roboto';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import {
  ImageBackground,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Button } from '../../components/Button';
import { ScreenNames } from '../../constants/ScreenNames';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function Welcome() {
  const navigation = useNavigation();
  const inset = useSafeAreaInsets();
  
  const [cinzelFontsLoaded] = useFonts({
    Cinzel_400Regular,
    Cinzel_600SemiBold,
  });

  const [robotoFontsLoaded] = useRobotoFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
  });

  if (!cinzelFontsLoaded || !robotoFontsLoaded) {
    return null;
  }

  const handleCreateAccount = () => {
    navigation.navigate(ScreenNames.SIGN_UP);
  };

  const handleSignIn = () => {
    navigation.navigate(ScreenNames.SIGN_IN);
  };

  return (
    <View style={[styles.container, { paddingBottom: inset.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor="#2D1B69" />
      <ImageBackground
        source={require('../../assets/splash-bg.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.content}>
          <Text style={styles.title}>NEVERMORE</Text>
          
          <Text style={styles.description}>
            Let us know if you're on your own path to sobriety, or here to support someone else on theirs. Either way, you're in the right place.
          </Text>
          
          <Button
            title="Create Account"
            onPress={handleCreateAccount}
            variant="primary"
            size="medium"
            style={styles.createAccountButton}
          />
          
          <View style={styles.signInContainer}>
            <Text style={styles.signInText}>
              Already have an account?{' '}
              <Text style={styles.signInLink} onPress={handleSignIn}>
                Sign In
              </Text>
            </Text>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '80%',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  title: {
    fontFamily: 'Cinzel_400Regular',
    fontSize: 40,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 2,
  },
  description: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 48,
    paddingHorizontal: 16,
  },
  createAccountButton: {
    marginBottom: 24,
    width: '100%',
  },
  signInContainer: {
    alignItems: 'center',
  },
  signInText: {
    fontFamily: 'Roboto_400Regular',
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
  signInLink: {
    fontFamily: 'Roboto_500Medium',
    color: '#8A2BE2',
  },
});
