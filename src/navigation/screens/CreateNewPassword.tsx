import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Input } from '../../components/Input';
import { PasswordInput } from '../../components/PasswordInput';
import { Button } from '../../components/Button';
import { ScreenNames } from '../../constants/ScreenNames';
import ArrowLeftIcon from '../../assets/icons/arrow-left';
import CheckIcon from '../../assets/icons/check';
import { updatePasswordRecovery } from '../../services/auth.service';
import { showAppwriteError } from '../../services/notifications';

type RootStackParamList = {
  [ScreenNames.HOME_TABS]: undefined;
  [ScreenNames.SIGN_IN]: undefined;
  [ScreenNames.CREATE_NEW_PASSWORD]: {
    userId?: string;
    secret?: string;
  };
};

type CreateNewPasswordRouteProp = RouteProp<RootStackParamList, ScreenNames.CREATE_NEW_PASSWORD>;
type CreateNewPasswordNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const CreateNewPassword: React.FC = () => {
  const navigation = useNavigation<CreateNewPasswordNavigationProp>();
  const route = useRoute<CreateNewPasswordRouteProp>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const userId = route.params?.userId;
  const secret = route.params?.secret;

  const hasCapitalLetter = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const isMinLength = password.length >= 8;
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const isValidPassword = hasCapitalLetter && hasNumber && hasSpecialChar && isMinLength && passwordsMatch;

  const isFromDeepLink = !!(userId && secret);

  useEffect(() => {
    if (isFromDeepLink && (!userId || !secret)) {
      setErrorMessage('Invalid password reset link. Please request a new one.');
    }
  }, [userId, secret, isFromDeepLink]);

  const handleResetPassword = async () => {
    if (!isValidPassword) {
      return;
    }

    if (isFromDeepLink && userId && secret) {
      setIsLoading(true);
      setErrorMessage('');
      
      try {
        await updatePasswordRecovery(userId, secret, password);
        Alert.alert(
          'Success',
          'Your password has been reset successfully. Please sign in with your new password.',
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: ScreenNames.SIGN_IN }],
                });
              },
            },
          ]
        );
      } catch (error: unknown) {
        showAppwriteError(error, { skipUnauthorized: true });
        const errorMsg = error instanceof Error ? error.message : 'Failed to reset password. Please try again.';
        setErrorMessage(errorMsg);
      } finally {
        setIsLoading(false);
      }
    } else {
      setErrorMessage('Invalid password reset link. Please request a new one.');
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
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <ArrowLeftIcon width={24} height={24} color="#ffffff" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Nevermore</Text>
              <View style={styles.headerSpacer} />
            </View>

            <View style={styles.content}>
              <Text style={styles.title}>CREATE NEW PASSWORD</Text>

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
                containerStyle={passwordsMatch ? styles.passwordMatchContainer : undefined}
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
                title="Reset Password"
                onPress={handleResetPassword}
                loading={isLoading}
                disabled={!isValidPassword}
                style={styles.createButton}
                size="large"
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
    marginBottom: 40,
    fontFamily: 'Roboto_700Bold',
    letterSpacing: 0.5,
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
  },
  requirementText: {
    fontSize: 14,
    color: '#ffffff',
    fontFamily: 'Roboto_400Regular',
  },
  createButton: {
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
