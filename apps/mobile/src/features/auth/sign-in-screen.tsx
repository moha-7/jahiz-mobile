import { useState } from 'react';
import { useSignIn } from '@clerk/expo';
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

type AuthCopy = {
  title: string;
  subtitle: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  showPassword: string;
  hidePassword: string;
  forgotPassword: string;
  signIn: string;
  signingIn: string;
  noAccount: string;
  createAccount: string;
  requiredFields: string;
  genericError: string;
  unsupportedStep: string;
  verificationTitle: string;
  verificationSubtitle: string;
  codeLabel: string;
  codePlaceholder: string;
  verify: string;
  verifying: string;
  resendCode: string;
  startOver: string;
};

const englishCopy: AuthCopy = {
  title: 'Welcome back',
  subtitle:
    'Sign in to keep your travel plan and money decisions together.',
  emailLabel: 'Email address',
  emailPlaceholder: 'you@example.com',
  passwordLabel: 'Password',
  passwordPlaceholder: 'Enter your password',
  showPassword: 'Show',
  hidePassword: 'Hide',
  forgotPassword: 'Forgot password?',
  signIn: 'Sign in',
  signingIn: 'Signing in...',
  noAccount: 'New to Jahiz?',
  createAccount: 'Create account',
  requiredFields:
    'Enter your email address and password.',
  genericError:
    'Something went wrong. Please try again.',
  unsupportedStep:
    'This account requires an additional authentication step that is not available yet.',
  verificationTitle: 'Verify this device',
  verificationSubtitle:
    'We sent a verification code to your email address.',
  codeLabel: 'Verification code',
  codePlaceholder: 'Enter the code',
  verify: 'Verify and continue',
  verifying: 'Verifying...',
  resendCode: 'Send a new code',
  startOver: 'Back to sign in',
};

const arabicCopy: AuthCopy = {
  title: 'أهلاً بعودتك',
  subtitle:
    'سجّل دخولك وخلي خطة سفرك وقراراتك المالية في مكان واحد.',
  emailLabel: 'البريد الإلكتروني',
  emailPlaceholder: 'you@example.com',
  passwordLabel: 'كلمة المرور',
  passwordPlaceholder: 'أدخل كلمة المرور',
  showPassword: 'إظهار',
  hidePassword: 'إخفاء',
  forgotPassword: 'نسيت كلمة المرور؟',
  signIn: 'تسجيل الدخول',
  signingIn: 'جارٍ تسجيل الدخول...',
  noAccount: 'جديد على جاهز؟',
  createAccount: 'إنشاء حساب',
  requiredFields:
    'أدخل البريد الإلكتروني وكلمة المرور.',
  genericError:
    'حدث خطأ. حاول مرة أخرى.',
  unsupportedStep:
    'هذا الحساب يحتاج خطوة تحقق إضافية لم يتم تفعيلها بعد.',
  verificationTitle: 'تأكيد هذا الجهاز',
  verificationSubtitle:
    'أرسلنا رمز تحقق إلى بريدك الإلكتروني.',
  codeLabel: 'رمز التحقق',
  codePlaceholder: 'أدخل الرمز',
  verify: 'تحقق واستمر',
  verifying: 'جارٍ التحقق...',
  resendCode: 'إرسال رمز جديد',
  startOver: 'العودة لتسجيل الدخول',
};

