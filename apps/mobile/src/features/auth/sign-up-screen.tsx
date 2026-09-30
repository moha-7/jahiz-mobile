import { useState } from 'react';
import { useSignUp } from '@clerk/expo';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { JzText } from '@jahiz/ui';
import {
  colors,
  radius,
  spacing,
} from '@jahiz/design-tokens';

import { JahizAuthField } from '@/features/auth/jahiz-auth-field';
import { JahizAuthScreen } from '@/features/auth/jahiz-auth-screen';
import { useJahizLocale } from '@/providers/locale-provider';
import { useJahizTheme } from '@/providers/theme-provider';

type SignUpCopy = {
  title: string;
  subtitle: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  showPassword: string;
  hidePassword: string;
  createAccount: string;
  creatingAccount: string;
  requiredFields: string;
  genericError: string;
  alreadyHaveAccount: string;
  signIn: string;
};

const englishCopy: SignUpCopy = {
  title: 'Create your account',
  subtitle:
    'Start with a secure Jahiz account. Your trip plan stays yours.',
  emailLabel: 'Email address',
  emailPlaceholder: 'you@example.com',
  passwordLabel: 'Password',
  passwordPlaceholder: 'Create a strong password',
  showPassword: 'Show',
  hidePassword: 'Hide',
  createAccount: 'Create account',
  creatingAccount: 'Creating account...',
  requiredFields:
    'Enter your email address and password.',
  genericError:
    'Something went wrong. Please try again.',
  alreadyHaveAccount: 'Already have an account?',
  signIn: 'Sign in',
};

const arabicCopy: SignUpCopy = {
  title: 'أنشئ حسابك',
  subtitle:
    'ابدأ بحساب جاهز آمن. خطة سفرك تفضل ملكك أنت.',
  emailLabel: 'البريد الإلكتروني',
  emailPlaceholder: 'you@example.com',
  passwordLabel: 'كلمة المرور',
  passwordPlaceholder: 'أنشئ كلمة مرور قوية',
  showPassword: 'إظهار',
  hidePassword: 'إخفاء',
  createAccount: 'إنشاء حساب',
  creatingAccount: 'جارٍ إنشاء الحساب...',
  requiredFields:
    'أدخل البريد الإلكتروني وكلمة المرور.',
  genericError:
    'حدث خطأ. حاول مرة أخرى.',
  alreadyHaveAccount: 'لديك حساب بالفعل؟',
  signIn: 'تسجيل الدخول',
};

