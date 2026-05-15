import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { requireSupabase, supabase } from '../services/supabaseClient';
import { clearLocalPeriodLogs, getLocalPeriodLogs, initLocalDatabase } from '../services/localPeriodLogs';
import { createPeriodLogs } from '../services/periodLogs';
import { clearLocalUserProfile, getLocalUserProfile, saveLocalUserProfile } from '../services/localUserProfile';
import { deleteCloudAccount } from '../services/accountDeletion';

const AuthContext = createContext(null);
const APP_MODE_STORAGE_KEY = 'the_rhythm_app_mode';

const parseAuthRedirectParams = (url) => {
  if (!url) return {};

  const [, rawQuery = ''] = url.split('?');
  const [queryPart = '', hashPart = ''] = rawQuery.split('#');
  const fragmentPart = url.includes('#') ? url.split('#').slice(1).join('#') : '';

  const merged = [queryPart, hashPart, fragmentPart]
    .filter(Boolean)
    .join('&');

  const params = new URLSearchParams(merged);
  return {
    type: params.get('type') || '',
    tokenHash: params.get('token_hash') || '',
    accessToken: params.get('access_token') || '',
    refreshToken: params.get('refresh_token') || '',
  };
};

const getPasswordResetRedirectUrl = () => {
  const appOwnership = Constants.appOwnership;
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoClient?.hostUri || '';

  if (appOwnership === 'expo' && hostUri) {
    return `exp://${hostUri}/--/reset-password`;
  }

  return 'ownapp://reset-password';
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [appMode, setAppMode] = useState(null);
  const [isPendingDeletedAccountExit, setPendingDeletedAccountExit] = useState(false);
  const [isPasswordRecoveryMode, setPasswordRecoveryMode] = useState(false);
  const [isHandlingPasswordRecovery, setHandlingPasswordRecovery] = useState(false);
  const [canCloseLoginScreen, setCanCloseLoginScreen] = useState(false);
  const [localProfile, setLocalProfile] = useState({
    fullName: '',
    heightCm: '',
    weightKg: '',
  });
  const [loading, setLoading] = useState(true);
  const isDeletingAccountRef = useRef(false);

  const resetToLoggedOutState = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Hesap sunucudan silinmiş olsa bile cihazdaki oturumu temizlemeye devam et.
      }
    }

    await AsyncStorage.removeItem(APP_MODE_STORAGE_KEY);
    setSession(null);
    setPasswordRecoveryMode(false);
    setAppMode(null);
    setPendingDeletedAccountExit(false);
    setCanCloseLoginScreen(false);
  };

  useEffect(() => {
    let authListener = null;
    let isMounted = true;

    const boot = async () => {
      const storedMode = await AsyncStorage.getItem(APP_MODE_STORAGE_KEY);

      if (storedMode === 'local') {
        const profile = await getLocalUserProfile();
        if (isMounted) {
          setLocalProfile(profile);
          setAppMode('local');
          setLoading(false);
        }
        return;
      }

      if (!supabase) {
        if (isMounted) {
          setAppMode(null);
          setLoading(false);
        }
        return;
      }

      if (storedMode === 'cloud') {
        const { data, error } = await supabase.auth.getSession();
        let nextSession = data.session;

        if (!error && nextSession?.access_token) {
          const { data: userData, error: userError } = await supabase.auth.getUser(nextSession.access_token);

          if (userError || !userData.user) {
            try {
              await supabase.auth.signOut();
            } catch {
              // Silinmiş hesap sonrası yerel oturumu temizlemeye devam et.
            }
            await AsyncStorage.removeItem(APP_MODE_STORAGE_KEY);
            nextSession = null;
          }
        }

        if (isMounted) {
          setSession(nextSession);
          setAppMode(nextSession ? 'cloud' : null);
        }
      }

      const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (isDeletingAccountRef.current) return;

        setSession(nextSession);
        if (nextSession) {
          setAppMode('cloud');
          AsyncStorage.setItem(APP_MODE_STORAGE_KEY, 'cloud');
        }
      });
      authListener = data;

      if (isMounted) {
        setLoading(false);
      }
    };

    boot();

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const migrateLocalDataToCloud = async (userId) => {
    const localLogs = await getLocalPeriodLogs();
    if (!localLogs.length) return;

    await createPeriodLogs({ userId, logs: localLogs });
    await clearLocalPeriodLogs();
  };

  const migrateLocalProfileToCloud = async () => {
    const client = requireSupabase();
    const profile = await getLocalUserProfile();

    if (!profile.fullName && !profile.heightCm && !profile.weightKg) return;

    const currentUser = client.auth.getUser ? (await client.auth.getUser()).data.user : null;
    const metadata = currentUser?.user_metadata || {};

    if (metadata.full_name || metadata.height_cm || metadata.weight_kg) return;

    await client.auth.updateUser({
      data: {
        full_name: profile.fullName,
        height_cm: profile.heightCm,
        weight_kg: profile.weightKg,
      },
    });
  };

  const value = useMemo(() => ({
    appMode,
    isLocalMode: appMode === 'local',
    isCloudMode: appMode === 'cloud',
    isPendingDeletedAccountExit,
    canCloseLoginScreen,
    loading,
    session,
    user: session?.user || null,
    profile: appMode === 'local'
      ? localProfile
      : {
          fullName: session?.user?.user_metadata?.full_name || '',
          heightCm: String(session?.user?.user_metadata?.height_cm || ''),
          weightKg: String(session?.user?.user_metadata?.weight_kg || ''),
        },
    startLocalMode: async () => {
      await initLocalDatabase();
      const profile = await getLocalUserProfile();
      setLocalProfile(profile);
      await AsyncStorage.setItem(APP_MODE_STORAGE_KEY, 'local');
      setAppMode('local');
      setCanCloseLoginScreen(false);
    },
    returnToLogin: async () => {
      await resetToLoggedOutState();
    },
    closeLoginScreen: async () => {
      await initLocalDatabase();
      const profile = await getLocalUserProfile();
      setLocalProfile(profile);
      await AsyncStorage.setItem(APP_MODE_STORAGE_KEY, 'local');
      setAppMode('local');
      setCanCloseLoginScreen(false);
    },
    signUpWithPassword: async ({ email, password, profile }) => {
      const client = requireSupabase();
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: profile?.fullName || '',
            height_cm: profile?.heightCm || '',
            weight_kg: profile?.weightKg || '',
          },
        },
      });
      if (error) throw error;
      if (data.session?.user?.id) {
        await migrateLocalDataToCloud(data.session.user.id);
        await migrateLocalProfileToCloud();
        setSession(data.session);
        await AsyncStorage.setItem(APP_MODE_STORAGE_KEY, 'cloud');
        setAppMode('cloud');
        setCanCloseLoginScreen(false);
      }
      return data;
    },
    signInWithPassword: async (email, password) => {
      const client = requireSupabase();
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.session?.user?.id) {
        await migrateLocalDataToCloud(data.session.user.id);
        await migrateLocalProfileToCloud();
        setSession(data.session);
        await AsyncStorage.setItem(APP_MODE_STORAGE_KEY, 'cloud');
        setAppMode('cloud');
        setCanCloseLoginScreen(false);
        return data;
      }

      throw new Error('Giriş oturumu oluşturulamadı. E-posta doğrulaması gerekiyorsa gelen kutunu kontrol edip tekrar giriş yap.');
    },
    requestPasswordReset: async (email) => {
      const client = requireSupabase();
      const redirectTo = getPasswordResetRedirectUrl();
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw error;
    },
    handleAuthRedirectUrl: async (url) => {
      const client = requireSupabase();
      const { type, tokenHash, accessToken, refreshToken } = parseAuthRedirectParams(url);
      const isRecoveryLink = type === 'recovery' && Boolean(tokenHash || (accessToken && refreshToken));

      if (!isRecoveryLink) return false;

      setHandlingPasswordRecovery(true);

      try {
        if (tokenHash) {
          const { error } = await client.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
          if (error) throw error;
        } else {
          const { error } = await client.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        }

        await AsyncStorage.setItem(APP_MODE_STORAGE_KEY, 'cloud');
        setAppMode('cloud');
        setPasswordRecoveryMode(true);
        return true;
      } finally {
        setHandlingPasswordRecovery(false);
      }
    },
    completePasswordRecovery: async (newPassword) => {
      const client = requireSupabase();
      const { data, error } = await client.auth.updateUser({ password: newPassword });
      if (error) throw error;

      if (data.user) {
        setSession((current) => (
          current
            ? {
                ...current,
                user: data.user,
              }
            : current
        ));
      }

      setPasswordRecoveryMode(false);
      return data.user;
    },
    cancelPasswordRecovery: async () => {
      if (supabase) {
        await supabase.auth.signOut();
      }
      setSession(null);
      setPasswordRecoveryMode(false);
      await AsyncStorage.removeItem(APP_MODE_STORAGE_KEY);
      setAppMode(null);
      setCanCloseLoginScreen(false);
    },
    isPasswordRecoveryMode,
    isHandlingPasswordRecovery,
    signOut: async () => {
      if (supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }
      await AsyncStorage.removeItem(APP_MODE_STORAGE_KEY);
      setSession(null);
      setAppMode(null);
      setPasswordRecoveryMode(false);
      setCanCloseLoginScreen(false);
    },
    finalizeDeletedAccount: async () => {
      isDeletingAccountRef.current = true;
      try {
        await resetToLoggedOutState();
      } finally {
        isDeletingAccountRef.current = false;
      }
    },
    deleteAccount: async () => {
      isDeletingAccountRef.current = true;

      try {
        if (appMode === 'local') {
          await clearLocalPeriodLogs();
          const clearedProfile = await clearLocalUserProfile();
          setLocalProfile(clearedProfile);
          return { mode: 'local' };
        }

        await deleteCloudAccount();
        await clearLocalPeriodLogs();
        const clearedProfile = await clearLocalUserProfile();
        setLocalProfile(clearedProfile);
        return { mode: 'cloud' };
      } catch (error) {
        isDeletingAccountRef.current = false;
        throw error;
      }
    },
    updateProfile: async ({ fullName, heightCm, weightKg }) => {
      if (appMode === 'local') {
        const nextProfile = await saveLocalUserProfile({ fullName, heightCm, weightKg });
        setLocalProfile(nextProfile);
        return nextProfile;
      }

      const client = requireSupabase();
      const { data, error } = await client.auth.updateUser({
        data: {
          full_name: fullName || '',
          height_cm: heightCm || '',
          weight_kg: weightKg || '',
        },
      });

      if (error) throw error;

      if (data.user) {
        setSession((current) => (
          current
            ? {
                ...current,
                user: data.user,
              }
            : current
        ));
      }

      return data.user;
    },
  }), [appMode, canCloseLoginScreen, isHandlingPasswordRecovery, isPasswordRecoveryMode, isPendingDeletedAccountExit, loading, localProfile, session]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth AuthProvider icinde kullanilmalidir.');
  }

  return context;
};
