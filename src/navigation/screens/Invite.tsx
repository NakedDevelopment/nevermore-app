import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState, useEffect } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Alert,
    Linking,
    Platform,
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
import { invitationService } from '../../services/invitation.service';
import { account } from '../../services/appwrite.config';
import { userProfileService } from '../../services/userProfile.service';
import { getCurrentUser } from '../../services/auth.service';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { showAppwriteError, showSuccessNotification } from '../../services/notifications';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { useWelcomeQuote } from '../../hooks/useWelcomeQuote';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useAuthStore } from '../../store/authStore';
import { useSharedAccessStore } from '../../store/sharedAccessStore';

type RootStackParamList = {
  [ScreenNames.INVITE]: {
    token?: string;
    userId?: string;
    secret?: string;
    expire?: string;
    project?: string;
  } | undefined;
  [ScreenNames.INVITE_SEND]: undefined;
  [ScreenNames.HOME_TABS]: undefined;
  [ScreenNames.TRIAL_WELCOME]: undefined;
  [ScreenNames.SIGN_UP]: undefined;
  [ScreenNames.SET_PASSWORD]: undefined;
};

type InviteRouteProp = RouteProp<RootStackParamList, ScreenNames.INVITE>;
type InviteNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function Invite() {
    const navigation = useNavigation<InviteNavigationProp>();
    const route = useRoute<InviteRouteProp>();
    const { navigateToInviteSend } = useAppNavigation();
    const { quote, loading: quoteLoading } = useWelcomeQuote();
    const { setCurrentStep } = useOnboardingStore();
    const { checkAuth, signOut } = useAuthStore();
    const { refreshSharedAccess } = useSharedAccessStore();
    
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessingInvitation, setIsProcessingInvitation] = useState(false);
    
    const width = Dimensions.get('window').width;
    const height = Dimensions.get('window').height;
    const bg = useImage(require('../../assets/gradient.png'));

    const token = route.params?.token;
    const userId = route.params?.userId;
    const secret = route.params?.secret;
    const isFromDeepLink = !!(token && userId && secret);

    useEffect(() => {
        if (isFromDeepLink) {
            handleInvitationAcceptance();
        }
    }, [isFromDeepLink]);

    const resetToSignUp = async () => {
        try {
            await signOut();
        } catch {
            try {
                await account.deleteSession('current');
            } catch {
                // No active session to clear.
            }
        }

        navigation.reset({
            index: 0,
            routes: [{ name: ScreenNames.SIGN_UP }],
        });
    };

    const handleInvitationAcceptance = async () => {
        // Validate that we have all required parameters from the Magic URL
        if (!token || !userId || !secret) {
            Alert.alert(
                'Invalid Invitation Link',
                'This invitation link is invalid or incomplete. Please request a new invitation.',
                [
                    {
                        text: 'OK',
                        onPress: resetToSignUp,
                    },
                ]
            );
            return;
        }

        setIsProcessingInvitation(true);

        try {
            // Create session using Magic URL credentials before reading the invitation.
            // Appwrite table permissions may require an authenticated user for invite lookup.
            try {
                try {
                    await account.getSession('current');
                    await account.deleteSession('current');
                } catch {
                    // No existing session to clear.
                }

                await account.createSession({
                    userId,
                    secret,
                });
                
                // Get user after session creation
                const user = await getCurrentUser();
                
                if (!user) {
                    throw new Error('Failed to retrieve user after session creation');
                }

                let invitation = await invitationService.getInvitationByToken(token);
                if (!invitation && user.email) {
                    invitation = await invitationService.getPendingInvitationByEmail(user.email);
                }
                
                if (!invitation) {
                    Alert.alert(
                        'Invalid Invitation',
                        'This invitation link is invalid or has expired. Please request a new invitation.',
                        [
                            {
                                text: 'OK',
                                onPress: resetToSignUp,
                            },
                        ]
                    );
                    return;
                }

                if (invitation.status !== 'pending') {
                    Alert.alert(
                        'Invitation Already Used',
                        `This invitation has already been ${invitation.status}.`,
                        [
                            {
                                text: 'OK',
                                onPress: resetToSignUp,
                            },
                        ]
                    );
                    return;
                }

                // Update auth store
                await checkAuth();
                
                // Create or get user profile
                let userProfile = null;
                let isNewUser = false;
                try {
                    userProfile = await userProfileService.getUserProfileByAuthId(user.$id);
                    if (!userProfile) {
                        isNewUser = true;
                        // Create user profile with default values
                        await userProfileService.createUserProfile({
                            auth_id: user.$id,
                            full_name: user.name || user.email?.split('@')[0] || '',
                            nickname: '',
                            type: 'patient',
                        });
                    }
                } catch (profileError: any) {
                    // Profile creation/check failed, but session is created - don't block login
                    console.error('User profile check/create error:', profileError);
                }
                
                // Mark invitation as accepted
                try {
                    await invitationService.acceptInvitationRecord(invitation, user.$id);
                    if (user.email) {
                        await invitationService.acceptInvitationByEmail(user.email);
                    }
                    await refreshSharedAccess();
                } catch (acceptError) {
                    console.error('Failed to mark invitation as accepted:', acceptError);
                }
                
                showSuccessNotification(
                    'Invitation accepted! Welcome to Nevermore.',
                    'Success'
                );
                
                // Route based on user type
                if (isNewUser) {
                    // New user - needs to set password and go through onboarding
                    navigation.reset({
                        index: 0,
                        routes: [{ name: ScreenNames.SET_PASSWORD }],
                    });
                } else {
                    // Existing invited users already have shared access; skip trial/paywall screens.
                    navigation.reset({
                        index: 0,
                        routes: [{ name: ScreenNames.HOME_TABS }],
                    });
                }
            } catch (sessionError: any) {
                // Session creation failed - the magic URL may have expired or been used
                console.error('Session creation error:', sessionError);
                
                Alert.alert(
                    'Invitation Link Expired',
                    'This magic link has expired or has already been used. Please request a new invitation or sign up manually.',
                    [
                        {
                            text: 'Sign Up',
                            onPress: resetToSignUp,
                        },
                    ]
                );
            }
        } catch (error: unknown) {
            console.error('Invitation acceptance error:', error);
            showAppwriteError(error, {
                title: 'Failed to Process Invitation',
                skipUnauthorized: true,
            });
            
            // On error, redirect to sign up
            setTimeout(() => {
                resetToSignUp();
            }, 2000);
        } finally {
            setIsProcessingInvitation(false);
        }
    };

    const handleNext = () => {
        setCurrentStep(ScreenNames.INVITE_SEND);
        navigateToInviteSend();
    };

    const handleSkip = () => {
        setCurrentStep(ScreenNames.TRIAL_WELCOME);
        navigation.navigate(ScreenNames.TRIAL_WELCOME);
    };

    if (isProcessingInvitation) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#000000" />
                <Canvas style={styles.canvas}>
                    <SkiaImage image={bg} x={0} y={0} width={width} height={height} fit="cover" />
                </Canvas>
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.loadingContainer}>
                        <LoadingSpinner />
                        <Text style={styles.loadingText}>Processing invitation...</Text>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />
            <Canvas style={styles.canvas}>
                <SkiaImage image={bg} x={0} y={0} width={width} height={height} fit="cover" />
            </Canvas>
            <SafeAreaView style={styles.safeArea}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()} testID="back-button">
                            <ArrowLeftIcon />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Nevermore</Text>
                        <View style={styles.headerSpacer} />
                    </View>

                    <View style={styles.content}>
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
                    </View>

                    <View style={styles.buttonContainer}>
                        <Button
                            title="Next"
                            onPress={handleNext}
                            variant="primary"
                            size="medium"
                            style={styles.nextButton}
                            testID="onboarding-continue"
                        />
                        <SecondaryButton
                            title="Skip"
                            onPress={handleSkip}
                            size="medium"
                            style={styles.skipButton}
                            textStyle={styles.skipButtonText}
                            testID="onboarding-skip"
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
        paddingHorizontal: 20,
        paddingTop: 20,
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#ffffff',
        fontFamily: 'Roboto_400Regular',
    },
});
