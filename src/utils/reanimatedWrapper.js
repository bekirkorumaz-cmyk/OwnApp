import { View } from 'react-native';

// Eğer uygulama hata verirse Reanimated yerine bunları kullanacağız
export const useSharedValue = (val) => ({ value: val });
export const useAnimatedStyle = (fn) => ({});
export const useAnimatedGestureHandler = (fn) => ({});
export const Animated = {
  View: View,
  createAnimatedComponent: (comp) => comp,
};
export const withTiming = (val) => val;
export const withSpring = (val) => val;
