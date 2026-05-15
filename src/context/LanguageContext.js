import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  formatTranslation,
  getTranslationValue,
} from '../constants/Translations';

const LANGUAGE_STORAGE_KEY = 'ownapp_language_preference_v1';

const LanguageContext = createContext({
  language: DEFAULT_LANGUAGE,
  supportedLanguages: SUPPORTED_LANGUAGES,
  setLanguage: async () => {},
  t: (key) => key,
});

const normalizeLocale = (locale) => String(locale || '').replace('_', '-');

const getDeviceLocale = () => {
  const intlLocale = Intl?.DateTimeFormat?.().resolvedOptions?.().locale;
  if (intlLocale) return normalizeLocale(intlLocale);

  if (Platform.OS === 'ios') {
    const settings = NativeModules.SettingsManager?.settings || {};
    return normalizeLocale(settings.AppleLocale || settings.AppleLanguages?.[0]);
  }

  return normalizeLocale(
    NativeModules.I18nManager?.localeIdentifier
      || NativeModules.PlatformConstants?.locale
      || NativeModules.PlatformConstants?.reactNativeVersion?.locale
  );
};

export const resolveSupportedLanguage = (locale) => {
  const normalized = normalizeLocale(locale);
  if (!normalized) return DEFAULT_LANGUAGE;

  const exact = SUPPORTED_LANGUAGES.find((item) => item.code.toLowerCase() === normalized.toLowerCase());
  if (exact) return exact.code;

  const baseCode = normalized.split('-')[0].toLowerCase();
  const baseMatch = SUPPORTED_LANGUAGES.find((item) => item.code.toLowerCase().split('-')[0] === baseCode);
  return baseMatch?.code || DEFAULT_LANGUAGE;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => resolveSupportedLanguage(getDeviceLocale()));

  useEffect(() => {
    let isMounted = true;

    const loadLanguage = async () => {
      try {
        const storedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (storedLanguage && isMounted) {
          setLanguageState(resolveSupportedLanguage(storedLanguage));
        }
      } catch (error) {
        console.error('Language preference could not be loaded:', error);
      }
    };

    loadLanguage();

    return () => {
      isMounted = false;
    };
  }, []);

  const setLanguage = useCallback(async (nextLanguage) => {
    const resolvedLanguage = resolveSupportedLanguage(nextLanguage);
    setLanguageState(resolvedLanguage);
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, resolvedLanguage);
  }, []);

  const t = useCallback((key, params) => (
    formatTranslation(getTranslationValue(language, key), params)
  ), [language]);

  const value = useMemo(() => ({
    language,
    supportedLanguages: SUPPORTED_LANGUAGES,
    setLanguage,
    t,
  }), [language, setLanguage, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
