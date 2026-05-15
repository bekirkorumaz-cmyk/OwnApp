import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getColors } from '../constants/Colors';

const THEME_STORAGE_KEY = 'ownapp_theme_mode';
const COLOR_MODE_STORAGE_KEY = 'ownapp_color_mode';

const ThemeContext = createContext({
  theme: 'dark',
  isDark: true,
  colorMode: 'color',
  isMono: false,
  colors: getColors('dark', 'color'),
  toggleTheme: () => {},
  toggleColorMode: () => {},
});

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(true);
  const [colorMode, setColorMode] = useState('color');

  useEffect(() => {
    let isMounted = true;

    const loadPreferences = async () => {
      try {
        const [storedTheme, storedColorMode] = await Promise.all([
          AsyncStorage.getItem(THEME_STORAGE_KEY),
          AsyncStorage.getItem(COLOR_MODE_STORAGE_KEY),
        ]);

        if (!isMounted) return;

        if (storedTheme === 'light') {
          setIsDark(false);
        } else if (storedTheme === 'dark') {
          setIsDark(true);
        }

        if (storedColorMode === 'mono' || storedColorMode === 'color') {
          setColorMode(storedColorMode);
        }
      } catch (error) {
        console.error('Tema tercihleri okunamadı:', error);
      }
    };

    loadPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  const toggleTheme = () => {
    setIsDark((current) => {
      const next = !current;
      AsyncStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light').catch((error) => {
        console.error('Tema tercihi kaydedilemedi:', error);
      });
      return next;
    });
  };

  const toggleColorMode = () => {
    setColorMode((current) => {
      const next = current === 'color' ? 'mono' : 'color';
      AsyncStorage.setItem(COLOR_MODE_STORAGE_KEY, next).catch((error) => {
        console.error('Renk modu kaydedilemedi:', error);
      });
      return next;
    });
  };

  const theme = isDark ? 'dark' : 'light';
  const isMono = colorMode === 'mono';
  const colors = useMemo(() => getColors(theme, colorMode), [theme, colorMode]);

  return (
    <ThemeContext.Provider value={{ theme, isDark, colorMode, isMono, colors, toggleTheme, toggleColorMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
