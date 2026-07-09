import { useState, useEffect, FC } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Canvas,
  Image as SkiaImage,
  useImage,
} from '@shopify/react-native-skia';
import ChevronLeftIcon from '../../assets/icons/chevron-left';
import EditIcon from '../../assets/icons/edit';
import ChevronRightIcon from '../../assets/icons/chevron-right';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenNames } from '../../constants/ScreenNames';
import { useAuthStore } from '../../store/authStore';
import { useUserProfile } from '../../hooks/useUserProfile';
import { EditFieldModal } from '../../components/EditFieldModal';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { account } from '../../services/appwrite.config';

interface EditableFieldProps {
  label: string;
  value: string;
  isPassword?: boolean;
  onEdit: () => void;
}

const EditableField: FC<EditableFieldProps> = ({
  label,
  value,
  isPassword = false,
  onEdit,
}) => {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldInputContainer}>
        <Text style={[styles.fieldValue, isPassword && styles.passwordValue]}>
          {isPassword ? '• • • • • • • •' : value}
        </Text>
        <TouchableOpacity
          onPress={onEdit}
          style={styles.editButton}
          activeOpacity={0.7}
        >
          <EditIcon width={20} height={20} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

type EditFieldType =
  | 'nickname'
  | 'fullName'
  | 'email'
  | 'phone'
  | 'password'
  | 'emailPassword'
  | 'passwordCurrent'
  | null;

