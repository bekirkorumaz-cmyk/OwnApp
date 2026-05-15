import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export const ThemedDialog = ({ visible, title, message, actions = [], coverScreen = false }) => {
  const { colors } = useTheme();
  const [isMounted, setIsMounted] = useState(visible);
  const dialogAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      dialogAnim.stopAnimation();
      dialogAnim.setValue(0);
      Animated.timing(dialogAnim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    dialogAnim.stopAnimation();
    Animated.timing(dialogAnim, {
      toValue: 0,
      duration: 130,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsMounted(false);
      }
    });
  }, [dialogAnim, visible]);

  const cardAnimatedStyle = {
    opacity: dialogAnim,
    transform: [
      {
        scale: dialogAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.985, 1],
        }),
      },
      {
        translateY: dialogAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [6, 0],
        }),
      },
    ],
  };

  if (!isMounted) return null;

  const dialogContent = (
    <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={[styles.backdrop, { opacity: dialogAnim }]}>
      <Animated.View style={[styles.card, cardAnimatedStyle, { backgroundColor: colors.surface, borderColor: colors.outline }]}>
        <Text style={[styles.title, { color: colors.primary }]}>{title}</Text>
        <Text style={[styles.message, { color: colors.secondary }]}>{message}</Text>
        <View style={styles.actions}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={[
                styles.button,
                action.variant === 'primary'
                  ? { backgroundColor: colors.primary }
                  : action.variant === 'custom'
                    ? { backgroundColor: action.backgroundColor, borderColor: action.borderColor || action.backgroundColor, borderWidth: 1 }
                    : { borderColor: colors.outline, borderWidth: 1 },
                action.disabled && styles.buttonDisabled,
              ]}
              onPress={action.onPress}
              disabled={action.disabled}
            >
              <Text
                style={[
                  styles.buttonText,
                  {
                    color: action.variant === 'primary'
                      ? colors.background
                      : action.variant === 'custom'
                        ? (action.textColor || colors.background)
                        : colors.primary,
                  },
                ]}
              >
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </Animated.View>
  );

  if (coverScreen) {
    return (
      <Modal visible={isMounted} transparent animationType="none" statusBarTranslucent hardwareAccelerated>
        {dialogContent}
      </Modal>
    );
  }

  return dialogContent;
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 1000,
    elevation: 1000,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 16,
  },
  message: {
    fontSize: 14,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.9,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
