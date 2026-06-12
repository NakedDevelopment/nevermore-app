import React, { useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/Button';
import { ScreenNames } from '../../constants/ScreenNames';
import { useAuthStore } from '../../store/authStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';

export function TrialExpired() {
  const navigation = useNavigation<any>();
  const { signOut } = useAuthStore();
  const { restorePurchases, getRestorePurchaseStatus, isLoading } = useSubscriptionStore();

  const handleSubscribe = useCallback(() => {
    navigation.navigate(ScreenNames.SUBSCRIPTION);
  }, [navigation]);

  const handleRestore = useCallback(async () => {
    try {
      const success = await restorePurchases();
      if (success) {
        navigation.reset({
          index: 0,
          routes: [{ name: ScreenNames.HOME_TABS }],
        });
      } else {
        const restoreStatus = await getRestorePurchaseStatus();
        if (restoreStatus === 'previous-expired') {
          Alert.alert(
            'Subscription Not Active',
            'We found a previous subscription for this store account, but it is no longer active. Subscribe again to continue.'
          );
        } else {
          Alert.alert(
            'No Previous Subscription Found',
            'We could not find a previous subscription for this store account. Choose Subscribe to start access.'
          );
        }
      }
    } catch (e) {
      Alert.alert('Restore failed', e instanceof Error ? e.message : 'Please try again.');
    }
  }, [navigation, restorePurchases, getRestorePurchaseStatus]);

  const handleLogout = useCallback(async () => {
    await signOut();
    navigation.reset({
      index: 0,
      routes: [{ name: ScreenNames.WELCOME }],
    });
  }, [navigation, signOut]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Text style={styles.title}>TRIAL ENDED</Text>
          <Text style={styles.description}>
            Your 3-day free trial has ended. Subscribe to continue.
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title="Subscribe"
            onPress={handleSubscribe}
            variant="primary"
            size="medium"
            disabled={isLoading}
          />
          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleRestore}
            disabled={isLoading}
          >
            <Text style={styles.linkButtonText}>Restore Purchase</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleLogout}
            disabled={isLoading}
          >
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
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
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    color: '#ffffff',
    marginBottom: 16,
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
    gap: 12,
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  linkButtonText: {
    color: '#8B5CF6',
    fontSize: 14,
    fontFamily: 'Roboto_500Medium',
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 14,
    fontFamily: 'Roboto_500Medium',
  },
});
