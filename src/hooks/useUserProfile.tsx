import { useState, useEffect } from 'react';
import { userProfileService, UserProfile } from '../services/userProfile.service';
import { useAuthStore } from '../store/authStore';
import { Alert } from 'react-native';

export const useUserProfile = () => {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch user profile
  const fetchProfile = async () => {
    if (!user?.$id) return;

    setIsLoading(true);
    try {
      const userProfile = await userProfileService.getUserProfileByAuthId(user.$id);
      setProfile(userProfile);
    } catch (error: any) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update user profile
  const updateProfile = async (data: Partial<UserProfile>): Promise<boolean> => {
    if (!profile?.$id) {
      Alert.alert('Error', 'Profile not found');
      return false;
    }

    setIsUpdating(true);
    try {
      const updatedProfile = await userProfileService.updateUserProfile(profile.$id, data);
      setProfile(updatedProfile as unknown as UserProfile);
      return true;
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', error.message || 'Failed to update profile');
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  // Fetch profile on mount or when user changes
  useEffect(() => {
    fetchProfile();
  }, [user?.$id]);

  return {
    profile,
    isLoading,
    isUpdating,
    updateProfile,
    refetchProfile: fetchProfile,
  };
};

