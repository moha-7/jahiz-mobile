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

type VerifyCopy = {
  title: string;
  subtitle: string;
  codeLabel: string;
  codePlaceholder: string;
  verify: string;
  verifying: string;
  resend: string;
  back: string;
  genericError: string;
  missingAttempt: string;
};

const englishCopy: VerifyCopy = {
  title: 'Check your email',
  subtitle:
    'Enter the verification code we sent to your email address.',
  codeLabel: 'Verification code',
  codePlaceholder: 'Enter the code',
  verify: 'Verify account',
  verifying: 'Verifying...',
  resend: 'Send a new code',
  back: 'Back to create account',
  genericError:
    'We could not verify that code. Please try again.',
  missingAttempt:
    'Your sign-up session is no longer available. Start again.',
};

const arabicCopy: VerifyCopy = {
  title: 'راجع بريدك الإلكتروني',
  subtitle:
    'أدخل رمز التحقق الذي أرسلناه إلى بريدك الإلكتروني.',
  codeLabel: 'رمز التحقق',
  codePlaceholder: 'أدخل الرمز',
  verify: 'تأكيد الحساب',
  verifying: 'جارٍ التحقق...',
  resend: 'إرسال رمز جديد',
  back: 'العودة لإنشاء الحساب',
  genericError:
    'لم نتمكن من تأكيد الرمز. حاول مرة أخرى.',
  missingAttempt:
    'جلسة إنشاء الحساب لم تعد متاحة. ابدأ من جديد.',
};

export function VerifyEmailScreen() {
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

  const [code, setCode] =
    useState('');

  const [
    localError,
    setLocalError,
  ] = useState<string | null>(null);

  const isBusy =
    fetchStatus === 'fetching';

  const textDirection =
    isRtl ? 'rtl' : 'ltr';

  const canVerify =
    code.trim().length > 0 &&
    !isBusy;

  async function handleVerify() {
    if (!canVerify) {
      return;
    }

    setLocalError(null);

    try {
      const {
        error,
      } =
        await signUp.verifications.verifyEmailCode({
          code: code.trim(),
        });

      if (error) {
        return;
      }

      if (
        signUp.status !==
        'complete'
      ) {
        setLocalError(
          copy.genericError,
        );
        return;
      }

      const {
        error: finalizeError,
      } = await signUp.finalize({
        navigate: () => {
          router.replace('/(tabs)');
        },
      });

      if (finalizeError) {
        setLocalError(
          copy.genericError,
        );
      }
    } catch {
      setLocalError(
        copy.genericError,
      );
    }
  }

  async function handleResend() {
    if (isBusy) {
      return;
    }

    setLocalError(null);

    try {
      const {
        error,
      } =
        await signUp.verifications.sendEmailCode();

      if (error) {
        return;
      }
    } catch {
      setLocalError(
        copy.genericError,
      );
    }
  }

  function handleBack() {
    signUp.reset();
    router.replace(
      '/(auth)/sign-up',
    );
  }

  return (
    <JahizAuthScreen
      title={copy.title}
      subtitle={copy.subtitle}
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
          void handleVerify();
        }}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          copy.verify
        }
        accessibilityState={{
          disabled: !canVerify,
          busy: isBusy,
        }}
        disabled={!canVerify}
        onPress={() => {
          void handleVerify();
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
          accessibilityLabel={
            copy.resend
          }
          disabled={isBusy}
          onPress={() => {
            void handleResend();
          }}
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
            {copy.resend}
          </JzText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            copy.back
          }
          disabled={isBusy}
          onPress={handleBack}
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
            {copy.back}
          </JzText>
        </Pressable>
      </View>
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
    secondaryActions: {
      width: '100%',
      alignItems: 'center',
      gap: spacing[3],
      paddingTop: spacing[1],
    },
  });