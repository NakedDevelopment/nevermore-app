import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Canvas, Image as SkiaImage, useImage } from '@shopify/react-native-skia';
import CheckmarkIcon from '../../assets/icons/checkmark';
import { Button } from '../../components/Button';
import { ScreenNames } from '../../constants/ScreenNames';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useTrialStore } from '../../store/trialStore';
import { useAuthStore } from '../../store/authStore';
import { useSharedAccessStore } from '../../store/sharedAccessStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { usePushNotificationStore } from '../../store/pushNotificationStore';
import { useAdminAccessStore } from '../../store/adminAccessStore';

type PlanType = 'monthly' | 'yearly';

function getYearlyPerMonthHint(displayPrice: string, price?: number): string | null {
  if (!price) return null;
  const currencySymbol = displayPrice.match(/^[^\d]+/)?.[0] || '$';
  return `~${currencySymbol}${(price / 12).toFixed(2)}/month`;
}

export function TrialWelcome() {
  const navigation = useNavigation<any>();
  const width = Dimensions.get('window').width;
  const height = Dimensions.get('window').height;
  const bg = useImage(require('../../assets/gradient.png'));
  const [hasCheckedSharedAccess, setHasCheckedSharedAccess] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('yearly');

  const { completeOnboarding, setCurrentStep } = useOnboardingStore();
  const { startTrial } = useTrialStore();
  const userId = useAuthStore((s) => s.user?.$id);
  const isSharedAccessActive = useSharedAccessStore((s) => s.isSharedAccessActive);
  const isAdminAccessActive = useAdminAccessStore((s) => s.isAdminAccessActive);
  const refreshSharedAccess = useSharedAccessStore((s) => s.refreshSharedAccess);
  const refreshAdminAccess = useAdminAccessStore((s) => s.refreshAdminAccess);
  const {
    isSubscribed,
    isLoading,
    error,
    products,
    loadProducts,
    purchaseSubscriptionForPlan,
    restorePurchases,
    getRestorePurchaseStatus,
    setError,
    checkSubscription,
  } = useSubscriptionStore();

  useEffect(() => {
    if (!userId) {
      setHasCheckedSharedAccess(true);
      return;
    }

    let isMounted = true;
    Promise.all([refreshSharedAccess(), refreshAdminAccess()])
      .finally(() => {
        if (isMounted) {
          setHasCheckedSharedAccess(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [refreshAdminAccess, refreshSharedAccess, userId]);

  useEffect(() => {
    loadProducts();
    checkSubscription();
  }, [loadProducts, checkSubscription]);

  const proceedAfterTrial = useCallback(() => {
    const optInDone = usePushNotificationStore.getState().optInScreenCompleted;
    if (optInDone) {
      completeOnboarding();
      navigation.reset({
        index: 0,
        routes: [{ name: ScreenNames.HOME_TABS }],
      });
      return;
    }
    setCurrentStep(ScreenNames.NOTIFICATION_OPT_IN);
    navigation.reset({
      index: 0,
      routes: [{ name: ScreenNames.NOTIFICATION_OPT_IN }],
    });
  }, [completeOnboarding, navigation, setCurrentStep]);

  useEffect(() => {
    if (!isSharedAccessActive) return;
    proceedAfterTrial();
  }, [proceedAfterTrial, isSharedAccessActive]);

  useEffect(() => {
    if (!isAdminAccessActive) return;
    proceedAfterTrial();
  }, [isAdminAccessActive, proceedAfterTrial]);

  useEffect(() => {
    if (!hasCheckedSharedAccess || isSharedAccessActive || isAdminAccessActive || !isSubscribed) return;
    proceedAfterTrial();
  }, [proceedAfterTrial, hasCheckedSharedAccess, isSharedAccessActive, isAdminAccessActive, isSubscribed]);

  const yearlyPrice = products.yearly?.displayPrice || '—';
  const monthlyPrice = products.monthly?.displayPrice || '—';
  const yearlyPerMonthHint = products.yearly
    ? getYearlyPerMonthHint(products.yearly.displayPrice, products.yearly.price)
    : null;

  const handleStartTrial = async () => {
    if (!userId) return;
    setError(null);
    try {
      const success = await purchaseSubscriptionForPlan(selectedPlan);
      if (!success) return;

      await startTrial(userId);
      proceedAfterTrial();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to start trial. Please try again.';
      setError(message);
    }
  };

  const handleRestore = async () => {
    setError(null);
    try {
      const success = await restorePurchases();
      if (success) {
        if (userId) {
          await startTrial(userId);
        }
        proceedAfterTrial();
        return;
      }

      const restoreStatus = await getRestorePurchaseStatus();
      if (restoreStatus === 'previous-expired') {
        setError(
          'We found a previous subscription for this store account, but it is no longer active. Choose a plan to subscribe again.'
        );
      } else {
        Alert.alert(
          'No Previous Subscription Found',
          'We could not find a previous subscription for this store account. Choose a plan to start your 3-day free trial.'
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to restore purchases. Please try again.';
      setError(message);
    }
  };

  const renderPlanCard = (
    planType: PlanType,
    title: string,
    price: string,
    isSelected: boolean,
    subline: string
  ) => {
    const planLabel = planType === 'monthly' ? 'Monthly' : 'Yearly';
    const isYearly = planType === 'yearly';
    const benefits = isYearly
      ? [
          'Full access to all 40 guided temptations',
          'Complete 40-day behavior-change system',
          'Dual perspective content (Recovery + Support)',
          'Unlimited access to audio, transcripts, and exercises',
        ]
      : [
          'Full access to the Nevermore experience',
          'All content, audio, and exercises included',
          'Cancel anytime',
        ];

    return (
      <TouchableOpacity
        style={[styles.planCard, isSelected && styles.planCardSelected]}
        onPress={() => {
          if (!isSelected) setSelectedPlan(planType);
        }}
        disabled={isLoading || isSelected}
      >
        <ImageBackground
          source={require('../../assets/card-bg.png')}
          style={styles.planHeader}
          imageStyle={styles.planHeaderImage}
        >
          <Text style={styles.planTitle}>{title}</Text>
          <Text style={styles.planSubline}>{subline}</Text>
        </ImageBackground>

        <View style={styles.planContent}>
          <View style={styles.benefitsContainer}>
            {benefits.map((benefit, index) => (
              <View key={index} style={styles.benefitRow}>
                <CheckmarkIcon width={16} height={16} color="#8B5CF6" />
                <Text style={styles.benefitText}>{benefit}</Text>
              </View>
            ))}
          </View>

          <View style={styles.planFooter}>
            <View style={styles.planSelection}>
              <View style={styles.radioButton}>
                {isSelected && <View style={styles.radioButtonInner} />}
              </View>
              <Text style={styles.planLabel}>{planLabel}</Text>
            </View>

            <View style={styles.priceContainer}>
              <Text style={styles.price}>{price || '—'}</Text>
              <Text style={styles.priceUnit}>{isYearly ? '/year' : '/month'}</Text>
              {isYearly && yearlyPerMonthHint ? (
                <Text style={styles.priceHint}>{yearlyPerMonthHint}</Text>
              ) : null}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (!hasCheckedSharedAccess || isSharedAccessActive || isAdminAccessActive) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <ActivityIndicator color="#8B5CF6" style={styles.loadingIndicator} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.backgroundContainer}>
        <Canvas style={styles.backgroundCanvas}>
          <SkiaImage image={bg} x={0} y={0} width={width} height={height} fit="cover" />
        </Canvas>
      </View>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text style={styles.headerTitle}>Nevermore</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>START YOUR FREE TRIAL</Text>
          <Text style={styles.description}>
            Choose a plan to begin your{' '}
            <Text style={styles.descriptionHighlight}>3-day free trial</Text>. You will not be charged during
            the trial; your selected plan starts afterward unless you cancel.
          </Text>

          <View style={styles.plansContainer}>
            {renderPlanCard(
              'yearly',
              'YEARLY',
              yearlyPrice,
              selectedPlan === 'yearly',
              '★ Best value'
            )}
            {renderPlanCard(
              'monthly',
              'MONTHLY',
              monthlyPrice,
              selectedPlan === 'monthly',
              'Flexible access'
            )}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.buttonContainer}>
          <Button
            title={isLoading ? 'Processing...' : 'Start my 3 free days'}
            onPress={handleStartTrial}
            variant="primary"
            size="medium"
            disabled={isLoading}
          />
          <TouchableOpacity style={styles.restoreButton} onPress={handleRestore} disabled={isLoading}>
            <Text style={styles.restoreButtonText}>Restore Purchases</Text>
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
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  backgroundCanvas: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    zIndex: 1,
  },
  loadingIndicator: {
    flex: 1,
    alignSelf: 'center',
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
    height: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    color: '#ffffff',
    marginBottom: 16,
    fontFamily: 'Cinzel_400Regular',
    textAlign: 'left',
  },
  description: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 24,
    fontFamily: 'Roboto_400Regular',
    lineHeight: 24,
  },
  descriptionHighlight: {
    color: '#8B5CF6',
  },
  plansContainer: {
    marginBottom: 12,
  },
  planCard: {
    backgroundColor: '#000000',
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#333333',
  },
  planCardSelected: {
    borderColor: '#8B5CF6',
  },
  planHeader: {
    backgroundColor: '#8B5CF6',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  planHeaderImage: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    resizeMode: 'cover',
    transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }],
  },
  planTitle: {
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'Cinzel_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  planSubline: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Roboto_400Regular',
    textAlign: 'center',
    marginTop: 4,
  },
  planContent: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  benefitsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitText: {
    fontSize: 16,
    color: '#ffffff',
    marginLeft: 12,
    fontFamily: 'Roboto_400Regular',
  },
  planFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
  },
  planSelection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#777777',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#8B5CF6',
  },
  planLabel: {
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'Roboto_500Medium',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '700',
  },
  priceUnit: {
    fontSize: 12,
    color: '#CCCCCC',
    fontFamily: 'Roboto_400Regular',
    marginTop: 2,
  },
  priceHint: {
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: 'Roboto_400Regular',
    marginTop: 2,
  },
  errorText: {
    fontSize: 14,
    color: '#ff6b6b',
    marginBottom: 8,
    fontFamily: 'Roboto_400Regular',
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 4,
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  restoreButtonText: {
    color: '#8B5CF6',
    fontSize: 14,
    fontFamily: 'Roboto_500Medium',
  },
});