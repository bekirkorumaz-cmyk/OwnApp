import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ThemedDialog } from '../components/ThemedDialog';

export const ResetPasswordScreen = () => {
  const { theme, colors } = useTheme();
  const { t } = useLanguage();
  const { completePasswordRecovery, cancelPasswordRecovery } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleSubmit = async () => {
    if (newPassword.length < 6) {
      showMessage(t('reset.shortTitle'), t('reset.shortMessage'));
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage(t('reset.mismatchTitle'), t('reset.mismatchMessage'));
      return;
    }

    try {
      setIsSubmitting(true);
      await completePasswordRecovery(newPassword);
      showMessage(t('reset.successTitle'), t('reset.successMessage'));
    } catch (error) {
      showMessage(t('reset.failedTitle'), error?.message || t('login.unknownError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedDialog
        visible={messageDialog.visible}
        title={messageDialog.title}
        message={messageDialog.message}
        actions={[
          { label: t('common.ok'), variant: 'primary', onPress: closeMessage },
        ]}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <View style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity onPress={cancelPasswordRecovery} disabled={isSubmitting} style={styles.iconButton}>
              <MaterialIcons name="close" size={24} color={colors.secondary} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>{t('reset.title')}</Text>
            <View style={styles.iconPlaceholder} />
          </View>

          <Text style={[styles.subtitle, { color: colors.secondary }]}>
            {t('reset.subtitle')}
          </Text>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.secondary }]}>{t('reset.newPassword')}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderBottomColor: colors.outline, color: colors.text }]}
                placeholder={t('reset.newPasswordPlaceholder')}
                placeholderTextColor={colors.placeholder}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password-new"
                textContentType="newPassword"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.secondary }]}>{t('reset.confirmPassword')}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderBottomColor: colors.outline, color: colors.text }]}
                placeholder={t('reset.confirmPasswordPlaceholder')}
                placeholderTextColor={colors.placeholder}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password-new"
                textContentType="newPassword"
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: colors.primary }]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Text style={[styles.submitButtonText, { color: theme === 'dark' ? colors.background : colors.white }]}>
                {isSubmitting ? t('common.processing') : t('reset.submit')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 40,
    paddingTop: 24,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPlaceholder: {
    width: 40,
    height: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    letterSpacing: 0.4,
  },
  form: {
    marginTop: 36,
    gap: 20,
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
    height: 56,
    borderRadius: 12,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  submitButton: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
});
