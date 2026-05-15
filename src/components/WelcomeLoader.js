import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';

const INTRO_BLACK_MS = 500;
const INTRO_GIF_MS = 1500;

export const WelcomeLoader = ({ exiting = false, onExited }) => {
  const [phase, setPhase] = useState('black');
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const containerScale = useRef(new Animated.Value(1)).current;
  const finalOpacity = useRef(new Animated.Value(0)).current;
  const finalScale = useRef(new Animated.Value(1.02)).current;

  useEffect(() => {
    const gifTimer = setTimeout(() => {
      finalOpacity.setValue(1);
      finalScale.setValue(1);
      setPhase('gif');
    }, INTRO_BLACK_MS);

    const finalTimer = setTimeout(() => {
      setPhase('final');
    }, INTRO_BLACK_MS + INTRO_GIF_MS);

    return () => {
      clearTimeout(gifTimer);
      clearTimeout(finalTimer);
    };
  }, [finalOpacity, finalScale]);

  useEffect(() => {
    if (!exiting) return undefined;

    Animated.parallel([
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 560,
        useNativeDriver: true,
      }),
      Animated.timing(containerScale, {
        toValue: 1.035,
        duration: 560,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onExited?.();
    });

    return undefined;
  }, [containerOpacity, containerScale, exiting, onExited]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: containerOpacity,
          transform: [{ scale: containerScale }],
        },
      ]}
    >
      {phase !== 'black' ? (
        <Animated.Image
          source={require('../../assets/intro/intro-final.png')}
          style={[
            styles.media,
            {
              opacity: finalOpacity,
              transform: [{ scale: finalScale }],
            },
          ]}
          resizeMode="cover"
        />
      ) : null}

      {phase === 'gif' ? (
        <Image
          source={require('../../assets/intro/intro.gif')}
          style={styles.media}
          resizeMode="cover"
          onError={() => setPhase('final')}
        />
      ) : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  media: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
});
