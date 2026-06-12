import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PasswordInput } from '../../components/PasswordInput';
import { Button } from '../../components/Button';
import { ScreenNames } from '../../constants/ScreenNames';
import ArrowLeftIcon from '../../assets/icons/arrow-left';
import CheckIcon from '../../assets/icons/check';
import { account } from '../../services/appwrite.config';
import { showAppwriteError, showSuccessNotification } from '../../services/notifications';
import { useOnboardingStore } from '../../store/onboardingStore';

type SetPasswordNavigationProp = NativeStackNavigationProp<any>;

export const SetPassword: React.FC = () => {
  const navigation = useNavigation<SetPasswordNavigationProp>();
  const { setCurrentStep } = useOnboardingStore();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const hasCapitalLetter = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const isMinLength = password.length >= 8;
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const isValidPassword = hasCapitalLetter && hasNumber && hasSpecialChar && isMinLength && passwordsMatch;

  const handleSetPassword = async () => {
    if (!isValidPassword) {
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    
    try {
      // Update password for the currently authenticated user
      await account.updatePassword(password);
      
      showSuccessNotification(
        'Password set successfully!',
        'Success'
      );
      
      // Set onboarding step and navigate to onboarding flow
      setCurrentStep(ScreenNames.PERMISSION);
      navigation.reset({
        index: 0,
        routes: [{ name: ScreenNames.PERMISSION }],
      });
    } catch (error: unknown) {
      showAppwriteError(error, { skipUnauthorized: true });
      const errorMsg = error instanceof Error ? error.message : 'Failed to set password. Please try again.';
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <ImageBackground
        source={require('../../assets/gradient.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView 
            style={styles.keyboardAvoidingView}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.header}>
              <TouchableOpacity onPress={handleBack} style={styles.backButton} testID="back-button">
                <ArrowLeftIcon width={24} height={24} color="#ffffff" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Nevermore</Text>
              <View style={styles.headerSpacer} />
            </View>

            <View style={styles.content}>
              <Text style={styles.title}>CREATE YOUR ACCOUNT</Text>
              
              <Text style={styles.description}>
                Create a secure password to finish setting up your invited account.
              </Text>

              <PasswordInput
                label="Password"
                placeholder="Enter password"
                value={password}
                onChangeText={setPassword}
                showPassword={showPassword}
                onTogglePassword={() => setShowPassword(!showPassword)}
                autoCapitalize="none"
                autoCorrect={false}
                testID="set-password-new"
              />

              <PasswordInput
                label="Re-enter Password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                showPassword={showConfirmPassword}
                onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
                autoCapitalize="none"
                autoCorrect={false}
                containerStyle={passwordsMatch ? styles.passwordMatchContainer : undefined}
                testID="set-password-confirm"
              />

              {errorMessage !== '' && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              <View style={styles.requirementsContainer}>
                <View style={styles.requirementItem}>
                  <View style={[styles.checkIcon, hasCapitalLetter && styles.checkIconActive]}>
                    {hasCapitalLetter && <CheckIcon width={12} height={12} color="#ffffff" />}
                  </View>
                  <Text style={styles.requirementText}>At least 1 capital letter</Text>
                </View>

                <View style={styles.requirementItem}>
                  <View style={[styles.checkIcon, hasNumber && styles.checkIconActive]}>
                    {hasNumber && <CheckIcon width={12} height={12} color="#ffffff" />}
                  </View>
                  <Text style={styles.requirementText}>At least 1 numerical value</Text>
                </View>

                <View style={styles.requirementItem}>
                  <View style={[styles.checkIcon, hasSpecialChar && styles.checkIconActive]}>
                    {hasSpecialChar && <CheckIcon width={12} height={12} color="#ffffff" />}
                  </View>
                  <Text style={styles.requirementText}>At least 1 special character</Text>
                </View>

                <View style={styles.requirementItem}>
                  <View style={[styles.checkIcon, isMinLength && styles.checkIconActive]}>
                    {isMinLength && <CheckIcon width={12} height={12} color="#ffffff" />}
                  </View>
                  <Text style={styles.requirementText}>Minimum 8 characters</Text>
                </View>

                <View style={styles.requirementItem}>
                  <View style={[styles.checkIcon, passwordsMatch && styles.checkIconActive]}>
                    {passwordsMatch && <CheckIcon width={12} height={12} color="#ffffff" />}
                  </View>
                  <Text style={styles.requirementText}>Passwords match</Text>
                </View>
              </View>

              <Button
                title="Create Account"
                onPress={handleSetPassword}
                loading={isLoading}
                disabled={!isValidPassword}
                style={styles.continueButton}
                size="large"
                testID="set-password-submit"
              />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
};

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
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    fontFamily: 'Roboto_500Medium',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'Cinzel_400Regular',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 40,
    fontFamily: 'Roboto_400Regular',
    lineHeight: 24,
  },
  passwordMatchContainer: {
    borderColor: '#8b5cf6',
  },
  requirementsContainer: {
    marginTop: 20,
    marginBottom: 30,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#666666',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkIconActive: {
    borderColor: '#8b5cf6',
    backgroundColor: '#8b5cf6',
  },
  requirementText: {
    fontSize: 14,
    color: '#ffffff',
    fontFamily: 'Roboto_400Regular',
  },
  continueButton: {
    marginTop: 'auto',
    marginBottom: 40,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    fontFamily: 'Roboto_400Regular',
    textAlign: 'center',
  },
});

