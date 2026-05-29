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
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Canvas,
  Image as SkiaImage,
  useImage,
} from '@shopify/react-native-skia';
import ChevronLeftIcon from '../../assets/icons/chevron-left';
import TrashIcon from '../../assets/icons/trash';
import { invitationService, Invitation } from '../../services/invitation.service';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { ScreenNames } from '../../constants/ScreenNames';
import { showAppwriteError, showSuccessNotification } from '../../services/notifications';
import { useAppNavigation } from '../../hooks/useAppNavigation';

interface InvitedUserItemProps {
  invitation: Invitation;
  onDelete: () => void;
  onResend: () => void;
}

const InvitedUserItem: React.FC<InvitedUserItemProps> = ({ invitation, onDelete, onResend }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return '#10B981'; // green
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
      case 'expired':
        return 'Expired';
      default:
        return 'Pending';
    }
  };

  return (
    <View style={styles.userItem}>
      <View style={styles.userInfo}>
        <Text style={styles.userEmail}>{invitation.email}</Text>
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
        <TouchableOpacity
          onPress={onDelete}
          style={styles.deleteButton}
          activeOpacity={0.7}
        >
          <TrashIcon width={20} height={20} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const ManageInvites: React.FC = () => {
  const navigation = useNavigation();
  const { navigateToInviteSend } = useAppNavigation();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [invitationToDelete, setInvitationToDelete] = useState<Invitation | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const MAX_INVITES = 2;
  const width = Dimensions.get('window').width;
  const bg = useImage(require('../../assets/gradient.png'));

  useFocusEffect(
    React.useCallback(() => {
      loadInvitations();
    }, [])
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

  const handleDeleteInvitation = (invitation: Invitation) => {
    setInvitationToDelete(invitation);
    setShowDeleteModal(true);
  };

  const confirmDeleteInvitation = async () => {
    if (!invitationToDelete) return;
    
    try {
      setDeletingId(invitationToDelete.$id || null);
      if (invitationToDelete.$id) {
        await invitationService.deleteInvitation(invitationToDelete.$id);
        showSuccessNotification('Invitation removed successfully');
        loadInvitations();
      }
    } catch (error: unknown) {
      showAppwriteError(error, { skipUnauthorized: true });
    } finally {
      setDeletingId(null);
      setInvitationToDelete(null);
      setShowDeleteModal(false);
    }
  };

  const cancelDeleteInvitation = () => {
    setInvitationToDelete(null);
    setShowDeleteModal(false);
  };

  const handleResendInvitation = async (invitation: Invitation) => {
    try {
      await invitationService.createInvitation({
        email: invitation.email,
        inviterProfileId: invitation.inviterProfileId,
      });
      
      loadInvitations();
    } catch (error: unknown) {
      showAppwriteError(error, { skipUnauthorized: true });
    }
  };

  const handleInviteFriend = () => {
    const pendingInvitations = invitations.filter(inv => inv.status === 'pending');
    if (pendingInvitations.length >= MAX_INVITES) {
      Alert.alert(
        'Invite Limit Reached',
        `You can only have up to ${MAX_INVITES} pending invitations. Please wait for some to be accepted or remove existing ones.`
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

        {isLoading ? (
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
              <TouchableOpacity
                onPress={handleInviteFriend}
                activeOpacity={0.7}
              >
                <Text style={styles.inviteLink}>Invite a friend</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.infoText}>
              You can have up to {MAX_INVITES} pending invitations at a time.
            </Text>

            <View style={styles.usersList}>
              {invitations.map((invitation) => (
                <InvitedUserItem
                  key={invitation.$id || invitation.invitationToken}
                  invitation={invitation}
                  onDelete={() => handleDeleteInvitation(invitation)}
                  onResend={() => handleResendInvitation(invitation)}
                />
              ))}
            </View>

            {invitations.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  You haven't invited anyone yet.
                </Text>
                <TouchableOpacity
                  onPress={handleInviteFriend}
                  style={styles.emptyStateButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emptyStateButtonText}>Invite a Friend</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      <ConfirmationModal
        visible={showDeleteModal}
        title={
          invitationToDelete
            ? `Are you sure you want to remove the invitation for ${invitationToDelete.email}?`
            : 'Are you sure you want to remove this invitation?'
        }
        description="If you remove this invitation, you will need to send a new one to invite this person again."
        cancelText="Keep Invitation"
        confirmText="Remove Invitation"
        onCancel={cancelDeleteInvitation}
        onConfirm={confirmDeleteInvitation}
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
  infoText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 32,
    fontFamily: 'Roboto_400Regular',
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
    marginRight: 12,
  },
  userEmail: {
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'Roboto_400Regular',
    marginBottom: 8,
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

