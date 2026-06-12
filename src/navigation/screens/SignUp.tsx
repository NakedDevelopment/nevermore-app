import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CheckIcon from '../../assets/icons/check';
import ArrowLeftIcon from '../../assets/icons/arrow-left';
import { Input } from '../../components/Input';
import { PasswordInput } from '../../components/PasswordInput';
import { Button } from '../../components/Button';
import { useSignUp } from '../../hooks/useSignUp';
import { useAppNavigation } from '../../hooks/useAppNavigation';

export function SignUp() {
  const { 
    goBack, 
    navigateToPermission,
    navigateToSignIn, 
    navigateToTermsConditions, 
    navigateToPrivacyPolicy 
  } = useAppNavigation();
  const { isLoading, validatePasswordRequirements, handleSignUp: signUpUser } = useSignUp();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isEmailValid = validateEmail(email);
  const requirements = validatePasswordRequirements(password, confirmPassword);

  const handleSignUp = async () => {
    setErrorMessage(''); // Clear previous errors
    await signUpUser(
      {
        email,
        password,
        confirmPassword,
        agreeToTerms,
        fullName: email.split('@')[0],
      },
      {
        onSuccess: () => {
          // Onboarding step is now set in authStore.signUp
          // Just navigate to Permission screen
          navigateToPermission();
        },
        onError: (error) => {
          console.error('Sign up failed:', error);
          setErrorMessage(error.message || 'An error occurred during sign up. Please try again.');
        },
      }
    );
  };

  const handleTermsPress = () => {
    navigateToTermsConditions();
  };

  const handlePrivacyPress = () => {
    navigateToPrivacyPolicy();
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
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingView}
          >
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <View style={styles.header}>
                <TouchableOpacity onPress={goBack}>
                  <ArrowLeftIcon />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Nevermore</Text>
                <View style={styles.headerSpacer} />
              </View>

              <View style={styles.content}>
                <Text style={styles.title}>CREATE YOUR ACCOUNT</Text>
                <Text style={styles.subtitle}>Enter your information below.</Text>

                <Input
                  label="Email"
                  placeholder="Enter Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="username"
                  autoComplete="email"
                />

                <PasswordInput
                  label="Password"
                  placeholder="Enter password"
                  value={password}
                  onChangeText={setPassword}
                  showPassword={showPassword}
                  onTogglePassword={() => setShowPassword(!showPassword)}
                  autoCapitalize="none"
                  autoCorrect={false}
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
                />

                {isEmailValid && (
                  <View style={styles.requirementsContainer}>
                    <View style={styles.requirementItem}>
                      {requirements.minLength ? <CheckIcon stroke="#8b5cf6" /> : <View style={styles.dotIcon} />}
                      <Text style={[styles.requirementText, requirements.minLength && styles.requirementTextChecked]}>
                        At least 8 characters
                      </Text>
                    </View>

                    <View style={styles.requirementItem}>
                      {requirements.capital ? <CheckIcon stroke="#8b5cf6" /> : <View style={styles.dotIcon} />}
                      <Text style={[styles.requirementText, requirements.capital && styles.requirementTextChecked]}>
                        At least 1 capital letter
                      </Text>
                    </View>

                    <View style={styles.requirementItem}>
                      {requirements.numerical ? <CheckIcon stroke="#8b5cf6" /> : <View style={styles.dotIcon} />}
                      <Text style={[styles.requirementText, requirements.numerical && styles.requirementTextChecked]}>
                        At least 1 numerical value
                      </Text>
                    </View>

                    <View style={styles.requirementItem}>
                      {requirements.special ? <CheckIcon stroke="#8b5cf6" /> : <View style={styles.dotIcon} />}
                      <Text style={[styles.requirementText, requirements.special && styles.requirementTextChecked]}>
                        At least 1 special character
                      </Text>
                    </View>

                    <View style={styles.requirementItem}>
                      {requirements.match ? <CheckIcon stroke="#8b5cf6" /> : <View style={styles.dotIcon} />}
                      <Text style={[styles.requirementText, requirements.match && styles.requirementTextChecked]}>
                        Passwords match
                      </Text>
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.termsContainer}
                  onPress={() => setAgreeToTerms(!agreeToTerms)}
                  activeOpacity={1}
                >
                  <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]}>
                    {agreeToTerms && (
                      <CheckIcon color="#ffffff" />
                    )}
                  </View>
                  <View style={styles.termsTextContainer}>
                    <Text style={styles.termsText}>
                      I agree to the{' '}
                      <Text
                        style={styles.termsLink}
                        onPress={handleTermsPress}
                        suppressHighlighting
                      >
                        Terms & Conditions
                      </Text>
                      {' '}and{' '}
                      <Text
                        style={styles.termsLink}
                        onPress={handlePrivacyPress}
                        suppressHighlighting
                      >
                        Privacy Policy
                      </Text>
                    </Text>
                  </View>
                </TouchableOpacity>

                {errorMessage !== '' && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                )}

                <Button
                  title={isLoading ? "Creating Account..." : "Create Account"}
                  onPress={handleSignUp}
                  variant="primary"
                  size="medium"
                  disabled={
                    isLoading ||
                    !requirements.minLength ||
                    !requirements.capital ||
                    !requirements.numerical ||
                    !requirements.special ||
                    !requirements.match ||
                    !agreeToTerms
                  }
                  style={styles.createAccountButton}
                />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
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
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
    fontSize: 28,
    color: '#ffffff',
    marginBottom: 8,
    fontFamily: 'Cinzel_600SemiBold',
  },
  subtitle: {
    fontSize: 16,
    color: '#cccccc',
    marginBottom: 32,
    fontFamily: 'Roboto_400Regular',
  },
  requirementsContainer: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 8,
    fontFamily: 'Roboto_400Regular',
  },
  requirementTextChecked: {
    color: '#ffffff',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 1.5,
    borderColor: '#ffffff',
    borderRadius: 8,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  dotIcon: {
    width: 7,
    height: 7,
    borderRadius: 5,
    backgroundColor: '#999',
    marginRight: 6,
    marginLeft:2
  },
  termsTextContainer: {
    flex: 1,
  },
  termsText: {
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 20,
    fontFamily: 'Roboto_400Regular',
  },
  termsLink: {
    color: '#8b5cf6',
    fontFamily: 'Roboto_500Medium',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    fontFamily: 'Roboto_400Regular',
    textAlign: 'center',
  },
  createAccountButton: {
    marginBottom: 24,
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  signInText: {
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'Roboto_400Regular',
  },
  signInLink: {
    fontSize: 16,
    color: '#8b5cf6',
    fontFamily: 'Roboto_500Medium',
  },
});