export const Profile: React.FC = () => {
  const navigation = useNavigation();
  const { user, deleteAccount } = useAuthStore();
  const { profile, isLoading, updateProfile } = useUserProfile();
  
  const [editingField, setEditingField] = useState<EditFieldType>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingNewPassword, setPendingNewPassword] = useState('');
  
  const width = Dimensions.get('window').width;
  const bg = useImage(require('../../assets/gradient.png'));

  const handleEditNickname = async (value: string): Promise<boolean> => {
    return await updateProfile({ nickname: value });
  };

  const handleEditFullName = async (value: string): Promise<boolean> => {
    return await updateProfile({ full_name: value });
  };

  const handleEditPhone = async (value: string): Promise<boolean> => {
    return await updateProfile({ phone: value });
  };

  const handleEditEmail = async (value: string): Promise<boolean> => {
    // Stash new email and open password prompt as the second step.
    setPendingEmail(value);
    setEditingField('emailPassword');
    return true;
  };

  const handleConfirmEmailWithPassword = async (password: string): Promise<boolean> => {
    try {
      if (!pendingEmail) {
        Alert.alert('Error', 'No email change pending.');
        return false;
      }
      await account.updateEmail(pendingEmail, password);
      setPendingEmail('');
      Alert.alert('Success', 'Email updated successfully');
      return true;
    } catch (error: any) {
      console.error('Error updating email:', error);
      Alert.alert('Error', error.message || 'Failed to update email');
      return false;
    }
  };

  const handleEditPassword = async (newPassword: string): Promise<boolean> => {
    // Stash new password and open current-password prompt as the second step.
    setPendingNewPassword(newPassword);
    setEditingField('passwordCurrent');
    return true;
  };

  const handleConfirmPasswordWithCurrent = async (oldPassword: string): Promise<boolean> => {
    try {
      if (!pendingNewPassword) {
        Alert.alert('Error', 'No password change pending.');
        return false;
      }
      await account.updatePassword(pendingNewPassword, oldPassword);
      setPendingNewPassword('');
      Alert.alert('Success', 'Password updated successfully');
      return true;
    } catch (error: any) {
      console.error('Error updating password:', error);
      Alert.alert('Error', error.message || 'Failed to update password');
      return false;
    }
  };

  const validateNickname = async (value: string) => {
    if (!value.trim()) {
      return { valid: false, message: 'Nickname is required' };
    }
    if (value.length < 3) {
      return { valid: false, message: 'Nickname must be at least 3 characters' };
    }
    return { valid: true };
  };

  const validatePhone = async (value: string) => {
    if (!value.trim()) {
      return { valid: false, message: 'Phone number is required' };
    }
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(value)) {
      return { valid: false, message: 'Please enter a valid phone number' };
    }
    if (value.replace(/\D/g, '').length < 9) {
      return { valid: false, message: 'Phone number must be at least 10 digits' };
    }
    return { valid: true };
  };

  const validateEmail = async (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return { valid: false, message: 'Please enter a valid email' };
    }
    return { valid: true };
  };

  const validatePassword = async (value: string) => {
    if (value.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters' };
    }
    return { valid: true };
  };

  const handleManageInvitedUsers = () => {
    (navigation as any).navigate(ScreenNames.MANAGE_INVITES);
  };

  const handleDeleteAccount = () => {
    setShowDeleteConfirmation(true);
  };

  const handleConfirmDeleteAccount = async () => {
    try {
      await deleteAccount();
      
      // Navigate to welcome screen after successful deletion
      (navigation as any).reset({
        index: 0,
        routes: [{ name: ScreenNames.WELCOME }],
      });
      
      // Show success message after navigation
      setTimeout(() => {
        Alert.alert(
          'Account Deleted', 
          'Your account data has been permanently deleted.'
        );
      }, 500);
    } catch (error: any) {
      console.error('Error deleting account:', error);
      Alert.alert(
        'Error', 
        error.message || 'Failed to delete account. Please try again.'
      );
    } finally {
      setShowDeleteConfirmation(false);
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
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.pageTitle}>Account Settings</Text>

            <View style={styles.fieldsContainer}>
              <EditableField
                label="Nickname"
                value={profile?.nickname || 'Not set'}
                onEdit={() => setEditingField('nickname')}
              />
              <EditableField
                label="Phone Number"
                value={profile?.phone || 'Not set'}
                onEdit={() => setEditingField('phone')}
              />
              <EditableField
                label="Email"
                value={user?.email || 'Not set'}
                onEdit={() => setEditingField('email')}
              />
              <EditableField
                label="Password"
                value="••••••••••"
                
                isPassword={true}
                onEdit={() => setEditingField('password')}
              />
            </View>

            <TouchableOpacity
              style={styles.manageUsersButton}
              onPress={handleManageInvitedUsers}
              activeOpacity={0.7}
            >
              <Text style={styles.manageUsersText}>Manage Invited Users</Text>
              <ChevronRightIcon width={24} height={24} color="#ffffff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteAccountButton}
              onPress={handleDeleteAccount}
              activeOpacity={0.7}
            >
              <Text style={styles.deleteAccountText}>Delete Account</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Edit Modals */}

        <EditFieldModal
          visible={editingField === 'nickname'}
          title="Edit Nickname"
          label="Nickname"
          value={profile?.nickname || ''}
          placeholder="Enter your nickname"
          onClose={() => setEditingField(null)}
          onSave={handleEditNickname}
          validateInput={validateNickname}
        />

        <EditFieldModal
          visible={editingField === 'phone'}
          title="Edit Phone"
          label="Phone Number"
          value={profile?.phone || ''}
          placeholder="Enter your phone number"
          onClose={() => setEditingField(null)}
          onSave={handleEditPhone}
          validateInput={validatePhone}
        />

        <EditFieldModal
          visible={editingField === 'email'}
          title="Edit Email"
          label="Email"
          value={user?.email || ''}
          placeholder="Enter your email"
          onClose={() =>
            setEditingField((prev) => (prev === 'email' ? null : prev))
          }
          onSave={handleEditEmail}
          validateInput={validateEmail}
        />

      

        <EditFieldModal
          visible={editingField === 'password'}
          title="Change Password"
          label="New Password"
          value=""
          placeholder="Enter new password"
          isPassword={true}
          onClose={() =>
            setEditingField((prev) => (prev === 'password' ? null : prev))
          }
          onSave={handleEditPassword}
          validateInput={validatePassword}
        />

        <EditFieldModal
          visible={editingField === 'emailPassword'}
          title="Confirm Password"
          label="Current Password"
          value=""
          placeholder="Enter your current password"
          isPassword={true}
          onClose={() => {
            setPendingEmail('');
            setEditingField(null);
          }}
          onSave={handleConfirmEmailWithPassword}
        />

        <EditFieldModal
          visible={editingField === 'passwordCurrent'}
          title="Confirm Current Password"
          label="Current Password"
          value=""
          placeholder="Enter your current password"
          isPassword={true}
          onClose={() => {
            setPendingNewPassword('');
            setEditingField(null);
          }}
          onSave={handleConfirmPasswordWithCurrent}
        />

        <ConfirmationModal
          visible={showDeleteConfirmation}
          title="Are you sure you want to delete your account?"
          description="If you delete this account, a new one will need to be created to access content."
          cancelText="Keep My Account"
          confirmText="Delete Account"
          onCancel={() => setShowDeleteConfirmation(false)}
          onConfirm={handleConfirmDeleteAccount}
          confirmButtonColor="#ff4444"
        />
      </SafeAreaView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#ffffff',
    marginTop: 16,
    fontFamily: 'Roboto_400Regular',
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
  pageTitle: {
    fontSize: 24,
    fontWeight: '400',
    color: '#ffffff',
    marginBottom: 32,
    fontFamily: 'Cinzel_400Regular',
    letterSpacing: 0.5,
  },
  fieldsContainer: {
    marginBottom: 32,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 8,
    fontFamily: 'Roboto_400Regular',
  },
  fieldInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 48,
  },
  fieldValue: {
    flex: 1,
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'Roboto_400Regular',
  },
  passwordValue: {
    fontSize: 28,
  },
  editButton: {
    padding: 4,
    marginLeft: 12,
  },
  manageUsersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 40,
  },
  manageUsersText: {
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'Roboto_500Medium',
  },
  deleteAccountButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  deleteAccountText: {
    fontSize: 16,
    color: '#ff4444',
    fontFamily: 'Roboto_500Medium',
  },
});

export default Profile;