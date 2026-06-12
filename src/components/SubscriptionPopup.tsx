import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ImageBackground,
  Alert,
} from 'react-native';
import CheckmarkIcon from '../assets/icons/checkmark';
import { Button } from './Button';
import { useSharedAccessStore } from '../store/sharedAccessStore';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { getIAPProductIds } from '../services/iap.service';

type PlanType = 'monthly' | 'yearly';

const DISPLAY_PRICES = {
  monthly: '$13.99',
  yearly: '$99',
  yearlyPerMonth: '~$8.25 / month equivalent',
};

interface SubscriptionPopupProps {
  isVisible: boolean;
  onClose: () => void;
  onSubscribeSuccess?: () => void;
}

export function SubscriptionPopup({
  isVisible,
  onClose,
  onSubscribeSuccess,
}: SubscriptionPopupProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const {
    isSubscribed,
    isLoading,
    error,
    purchaseSubscription,
    restorePurchases,
    getRestorePurchaseStatus,
    setError,
  } = useSubscriptionStore();
  const markSharedAccessUpgraded = useSharedAccessStore((s) => s.markSharedAccessUpgraded);

  const [selectedPlan, setSelectedPlan] = React.useState<PlanType>('monthly');

  const snapPoints = useMemo(() => ['75%'], []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        onPress={() => bottomSheetRef.current?.close()}
        style={[props.style, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}
      />
    ),
    []
  );

  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isVisible) {
      bottomSheetRef.current?.expand();
      setError(null);
    } else {
      bottomSheetRef.current?.close();
    }
  }, [isVisible, setError]);

  useEffect(() => {
    if (isSubscribed && isVisible) {
      onSubscribeSuccess?.();
      onClose();
    }
  }, [isSubscribed, isVisible, onSubscribeSuccess, onClose]);

  const handleSubscribe = useCallback(async () => {
    const productIds = getIAPProductIds();
    const productId = productIds[selectedPlan];
    const success = await purchaseSubscription(productId);
    if (success) {
      if (useSharedAccessStore.getState().isSharedAccessActive) {
        await markSharedAccessUpgraded();
      }
      onSubscribeSuccess?.();
      onClose();
    }
  }, [selectedPlan, purchaseSubscription, markSharedAccessUpgraded, onSubscribeSuccess, onClose]);

  const handleRestore = useCallback(async () => {
    const success = await restorePurchases();
    if (success) {
      if (useSharedAccessStore.getState().isSharedAccessActive) {
        await markSharedAccessUpgraded();
      }
      onSubscribeSuccess?.();
      onClose();
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
  }, [restorePurchases, getRestorePurchaseStatus, setError, markSharedAccessUpgraded, onSubscribeSuccess, onClose]);

  const benefits = [
    'Full access to all temptations',
    'Full 40-day challenge',
    'Cancel anytime',
    'New content as we add it',
  ];

  const renderPlanCard = (
    planType: PlanType,
    title: string,
    price: string,
    isSelected: boolean
  ) => {
    const isYearly = planType === 'yearly';
    const planLabel = planType === 'monthly' ? 'Monthly' : 'Yearly';

    return (
      <TouchableOpacity
        key={planType}
        style={[styles.planCard, isSelected && styles.planCardSelected]}
        onPress={() => {
          if (!isSelected) setSelectedPlan(planType);
        }}
        disabled={isLoading || isSelected}
      >
        <ImageBackground
          source={require('../assets/card-bg.png')}
          style={styles.planHeader}
          imageStyle={styles.planHeaderImage}
        >
          <Text style={styles.planTitle}>{title}</Text>
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
              <Text style={styles.price}>{price}</Text>
              <Text style={styles.priceUnit}>{isYearly ? 'per year' : 'per month'}</Text>
              {isYearly && <Text style={styles.priceHint}>{DISPLAY_PRICES.yearlyPerMonth}</Text>}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      backdropComponent={renderBackdrop}
      enablePanDownToClose
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
      style={styles.bottomSheet}
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Unlock full access</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => bottomSheetRef.current?.close()}
            activeOpacity={0.7}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.description}>
          You have 3 free days. After that you must subscribe to continue.
        </Text>

        <View style={styles.plansContainer}>
          {renderPlanCard('monthly', 'MONTHLY', DISPLAY_PRICES.monthly, selectedPlan === 'monthly')}
          {renderPlanCard('yearly', 'YEARLY', DISPLAY_PRICES.yearly, selectedPlan === 'yearly')}
        </View>

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        <View style={styles.buttonContainer}>
          <Button
            title={isLoading ? 'Processing...' : 'Subscribe'}
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
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  bottomSheet: {
    zIndex: 9999,
    elevation: 9999,
  },
  bottomSheetBackground: {
    backgroundColor: '#000000',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    borderTopWidth: 1,
    borderTopColor: '#282828',
  },
  handleIndicator: {
    backgroundColor: '#666666',
    width: 40,
    height: 3,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    paddingTop: 30,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'Cinzel_600SemiBold',
    flex: 1,
  },
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 24,
    fontFamily: 'Roboto_400Regular',
    lineHeight: 24,
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
    overflow: 'hidden',
  },
  planCardSelected: {
    borderColor: '#8B5CF6',
  },
  planHeader: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 24,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  planHeaderImage: {
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
    fontSize: 14,
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
    marginHorizontal: 16,
    marginBottom: 8,
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
    marginBottom: 12,
    fontFamily: 'Roboto_400Regular',
  },
  buttonContainer: {
    paddingTop: 8,
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
});
