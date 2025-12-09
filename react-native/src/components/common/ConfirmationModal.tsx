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
            <View className="w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-lg">
              <Text className="text-xl font-bold text-slate-900 dark:text-white mb-2 text-center">
                {title}
              </Text>
              <Text className="text-slate-500 dark:text-slate-400 text-sm text-center mb-6 leading-5">
                {message}
              </Text>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={onCancel}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 items-center shadow-sm dark:shadow-none"
                >
                  <Text className="text-slate-800 dark:text-white font-semibold">{cancelText}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onConfirm}
                  className={`flex-1 py-3.5 rounded-xl items-center shadow-lg dark:shadow-none ${
                    isDestructive ? 'bg-red-600 shadow-red-500/40' : 'bg-orange-600 shadow-orange-500/40'
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

