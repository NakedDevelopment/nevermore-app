import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Input } from './Input';
import { Button } from './Button';

interface EditFieldModalProps {
  visible: boolean;
  title: string;
  label: string;
  value: string;
  placeholder?: string;
  isPassword?: boolean;
  onClose: () => void;
  onSave: (value: string) => Promise<boolean>;
  validateInput?: (value: string) => Promise<{ valid: boolean; message?: string }>;
}

export const EditFieldModal: React.FC<EditFieldModalProps> = ({
  visible,
  title,
  label,
  value,
  placeholder,
  isPassword = false,
  onClose,
  onSave,
  validateInput,
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [inputState, setInputState] = useState<'default' | 'error' | 'success'>('default');

  useEffect(() => {
    if (visible) {
      setInputValue(value);
      setErrorMessage('');
      setInputState('default');
    }
  }, [visible, value]);

  const handleSave = async () => {
    if (!inputValue.trim()) {
      setErrorMessage(`${label} is required`);
      setInputState('error');
      return;
    }

    // Run custom validation if provided
    if (validateInput) {
      setIsLoading(true);
      const validation = await validateInput(inputValue);
      setIsLoading(false);

      if (!validation.valid) {
        setErrorMessage(validation.message || 'Invalid input');
        setInputState('error');
        return;
      }
    }

    setIsLoading(true);
    const success = await onSave(inputValue);
    setIsLoading(false);

    if (success) {
      setInputState('success');
      setTimeout(() => {
        onClose();
      }, 500);
    }
  };

  const handleCancel = () => {
    setInputValue(value);
    setErrorMessage('');
    setInputState('default');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.modalContainer}>
            <Text style={styles.title}>{title}</Text>

            <Input
              label={label}
              value={inputValue}
              onChangeText={(text) => {
                setInputValue(text);
                setErrorMessage('');
                setInputState('default');
              }}
              placeholder={placeholder || `Enter ${label.toLowerCase()}`}
              secureTextEntry={isPassword}
              autoCapitalize={isPassword ? 'none' : 'sentences'}
              autoCorrect={false}
              state={inputState}
              errorMessage={errorMessage}
              editable={!isLoading}
            />

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleCancel}
                disabled={isLoading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.saveButton,
                  isLoading && styles.saveButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 24,
    fontFamily: 'Roboto_600SemiBold',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Roboto_500Medium',
  },
  saveButton: {
    backgroundColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Roboto_600SemiBold',
  },
});

