import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  RefreshControl,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Canvas,
  Image as SkiaImage,
  useImage,
} from '@shopify/react-native-skia';
import ChevronLeftIcon from '../../assets/icons/chevron-left';
import AccountIcon from '../../assets/icons/account';
import TrashIcon from '../../assets/icons/trash';
import { invitationService, Invitation } from '../../services/invitation.service';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { ScreenNames } from '../../constants/ScreenNames';
import { showAppwriteError, showSuccessNotification } from '../../services/notifications';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { useSharedAccessStore } from '../../store/sharedAccessStore';

interface InvitedUserItemProps {
  invitation: Invitation;
  onRevoke: () => void;
  onResend: () => void;
}

const InvitedUserItem: React.FC<InvitedUserItemProps> = ({ invitation, onRevoke, onResend }) => {
  const { width } = useWindowDimensions();
  const emailFontSize = width < 360 ? 13 : 14;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return '#10B981'; // green
      case 'upgraded':
        return '#3B82F6'; // blue
      case 'revoked':
        return '#6B7280'; // gray
      case 'expired':
        return '#EF4444'; // red
      default:
        return '#8B5CF6'; // purple (pending)
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'Accepted';
      case 'upgraded':
        return 'Upgraded to own subscription';
      case 'revoked':
        return 'Revoked';
      case 'expired':
        return 'Expired';
      default:
        return 'Pending';
    }
  };

  return (
    <View style={styles.userItem}>
      <View style={styles.userInfo}>
        <Text
          style={[styles.userEmail, { fontSize: emailFontSize }]}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {invitation.email}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(invitation.status) }]}>
          <Text style={styles.statusText}>{getStatusText(invitation.status)}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        {invitation.status === 'pending' && (
          <TouchableOpacity
            onPress={onResend}
            style={styles.resendButton}
            activeOpacity={0.7}
          >
            <Text style={styles.resendButtonText}>Resend</Text>
          </TouchableOpacity>
        )}
        {(invitation.status === 'pending' || invitation.status === 'accepted') && (
          <TouchableOpacity
            onPress={onRevoke}
            style={styles.deleteButton}
            activeOpacity={0.7}
          >
            <TrashIcon width={20} height={20} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export const ManageInvites: React.FC = () => {
  const navigation = useNavigation();
  const { navigateToInviteSend, navigateToSubscription } = useAppNavigation();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [invitationToRevoke, setInvitationToRevoke] = useState<Invitation | null>(null);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const isSharedAccessActive = useSharedAccessStore((s) => s.isSharedAccessActive);
  const isSharedAccessLoading = useSharedAccessStore((s) => s.isLoading);
  const refreshSharedAccess = useSharedAccessStore((s) => s.refreshSharedAccess);

  const MAX_INVITES = 2;
  const width = Dimensions.get('window').width;
  const bg = useImage(require('../../assets/gradient.png'));

  useFocusEffect(
    React.useCallback(() => {
      refreshSharedAccess();
      loadInvitations();
    }, [refreshSharedAccess])
  );

  const loadInvitations = async () => {
    try {
      setIsLoading(true);
      const myInvitations = await invitationService.getMyInvitations();
      setInvitations(myInvitations);
    } catch (error: unknown) {
      showAppwriteError(error, { skipUnauthorized: true });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadInvitations();
  };

  const activeInvitations = invitations.filter(inv => invitationService.isActiveInvite(inv.status));
  const activeInviteCount = activeInvitations.length;
  const canInviteMore = activeInviteCount < MAX_INVITES;

  const handleRevokeInvitation = (invitation: Invitation) => {
    setInvitationToRevoke(invitation);
    setShowRevokeModal(true);
  };

  const confirmRevokeInvitation = async () => {
    if (!invitationToRevoke) return;
    
    try {
      if (invitationToRevoke.$id) {
        await invitationService.revokeInvitation(invitationToRevoke.$id);
        showSuccessNotification('Shared access removed successfully');
        loadInvitations();
      }
    } catch (error: unknown) {
      showAppwriteError(error, { skipUnauthorized: true });
    } finally {
      setInvitationToRevoke(null);
      setShowRevokeModal(false);
    }
  };

  const cancelRevokeInvitation = () => {
    setInvitationToRevoke(null);
    setShowRevokeModal(false);
  };

  const handleResendInvitation = async (invitation: Invitation) => {
    try {
      await invitationService.resendInvitation(invitation);
      
      loadInvitations();
    } catch (error: unknown) {
      showAppwriteError(error, { skipUnauthorized: true });
    }
  };

  const handleInviteFriend = () => {
    if (!canInviteMore) {
      Alert.alert(
        'Invite Limit Reached',
        `You can only have up to ${MAX_INVITES} active invites. Remove an active invite or wait for someone to get their own subscription.`
      );
    } else {
      navigateToInviteSend({ fromManageInvites: true });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.backgroundContainer}>
        <Canvas style={styles.backgroundCanvas}>
          <SkiaImage image={bg} x={0} y={0} width={width} height={300} fit="cover" />
        </Canvas>
      </View>
      
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <ChevronLeftIcon width={24} height={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nevermore</Text>
          <View style={styles.headerSpacer} />
        </View>

        {isLoading || isSharedAccessLoading ? (
          <View style={styles.loadingContainer}>
            <LoadingSpinner />
            <Text style={styles.loadingText}>Loading invitations...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor="#8B5CF6"
                colors={['#8B5CF6']}
              />
            }
          >
            <View style={styles.titleContainer}>
              <Text style={styles.pageTitle}>Your Invites</Text>
              {!isSharedAccessActive && (
                <TouchableOpacity
                  onPress={handleInviteFriend}
                  disabled={!canInviteMore}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.inviteLink, !canInviteMore && styles.inviteLinkDisabled]}>
                    Invite a Loved One
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {isSharedAccessActive ? (
              <View style={styles.sharedAccessCard}>
                <Text style={styles.sharedAccessTitle}>Create Your Own Support Circle</Text>
                <Text style={styles.sharedAccessText}>
                  You're currently using Nevermore through another member's subscription.
                </Text>
                <Text style={styles.sharedAccessText}>
                  To invite your own loved ones, you'll need your own Nevermore subscription.
                </Text>
                <TouchableOpacity
                  onPress={navigateToSubscription}
                  style={styles.subscriptionButton}
                  activeOpacity={0.8}
                >
                  <Text style={styles.subscriptionButtonText}>Get Subscription</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.infoText}>Build a circle of those you trust, one connection at a time.</Text>

                <View style={styles.inviteLimitContainer}>
                  <AccountIcon width={22} height={22} color="#8B5CF6" />
                  <Text style={styles.inviteLimitText}>{activeInviteCount}/{MAX_INVITES} invites used.</Text>
                </View>

                <View style={styles.usersList}>
                  {invitations.map((invitation) => (
                    <InvitedUserItem
                      key={invitation.$id || invitation.invitationToken}
                      invitation={invitation}
                      onRevoke={() => handleRevokeInvitation(invitation)}
                      onResend={() => handleResendInvitation(invitation)}
                    />
                  ))}
                </View>

                {invitations.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>
                      You haven't invited a loved one yet.
                    </Text>
                    <TouchableOpacity
                      onPress={handleInviteFriend}
                      style={styles.emptyStateButton}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.emptyStateButtonText}>Invite a Loved One</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      <ConfirmationModal
        visible={showRevokeModal}
        title={
          invitationToRevoke
            ? `Remove shared access for ${invitationToRevoke.email}?`
            : 'Remove this shared access?'
        }
        description="Their current invite link will stop working. If they already accepted the invite, they will need their own subscription to continue after losing shared access."
        cancelText="Keep Access"
        confirmText="Remove Access"
        onCancel={cancelRevokeInvitation}
        onConfirm={confirmRevokeInvitation}
        confirmButtonColor="#EF4444"
      />
    </View>
  );
};

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
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    color: '#ffffff',
    fontFamily: 'Cinzel_600SemiBold',
    letterSpacing: 2,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '400',
    color: '#ffffff',
    fontFamily: 'Cinzel_400Regular',
    letterSpacing: 0.5,
  },
  inviteLink: {
    fontSize: 14,
    color: '#8B5CF6',
    fontFamily: 'Roboto_500Medium',
  },
  inviteLinkDisabled: {
    color: 'rgba(139, 92, 246, 0.45)',
  },
  infoText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 18,
    fontFamily: 'Roboto_400Regular',
    lineHeight: 20,
  },
  inviteLimitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(139, 92, 246, 0.32)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 32,
  },
  inviteLimitText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.78)',
    marginLeft: 10,
    fontFamily: 'Roboto_400Regular',
    lineHeight: 20,
  },
  sharedAccessCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(139, 92, 246, 0.35)',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
    marginTop: 8,
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
  subscriptionButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 10,
  },
  subscriptionButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'Roboto_600SemiBold',
  },
  usersList: {
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'Roboto_400Regular',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 16,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  userEmail: {
    color: '#ffffff',
    fontFamily: 'Roboto_400Regular',
    marginBottom: 8,
    lineHeight: 20,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#ffffff',
    fontFamily: 'Roboto_500Medium',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },
  resendButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  resendButtonText: {
    fontSize: 12,
    color: '#8B5CF6',
    fontFamily: 'Roboto_500Medium',
  },
  deleteButton: {
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 24,
    fontFamily: 'Roboto_400Regular',
    textAlign: 'center',
  },
  emptyStateButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'Roboto_500Medium',
  },
});

export default ManageInvites;

