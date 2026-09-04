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
import { invitationService } from '../../services/invitation.service';
import { usePendingInviteStore } from '../../store/pendingInvite.store';

// Entry point for someone who received an invite email but installed the app
// fresh from the store, so the original deep link (userId + secret + token)
// never reached the app. They copy the plain-text code from the email here
// instead; redemption happens automatically right after they sign up/in
// (see authStore) since accepting an invitation requires an authenticated
// session either way.
export function RedeemInviteCode() {
  const { goBack, navigateToSignUp, navigateToSignIn } = useAppNavigation();
  const [code, setCode] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleContinue = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setErrorMessage('Enter the invite code from your email.');
      return;
    }

    setErrorMessage('');
    setIsChecking(true);
    try {
      const invitation = await invitationService.getInvitationByToken(trimmed);

      if (!invitation) {
        setErrorMessage('That code doesn\'t match an invitation. Double-check it and try again.');
        return;
      }

      if (invitation.status !== 'pending') {
        setErrorMessage(`This invitation has already been ${invitation.status}.`);
        return;
      }

      usePendingInviteStore.getState().setCode(trimmed);
      navigateToSignUp();
    } catch {
      setErrorMessage('Something went wrong checking that code. Please try again.');
    } finally {
      setIsChecking(false);
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
              <Text style={styles.title}>Enter Invite Code</Text>
              <Text style={styles.description}>
                Paste the invite code from your email. You'll create your account
                next, then join automatically.
              </Text>

              <Input
                testID="redeem-invite-code-input"
                label="Invite Code"
                placeholder="Enter code"
                value={code}
                onChangeText={setCode}
                autoCapitalize="none"
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
                <TouchableOpacity testID="redeem-invite-code-sign-in-link" onPress={navigateToSignIn}>
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
