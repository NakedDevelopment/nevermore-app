import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import {
  Canvas,
  Image as SkiaImage,
  useImage
} from '@shopify/react-native-skia';
import ArrowLeftIcon from '../../assets/icons/arrow-left';
import AccountIcon from '../../assets/icons/account';
import PlusIcon from '../../assets/icons/plus';
import { Button } from '../../components/Button';
import { SecondaryButton } from '../../components/SecondaryButton';
import { Input } from '../../components/Input';
import { ScreenNames } from '../../constants/ScreenNames';
import { invitationService } from '../../services/invitation.service';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { showAppwriteError, showSuccessNotification } from '../../services/notifications';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useAuthStore } from '../../store/authStore';
import { useSharedAccessStore } from '../../store/sharedAccessStore';
import { getCurrentUser } from '../../services/auth.service';
import { RootStackParamList } from '../../hooks/useAppNavigation';

type InviteSendRouteProp = RouteProp<RootStackParamList, ScreenNames.INVITE_SEND>;

export function InviteSend() {
  const navigation = useNavigation<any>();
  const route = useRoute<InviteSendRouteProp>();
  const fromManageInvites = route.params?.fromManageInvites ?? false;

  const returnToManageInvites = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate(ScreenNames.MANAGE_INVITES);
    }
  };
  const [emails, setEmails] = useState<string[]>(['']);
  const [isLoading, setIsLoading] = useState(false);
  const { setCurrentStep, completeOnboarding } = useOnboardingStore();
  const { checkAuth, isAuthenticated } = useAuthStore();
  const isSharedAccessActive = useSharedAccessStore((s) => s.isSharedAccessActive);
  const refreshSharedAccess = useSharedAccessStore((s) => s.refreshSharedAccess);
  
  const width = Dimensions.get('window').width;
  const bg = useImage(require('../../assets/gradient.png'));

  // Check authentication status when component mounts
  useEffect(() => {
    checkAuth();
    refreshSharedAccess();
  }, [checkAuth, refreshSharedAccess]);

  useEffect(() => {
    if (!isSharedAccessActive) return;

    if (fromManageInvites) {
      navigation.replace(ScreenNames.MANAGE_INVITES);
      return;
    }

    completeOnboarding();
    navigation.reset({
      index: 0,
      routes: [{ name: ScreenNames.HOME_TABS }],
    });
  }, [completeOnboarding, fromManageInvites, isSharedAccessActive, navigation]);

  const handleEmailChange = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const addAnotherEmail = () => {
    if (emails.length < 2) {
      setEmails([...emails, '']);
    }
  };

  const removeEmail = (index: number) => {
    if (emails.length > 1) {
      const newEmails = emails.filter((_, i) => i !== index);
      setEmails(newEmails);
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleNext = async () => {
    const validEmails = emails.filter(email => email.trim() !== '');
    
    if (validEmails.length === 0) {
      Alert.alert('Error', 'Please enter at least one email address');
      return;
    }

    const invalidEmails = validEmails.filter(email => !validateEmail(email));
    if (invalidEmails.length > 0) {
      Alert.alert('Error', `Please enter valid email addresses:\n${invalidEmails.join('\n')}`);
      return;
    }

    // Ensure user is authenticated before sending invites
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        Alert.alert(
          'Authentication Required',
          'You must be signed in to send invites. Please sign in and try again.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate(ScreenNames.SIGN_IN),
            },
          ]
        );
        return;
      }
    } catch (authError) {
      Alert.alert(
        'Authentication Error',
        'Unable to verify your authentication status. Please sign in and try again.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate(ScreenNames.SIGN_IN),
          },
        ]
      );
      return;
    }

    setIsLoading(true);

    try {
      const invitationPromises = validEmails.map(email =>
        invitationService.createInvitation({ email })
      );

      await Promise.all(invitationPromises);

      showSuccessNotification(
          `Invite sent successfully to ${validEmails.length} ${validEmails.length === 1 ? 'loved one' : 'loved ones'}!`,
          'Invites Sent'
      );

      if (fromManageInvites) {
        returnToManageInvites();
      } else {
        setCurrentStep(ScreenNames.TRIAL_WELCOME);
        navigation.navigate(ScreenNames.TRIAL_WELCOME);
      }
    
    } catch (error: unknown) {
      showAppwriteError(error, {
        title: 'Failed to Send Invites',
        skipUnauthorized: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    if (fromManageInvites) {
      returnToManageInvites();
      return;
    }
    setCurrentStep(ScreenNames.TRIAL_WELCOME);
    navigation.navigate(ScreenNames.TRIAL_WELCOME);
  };

  const isNextEnabled = emails.some(email => email.trim() !== '' && validateEmail(email.trim()));

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.backgroundContainer}>
          <Canvas style={styles.backgroundCanvas}>
            <SkiaImage image={bg} x={0} y={0} width={width} height={300} fit="cover" />
          </Canvas>
        </View>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
          <View style={styles.loadingContainer}>
            <LoadingSpinner />
            <Text style={styles.loadingText}>Sending invites...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.backgroundContainer}>
        <Canvas style={styles.backgroundCanvas}>
          <SkiaImage image={bg} x={0} y={0} width={width} height={300} fit="cover" />
        </Canvas>
      </View>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <ArrowLeftIcon />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Nevermore</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>
              BUILD A CIRCLE OF THOSE YOU TRUST, ONE CONNECTION AT A TIME.
            </Text>

            <View style={styles.inviteLimitContainer}>
              <AccountIcon width={22} height={22} color="#8B5CF6" />
              <Text style={styles.inviteLimitText}>You can send up to 2 active invites.</Text>
            </View>
            
            <View style={styles.emailSection}>
              {emails.map((email, index) => (
                <View key={index} style={styles.emailInputContainer}>
                  <View style={styles.inputRow}>
                    <View style={styles.inputWrapper}>
                      <Input
                        label="Email"
                        placeholder="example@email.com"
                        value={email}
                        onChangeText={(value) => handleEmailChange(index, value)}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                    {emails.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeEmail(index)}
                        style={styles.removeButton}
                      >
                        <Text style={styles.removeButtonText}>×</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}

              {emails.length < 2 && (
                <TouchableOpacity
                  onPress={addAnotherEmail}
                  style={styles.addAnotherContainer}
                >
                  <PlusIcon width={20} height={20} color="#8B5CF6" />
                  <Text style={styles.addAnotherText}>Add another</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <Button
              title="Next"
              onPress={handleNext}
              variant="primary"
              size="medium"
              disabled={!isNextEnabled}
              style={styles.nextButton}
            />
            <SecondaryButton
              title="Skip"
              onPress={handleSkip}
              size="medium"
              style={styles.skipButton}
              textStyle={styles.skipButtonText}
            />
          </View>
        </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    zIndex: 0,
  },
  backgroundCanvas: {
    height: 300,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
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
    fontFamily: 'Cinzel_600SemiBold',
  },
  headerSpacer: {
    width: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 28,
    fontFamily: 'Cinzel_600SemiBold',
    textAlign: 'left',
    lineHeight: 26,
  },
  inviteLimitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(139, 92, 246, 0.32)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 28,
  },
  inviteLimitText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.78)',
    marginLeft: 10,
    fontFamily: 'Roboto_400Regular',
    lineHeight: 20,
  },
  emailSection: {
    flex: 1,
  },
  emailInputContainer: {
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  inputWrapper: {
    flex: 1,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ff4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  removeButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'Roboto_500Medium',
  },
  addAnotherContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  addAnotherText: {
    fontSize: 16,
    color: '#8B5CF6',
    marginLeft: 8,
    fontFamily: 'Roboto_500Medium',
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  nextButton: {
    marginBottom: 12,
  },
  skipButton: {
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#8B5CF6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'Roboto_400Regular',
  },
});
