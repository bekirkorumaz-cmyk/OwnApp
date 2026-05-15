import 'react-native-get-random-values';
import React, { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import { AppNavigator } from './src/navigation/AppNavigator';
import { LoginScreen } from './src/screens/LoginScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { getLocalPeriodLogs } from './src/services/localPeriodLogs';
import { getPeriodLogs } from './src/services/periodLogs';
import { DEFAULT_CYCLE_SETTINGS, getCycleSettings } from './src/services/cycleSettings';
import { WelcomeLoader } from './src/components/WelcomeLoader';
import {
  useFonts,
  TitilliumWeb_300Light_Italic,
  TitilliumWeb_400Regular,
  TitilliumWeb_700Bold,
} from '@expo-google-fonts/titillium-web';

let isDefaultFontApplied = false;

const applyDefaultFont = () => {
  if (isDefaultFontApplied) return;

  Text.defaultProps = Text.defaultProps || {};
  Text.defaultProps.style = [
    { fontFamily: 'TitilliumWeb_400Regular' },
    Text.defaultProps.style,
  ];
  isDefaultFontApplied = true;
};

const ThemedStatusBar = () => {
  const { theme, colors } = useTheme();

  return (
    <StatusBar
      style={theme === 'dark' ? 'light' : 'dark'}
      backgroundColor={colors.background}
      translucent={false}
    />
  );
};

const ThemedNavigationBar = () => {
  const { theme, colors } = useTheme();

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const applyNavigationBar = async () => {
      try {
        await NavigationBar.setBackgroundColorAsync(colors.background);
        await NavigationBar.setButtonStyleAsync(theme === 'dark' ? 'light' : 'dark');
      } catch (error) {
        console.error('Navigation bar ayarlanamadı:', error);
      }
    };

    applyNavigationBar();
  }, [colors.background, theme]);

  return null;
};

