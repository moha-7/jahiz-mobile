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

type ForgotPasswordCopy = {
  emailTitle: string;
  emailSubtitle: string;
  emailLabel: string;
  emailPlaceholder: string;
  sendCode: string;
  codeTitle: string;
  codeSubtitle: string;
  codeLabel: string;
  codePlaceholder: string;
  verifyCode: string;
  resendCode: string;
  passwordTitle: string;
  passwordSubtitle: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  showPassword: string;
  hidePassword: string;
  updatePassword: string;
  backToSignIn: string;
  startOver: string;
  requiredEmail: string;
  requiredCode: string;
  requiredPassword: string;
  genericError: string;
  unsupportedStep: string;
};

const englishCopy: ForgotPasswordCopy = {
  emailTitle: 'Reset your password',
  emailSubtitle:
    'Enter your email and we’ll send you a secure reset code.',
  emailLabel: 'Email address',
  emailPlaceholder: 'you@example.com',
  sendCode: 'Send reset code',

  codeTitle: 'Check your email',
  codeSubtitle:
    'Enter the password reset code we sent to your email.',
  codeLabel: 'Reset code',
  codePlaceholder: 'Enter the code',
  verifyCode: 'Verify code',
  resendCode: 'Send a new code',

  passwordTitle: 'Create a new password',
  passwordSubtitle:
    'Choose a new password for your Jahiz account.',
  passwordLabel: 'New password',
  passwordPlaceholder: 'Enter a new password',
  showPassword: 'Show',
  hidePassword: 'Hide',
  updatePassword: 'Update password',

  backToSignIn: 'Back to sign in',
  startOver: 'Start over',

  requiredEmail:
    'Enter your email address.',
  requiredCode:
    'Enter the reset code.',
  requiredPassword:
    'Enter your new password.',
  genericError:
    'Something went wrong. Please try again.',
  unsupportedStep:
    'Your account requires an additional authentication step that is not available yet.',
};

const arabicCopy: ForgotPasswordCopy = {
  emailTitle: 'إعادة تعيين كلمة المرور',
  emailSubtitle:
    'أدخل بريدك وسنرسل لك رمزًا آمنًا لإعادة التعيين.',
  emailLabel: 'البريد الإلكتروني',
  emailPlaceholder: 'you@example.com',
  sendCode: 'إرسال رمز الاستعادة',

  codeTitle: 'راجع بريدك الإلكتروني',
  codeSubtitle:
    'أدخل رمز إعادة تعيين كلمة المرور الذي أرسلناه إلى بريدك.',
  codeLabel: 'رمز الاستعادة',
  codePlaceholder: 'أدخل الرمز',
  verifyCode: 'تأكيد الرمز',
  resendCode: 'إرسال رمز جديد',

  passwordTitle: 'أنشئ كلمة مرور جديدة',
  passwordSubtitle:
    'اختر كلمة مرور جديدة لحسابك في جاهز.',
  passwordLabel: 'كلمة المرور الجديدة',
  passwordPlaceholder: 'أدخل كلمة مرور جديدة',
  showPassword: 'إظهار',
  hidePassword: 'إخفاء',
  updatePassword: 'تحديث كلمة المرور',

  backToSignIn: 'العودة لتسجيل الدخول',
  startOver: 'البدء من جديد',

  requiredEmail:
    'أدخل بريدك الإلكتروني.',
  requiredCode:
    'أدخل رمز الاستعادة.',
  requiredPassword:
    'أدخل كلمة المرور الجديدة.',
  genericError:
    'حدث خطأ. حاول مرة أخرى.',
  unsupportedStep:
    'حسابك يحتاج خطوة تحقق إضافية لم يتم تفعيلها بعد.',
};

