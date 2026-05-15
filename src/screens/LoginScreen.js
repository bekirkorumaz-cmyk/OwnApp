import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { isSupabaseConfigured } from '../config/supabaseConfig';
import { ThemedDialog } from '../components/ThemedDialog';

const waitForDialogExit = () => new Promise((resolve) => setTimeout(resolve, 150));

export const LoginScreen = () => {
  const { theme, colors, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const {
    signInWithPassword,
    signUpWithPassword,
    startLocalMode,
    requestPasswordReset,
    canCloseLoginScreen,
    closeLoginScreen,
  } = useAuth();
  
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStartingAnonymousMode, setStartingAnonymousMode] = useState(false);
  const [isAnonymousDialogVisible, setAnonymousDialogVisible] = useState(false);
  const [messageDialog, setMessageDialog] = useState({
    visible: false,
    title: '',
    message: '',
  });

  const showMessage = (title, message) => {
    setMessageDialog({ visible: true, title, message });
  };

  const closeMessage = () => {
    setMessageDialog((current) => ({ ...current, visible: false }));
  };

  const getFriendlyAuthError = (error) => {
    const message = error?.message || t('login.unknownError');

    if (message.includes('Email signups are disabled')) {
      return t('login.emailSignupDisabled');
    }

    if (message.includes('Email logins are disabled')) {
      return t('login.emailLoginDisabled');
    }

    if (message.includes('Invalid login credentials')) {
      return t('login.invalidCredentials');
    }

    if (message.includes('User already registered')) {
      return t('login.userRegistered');
    }

    return message;
  };

  const validateAuthForm = () => {
    const normalizedEmail = email.trim();
    const normalizedName = fullName.trim();

    if (!isSupabaseConfigured) {
      showMessage(
        t('login.missingConfigTitle'),
        t('login.missingConfigMessage')
      );
      return null;
    }

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      showMessage(t('login.emailRequiredTitle'), t('login.emailRequiredMessage'));
      return null;
    }

    if (password.length < 6) {
      showMessage(t('login.shortPasswordTitle'), t('login.shortPasswordMessage'));
      return null;
    }

    if (authMode === 'signup' && !normalizedName) {
      showMessage(t('login.nameRequiredTitle'), t('login.nameRequiredMessage'));
      return null;
    }

    return {
      email: normalizedEmail,
      password,
      profile: {
        fullName: normalizedName,
        heightCm: heightCm.trim(),
        weightKg: weightKg.trim(),
      },
    };
  };

  const validateEmailOnly = () => {
    const normalizedEmail = email.trim();

    if (!isSupabaseConfigured) {
      showMessage(
        t('login.missingConfigTitle'),
        t('login.missingConfigMessage')
      );
      return null;
    }

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      showMessage(t('login.emailRequiredTitle'), t('login.resetEmailRequiredMessage'));
      return null;
    }

    return normalizedEmail;
  };

  const handleAnonymousLogin = async () => {
    setAnonymousDialogVisible(true);
  };

  const confirmAnonymousMode = async () => {
    try {
      setAnonymousDialogVisible(false);
      await waitForDialogExit();
      setStartingAnonymousMode(true);
      await startLocalMode();
    } catch (error) {
      console.error('Anonim mod başlatılamadı:', error);
      showMessage(t('login.anonymousFailed'), getFriendlyAuthError(error));
    } finally {
      setStartingAnonymousMode(false);
    }
  };

  const handleLogin = async () => {
    const credentials = validateAuthForm();
    if (!credentials) return;

    try {
      setIsSubmitting(true);
      await signInWithPassword(credentials.email, credentials.password);
    } catch (error) {
      console.error('Giriş hatası:', error);
      showMessage(t('login.loginFailed'), getFriendlyAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async () => {
    const credentials = validateAuthForm();
    if (!credentials) return;

    try {
      setIsSubmitting(true);
      const data = await signUpWithPassword(credentials);

      if (!data.session?.user?.id) {
        showMessage(
          t('login.signupCreatedTitle'),
          t('login.signupCreatedMessage')
        );
      }
    } catch (error) {
      console.error('Kayıt hatası:', error);
      showMessage(t('login.signupFailed'), getFriendlyAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = validateEmailOnly();
    if (!normalizedEmail) return;

    try {
      setIsSubmitting(true);
      await requestPasswordReset(normalizedEmail);
      showMessage(
        t('login.resetSentTitle'),
        t('login.resetSentMessage')
      );
    } catch (error) {
      console.error('Şifre sıfırlama hatası:', error);
      showMessage(t('login.resetFailed'), getFriendlyAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedDialog
        visible={isAnonymousDialogVisible}
        title={t('login.anonymousTitle')}
        message={t('login.anonymousMessage')}
        actions={[
          { label: t('common.cancel'), onPress: () => setAnonymousDialogVisible(false) },
          { label: t('common.continue'), variant: 'primary', onPress: confirmAnonymousMode },
        ]}
      />
      <ThemedDialog
        visible={messageDialog.visible}
        title={messageDialog.title}
        message={messageDialog.message}
        actions={[
          { label: t('common.ok'), variant: 'primary', onPress: closeMessage },
        ]}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            {canCloseLoginScreen ? (
              <TouchableOpacity onPress={closeLoginScreen} style={styles.closeButton} activeOpacity={0.7}>
                <MaterialIcons name="close" size={24} color={colors.secondary} />
              </TouchableOpacity>
            ) : (
              <View style={styles.closeButtonPlaceholder} />
            )}
            <Text style={[styles.appTitle, { color: colors.text }]}>OwnApp</Text>
            <TouchableOpacity onPress={toggleTheme} style={styles.themeButton} activeOpacity={0.7}>
              <MaterialIcons name={theme === 'dark' ? 'light-mode' : 'dark-mode'} size={24} color={colors.secondary} />
            </TouchableOpacity>
          </View>

          {/* Main Content */}
          <View style={styles.main}>
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: colors.text }]}>{t('login.welcome')}</Text>
              <Text style={[styles.subtitle, { color: colors.secondary }]}>
                {t('login.subtitle')}
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.actionContainer}>
              <TouchableOpacity
                style={[styles.anonymousButton, { borderColor: colors.outline, backgroundColor: 'transparent' }]}
                onPress={handleAnonymousLogin}
                disabled={isSubmitting || isStartingAnonymousMode}
              >
                <MaterialIcons name="fingerprint" size={24} color={colors.text} style={{ opacity: 0.6 }} />
                <Text style={[styles.anonymousButtonText, { color: colors.text }]}>{t('login.anonymous')}</Text>
              </TouchableOpacity>

              <View style={[styles.authModeRow, { backgroundColor: colors.surfaceVariant, borderColor: colors.outline }]}>
                <TouchableOpacity
                  style={[styles.authModeButton, authMode === 'login' && { backgroundColor: colors.primary }]}
                  onPress={() => setAuthMode('login')}
                  disabled={isSubmitting}
                >
                  <Text style={[styles.authModeButtonText, { color: authMode === 'login' ? colors.background : colors.text }]}>{t('login.login')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.authModeButton, authMode === 'signup' && { backgroundColor: colors.primary }]}
                  onPress={() => setAuthMode('signup')}
                  disabled={isSubmitting}
                >
                  <Text style={[styles.authModeButtonText, { color: authMode === 'signup' ? colors.background : colors.text }]}>{t('login.signup')}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formContainer}>
                  {authMode === 'signup' && (
                    <>
                      <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: colors.secondary }]}>{t('drawer.name')}</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.outline, color: colors.text }]}
                          placeholder={t('drawer.namePlaceholder')}
                          placeholderTextColor={colors.placeholder}
                          value={fullName}
                          onChangeText={setFullName}
                          autoCapitalize="words"
                          autoCorrect={false}
                        />
                      </View>

                      <View style={styles.profileRow}>
                        <View style={[styles.inputGroup, styles.profileInputGroup]}>
                          <Text style={[styles.label, { color: colors.secondary }]}>{t('drawer.height')}</Text>
                          <TextInput
                            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.outline, color: colors.text }]}
                            placeholder="170"
                            placeholderTextColor={colors.placeholder}
                            value={heightCm}
                            onChangeText={setHeightCm}
                            keyboardType="numeric"
                          />
                        </View>

                        <View style={[styles.inputGroup, styles.profileInputGroup]}>
                          <Text style={[styles.label, { color: colors.secondary }]}>{t('drawer.weight')}</Text>
                          <TextInput
                            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.outline, color: colors.text }]}
                            placeholder="60"
                            placeholderTextColor={colors.placeholder}
                            value={weightKg}
                            onChangeText={setWeightKg}
                            keyboardType="numeric"
                          />
                        </View>
                      </View>
                    </>
                  )}

                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.secondary }]}>{t('login.email')}</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.outline, color: colors.text }]}
                      placeholder={t('login.emailPlaceholder')}
                      placeholderTextColor={colors.placeholder}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      textContentType="emailAddress"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.secondary }]}>{t('login.password')}</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.outline, color: colors.text }]}
                      placeholder={t('login.passwordPlaceholder')}
                      placeholderTextColor={colors.placeholder}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="off"
                      textContentType="none"
                      contextMenuHidden
                    />
                  </View>

                  {authMode === 'login' ? (
                    <>
                      <TouchableOpacity
                        style={[styles.submitButton, { backgroundColor: colors.primary }]}
                        onPress={handleLogin}
                        disabled={isSubmitting}
                      >
                        <Text style={[styles.submitButtonText, { color: theme === 'dark' ? colors.background : colors.white }]}>
                          {isSubmitting ? t('common.processing') : t('login.login')}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.forgotPassword} onPress={handleForgotPassword} disabled={isSubmitting}>
                        <Text style={[styles.forgotPasswordText, { color: colors.secondary }]}>{t('login.forgotPassword')}</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={[styles.submitButton, { backgroundColor: colors.primary }]}
                      onPress={handleSignUp}
                      disabled={isSubmitting}
                    >
                      <Text style={[styles.submitButtonText, { color: theme === 'dark' ? colors.background : colors.white }]}>
                        {isSubmitting ? t('common.processing') : t('login.signup')}
                      </Text>
                    </TouchableOpacity>
                  )}
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingBottom: 20,
  },
  header: {
    height: 64,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  themeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  appTitle: {
    fontSize: 14,
    letterSpacing: 5,
    fontWeight: '200',
  },
  main: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 28,
    paddingTop: 10,
    minHeight: 620,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 34,
    fontWeight: '100',
    letterSpacing: -1,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '300',
    letterSpacing: 1,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  actionContainer: {
    gap: 14,
  },
  anonymousButton: {
    height: 60,
    borderWidth: 1,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  anonymousButtonText: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 1,
  },
  authModeRow: {
    height: 58,
    borderWidth: 1,
    borderRadius: 20,
    padding: 6,
    flexDirection: 'row',
    gap: 6,
  },
  authModeButton: {
    flex: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authModeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  formContainer: {
    marginTop: 18,
    gap: 18,
  },
  profileRow: {
    flexDirection: 'row',
    gap: 12,
  },
  profileInputGroup: {
    flex: 1,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 10,
    letterSpacing: 2,
    marginLeft: 4,
  },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  submitButton: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
  forgotPassword: {
    alignItems: 'center',
    paddingTop: 2,
  },
  forgotPasswordText: {
    fontSize: 12,
    letterSpacing: 1,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
});
