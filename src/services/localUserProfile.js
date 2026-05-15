import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCAL_PROFILE_KEY = 'the_rhythm_local_profile';

const sanitizeProfile = (profile = {}) => ({
  fullName: (profile.fullName || '').trim(),
  heightCm: String(profile.heightCm || '').trim(),
  weightKg: String(profile.weightKg || '').trim(),
});

export const getLocalUserProfile = async () => {
  const stored = await AsyncStorage.getItem(LOCAL_PROFILE_KEY);
  if (!stored) return sanitizeProfile();

  try {
    return sanitizeProfile(JSON.parse(stored));
  } catch {
    return sanitizeProfile();
  }
};

export const saveLocalUserProfile = async (profile) => {
  const sanitized = sanitizeProfile(profile);
  await AsyncStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(sanitized));
  return sanitized;
};

export const clearLocalUserProfile = async () => {
  await AsyncStorage.removeItem(LOCAL_PROFILE_KEY);
  return sanitizeProfile();
};
