import type {
  ReactNode,
} from 'react';
import type {
  TextInputProps,
} from 'react-native';
import {
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { JzText } from '@jahiz/ui';
import {
  radius,
  spacing,
} from '@jahiz/design-tokens';

import { useJahizLocale } from '@/providers/locale-provider';
import { useJahizTheme } from '@/providers/theme-provider';

type JahizAuthFieldProps = {
  label: string;
  value: string;
  onChangeText:
    TextInputProps['onChangeText'];
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?:
    TextInputProps['keyboardType'];
  autoCapitalize?:
    TextInputProps['autoCapitalize'];
  autoCorrect?:
    TextInputProps['autoCorrect'];
  autoComplete?:
    TextInputProps['autoComplete'];
  textContentType?:
    TextInputProps['textContentType'];
  returnKeyType?:
    TextInputProps['returnKeyType'];
  editable?: boolean;
  error?: string | null;
  rightAccessory?: ReactNode;
  onSubmitEditing?:
    TextInputProps['onSubmitEditing'];
};

export function JahizAuthField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoCorrect = false,
  autoComplete,
  textContentType,
  returnKeyType,
  editable = true,
  error,
  rightAccessory,
  onSubmitEditing,
}: JahizAuthFieldProps) {
  const {
    isRtl,
  } = useJahizLocale();

  const {
    palette,
  } = useJahizTheme();

  const textDirection =
    isRtl ? 'rtl' : 'ltr';

  const textAlign =
    isRtl ? 'right' : 'left';

  return (
    <View
      style={styles.root}
    >
      <JzText
        variant="bodySmall"
        textDirection={
          textDirection
        }
        style={{
          color:
            palette.textSecondary,
          textAlign,
          fontWeight: '700',
        }}
      >
        {label}
      </JzText>

      <View
        style={[
          styles.inputShell,
          {
            flexDirection:
              isRtl
                ? 'row-reverse'
                : 'row',
            backgroundColor:
              palette.inputBackground,
            borderColor:
              error
                ? palette.dangerSurface
                : palette.borderStrong,
            opacity:
              editable ? 1 : 0.62,
          },
        ]}
      >
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={
            onChangeText
          }
          placeholder={
            placeholder
          }
          placeholderTextColor={
            palette.textMuted
          }
          secureTextEntry={
            secureTextEntry
          }
          keyboardType={
            keyboardType
          }
          autoCapitalize={
            autoCapitalize
          }
          autoCorrect={
            autoCorrect
          }
          autoComplete={
            autoComplete
          }
          textContentType={
            textContentType
          }
          returnKeyType={
            returnKeyType
          }
          editable={editable}
          onSubmitEditing={
            onSubmitEditing
          }
          selectionColor={
            palette.textPrimary
          }
          style={[
            styles.input,
            {
              color:
                palette.textPrimary,
              textAlign,
              writingDirection:
                isRtl
                  ? 'rtl'
                  : 'ltr',
            },
          ]}
        />

        {rightAccessory ? (
          <View
            style={
              styles.accessory
            }
          >
            {rightAccessory}
          </View>
        ) : null}
      </View>

      {error ? (
        <JzText
          variant="caption"
          textDirection={
            textDirection
          }
          style={{
            color:
              palette.textSecondary,
            textAlign,
          }}
        >
          {error}
        </JzText>
      ) : null}
    </View>
  );
}

const styles =
  StyleSheet.create({
    root: {
      gap: spacing[1],
    },
    inputShell: {
      minHeight: 54,
      alignItems: 'center',
      borderRadius: radius.lg,
      borderWidth: 1,
      paddingHorizontal:
        spacing[3],
    },
    input: {
      flex: 1,
      minHeight: 52,
      paddingVertical:
        spacing[2],
      fontSize: 16,
    },
    accessory: {
      alignItems: 'center',
      justifyContent: 'center',
      marginStart:
        spacing[2],
    },
  });
