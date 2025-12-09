import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CalendarModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export function CalendarModal({ visible, onClose, selectedDate, onSelectDate }: CalendarModalProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    return days;
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const shiftMonth = (increment: number) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + increment);
      return newDate;
    });
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear()
    );
  };

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];

    // Empty slots for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} className="w-[14.28%] aspect-square" />);
    }

    // Days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
      const isSelected = isSameDay(date, selectedDate);
      const isToday = isSameDay(date, new Date());

      days.push(
        <TouchableOpacity
          key={`day-${i}`}
          onPress={() => {
            onSelectDate(date);
            onClose();
          }}
          className="w-[14.28%] aspect-square items-center justify-center p-1"
        >
          <View
            className={`w-full h-full items-center justify-center rounded-xl ${
              isSelected ? 'bg-orange-600' : isToday ? 'bg-slate-800' : ''
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                isSelected
                  ? 'text-white'
                  : isToday
                  ? 'text-orange-400'
                  : 'text-slate-300'
              }`}
            >
              {i}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    return days;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 bg-black/70 justify-center items-center px-6">
          <TouchableWithoutFeedback>
            <View className="w-full bg-slate-900 rounded-3xl border border-slate-800 p-4">
              {/* Header */}
              <View className="flex-row items-center justify-between mb-4">
                <TouchableOpacity
                  onPress={() => shiftMonth(-1)}
                  className="h-10 w-10 items-center justify-center rounded-full bg-slate-800"
                >
                  <Ionicons name="chevron-back" size={20} color="#e2e8f0" />
                </TouchableOpacity>
                <Text className="text-white text-lg font-bold">
                  {currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </Text>
                <TouchableOpacity
                  onPress={() => shiftMonth(1)}
                  className="h-10 w-10 items-center justify-center rounded-full bg-slate-800"
                >
                  <Ionicons name="chevron-forward" size={20} color="#e2e8f0" />
                </TouchableOpacity>
              </View>

              {/* Day Labels */}
              <View className="flex-row mb-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                  <View key={index} className="w-[14.28%] items-center">
                    <Text className="text-slate-500 text-xs font-semibold">{day}</Text>
                  </View>
                ))}
              </View>

              {/* Calendar Grid */}
              <View className="flex-row flex-wrap">
                {renderCalendarDays()}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

