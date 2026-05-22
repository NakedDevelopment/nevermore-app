import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ImageBackground,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ArrowLeftIcon from '../../assets/icons/arrow-left';
import { Button } from '../../components/Button';
import { ScreenNames } from '../../constants/ScreenNames';
import { RootStackParamList } from '../../hooks/useAppNavigation';
import { createPasswordRecovery, createMagicURLToken } from '../../services/auth.service';
import { showAppwriteError, showSuccessNotification } from '../../services/notifications';

type VerifyEmailRouteProp = RouteProp<RootStackParamList, ScreenNames.VERIFY_EMAIL>;
type VerifyEmailNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function VerifyEmail() {
  const navigation = useNavigation<VerifyEmailNavigationProp>();
  const route = useRoute<VerifyEmailRouteProp>();
  
  // Get the source parameter to determine which email to resend
  const source = route.params?.source || 'signup';
  const email = route.params?.email || '';
  const [isResending, setIsResending] = useState(false);

  const handleResendEmail = async () => {
    if (!email) {
      Alert.alert('Error', 'Email address is required to resend the verification email.');
      return;
    }

    setIsResending(true);
    
    try {
      if (source === 'forgot-password') {
        // Resend password recovery email
        await createPasswordRecovery(email);
        showSuccessNotification('Password recovery email has been resent. Please check your inbox.');
      } else {
        // Resend magic URL token for signup/verification
        await createMagicURLToken(email);
        showSuccessNotification('Verification email has been resent. Please check your inbox.');
      }
    } catch (error: unknown) {
      showAppwriteError(error, { skipUnauthorized: true });
    } finally {
      setIsResending(false);
    }
  };

  const handleDidntGetEmail = () => {
    navigation.navigate(ScreenNames.HELP_SUPPORT, {
      preSelectedReason: 'Technical Issue/Bug',
    });
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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <ArrowLeftIcon />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Nevermore</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Main Content */}
          <View style={styles.content}>
            <Text style={styles.title}>CHECK YOUR EMAIL</Text>
            
            <Text style={styles.instructionText}>
              A link to verify your email was sent to
            </Text>
            
            <Text style={styles.emailText}>{email || 'your email address'}</Text>
            
            <Text style={styles.spamText}>
              (Please check your spam folder if the email has not arrived after a few minutes).
            </Text>

            {/* Bottom Section */}
            <View style={styles.bottomSection}>
              <TouchableOpacity onPress={handleDidntGetEmail}>
                <Text style={styles.didntGetEmailText}>Didn't get an email?</Text>
              </TouchableOpacity>
              
              <Button
                title="Resend Email"
                onPress={handleResendEmail}
                variant="primary"
                size="medium"
                disabled={isResending}
              />
            </View>
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
    marginBottom: 24,
    fontFamily: 'Cinzel_400Regular',
  },
  instructionText: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 8,
    fontFamily: 'Roboto_400Regular',
  },
  emailText: {
    fontSize: 16,
    color: '#8b5cf6',
    marginBottom: 16,
    fontFamily: 'Roboto_500Medium',
  },
  spamText: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 40,
    fontFamily: 'Roboto_400Regular',
  },
  bottomSection: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 20,
  },
  didntGetEmailText: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'Roboto_500Medium',
  },
});
