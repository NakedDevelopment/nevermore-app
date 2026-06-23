import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Dimensions,
  ImageBackground,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  Canvas,
  Image as SkiaImage,
  useImage
} from '@shopify/react-native-skia';
import ArrowLeftIcon from '../../assets/icons/arrow-left';
import CheckmarkIcon from '../../assets/icons/checkmark';
import { Button } from '../../components/Button';
import { ScreenNames } from '../../constants/ScreenNames';
import { useSharedAccessStore } from '../../store/sharedAccessStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { useTrialStore } from '../../store/trialStore';

type PlanType = 'monthly' | 'yearly';

const DISPLAY_PRICES = {
  monthly: '$13.99',
  yearly: '$99',
  yearlyPerMonth: '~$8.25/month',
};

export function Subscription() {
  const navigation = useNavigation<any>();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('yearly');
  const width = Dimensions.get('window').width;
  const bg = useImage(require('../../assets/gradient.png'));
  const {
    isSubscribed,
    activePlan,
    isLoading,
    error,
    presentPaywall,
    presentCustomerCenter,
    restorePurchases,
    getRestorePurchaseStatus,
    checkSubscription,
    loadProducts,
    setError,
  } = useSubscriptionStore();
  const isSharedAccessActive = useSharedAccessStore((s) => s.isSharedAccessActive);
  const markSharedAccessUpgraded = useSharedAccessStore((s) => s.markSharedAccessUpgraded);
  const isTrialExpired = useTrialStore((s) => s.isTrialExpired);
  const isUsingSharedSubscription = isSharedAccessActive;
  const hasOwnSubscription = isSubscribed && !isSharedAccessActive;
  const [hasCheckedSubscription, setHasCheckedSubscription] = useState(false);

  useEffect(() => {
    loadProducts();
    checkSubscription().finally(() => setHasCheckedSubscription(true));
  }, [loadProducts, checkSubscription]);

  const yearlyPrice = DISPLAY_PRICES.yearly;
  const monthlyPrice = DISPLAY_PRICES.monthly;
  const yearlyPerMonthHint = DISPLAY_PRICES.yearlyPerMonth;

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    const fallbackRoute = isUsingSharedSubscription
      ? ScreenNames.HOME_TABS
      : !hasOwnSubscription && isTrialExpired()
      ? ScreenNames.TRIAL_EXPIRED
      : ScreenNames.TRIAL_WELCOME;

    navigation.reset({
      index: 0,
      routes: [{ name: fallbackRoute }],
    });
  };

  const handleSubscribe = async () => {
    setError(null);
    try {
      const success = await presentPaywall();
      if (success) {
        if (useSharedAccessStore.getState().isSharedAccessActive) {
          await markSharedAccessUpgraded();
        }
        navigation.reset({
          index: 0,
          routes: [{ name: ScreenNames.HOME_TABS }],
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to start purchase. Please try again.');
    }
  };

  const handleManageSubscription = async () => {
    setError(null);
    try {
      await presentCustomerCenter();
    } catch (err: any) {
      setError(err?.message || 'Unable to open subscription center. Please try again.');
    }
  };

  const handleRestore = async () => {
    setError(null);
    try {
      const success = await restorePurchases();
      if (success) {
        if (useSharedAccessStore.getState().isSharedAccessActive) {
          await markSharedAccessUpgraded();
        }
        navigation.reset({
          index: 0,
          routes: [{ name: ScreenNames.HOME_TABS }],
        });
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
          'We could not find a previous subscription for this store account. Choose a plan to start your Nevermore subscription.'
        );
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to restore purchases. Please try again.');
    }
  };

  const yearlyBenefits = [
    'Full access to all 40 guided temptations',
    'Complete 40-day behavior-change system',
    'Dual perspective content (Recovery + Support)',
    'Unlimited access to audio, transcripts, and exercises',
  ];

  const monthlyBenefits = [
    'Full access to the Nevermore experience',
    'All content, audio, and exercises included',
    'Cancel anytime',
  ];

  const renderPlanCard = (
    planType: PlanType,
    title: string,
    price: string,
    isSelected: boolean
  ) => {
    const planLabel = planType === 'monthly' ? 'Monthly' : 'Yearly';
    const isYearly = planType === 'yearly';
    const benefits = isYearly ? yearlyBenefits : monthlyBenefits;

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
          {isYearly && (
            <Text style={styles.planSubline}>★ Recommended for the full 40-day experience</Text>
          )}
          {!isYearly && (
            <Text style={styles.planSubline}>Flexible access</Text>
          )}
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
              <View style={[styles.radioButton]}>
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.backgroundContainer}>
        <Canvas style={styles.backgroundCanvas}>
          <SkiaImage image={bg} x={0} y={0} width={width} height={300} fit="cover" />
        </Canvas>
      </View>
      <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack}>
              <ArrowLeftIcon />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Nevermore</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Main Content */}
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>SUBSCRIPTION</Text>
            
            {!hasOwnSubscription && !isUsingSharedSubscription && hasCheckedSubscription ? (
              <Text style={styles.description}>
                Start your <Text style={styles.descriptionHighlight}>3-day free trial</Text>. Continue anytime with a subscription.
              </Text>
            ) : null}

            {isUsingSharedSubscription ? (
              <View style={styles.sharedAccessCard}>
                <Text style={styles.sharedAccessTitle}>Create Your Own Support Circle</Text>
                <Text style={styles.sharedAccessText}>
                  You're currently using Nevermore through another member's subscription.
                </Text>
                <Text style={styles.sharedAccessText}>
                  To invite your own loved ones, you'll need your own Nevermore subscription.
                </Text>
              </View>
            ) : null}

            {!hasCheckedSubscription && !isUsingSharedSubscription ? (
              <View style={styles.subscriptionCheckContainer}>
                <ActivityIndicator size="small" color="#8B5CF6" />
                <Text style={styles.subscriptionCheckText}>Checking subscription...</Text>
              </View>
            ) : hasOwnSubscription ? (
              <>
                <View style={styles.subscribedContainer}>
                  <Text style={styles.subscribedText}>You have an active subscription</Text>
                </View>
                <View style={styles.plansContainer}>
                  {activePlan === 'monthly'
                    ? renderPlanCard('monthly', 'MONTHLY', monthlyPrice, true)
                    : activePlan === 'yearly'
                    ? renderPlanCard('yearly', 'YEARLY', yearlyPrice, true)
                    : (
                      <View style={styles.activePlanFallbackCard}>
                        <Text style={styles.activePlanFallbackTitle}>Active Plan</Text>
                        <Text style={styles.activePlanFallbackText}>
                          Your subscription is active. Restore purchases to refresh plan details if needed.
                        </Text>
                      </View>
                    )}
                </View>
                {error ? (
                  <Text style={styles.errorText}>{error}</Text>
                ) : null}
                <View style={styles.buttonContainer}>
                  <Button
                    title={isLoading ? 'Opening...' : 'Manage Subscription'}
                    onPress={handleManageSubscription}
                    variant="primary"
                    size="medium"
                    style={styles.subscribeButton}
                    disabled={isLoading}
                  />
                </View>
              </>
            ) : (
              <>
                {/* Subscription Plans */}
                <View style={styles.plansContainer}>
                  {renderPlanCard('yearly', 'YEARLY', yearlyPrice, selectedPlan === 'yearly')}
                  {renderPlanCard('monthly', 'MONTHLY', monthlyPrice, selectedPlan === 'monthly')}
                </View>

                {error ? (
                  <Text style={styles.errorText}>{error}</Text>
                ) : null}

                {/* Buttons */}
                <View style={styles.buttonContainer}>
                  <Button
                    title={isLoading ? 'Processing...' : isUsingSharedSubscription ? 'Get my own subscription' : 'Subscribe'}
                    onPress={handleSubscribe}
                    variant="primary"
                    size="medium"
                    style={styles.subscribeButton}
                    disabled={isLoading}
                  />
                  <TouchableOpacity
                    style={styles.restoreButton}
                    onPress={handleRestore}
                    disabled={isLoading}
                  >
                    <Text style={styles.restoreButtonText}>Restore Purchases</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
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
    zIndex: 1,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
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
    marginBottom: 32,
    fontFamily: 'Roboto_400Regular',
    lineHeight: 24,
  },
  descriptionHighlight: {
    color: '#8B5CF6',
  },
  sharedAccessCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(139, 92, 246, 0.35)',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
    marginBottom: 24,
  },
  sharedAccessTitle: {
    fontSize: 22,
    color: '#ffffff',
    fontFamily: 'Cinzel_600SemiBold',
    lineHeight: 30,
    marginBottom: 18,
  },
  sharedAccessText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.78)',
    fontFamily: 'Roboto_400Regular',
    lineHeight: 22,
    marginBottom: 14,
  },
  plansContainer: {
    marginBottom: 20,
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
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  subscribeButton: {
    marginBottom: 12,
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
  errorText: {
    fontSize: 14,
    color: '#ff6b6b',
    marginBottom: 12,
    fontFamily: 'Roboto_400Regular',
  },
  subscriptionCheckContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  subscriptionCheckText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.78)',
    fontFamily: 'Roboto_400Regular',
  },
  subscribedContainer: {
    paddingTop: 8,
    paddingBottom: 18,
  },
  subscribedText: {
    fontSize: 18,
    color: '#ffffff',
    fontFamily: 'Roboto_600SemiBold',
    marginBottom: 8,
  },
  subscribedSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Roboto_400Regular',
  },
  activePlanFallbackCard: {
    backgroundColor: '#000000',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#8B5CF6',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  activePlanFallbackTitle: {
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'Cinzel_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  activePlanFallbackText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.78)',
    fontFamily: 'Roboto_400Regular',
    lineHeight: 21,
  },
});
