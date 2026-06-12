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
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import ArrowLeftIcon from '../../assets/icons/arrow-left';
import { useSignIn } from '../../hooks/useSignIn';
import { useAppNavigation } from '../../hooks/useAppNavigation';

export const ForgotPassword: React.FC = () => {
  const { goBack, navigateToVerifyEmail } = useAppNavigation();
  const { isLoading, handlePasswordRecovery } = useSignIn();
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  const isEmailValid = validateEmail(email);

  const handleNext = async () => {
    setErrorMessage(''); // Clear previous errors
    await handlePasswordRecovery(
      email,
      {
        onSuccess: () => {
          navigateToVerifyEmail({ email, source: 'forgot-password' });
        },
        onError: (error) => {
          console.error('Password recovery failed:', error);
          setErrorMessage(error.message || 'Failed to send recovery email. Please try again.');
        },
      }
    );
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
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <ArrowLeftIcon width={24} height={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nevermore</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>Forgot Your Password?</Text>
          
          <Text style={styles.instructionText}>
            Enter your email and we will send a link to reset your password.
          </Text>

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholder="Enter email address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {errorMessage !== '' && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <Button
            title="Next"
            onPress={handleNext}
            disabled={isLoading || !isEmailValid}
            style={styles.nextButton}
            size="medium"
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
    color: '#ffffff',
    textAlign: 'left',
    marginBottom: 20,
    fontFamily: 'Cinzel_400Regular',
  },
  instructionText: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'left',
    marginBottom: 40,
    lineHeight: 24,
    fontFamily: 'Roboto_400Regular',
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
  nextButton: {
    marginTop: 'auto',
    marginBottom: 40,
  },
});