export function SignUpScreen() {
  const router = useRouter();

  const {
    signUp,
    errors,
    fetchStatus,
  } = useSignUp();

  const {
    locale,
    isRtl,
  } = useJahizLocale();

  const {
    palette,
  } = useJahizTheme();

  const copy =
    locale === 'ar'
      ? arabicCopy
      : englishCopy;

  const [emailAddress, setEmailAddress] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [
    passwordVisible,
    setPasswordVisible,
  ] = useState(false);

  const [
    localError,
    setLocalError,
  ] = useState<string | null>(null);

  const isBusy =
    fetchStatus === 'fetching';

  const textDirection =
    isRtl ? 'rtl' : 'ltr';

  const canSubmit =
    emailAddress.trim().length > 0 &&
    password.length > 0 &&
    !isBusy;

  async function handleCreateAccount() {
    if (!canSubmit) {
      setLocalError(
        copy.requiredFields,
      );
      return;
    }

    setLocalError(null);

    try {
      const {
        error,
      } = await signUp.password({
        emailAddress:
          emailAddress.trim(),
        password,
      });

      if (error) {
        return;
      }

      const {
        error: verificationError,
      } =
        await signUp.verifications.sendEmailCode();

      if (verificationError) {
        return;
      }

      router.push(
        '/(auth)/verify-email',
      );
    } catch {
      setLocalError(
        copy.genericError,
      );
    }
  }

  const footer = (
    <View
      style={[
        styles.footerRow,
        {
          flexDirection:
            isRtl
              ? 'row-reverse'
              : 'row',
        },
      ]}
    >
      <JzText
        variant="bodySmall"
        textDirection={
          textDirection
        }
        style={{
          color:
            palette.textSecondary,
        }}
      >
        {copy.alreadyHaveAccount}
      </JzText>

      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.replace(
            '/(auth)/sign-in',
          )
        }
        hitSlop={8}
      >
        <JzText
          variant="bodySmall"
          textDirection={
            textDirection
          }
          style={{
            color:
              palette.textPrimary,
            fontWeight: '800',
          }}
        >
          {copy.signIn}
        </JzText>
      </Pressable>
    </View>
  );

  return (
    <JahizAuthScreen
      title={copy.title}
      subtitle={copy.subtitle}
      footer={footer}
    >
      {localError ? (
        <View
          style={[
            styles.errorBanner,
            {
              backgroundColor:
                palette.dangerSurface,
              borderColor:
                palette.border,
            },
          ]}
        >
          <JzText
            variant="bodySmall"
            textDirection={
              textDirection
            }
            style={{
              color:
                palette.textPrimary,
              textAlign:
                isRtl
                  ? 'right'
                  : 'left',
            }}
          >
            {localError}
          </JzText>
        </View>
      ) : null}

      <JahizAuthField
        label={copy.emailLabel}
        value={emailAddress}
        onChangeText={
          setEmailAddress
        }
        placeholder={
          copy.emailPlaceholder
        }
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        editable={!isBusy}
        error={
          errors.fields.emailAddress
            ?.message ?? null
        }
        returnKeyType="next"
      />

      <JahizAuthField
        label={copy.passwordLabel}
        value={password}
        onChangeText={
          setPassword
        }
        placeholder={
          copy.passwordPlaceholder
        }
        secureTextEntry={
          !passwordVisible
        }
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        editable={!isBusy}
        error={
          errors.fields.password
            ?.message ?? null
        }
        returnKeyType="done"
        onSubmitEditing={() => {
          void handleCreateAccount();
        }}
        rightAccessory={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              passwordVisible
                ? copy.hidePassword
                : copy.showPassword
            }
            onPress={() =>
              setPasswordVisible(
                (current) =>
                  !current,
              )
            }
            hitSlop={10}
          >
            <JzText
              variant="caption"
              textDirection={
                textDirection
              }
              style={{
                color:
                  palette.textSecondary,
                fontWeight: '800',
              }}
            >
              {passwordVisible
                ? copy.hidePassword
                : copy.showPassword}
            </JzText>
          </Pressable>
        }
      />

      <View nativeID="clerk-captcha" />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          copy.createAccount
        }
        accessibilityState={{
          disabled: !canSubmit,
          busy: isBusy,
        }}
        disabled={!canSubmit}
        onPress={() => {
          void handleCreateAccount();
        }}
        style={({ pressed }) => [
          styles.primaryPressable,
          {
            opacity:
              !canSubmit
                ? 0.44
                : pressed
                  ? 0.82
                  : 1,
          },
        ]}
      >
        <LinearGradient
          colors={[
            '#74EDBA',
            '#2DD7A4',
            '#22C8AF',
          ]}
          start={{
            x: 0,
            y: 0,
          }}
          end={{
            x: 1,
            y: 1,
          }}
          style={
            styles.primaryButton
          }
        >
          {isBusy ? (
            <ActivityIndicator
              color={
                colors.navy950
              }
            />
          ) : (
            <JzText
              variant="body"
              textDirection={
                textDirection
              }
              style={
                styles.primaryText
              }
            >
              {copy.createAccount}
            </JzText>
          )}
        </LinearGradient>
      </Pressable>
    </JahizAuthScreen>
  );
}

const styles =
  StyleSheet.create({
    primaryPressable: {
      width: '100%',
      borderRadius: radius.lg,
    },
    primaryButton: {
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal:
        spacing[4],
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor:
        'rgba(187,255,230,0.56)',
    },
    primaryText: {
      color: colors.navy950,
      textAlign: 'center',
      fontWeight: '800',
    },
    errorBanner: {
      borderRadius: radius.lg,
      borderWidth: 1,
      paddingHorizontal:
        spacing[3],
      paddingVertical:
        spacing[2],
    },
    footerRow: {
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: spacing[1],
    },
  });