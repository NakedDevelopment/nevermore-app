import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import {
    ActivityIndicator,
    Dimensions,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Canvas,
    Image as SkiaImage,
    useImage
} from '@shopify/react-native-skia';
import ArrowLeftIcon from '../../assets/icons/arrow-left';
import ArrowsIcon from '../../assets/icons/arrows';
import QuoteIcon from '../../assets/icons/quote';
import SmsIcon from '../../assets/icons/sms';
import VolumeIcon from '../../assets/icons/volume';
import { Button } from '../../components/Button';
import { SecondaryButton } from '../../components/SecondaryButton';
import { ScreenNames } from '../../constants/ScreenNames';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { useWelcomeQuote } from '../../hooks/useWelcomeQuote';
import { useOnboardingStore } from '../../store/onboardingStore';

type RootStackParamList = {
  [ScreenNames.INVITE]: undefined;
  [ScreenNames.INVITE_SEND]: undefined;
  [ScreenNames.HOME_TABS]: undefined;
  [ScreenNames.TRIAL_WELCOME]: undefined;
  [ScreenNames.SIGN_UP]: undefined;
  [ScreenNames.SET_PASSWORD]: undefined;
};

type InviteNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Onboarding step explaining shared-subscription invites to the inviter
// ("HOW IT WORKS" -> InviteSend). Accepting an invitation as the recipient
// happens on RedeemInviteCode + sign-up/sign-in instead — this screen no
// longer doubles as a deep-link landing page.
export function Invite() {
    const navigation = useNavigation<InviteNavigationProp>();
    const { navigateToInviteSend } = useAppNavigation();
    const { quote, loading: quoteLoading } = useWelcomeQuote();
    const { setCurrentStep } = useOnboardingStore();

    const width = Dimensions.get('window').width;
    const height = Dimensions.get('window').height;
    const bg = useImage(require('../../assets/gradient.png'));

    const handleNext = () => {
        setCurrentStep(ScreenNames.INVITE_SEND);
        navigateToInviteSend();
    };

    const handleSkip = () => {
        setCurrentStep(ScreenNames.TRIAL_WELCOME);
        navigation.navigate(ScreenNames.TRIAL_WELCOME);
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />
            <Canvas style={styles.canvas}>
                <SkiaImage image={bg} x={0} y={0} width={width} height={height} fit="cover" />
            </Canvas>
            <SafeAreaView style={styles.safeArea}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <ArrowLeftIcon />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Nevermore</Text>
                        <View style={styles.headerSpacer} />
                    </View>

                    <ScrollView
                        style={styles.content}
                        contentContainerStyle={styles.contentContainer}
                        showsVerticalScrollIndicator={false}
                    >
                        <Text style={styles.title}>INVITE A LOVED ONE</Text>

                        <Text style={styles.description}>
                            Whether you're here for yourself or supporting someone else, you're in the right place.
                        </Text>

                        <View style={styles.howItWorksSection}>
                            <Text style={styles.sectionTitle}>HOW IT WORKS</Text>

                            <View style={styles.stepContainer}>
                                    <SmsIcon />
                                <Text style={styles.stepText}>Send a personal invite link to someone you trust</Text>
                            </View>

                            <View style={styles.stepContainer}>
                                <ArrowsIcon />
                                <Text style={styles.stepText}>Let them choose their role—support or recovery</Text>
                            </View>

                            <View style={styles.stepContainer}>
                                <VolumeIcon />
                                <Text style={styles.stepText}>Stay connected through shared audio experiences</Text>
                            </View>
                        </View>

                        <View style={styles.quoteSection}>
                            <QuoteIcon />
                            {quoteLoading ? (
                                <ActivityIndicator size="small" color="#FFFFFF" style={styles.quoteLoader} />
                            ) : quote ? (
                                <>
                                    <Text style={styles.quoteText}>
                                        "{quote.quote}"
                                    </Text>
                                    <Text style={styles.quoteAuthor}>- {quote.author}</Text>
                                </>
                            ) : (
                                <>
                                    <Text style={styles.quoteText}>
                                        "Sobriety is a state of self love that is timeless."
                                    </Text>
                                    <Text style={styles.quoteAuthor}>- Lou</Text>
                                </>
                            )}
                        </View>
                    </ScrollView>

                    <View style={styles.buttonContainer}>
                        <Button
                            testID="invite-next-button"
                            title="Next"
                            onPress={handleNext}
                            variant="primary"
                            size="medium"
                            style={styles.nextButton}
                        />
                        <SecondaryButton
                            testID="invite-skip-button"
                            title="Skip"
                            onPress={handleSkip}
                            size="medium"
                            style={styles.skipButton}
                            textStyle={styles.skipButtonText}
                        />
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
    canvas: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
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
    },
    contentContainer: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 20,
    },
    title: {
        fontSize: 28,
        color: '#ffffff',
        marginBottom: 16,
        fontFamily: 'Cinzel_600SemiBold',
        textAlign: 'left',
    },
    description: {
        fontSize: 16,
        color: '#ffffff',
        marginBottom: 40,
        fontFamily: 'Roboto_400Regular',
        lineHeight: 24,
    },
    howItWorksSection: {
        marginBottom: 40,
    },
    sectionTitle: {
        fontSize: 18,
        color: '#ffffff',
        marginBottom: 24,
        fontFamily: 'Cinzel_600SemiBold',
        textAlign: 'left',
    },
    stepContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    stepIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#2d1b4e',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    stepText: {
        flex: 1,
        fontSize: 14,
        color: '#ffffff',
        fontFamily: 'Roboto_400Regular',
        lineHeight: 22,
        marginLeft: 16,
    },
    quoteSection: {
        alignItems: 'center',
        marginBottom: 40,
    },
    quoteIcon: {
        marginBottom: 16,
    },
    quoteLoader: {
        marginVertical: 20,
    },
    quoteText: {
        fontSize: 18,
        color: '#ffffff',
        fontFamily: 'Roboto_400Regular',
        textAlign: 'center',
        lineHeight: 26,
        marginBottom: 12,
        marginTop: 16,
    },
    quoteAuthor: {
        fontSize: 14,
        color: '#8B5CF6',
        fontFamily: 'Roboto_400Regular',
        textAlign: 'center',
    },
    buttonContainer: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    nextButton: {
        marginBottom: 12,
    },
    skipButton: {
        alignItems: 'center',
    },
    skipButtonText: {
        color: '#8B5CF6',
    },
});
