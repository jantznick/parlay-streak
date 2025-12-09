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
            <View className="w-full bg-slate-900 rounded-3xl border border-slate-800 p-6">
              <Text className="text-xl font-bold text-white mb-2 text-center">
                {title}
              </Text>
              <Text className="text-slate-400 text-sm text-center mb-6 leading-5">
                {message}
              </Text>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={onCancel}
                  className="flex-1 bg-slate-800 py-3.5 rounded-xl border border-slate-700 items-center"
                >
                  <Text className="text-white font-semibold">{cancelText}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onConfirm}
                  className={`flex-1 py-3.5 rounded-xl items-center ${
                    isDestructive ? 'bg-red-600' : 'bg-orange-600'
                  }`}
                >
                  <Text className="text-white font-semibold">{confirmText}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

