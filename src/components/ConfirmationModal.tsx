import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { BlurView } from 'expo-blur';

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  description: string;
  cancelText?: string;
  confirmText: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmButtonColor?: string;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  title,
  description,
  cancelText = 'Keep My Account',
  confirmText,
  onCancel,
  onConfirm,
  confirmButtonColor = '#ff4444',
}) => {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <BlurView intensity={80} tint="dark" style={styles.modalContainer}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>{cancelText}</Text>
            </TouchableOpacity>
            
            <View style={styles.separator} />
            
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={onConfirm}
              activeOpacity={0.7}
            >
              <Text style={[styles.confirmButtonText, { color: confirmButtonColor }]}>
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    width: '75%',
    backgroundColor: 'rgba(64, 64, 64, 0.5)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    fontFamily: 'Roboto_600SemiBold',
    textAlign: 'center',
    padding: 24,
  },
  description: {
    fontSize: 14,
    color: '#ffffff',
    paddingHorizontal: 24,
    paddingBottom: 24,
    fontFamily: 'Roboto_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#0A84FF',
    fontFamily: 'Roboto_400Medium',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  confirmButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontFamily: 'Roboto_400Medium',
    color: '#EF4444',
  },
});