export function ForgotPasswordScreen() {
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

  const [code, setCode] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [
    codeSent,
    setCodeSent,
  ] = useState(false);

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

  function showGenericError() {
    setLocalError(
      copy.genericError,
    );
  }

  async function handleSendCode() {
    if (
      emailAddress.trim().length === 0 ||
      isBusy
    ) {
      setLocalError(
        copy.requiredEmail,
      );
      return;
    }

    setLocalError(null);

    try {
      const {
        error: createError,
      } = await signIn.create({
        identifier:
          emailAddress.trim(),
      });

      if (createError) {
        return;
      }

      const {
        error: sendCodeError,
      } =
        await signIn.resetPasswordEmailCode.sendCode();

      if (sendCodeError) {
        return;
      }

      setCode('');
      setCodeSent(true);
    } catch {
      showGenericError();
    }
  }

  async function handleVerifyCode() {
    if (
      code.trim().length === 0 ||
      isBusy
    ) {
      setLocalError(
        copy.requiredCode,
      );
      return;
    }

    setLocalError(null);

    try {
      const {
        error,
      } =
        await signIn.resetPasswordEmailCode.verifyCode({
          code: code.trim(),
        });

      if (error) {
        return;
      }

      if (
        signIn.status !==
        'needs_new_password'
      ) {
        if (
          signIn.status ===
            'needs_second_factor' ||
          signIn.status ===
            'needs_client_trust'
        ) {
          setLocalError(
            copy.unsupportedStep,
          );
          return;
        }

        showGenericError();
      }
    } catch {
      showGenericError();
    }
  }

  async function handleSubmitPassword() {
    if (
      password.length === 0 ||
      isBusy
    ) {
      setLocalError(
        copy.requiredPassword,
      );
      return;
    }

    setLocalError(null);

    try {
      const {
        error,
      } =
        await signIn.resetPasswordEmailCode.submitPassword({
          password,
          signOutOfOtherSessions: true,
        });

      if (error) {
        return;
      }

      if (
        signIn.status ===
        'complete'
      ) {
        const {
          error: finalizeError,
        } = await signIn.finalize({
          navigate: () => undefined,
        });

        if (finalizeError) {
          showGenericError();
        }

        return;
      }

      if (
        signIn.status ===
          'needs_second_factor' ||
        signIn.status ===
          'needs_client_trust'
      ) {
        setLocalError(
          copy.unsupportedStep,
        );
        return;
      }

      showGenericError();
    } catch {
      showGenericError();
    }
  }

  async function handleResendCode() {
    if (isBusy) {
      return;
    }

    setLocalError(null);

    try {
      const {
        error,
      } =
        await signIn.resetPasswordEmailCode.sendCode();

      if (error) {
        return;
      }

      setCode('');
    } catch {
      showGenericError();
    }
  }

  function handleStartOver() {
    signIn.reset();

    setCodeSent(false);
    setCode('');
    setPassword('');
    setPasswordVisible(false);
    setLocalError(null);
  }

  function handleBackToSignIn() {
    signIn.reset();

    router.replace(
      '/(auth)/sign-in',
    );
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
    'needs_new_password'
  ) {
    return (
      <JahizAuthScreen
        title={
          copy.passwordTitle
        }
        subtitle={
          copy.passwordSubtitle
        }
      >
        {errorBanner}

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
          autoComplete="new-password"
          textContentType="newPassword"
          editable={!isBusy}
          error={
            errors.fields.password
              ?.message ?? null
          }
          returnKeyType="done"
          onSubmitEditing={() => {
            void handleSubmitPassword();
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

        <PrimaryButton
          label={
            copy.updatePassword
          }
          disabled={
            password.length === 0 ||
            isBusy
          }
          busy={isBusy}
          textDirection={
            textDirection
          }
          onPress={() => {
            void handleSubmitPassword();
          }}
        />

        <SecondaryAction
          label={
            copy.backToSignIn
          }
          textDirection={
            textDirection
          }
          color={
            palette.textSecondary
          }
          onPress={
            handleBackToSignIn
          }
        />
      </JahizAuthScreen>
    );
  }

  if (codeSent) {
    return (
      <JahizAuthScreen
        title={copy.codeTitle}
        subtitle={
          copy.codeSubtitle
        }
      >
        {errorBanner}

        <JahizAuthField
          label={copy.codeLabel}
          value={code}
          onChangeText={setCode}
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
            void handleVerifyCode();
          }}
        />

        <PrimaryButton
          label={
            copy.verifyCode
          }
          disabled={
            code.trim().length === 0 ||
            isBusy
          }
          busy={isBusy}
          textDirection={
            textDirection
          }
          onPress={() => {
            void handleVerifyCode();
          }}
        />

        <View
          style={
            styles.secondaryActions
          }
        >
          <SecondaryAction
            label={
              copy.resendCode
            }
            textDirection={
              textDirection
            }
            color={
              palette.textSecondary
            }
            disabled={isBusy}
            onPress={() => {
              void handleResendCode();
            }}
          />

          <SecondaryAction
            label={
              copy.startOver
            }
            textDirection={
              textDirection
            }
            color={
              palette.textSecondary
            }
            disabled={isBusy}
            onPress={
              handleStartOver
            }
          />
        </View>
      </JahizAuthScreen>
    );
  }

  return (
    <JahizAuthScreen
      title={copy.emailTitle}
      subtitle={
        copy.emailSubtitle
      }
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
        returnKeyType="done"
        onSubmitEditing={() => {
          void handleSendCode();
        }}
      />

      <PrimaryButton
        label={copy.sendCode}
        disabled={
          emailAddress.trim()
            .length === 0 ||
          isBusy
        }
        busy={isBusy}
        textDirection={
          textDirection
        }
        onPress={() => {
          void handleSendCode();
        }}
      />

      <SecondaryAction
        label={
          copy.backToSignIn
        }
        textDirection={
          textDirection
        }
        color={
          palette.textSecondary
        }
        onPress={
          handleBackToSignIn
        }
      />
    </JahizAuthScreen>
  );
}

type PrimaryButtonProps = {
  label: string;
  disabled: boolean;
  busy: boolean;
  textDirection:
    'rtl' | 'ltr';
  onPress: () => void;
};

function PrimaryButton({
  label,
  disabled,
  busy,
  textDirection,
  onPress,
}: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        label
      }
      accessibilityState={{
        disabled,
        busy,
      }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryPressable,
        {
          opacity:
            disabled
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
        {busy ? (
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
            {label}
          </JzText>
        )}
      </LinearGradient>
    </Pressable>
  );
}

type SecondaryActionProps = {
  label: string;
  textDirection:
    'rtl' | 'ltr';
  color: string;
  disabled?: boolean;
  onPress: () => void;
};

function SecondaryAction({
  label,
  textDirection,
  color,
  disabled = false,
  onPress,
}: SecondaryActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        label
      }
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
    >
      <JzText
        variant="bodySmall"
        textDirection={
          textDirection
        }
        style={{
          color,
          fontWeight: '700',
        }}
      >
        {label}
      </JzText>
    </Pressable>
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
    secondaryActions: {
      width: '100%',
      alignItems: 'center',
      gap: spacing[3],
      paddingTop: spacing[1],
    },
  });