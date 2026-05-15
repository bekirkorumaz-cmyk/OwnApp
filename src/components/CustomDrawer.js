import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Linking,
} from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ThemedDialog } from './ThemedDialog';

const DRAWER_VERTICAL_PADDING = 40;
const FOOTER_BOTTOM_PADDING = 40;
const waitForDialogExit = () => new Promise((resolve) => setTimeout(resolve, 150));

export const CustomDrawer = (props) => {
  const { isDark, isMono, colors, toggleTheme, toggleColorMode } = useTheme();
  const { t } = useLanguage();
  const { isLocalMode, returnToLogin, signOut, profile, updateProfile, deleteAccount, finalizeDeletedAccount } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [expandedSection, setExpandedSection] = useState(null);
  const [isHelpExpanded, setHelpExpanded] = useState(false);
  const [isCloudDialogVisible, setCloudDialogVisible] = useState(false);
  const [isDeleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [isProfileEditing, setProfileEditing] = useState(false);
  const [messageDialog, setMessageDialog] = useState({
    visible: false,
    title: '',
    message: '',
  });
  const [shouldExitAfterMessage, setShouldExitAfterMessage] = useState(false);
  const [deleteCountdown, setDeleteCountdown] = useState(5);
  const [isDeletingAccount, setDeletingAccount] = useState(false);
  const [profileName, setProfileName] = useState(profile?.fullName || '');
  const [profileHeight, setProfileHeight] = useState(String(profile?.heightCm || ''));
  const [profileWeight, setProfileWeight] = useState(String(profile?.weightKg || ''));

  useEffect(() => {
    setProfileName(profile?.fullName || '');
    setProfileHeight(String(profile?.heightCm || ''));
    setProfileWeight(String(profile?.weightKg || ''));
    setProfileEditing(false);
  }, [profile?.fullName, profile?.heightCm, profile?.weightKg]);

  useEffect(() => {
    if (!isDeleteDialogVisible) {
      setDeleteCountdown(5);
      return undefined;
    }

    const intervalId = setInterval(() => {
      setDeleteCountdown((current) => {
        if (current <= 1) {
          clearInterval(intervalId);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isDeleteDialogVisible]);

  const showMessage = (title, message) => {
    setMessageDialog({
      visible: true,
      title,
      message,
    });
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleAccountAction = () => {
    if (isLocalMode) {
      setCloudDialogVisible(true);
      return;
    }

    signOut().catch((error) => {
      showMessage(t('drawer.signOutFailed'), error.message);
    });
  };

  const handleUpdateProfile = async () => {
    try {
      await updateProfile({
        fullName: profileName.trim(),
        heightCm: profileHeight.trim(),
        weightKg: profileWeight.trim(),
      });
      setProfileEditing(false);
      showMessage(t('drawer.profileUpdatedTitle'), t('drawer.profileUpdatedMessage'));
    } catch (error) {
      showMessage(t('drawer.profileUpdateFailed'), error.message);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setDeletingAccount(true);
      await deleteAccount();

      setDeleteDialogVisible(false);
      await waitForDialogExit();
      setShouldExitAfterMessage(true);
      showMessage(
        t('drawer.accountDeletedTitle'),
        isLocalMode
          ? t('drawer.localDeleted')
          : t('drawer.remoteDeleted')
      );
    } catch (error) {
      showMessage(t('drawer.deleteFailed'), error.message);
    } finally {
      setDeletingAccount(false);
    }
  };

  const accountTypeLabel = isLocalMode ? t('drawer.anonymousAccount') : t('drawer.registeredAccount');
  const accountTypeDescription = isLocalMode
    ? t('drawer.localData')
    : t('drawer.cloudData');
  const isReadOnlyProfile = !isLocalMode && !isProfileEditing;
  const isRegisteredProfile = !isLocalMode;
  const isDeleteConfirmEnabled = deleteCountdown <= 0;
  const deleteDialogMessage = isLocalMode
    ? t('drawer.deleteLocalMessage')
    : t('drawer.deleteRemoteMessage');
  const deleteButtonBackground = isDeleteConfirmEnabled ? colors.error : `${colors.error}66`;

  const handleOpenHelpTour = () => {
    props.navigation.closeDrawer();
    setTimeout(() => {
      props.navigation.navigate('Home', {
        helpTourNonce: Date.now(),
        helpTourStartDelayMs: 340,
      });
    }, 80);
  };

  const handleReportIssue = async () => {
    const mailToUrl = 'mailto:info@sers.com.tr?subject=Ownapp%20Feedback';
    try {
      const canOpen = await Linking.canOpenURL(mailToUrl);
      if (!canOpen) {
        showMessage(t('drawer.mailFailed'), t('drawer.mailMissing'));
        return;
      }
      await Linking.openURL(mailToUrl);
    } catch (error) {
      showMessage(t('drawer.mailFailed'), error.message);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemedDialog
        coverScreen
        visible={isCloudDialogVisible}
        title={t('drawer.cloudTitle')}
        message={t('drawer.cloudMessage')}
        actions={[
          { label: t('common.cancel'), onPress: () => setCloudDialogVisible(false) },
          {
            label: t('common.continue'),
            variant: 'primary',
            onPress: () => {
              setCloudDialogVisible(false);
              returnToLogin();
            },
          },
        ]}
      />
      <ThemedDialog
        coverScreen
        visible={messageDialog.visible}
        title={messageDialog.title}
        message={messageDialog.message}
        actions={[
          {
            label: t('common.ok'),
            variant: 'primary',
            onPress: async () => {
              setMessageDialog((current) => ({ ...current, visible: false }));

              if (shouldExitAfterMessage) {
                await waitForDialogExit();
                setShouldExitAfterMessage(false);
                await finalizeDeletedAccount();
              }
            },
          },
        ]}
      />
      <ThemedDialog
        coverScreen
        visible={isDeleteDialogVisible}
        title={t('drawer.deleteTitle')}
        message={`${deleteDialogMessage}${deleteCountdown > 0 ? `\n\n${t('drawer.deleteCountdown', { count: deleteCountdown })}` : ''}`}
        actions={[
          {
            label: t('common.cancel'),
            onPress: () => setDeleteDialogVisible(false),
          },
          {
            label: isDeletingAccount ? t('drawer.deleting') : (deleteCountdown > 0 ? `${deleteCountdown}` : t('common.confirm')),
            variant: 'custom',
            onPress: () => {
              if (!isDeleteConfirmEnabled || isDeletingAccount) return;
              handleDeleteAccount();
            },
            disabled: !isDeleteConfirmEnabled || isDeletingAccount,
            backgroundColor: deleteButtonBackground,
            textColor: '#FFFFFF',
          },
        ]}
      />
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={[
          styles.drawerContent,
          {
            paddingTop: DRAWER_VERTICAL_PADDING + insets.top,
            paddingBottom: FOOTER_BOTTOM_PADDING + insets.bottom + 24,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.primary }]}>{t('drawer.menu')}</Text>
        </View>

        {/* Theme Toggle */}
        <View style={styles.modeToggleGroup}>
          <TouchableOpacity
            style={styles.modeToggleCard}
            onPress={toggleTheme}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeToggleLabel, { color: colors.secondary }]}>
              {isDark ? t('drawer.darkOn') : t('drawer.darkOff')}
            </Text>
            <View style={[styles.modeToggle, { backgroundColor: colors.surfaceVariant, alignItems: isDark ? 'flex-end' : 'flex-start' }]}>
              <View style={[styles.modeHandle, { backgroundColor: colors.primary }]}>
                <MaterialIcons name={isDark ? 'dark-mode' : 'light-mode'} size={13} color={isDark ? colors.background : colors.white} />
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modeToggleCard}
            onPress={toggleColorMode}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeToggleLabel, { color: colors.secondary }]}>
              {isMono ? t('drawer.mono') : t('drawer.color')}
            </Text>
            <View style={[styles.modeToggle, { backgroundColor: colors.surfaceVariant, alignItems: isMono ? 'flex-start' : 'flex-end' }]}>
              <View style={[styles.modeHandle, { backgroundColor: colors.primary }]}>
                <MaterialIcons name={isMono ? 'contrast' : 'palette'} size={13} color={isDark ? colors.background : colors.white} />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Navigation Sections */}
        <View style={styles.navContainer}>
          {/* Section: HESABIM */}
          <View style={styles.section}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection('hesabim')}
              >
                <View style={styles.sectionHeaderLeft}>
                  <MaterialIcons name="person-outline" size={20} color={colors.secondary} />
                  <Text style={[styles.sectionLabel, { color: colors.secondary }]}>{t('drawer.myAccount')}</Text>
                </View>
                <MaterialIcons
                  name={expandedSection === 'hesabim' ? 'expand-less' : 'expand-more'}
                  size={20}
                  color={colors.secondary}
                />
              </TouchableOpacity>

              {expandedSection === 'hesabim' && (
                <View style={styles.expandedContent}>
                  <View style={[styles.accountTypeCard, { backgroundColor: colors.softCardStrong, borderColor: colors.outline + '35' }]}>
                    <View style={styles.accountTypeHeaderRow}>
                      <View style={styles.accountTypeTextBlock}>
                        <Text style={[styles.accountTypeLabel, { color: isLocalMode ? colors.secondary : colors.primary }]}>
                          {accountTypeLabel}
                        </Text>
                        <Text style={[styles.accountTypeDescription, { color: colors.secondary }]}>
                          {accountTypeDescription}
                        </Text>
                      </View>
                      {!isLocalMode ? (
                        <TouchableOpacity
                          style={[styles.profileEditButton, { borderColor: colors.outline, backgroundColor: colors.background }]}
                          onPress={() => setProfileEditing((current) => !current)}
                          activeOpacity={0.85}
                        >
                          <MaterialIcons name={isProfileEditing ? 'close' : 'edit'} size={16} color={colors.primary} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                  {isReadOnlyProfile ? (
                    <View style={styles.profileInfoList}>
                      <Text style={[styles.profileInfoHint, { color: colors.outline }]}>
                        {t('drawer.editProfileHint')}
                      </Text>
                      <View style={[styles.profileInfoCard, { backgroundColor: colors.softCardStrong, borderColor: colors.outline + '35' }]}>
                        <Text style={[styles.profileInfoLabel, { color: colors.outline }]}>{t('drawer.name')}</Text>
                        <Text style={[styles.profileInfoValue, { color: colors.text }]}>{profileName || t('common.notSpecified')}</Text>
                      </View>
                      <View style={[styles.profileInfoCard, { backgroundColor: colors.softCardStrong, borderColor: colors.outline + '35' }]}>
                        <Text style={[styles.profileInfoLabel, { color: colors.outline }]}>{t('drawer.height')}</Text>
                        <Text style={[styles.profileInfoValue, { color: colors.text }]}>{profileHeight || t('common.notSpecified')}</Text>
                      </View>
                      <View style={[styles.profileInfoCard, { backgroundColor: colors.softCardStrong, borderColor: colors.outline + '35' }]}>
                        <Text style={[styles.profileInfoLabel, { color: colors.outline }]}>{t('drawer.weight')}</Text>
                        <Text style={[styles.profileInfoValue, { color: colors.text }]}>{profileWeight || t('common.notSpecified')}</Text>
                      </View>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.profileEditorCard,
                        {
                          backgroundColor: colors.softCardStrong,
                          borderColor: colors.outline + '35',
                        },
                      ]}
                    >
                      {isRegisteredProfile ? (
                        <Text style={[styles.profileEditorTitle, { color: colors.primary }]}>{t('drawer.editProfile')}</Text>
                      ) : null}
                      <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: colors.outline }]}>{t('drawer.name')}</Text>
                        <TextInput
                          style={[
                            styles.input,
                            {
                              backgroundColor: colors.softCardStrong,
                              borderColor: colors.outline,
                              color: colors.text,
                            },
                          ]}
                          placeholder={t('drawer.namePlaceholder')}
                          placeholderTextColor={colors.placeholder}
                          value={profileName}
                          onChangeText={setProfileName}
                        />
                      </View>
                      <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: colors.outline }]}>{t('drawer.height')}</Text>
                        <TextInput
                          style={[
                            styles.input,
                            {
                              backgroundColor: colors.softCardStrong,
                              borderColor: colors.outline,
                              color: colors.text,
                            },
                          ]}
                          placeholder="170"
                          placeholderTextColor={colors.placeholder}
                          keyboardType="numeric"
                          value={profileHeight}
                          onChangeText={setProfileHeight}
                        />
                      </View>
                      <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: colors.outline }]}>{t('drawer.weight')}</Text>
                        <TextInput
                          style={[
                            styles.input,
                            {
                              backgroundColor: colors.softCardStrong,
                              borderColor: colors.outline,
                              color: colors.text,
                            },
                          ]}
                          placeholder="60"
                          placeholderTextColor={colors.placeholder}
                          keyboardType="numeric"
                          value={profileWeight}
                          onChangeText={setProfileWeight}
                        />
                      </View>
                    </View>
                  )}
                  {(isLocalMode || isProfileEditing) ? (
                    <TouchableOpacity style={[styles.updateButton, { backgroundColor: colors.primary }]} onPress={handleUpdateProfile}>
                      <Text style={[styles.updateButtonText, { color: colors.background }]}>{t('common.save')}</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={[styles.deleteAccountButton, { backgroundColor: `${colors.error}18`, borderColor: `${colors.error}55` }]}
                    onPress={() => setDeleteDialogVisible(true)}
                  >
                    <Text style={[styles.deleteAccountText, { color: colors.error }]}>{t('drawer.deleteAccount')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

          {/* Section: HESAP */}
          <View style={[styles.section, { borderTopWidth: 1, borderTopColor: colors.outline + '20' }]}>
            <TouchableOpacity 
              style={styles.sectionHeader}
              onPress={handleAccountAction}
            >
              <View style={styles.sectionHeaderLeft}>
                <MaterialIcons name="login" size={20} color={colors.secondary} />
                <Text style={[styles.sectionLabel, { color: colors.secondary }]}>
                  {isLocalMode ? t('drawer.loginOrSignup') : t('drawer.signOut')}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: FOOTER_BOTTOM_PADDING + insets.bottom, borderTopWidth: 1, borderTopColor: colors.outline + '20' }]}>
          <TouchableOpacity style={styles.footerItem} onPress={() => setHelpExpanded((value) => !value)}>
            <View style={[styles.footerIconContainer, { borderColor: colors.outline + '40' }]}>
              <MaterialIcons name="help-outline" size={16} color={colors.secondary} />
            </View>
            <Text style={[styles.footerText, { color: colors.secondary }]}>{t('drawer.help')}</Text>
            <MaterialIcons
              name={isHelpExpanded ? 'expand-less' : 'expand-more'}
              size={18}
              color={colors.secondary}
              style={{ marginLeft: 'auto' }}
            />
          </TouchableOpacity>
          {isHelpExpanded && (
            <View style={[styles.helpPanel, { borderColor: colors.outline + '25', backgroundColor: colors.softCardStrong }]}>
              <TouchableOpacity style={styles.helpRow} onPress={handleOpenHelpTour}>
                <MaterialIcons name="tips-and-updates" size={16} color={colors.primary} />
                <Text style={[styles.helpText, { color: colors.primary }]}>{t('drawer.appTour')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.helpRow} onPress={handleReportIssue}>
                <MaterialIcons name="mail-outline" size={16} color={colors.primary} />
                <Text style={[styles.helpText, { color: colors.primary }]}>{t('drawer.report')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </DrawerContentScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  drawerContent: { paddingHorizontal: 32, paddingVertical: DRAWER_VERTICAL_PADDING, flexGrow: 1 },
  header: { marginBottom: 56 },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 4,
  },
  modeToggleGroup: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 44,
  },
  modeToggleCard: {
    flex: 1,
    gap: 10,
  },
  modeToggleLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  modeToggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 4,
    alignSelf: 'flex-start',
  },
  modeHandle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navContainer: {},
  section: { paddingVertical: 8 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  expandedContent: {
    marginTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  accountTypeCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  accountTypeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  accountTypeTextBlock: {
    flex: 1,
    gap: 4,
  },
  accountTypeLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  accountTypeDescription: {
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '600',
  },
  profileEditButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfoList: {
    gap: 10,
  },
  profileInfoHint: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    lineHeight: 15,
    paddingHorizontal: 2,
  },
  profileInfoCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 4,
  },
  profileEditorCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  profileEditorTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  profileInfoLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  profileInfoValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  inputGroup: { gap: 4 },
  inputLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    marginLeft: 4,
  },
  input: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '700',
  },
  updateButton: {
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  updateButtonText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.5,
  },
  deleteAccountButton: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAccountText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.3,
  },
  footer: {
    padding: 32,
    paddingBottom: FOOTER_BOTTOM_PADDING,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  footerIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  helpPanel: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 36,
    paddingHorizontal: 4,
  },
  helpText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
});
