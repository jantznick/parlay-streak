import React, { useState, useEffect } from 'react';
import { Text, View } from 'react-native';

interface LockTimerProps {
  startTime: string;
  status: string;
}

export function LockTimer({ startTime, status }: LockTimerProps) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const start = new Date(startTime);
      const diff = start.getTime() - now.getTime();

      if (status !== 'scheduled' || diff <= 0) {
        setIsLocked(true);
        return 'Locked';
      }

      setIsLocked(false);

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) return `${days}d ${hours}h`;
      if (hours > 0) return `${hours}h ${minutes}m`;
      return `${minutes}m ${seconds}s`;
    };

    // Initial calculation
    const initial = calculateTimeLeft();
    setTimeLeft(initial);

    // Only set interval if not locked and scheduled
    if (status === 'scheduled' && initial !== 'Locked') {
      const timer = setInterval(() => {
        const remaining = calculateTimeLeft();
        setTimeLeft(remaining);
        if (remaining === 'Locked') {
          clearInterval(timer);
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [startTime, status]);

  if (isLocked) return null;

  return (
    <View className="flex-row items-center bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
      <Text style={{ fontSize: 10, marginRight: 4 }}>🔒</Text>
      <Text className="text-[10px] text-primary font-medium">
        {timeLeft}
      </Text>
    </View>
  );
}

