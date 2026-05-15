const baseColors = {
  light: {
    background: '#F8F9FA',
    surface: '#FFFFFF',
    surfaceVariant: '#E9ECEF',
    softCard: '#EEF0F2',
    softCardStrong: '#E2E5E9',
    primary: '#000000',
    secondary: '#495057',
    outline: '#CED4DA',
    text: '#000000',
    white: '#FFFFFF',
    placeholder: '#ADB5BD',
    error: '#DC3545',
    period: '#E85D75',
    ovulation: '#B58CFF',
    ovulationPeak: '#00A6A6',
    fertilityLow: '#F6D77A',
    black: '#000000',
  },
  dark: {
    background: '#000000',
    surface: '#121212',
    surfaceVariant: '#1E1E1E',
    softCard: '#202124',
    softCardStrong: '#2A2C30',
    primary: '#FFFFFF',
    secondary: '#E0E0E0',
    outline: '#404040',
    text: '#FFFFFF',
    white: '#FFFFFF',
    placeholder: '#757575',
    error: '#FF5252',
    period: '#D94B66',
    ovulation: '#B58CFF',
    ovulationPeak: '#2ED3D3',
    fertilityLow: '#F6D77A',
    black: '#000000',
  },
};

export const getColors = (theme, colorMode = 'color') => {
  const palette = baseColors[theme] || baseColors.dark;

  if (colorMode !== 'mono') {
    return palette;
  }

  return palette;
};

export const Colors = {
  light: getColors('light'),
  dark: getColors('dark'),
};
