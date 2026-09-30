import type {
  PropsWithChildren,
  ReactNode,
} from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JzText } from '@jahiz/ui';
import {
  radius,
  spacing,
} from '@jahiz/design-tokens';

import { useJahizLocale } from '@/providers/locale-provider';
import { useJahizTheme } from '@/providers/theme-provider';

type JahizAuthScreenProps =
  PropsWithChildren<{
    title: string;
    subtitle?: string;
    footer?: ReactNode;
  }>;

const darkMark =
  require('../../../assets/brand/jahiz-mark-dark.png');

const lightMark =
  require('../../../assets/brand/jahiz-mark-light.png');

export function JahizAuthScreen({
  title,
  subtitle,
  footer,
  children,
}: JahizAuthScreenProps) {
  const {
    isRtl,
  } = useJahizLocale();

  const {
    isDark,
    palette,
  } = useJahizTheme();

  const textDirection =
    isRtl ? 'rtl' : 'ltr';

  const textAlign =
    isRtl ? 'right' : 'left';

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[
        styles.safeArea,
        {
          backgroundColor:
            palette.background,
        },
      ]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === 'ios'
              ? 'interactive'
              : 'on-drag'
          }
          contentContainerStyle={
            styles.scrollContent
          }
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View
            style={styles.container}
          >
            <View
              style={styles.brandBlock}
            >
              <Image
                source={
                  isDark
                    ? lightMark
                    : darkMark
                }
                resizeMode="contain"
                accessibilityIgnoresInvertColors
                style={styles.logo}
              />
            </View>

            <View
              style={[
                styles.headingBlock,
                {
                  alignItems:
                    isRtl
                      ? 'flex-end'
                      : 'flex-start',
                },
              ]}
            >
              <JzText
                variant="title"
                textDirection={
                  textDirection
                }
                style={{
                  color:
                    palette.textPrimary,
                  textAlign,
                  fontWeight: '800',
                }}
              >
                {title}
              </JzText>

              {subtitle ? (
                <JzText
                  variant="body"
                  textDirection={
                    textDirection
                  }
                  style={{
                    color:
                      palette.textSecondary,
                    textAlign,
                    lineHeight: 22,
                  }}
                >
                  {subtitle}
                </JzText>
              ) : null}
            </View>

            <View
              style={[
                styles.formCard,
                {
                  backgroundColor:
                    palette.surface,
                  borderColor:
                    palette.border,
                },
              ]}
            >
              {children}
            </View>

            {footer ? (
              <View
                style={
                  styles.footer
                }
              >
                {footer}
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    keyboardAvoidingView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal:
        spacing[4],
      paddingVertical:
        spacing[5],
    },
    container: {
      width: '100%',
      maxWidth: 460,
      alignSelf: 'center',
      gap: spacing[4],
    },
    brandBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 104,
    },
    logo: {
      width: 104,
      height: 104,
    },
    headingBlock: {
      gap: spacing[2],
    },
    formCard: {
      width: '100%',
      gap: spacing[3],
      padding: spacing[4],
      borderRadius: radius.xl,
      borderWidth:
        StyleSheet.hairlineWidth,
    },
    footer: {
      width: '100%',
      alignItems: 'center',
      paddingHorizontal:
        spacing[2],
    },
  });