const App = () => {
  const [fontsLoaded] = useFonts({
    TitilliumWeb_300Light_Italic,
    TitilliumWeb_400Regular,
    TitilliumWeb_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <ThemeProvider>
          <WelcomeLoader />
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  applyDefaultFont();

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <ThemedStatusBar />
            <ThemedNavigationBar />
            <AuthGate />
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

const AuthGate = () => {
  const { colors } = useTheme();
  const {
    appMode,
    isHandlingPasswordRecovery,
    isLocalMode,
    isPendingDeletedAccountExit,
    isPasswordRecoveryMode,
    loading,
    returnToLogin,
    session,
    user,
    handleAuthRedirectUrl,
  } = useAuth();
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(false);
  const [hasCheckedOnboarding, setHasCheckedOnboarding] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [onboardingInitialSettings, setOnboardingInitialSettings] = useState(DEFAULT_CYCLE_SETTINGS);
  const [onboardingVersion, setOnboardingVersion] = useState(0);
  const [isOnboardingDismissed, setOnboardingDismissed] = useState(false);
  const [isReturningToLogin, setReturningToLogin] = useState(false);
  const [isIntroMinimumDone, setIntroMinimumDone] = useState(false);
  const [isIntroVisible, setIntroVisible] = useState(true);
  const [isIntroExiting, setIntroExiting] = useState(false);
  const transitionCoverOpacity = React.useRef(new Animated.Value(0)).current;
  const screenTransitionIdRef = React.useRef(0);
  const displayedScreenKeyRef = React.useRef('boot');
  const [displayedScreenKey, setDisplayedScreenKey] = useState('boot');

  const isAuthenticated = appMode === 'local' || Boolean(session);
  const isHardGateBusy = loading || isHandlingPasswordRecovery;
  const isOnboardingGateBusy = isCheckingOnboarding || (isAuthenticated && !isPendingDeletedAccountExit && !hasCheckedOnboarding);
  const isGateBusy = isHardGateBusy || isOnboardingGateBusy;
  const resolvedScreenKey = isHardGateBusy
    ? 'boot'
    : isPasswordRecoveryMode
      ? 'passwordRecovery'
      : !isAuthenticated
        ? 'login'
        : needsOnboarding && !isOnboardingDismissed
          ? 'onboarding'
          : 'app';
  const currentScreenKey = isOnboardingGateBusy || isPendingDeletedAccountExit || isReturningToLogin ? displayedScreenKey : resolvedScreenKey;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIntroMinimumDone(true);
    }, 2200);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isIntroVisible || isIntroExiting || !isIntroMinimumDone || isGateBusy) return;

    setIntroExiting(true);
  }, [isGateBusy, isIntroExiting, isIntroMinimumDone, isIntroVisible]);

  useEffect(() => {
    let isMounted = true;

    const tryHandleUrl = async (url) => {
      if (!url) return;
      try {
        await handleAuthRedirectUrl(url);
      } catch (error) {
        if (isMounted) {
          console.error('Şifre sıfırlama linki işlenemedi:', error);
        }
      }
    };

    const init = async () => {
      const initialUrl = await Linking.getInitialURL();
      await tryHandleUrl(initialUrl);
    };

    init();

    const subscription = Linking.addEventListener('url', (event) => {
      tryHandleUrl(event.url);
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [handleAuthRedirectUrl]);

  useEffect(() => {
    let isActive = true;

    const checkOnboarding = async () => {
      if (loading || !isAuthenticated || isPendingDeletedAccountExit) {
        setNeedsOnboarding(false);
        setIsCheckingOnboarding(false);
        setHasCheckedOnboarding(false);
        return;
      }

      try {
        setIsCheckingOnboarding(true);
        setHasCheckedOnboarding(false);
        const logs = isLocalMode
          ? await getLocalPeriodLogs()
          : user?.id
            ? await getPeriodLogs({ userId: user.id })
            : [];
        const settings = await getCycleSettings();

        if (isActive) {
          setOnboardingInitialSettings(settings);
          setNeedsOnboarding(logs.length === 0);
          setOnboardingDismissed(false);
        }
      } catch (error) {
        console.error('İlk kurulum kontrolü yapılamadı:', error);
        if (isActive) {
          setNeedsOnboarding(false);
        }
      } finally {
        if (isActive) {
          setIsCheckingOnboarding(false);
          setHasCheckedOnboarding(true);
        }
      }
    };

    checkOnboarding();

    return () => {
      isActive = false;
    };
  }, [appMode, isAuthenticated, isLocalMode, isPendingDeletedAccountExit, loading, onboardingVersion, user?.id]);

  const handleOnboardingComplete = useCallback(() => {
    setOnboardingVersion((value) => value + 1);
  }, []);

  const handleOnboardingBack = useCallback(async () => {
    setReturningToLogin(true);
    try {
      await returnToLogin();
      setOnboardingDismissed(true);
    } finally {
      setReturningToLogin(false);
    }
  }, [returnToLogin]);

  useEffect(() => {
    if (displayedScreenKeyRef.current === currentScreenKey) {
      screenTransitionIdRef.current += 1;
      transitionCoverOpacity.stopAnimation();
      transitionCoverOpacity.setValue(0);
      return undefined;
    }

    const transitionId = screenTransitionIdRef.current + 1;
    screenTransitionIdRef.current = transitionId;
    transitionCoverOpacity.stopAnimation();

    Animated.timing(transitionCoverOpacity, {
      toValue: 1,
      duration: 90,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished || screenTransitionIdRef.current !== transitionId) return;

      displayedScreenKeyRef.current = currentScreenKey;
      setDisplayedScreenKey(currentScreenKey);

      requestAnimationFrame(() => {
        if (screenTransitionIdRef.current !== transitionId) return;

        requestAnimationFrame(() => {
          if (screenTransitionIdRef.current !== transitionId) return;

          Animated.timing(transitionCoverOpacity, {
            toValue: 0,
            duration: 170,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start(({ finished: revealFinished }) => {
            if (!revealFinished || screenTransitionIdRef.current !== transitionId) return;
            transitionCoverOpacity.setValue(0);
          });
        });
      });
    });

    return () => {
      screenTransitionIdRef.current += 1;
    };
  }, [currentScreenKey, transitionCoverOpacity]);

  const renderAppContent = (screenKey) => {
    if (screenKey === 'boot') {
      return <View style={styles.bootBackground} />;
    }

    if (screenKey === 'passwordRecovery') {
      return <ResetPasswordScreen />;
    }

    if (screenKey === 'login') {
      return <LoginScreen />;
    }

    if (screenKey === 'onboarding') {
      return (
        <OnboardingScreen
          initialCycleSettings={onboardingInitialSettings}
          onComplete={handleOnboardingComplete}
          onBack={handleOnboardingBack}
        />
      );
    }

    return <AppNavigator />;
  };

  return (
    <View style={[styles.appRoot, { backgroundColor: colors.background }]}>
      <View style={[styles.screenLayer, { backgroundColor: colors.background }]}>
        {renderAppContent(displayedScreenKey)}
      </View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.transitionCover,
          {
            backgroundColor: colors.background,
            opacity: transitionCoverOpacity,
          },
        ]}
      />
      {isIntroVisible ? (
        <View pointerEvents="none" style={styles.introOverlay}>
          <WelcomeLoader
            exiting={isIntroExiting}
            onExited={() => setIntroVisible(false)}
          />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  bootBackground: {
    flex: 1,
    backgroundColor: '#000000',
  },
  screenLayer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  transitionCover: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 900,
    elevation: 900,
  },
  introOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    elevation: 999,
  },
});

export default App;
