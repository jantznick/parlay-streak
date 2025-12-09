import React from 'react';
import { View, Text, Modal, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export function ConfirmationModal({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isDestructive = false,
}: ConfirmationModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View className="flex-1 bg-black/70 justify-center items-center px-6">
          <TouchableWithoutFeedback>
            <View className="w-full bg-card rounded-3xl border border-border p-6 shadow-xl">
              <Text className="text-xl font-bold text-card-foreground mb-2 text-center">
                {title}
              </Text>
              <Text className="text-muted-foreground text-sm text-center mb-6 leading-5">
                {message}
              </Text>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={onCancel}
                  className="flex-1 bg-secondary py-3.5 rounded-xl border border-border items-center"
                >
                  <Text className="text-foreground font-semibold">{cancelText}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onConfirm}
                  className={`flex-1 py-3.5 rounded-xl items-center ${
                    isDestructive ? 'bg-destructive' : 'bg-primary'
                  }`}
                >
                  <Text className={`font-semibold ${isDestructive ? 'text-destructive-foreground' : 'text-primary-foreground'}`}>{confirmText}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

