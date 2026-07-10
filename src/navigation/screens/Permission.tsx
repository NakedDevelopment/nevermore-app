import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import ArrowLeftIcon from '../../assets/icons/arrow-left';
import { Button } from '../../components/Button';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useAuthStore } from '../../store/authStore';
import { ScreenNames } from '../../constants/ScreenNames';

export function Permission() {
  const navigation = useNavigation();
  const { setCurrentStep } = useOnboardingStore();
  const { signOut } = useAuthStore();

  const handleBack = async () => {
    if ((navigation as any).canGoBack()) {
      (navigation as any).goBack();
      return;
    }

    // When onboarding is restored on app relaunch, Permission can be stack root.
    // In that case, "back" should exit onboarding and return to auth screens.
    try {
      await signOut();
    } finally {
      (navigation as any).reset({
        index: 1,
        routes: [
          { name: ScreenNames.WELCOME },
          { name: ScreenNames.SIGN_UP },
        ],
      });
    }
  };

  const handleNext = () => {
    // Save current step before navigating
    setCurrentStep(ScreenNames.PURPOSE);
    // Navigate to purpose selection screen
    (navigation as any).navigate(ScreenNames.PURPOSE);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <ImageBackground
        source={require('../../assets/splash-bg.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack}>
              <ArrowLeftIcon />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Nevermore</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Main Content */}
          <View style={styles.content}>
            {/* Welcome Text */}
            <View style={styles.textContainer}>
              <Text style={styles.title}>YOU’RE NOT THE ONLY ONE</Text>
              
              <Text style={styles.description}>
                Real stories. Real thoughts.{"\n"}
                About alcohol—and everything around it.
              </Text>
            </View>
          </View>

          {/* Next Button */}
          <View style={styles.buttonContainer}>
            <Button
              title="Start Listening"
              onPress={handleNext}
              variant="primary"
              size="medium"
            />
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 18,
    color: '#ffffff',
    fontFamily: 'Roboto_400Regular',
  },
  headerSpacer: {
    width: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  graphicsContainer: {
    flex: 1,
    position: 'relative',
    marginBottom: 40,
  },
  ravenContainer: {
    position: 'absolute',
    top: 60,
    left: 40,
    width: 120,
    height: 80,
  },
  ravenBody: {
    position: 'absolute',
    top: 20,
    left: 30,
    width: 40,
    height: 30,
    backgroundColor: '#000000',
    borderRadius: 20,
  },
  ravenWing: {
    position: 'absolute',
    top: 15,
    left: 20,
    width: 50,
    height: 25,
    backgroundColor: '#000000',
    borderRadius: 25,
    transform: [{ rotate: '-15deg' }],
  },
  ravenHead: {
    position: 'absolute',
    top: 10,
    left: 35,
    width: 20,
    height: 20,
    backgroundColor: '#000000',
    borderRadius: 10,
  },
  ravenBeak: {
    position: 'absolute',
    top: 18,
    left: 50,
    width: 8,
    height: 4,
    backgroundColor: '#000000',
    borderRadius: 2,
  },
  treeContainer: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 100,
    height: 200,
  },
  branch1: {
    position: 'absolute',
    top: 20,
    right: 0,
    width: 60,
    height: 3,
    backgroundColor: '#000000',
    borderRadius: 2,
    transform: [{ rotate: '25deg' }],
  },
  branch2: {
    position: 'absolute',
    top: 40,
    right: 10,
    width: 50,
    height: 3,
    backgroundColor: '#000000',
    borderRadius: 2,
    transform: [{ rotate: '15deg' }],
  },
  branch3: {
    position: 'absolute',
    top: 60,
    right: 5,
    width: 45,
    height: 3,
    backgroundColor: '#000000',
    borderRadius: 2,
    transform: [{ rotate: '10deg' }],
  },
  branch4: {
    position: 'absolute',
    top: 80,
    right: 15,
    width: 40,
    height: 3,
    backgroundColor: '#000000',
    borderRadius: 2,
    transform: [{ rotate: '5deg' }],
  },
  branch5: {
    position: 'absolute',
    top: 100,
    right: 8,
    width: 35,
    height: 3,
    backgroundColor: '#000000',
    borderRadius: 2,
    transform: [{ rotate: '0deg' }],
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    color: '#ffffff',
    marginBottom: 24,
    fontFamily: 'Cinzel_600SemiBold',
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#ffffff',
    lineHeight: 24,
    fontFamily: 'Roboto_400Regular',
    textAlign: 'center',
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
});
