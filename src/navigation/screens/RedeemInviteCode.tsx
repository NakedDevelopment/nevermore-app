import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ArrowLeftIcon from '../../assets/icons/arrow-left';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { codeRedemptionService } from '../../services/codeRedemption.service';
import { usePendingInviteStore } from '../../store/pendingInvite.store';

// Entry point for someone who received either a subscriber's shared-access
// invitation or an administrator-issued access code (pilot/research/bulk/
// promo) — the recipient never has to know which. Acceptance no longer
// depends on a deep link surviving the app-store round trip: the recipient
// installs Nevermore, opens it, and types the code from their email here
// instead. Redemption happens automatically right after they sign up/in (see
// authStore) since accepting either kind of code requires an authenticated
// session either way, so the code is held in pendingInvite.store until then
// and the user never has to re-enter it.
const INVITATION_ERROR_MESSAGES: Record<string, string> = {
  not_found: 'The code entered could not be found. Please check the code and try again.',
  expired: 'This invitation has expired. Please ask the subscriber to send you a new invitation.',
  accepted: 'This invitation has already been accepted.',
  revoked: 'This invitation is no longer active. Please contact the person who invited you.',
  invalid: 'Enter the invitation code from your email.',
};

const ACCESS_CODE_ERROR_MESSAGES: Record<string, string> = {
  not_found: 'The code entered could not be found. Please check the code and try again.',
  expired: 'This code has expired. Please request a new one.',
  redemption_limit: 'This code has already been used.',
  inactive: 'This code is no longer active. Please contact whoever provided it.',
  invalid: 'Enter the code from your email.',
};

const GENERIC_ERROR_MESSAGES: Record<string, string> = {
  not_found: 'The code entered could not be found. Please check the code and try again.',
  invalid: 'Enter the invitation code from your email.',
};

export function RedeemInviteCode() {
  const { goBack, navigateToSignUp, navigateToSignIn } = useAppNavigation();
  const [code, setCode] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Shared by both "Continue" (new account) and "Sign In" (existing
  // account) — either way the code must be validated and stashed before
  // authentication happens, so it can be redeemed automatically afterward.
  const validateAndStoreCode = async (): Promise<boolean> => {
    if (!code.trim()) {
      setErrorMessage(GENERIC_ERROR_MESSAGES.invalid);
      return false;
    }

    setErrorMessage('');
    setIsChecking(true);
    try {
      const result = await codeRedemptionService.classifyCode(code);

      if (!result.ok) {
        const messages = result.kind === 'invitation'
          ? INVITATION_ERROR_MESSAGES
          : result.kind === 'access_code'
            ? ACCESS_CODE_ERROR_MESSAGES
            : GENERIC_ERROR_MESSAGES;
        setErrorMessage(messages[result.reason]);
        return false;
      }

      // Store the canonical code from the record, not the user's raw input,
      // so casing/whitespace differences can't cause a mismatch when
      // authStore redeems it after sign-up/sign-in.
      usePendingInviteStore.getState().setCode(result.code);
      return true;
    } catch {
      setErrorMessage('Something went wrong checking that code. Please try again.');
      return false;
    } finally {
      setIsChecking(false);
    }
  };

  const handleContinue = async () => {
    if (await validateAndStoreCode()) {
      navigateToSignUp();
    }
  };

  const handleSignIn = async () => {
    if (await validateAndStoreCode()) {
      navigateToSignIn();
    }
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
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardAvoidingView}
          >
            <View style={styles.header}>
              <TouchableOpacity onPress={goBack}>
                <ArrowLeftIcon />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Nevermore</Text>
              <View style={styles.headerSpacer} />
            </View>

            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.title}>Enter Invitation Code</Text>
              <Text style={styles.description}>
                Enter the invitation code from your email. You'll create your
                account next, then join automatically.
              </Text>

              <Input
                testID="redeem-invite-code-input"
                label="Invitation Code"
                placeholder="NM-7X4K92"
                value={code}
                onChangeText={(value) => setCode(value.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                state={errorMessage ? 'error' : 'default'}
              />

              {errorMessage !== '' && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              <View style={styles.signInContainer}>
                <Text style={styles.signInText}>Already have an account? </Text>
                <TouchableOpacity
                  testID="redeem-invite-code-sign-in-link"
                  onPress={handleSignIn}
                  disabled={isChecking}
                >
                  <Text style={styles.signInLink}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.buttonContainer}>
              <Button
                testID="redeem-invite-code-continue-button"
                title={isChecking ? 'Checking...' : 'Continue'}
                onPress={handleContinue}
                variant="primary"
                size="medium"
                disabled={isChecking}
              />
            </View>
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
    fontFamily: 'Roboto_700Bold',
  },
  headerSpacer: {
    width: 24,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
  },
  title: {
    fontSize: 32,
    color: '#ffffff',
    marginBottom: 16,
    fontFamily: 'Cinzel_400Regular',
  },
  description: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 32,
    fontFamily: 'Roboto_400Regular',
    lineHeight: 24,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    fontFamily: 'Roboto_400Regular',
    textAlign: 'center',
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
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
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
});
