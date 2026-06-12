import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { DrawerActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ArrowLeftIcon from '../assets/icons/arrow-left';
import AccountIcon from '../assets/icons/account';
import LegalIcon from '../assets/icons/legal';
import DocumentIcon from '../assets/icons/document';
import ShieldIcon from '../assets/icons/shield';
import SubscriptionsIcon from '../assets/icons/subscriptions';
import HelpIcon from '../assets/icons/help';
import SignOutIcon from '../assets/icons/sign-out';
import ChevronUpIcon from '../assets/icons/chevron-up';
import ChevronDownIcon from '../assets/icons/chevron-down';
import { ScreenNames } from '../constants/ScreenNames';
import { useAuthStore } from '../store/authStore';
import { ConfirmationModal } from './ConfirmationModal';

interface MenuItemProps {
  icon: React.ReactNode;
  text: string;
  onPress: () => void;
  isSubItem?: boolean;
  showChevron?: boolean;
  chevronUp?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  text,
  onPress,
  isSubItem = false,
  showChevron = false,
  chevronUp = false,
}) => (
  <TouchableOpacity
    style={[styles.menuItem, isSubItem && styles.subMenuItem]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.menuItemLeft}>
      {icon}
      <Text style={[styles.menuItemText, isSubItem && styles.subMenuItemText]}>
        {text}
      </Text>
    </View>
    {showChevron && (
      <View style={styles.chevronContainer}>
        {chevronUp ? (
          <ChevronUpIcon color="#fff" width={16} height={16} />
        ) : (
          <ChevronDownIcon color="#fff" width={16} height={16} />
        )}
      </View>
    )}
  </TouchableOpacity>
);

const Separator = () => <View style={styles.separator} />;

export const CustomDrawerContent = (props: any) => {
  const { navigation } = props;
  const insets = useSafeAreaInsets();
  const [legalExpanded, setLegalExpanded] = useState(false);
  const [showSignOutConfirmation, setShowSignOutConfirmation] = useState(false);
  const { signOut } = useAuthStore();

  const handleCloseDrawer = () => {
    navigation.dispatch(DrawerActions.closeDrawer());
  };

  const handleAccountSettings = () => {
    navigation.navigate(ScreenNames.PROFILE);
    navigation.dispatch(DrawerActions.closeDrawer());
  };

  const handleLegalNotices = () => {
    setLegalExpanded(!legalExpanded);
  };

  const handleTermsConditions = () => {
    navigation.navigate(ScreenNames.TERMS_CONDITIONS);
    navigation.dispatch(DrawerActions.closeDrawer());
  };

  const handlePrivacyPolicy = () => {
    navigation.navigate(ScreenNames.PRIVACY_POLICY);
    navigation.dispatch(DrawerActions.closeDrawer());
  };

  const handleSubscriptions = () => {
    navigation.navigate(ScreenNames.SUBSCRIPTION);
    navigation.dispatch(DrawerActions.closeDrawer());
  };

  const handleHelpSupport = () => {
    navigation.navigate(ScreenNames.HELP_SUPPORT);
    navigation.dispatch(DrawerActions.closeDrawer());
  };

  const handleSignOut = () => {
    setShowSignOutConfirmation(true);
  };

  const handleConfirmSignOut = async () => {
    try {
      setShowSignOutConfirmation(false);
      navigation.dispatch(DrawerActions.closeDrawer());
      await signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: ScreenNames.WELCOME }],
      });
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 60) }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleCloseDrawer}
          >
            <ArrowLeftIcon color="#fff" width={18} height={14} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>MENU</Text>
        </View>

        <View style={styles.menuContainer}>
          <MenuItem
            icon={<AccountIcon color="#fff" width={24} height={24} />}
            text="Account Settings"
            onPress={handleAccountSettings}
          />
          <Separator />

          <MenuItem
            icon={<LegalIcon color="#fff" width={24} height={24} />}
            text="Legal Notices"
            onPress={handleLegalNotices}
            showChevron={true}
            chevronUp={legalExpanded}
          />
          {legalExpanded && (
            <>
              <MenuItem
                icon={<DocumentIcon color="rgba(255, 255, 255, 0.5)" width={24} height={24} />}
                text="Terms & Conditions"
                onPress={handleTermsConditions}
                isSubItem={true}
              />
              <MenuItem
                icon={<ShieldIcon color="rgba(255, 255, 255, 0.5)" width={24} height={24} />}
                text="Privacy Policy"
                onPress={handlePrivacyPolicy}
                isSubItem={true}
              />
            </>
          )}
          <Separator />

          <MenuItem
            icon={<SubscriptionsIcon color="#fff" width={24} height={24} />}
            text="Subscriptions"
            onPress={handleSubscriptions}
          />
          <Separator />

          <MenuItem
            icon={<HelpIcon color="#fff" width={24} height={24} />}
            text="Help & Support"
            onPress={handleHelpSupport}
          />
          <Separator />

          <MenuItem
            icon={<SignOutIcon color="#fff" width={24} height={24} />}
            text="Sign Out"
            onPress={handleSignOut}
          />
          <Separator />
        </View>
      </DrawerContentScrollView>

      <ConfirmationModal
        visible={showSignOutConfirmation}
        title="Sign Out"
        description="Are you sure you want to sign out?"
        cancelText="Cancel"
        confirmText="Sign Out"
        onCancel={() => setShowSignOutConfirmation(false)}
        onConfirm={handleConfirmSignOut}
        confirmButtonColor="#EF4444"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#28202E',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontFamily: 'Cinzel_400Regular',
    fontSize: 32,
    color: '#fff',
    letterSpacing: 1,
  },
  menuContainer: {
    paddingHorizontal: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  subMenuItem: {
    paddingLeft: 48,
    paddingVertical: 12,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemText: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 16,
    color: '#fff',
    marginLeft: 16,
  },
  subMenuItemText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 15,
  },
  chevronContainer: {
    paddingLeft: 8,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 4,
  },
});