export function SignInScreen() {
  const router = useRouter();

  const {
    signIn,
    errors,
    fetchStatus,
  } = useSignIn();

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

  const [verificationCode, setVerificationCode] =
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

  const canVerify =
    verificationCode.trim().length > 0 &&
    !isBusy;

  async function finalizeSignIn() {
    await signIn.finalize({
      navigate: () => undefined,
    });
  }

  async function handleSignIn() {
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
      } = await signIn.password({
        emailAddress:
          emailAddress.trim(),
        password,
      });

      if (error) {
        return;
      }

      if (
        signIn.status ===
        'complete'
      ) {
        await finalizeSignIn();
        return;
      }

      if (
        signIn.status ===
        'needs_client_trust'
      ) {
        const emailCodeFactor =
          signIn.supportedSecondFactors.find(
            (factor) =>
              factor.strategy ===
              'email_code',
          );

        if (!emailCodeFactor) {
          setLocalError(
            copy.unsupportedStep,
          );
          return;
        }

        await signIn.mfa.sendEmailCode();
        return;
      }

      if (
        signIn.status ===
        'needs_second_factor'
      ) {
        setLocalError(
          copy.unsupportedStep,
        );
        return;
      }

      setLocalError(
        copy.genericError,
      );
    } catch {
      setLocalError(
        copy.genericError,
      );
    }
  }

  async function handleVerifyDevice() {
    if (!canVerify) {
      return;
    }

    setLocalError(null);

    try {
      const {
        error,
      } =
        await signIn.mfa.verifyEmailCode({
          code:
            verificationCode.trim(),
        });

      if (error) {
        return;
      }

      if (
        signIn.status ===
        'complete'
      ) {
        await finalizeSignIn();
        return;
      }

      setLocalError(
        copy.genericError,
      );
    } catch {
      setLocalError(
        copy.genericError,
      );
    }
  }

  async function handleResendCode() {
    if (isBusy) {
      return;
    }

    setLocalError(null);

    try {
      await signIn.mfa.sendEmailCode();
    } catch {
      setLocalError(
        copy.genericError,
      );
    }
  }

  function handleStartOver() {
    signIn.reset();

    setVerificationCode('');
    setPassword('');
    setLocalError(null);
  }

  const errorBanner =
    localError ? (
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
    ) : null;

  if (
    signIn.status ===
    'needs_client_trust'
  ) {
    return (
      <JahizAuthScreen
        title={
          copy.verificationTitle
        }
        subtitle={
          copy.verificationSubtitle
        }
      >
        {errorBanner}

        <JahizAuthField
          label={copy.codeLabel}
          value={verificationCode}
          onChangeText={
            setVerificationCode
          }
          placeholder={
            copy.codePlaceholder
          }
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          editable={!isBusy}
          error={
            errors.fields.code
              ?.message ?? null
          }
          returnKeyType="done"
          onSubmitEditing={() => {
            void handleVerifyDevice();
          }}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            copy.verify
          }
          disabled={!canVerify}
          onPress={() => {
            void handleVerifyDevice();
          }}
          style={({ pressed }) => [
            styles.primaryPressable,
            {
              opacity:
                !canVerify
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
                {copy.verify}
              </JzText>
            )}
          </LinearGradient>
        </Pressable>

        <View
          style={
            styles.secondaryActions
          }
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void handleResendCode();
            }}
            disabled={isBusy}
            hitSlop={8}
          >
            <JzText
              variant="bodySmall"
              textDirection={
                textDirection
              }
              style={{
                color:
                  palette.textSecondary,
                fontWeight: '700',
              }}
            >
              {copy.resendCode}
            </JzText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={
              handleStartOver
            }
            disabled={isBusy}
            hitSlop={8}
          >
            <JzText
              variant="bodySmall"
              textDirection={
                textDirection
              }
              style={{
                color:
                  palette.textSecondary,
                fontWeight: '700',
              }}
            >
              {copy.startOver}
            </JzText>
          </Pressable>
        </View>
      </JahizAuthScreen>
    );
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
        {copy.noAccount}
      </JzText>

      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.push(
            '/(auth)/sign-up',
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
          {copy.createAccount}
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
      {errorBanner}

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
          errors.fields.identifier
            ?.message ?? null
        }
        returnKeyType="next"
      />

      <JahizAuthField
        label={
          copy.passwordLabel
        }
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
        autoComplete="current-password"
        textContentType="password"
        editable={!isBusy}
        error={
          errors.fields.password
            ?.message ?? null
        }
        returnKeyType="done"
        onSubmitEditing={() => {
          void handleSignIn();
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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          copy.forgotPassword
        }
        disabled={isBusy}
        onPress={() =>
          router.push(
            '/(auth)/forgot-password',
          )
        }
        hitSlop={8}
        style={{
          alignSelf:
            isRtl
              ? 'flex-start'
              : 'flex-end',
        }}
      >
        <JzText
          variant="bodySmall"
          textDirection={
            textDirection
          }
          style={{
            color:
              palette.textSecondary,
            fontWeight: '700',
          }}
        >
          {copy.forgotPassword}
        </JzText>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          copy.signIn
        }
        accessibilityState={{
          disabled: !canSubmit,
          busy: isBusy,
        }}
        disabled={!canSubmit}
        onPress={() => {
          void handleSignIn();
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
              {copy.signIn}
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
    secondaryActions: {
      width: '100%',
      alignItems: 'center',
      gap: spacing[3],
      paddingTop: spacing[1],
    },
  });