import { Pressable, View } from 'react-native';
import { XStack, YStack } from 'tamagui';
import { JzText } from '@jahiz/ui';
import {
  colors,
  radius,
  spacing,
} from '@jahiz/design-tokens';
import type { AirportDirectoryItem } from '@jahiz/api-contracts';
import { JzGlassPanel } from '@/components/jz-glass-panel';
import { JzIcon } from '@/components/jz-icon';
import { getLocalizedAirportText } from '@/entities/airport/airport-directory';
import { useJahizTheme } from '@/providers/theme-provider';

type LocationCardProps = {
  label: string;
  emptyTitle: string;
  emptyHelper: string;
  airport: AirportDirectoryItem | null;
  isRtl: boolean;
  accessibilityLabel: string;
  onPress: () => void;
};

export function LocationCard({
  label,
  emptyTitle,
  emptyHelper,
  airport,
  isRtl,
  accessibilityLabel,
  onPress,
}: LocationCardProps) {
  const { palette } = useJahizTheme();
  const direction = isRtl ? 'row-reverse' : 'row';
  const align = isRtl ? 'flex-end' : 'flex-start';
  const textDirection = isRtl ? 'rtl' : 'ltr';
  const localized = airport
    ? getLocalizedAirportText(airport, isRtl)
    : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.76 : 1,
        transform: [
          {
            scale: pressed ? 0.995 : 1,
          },
        ],
      })}
    >
      <JzGlassPanel
        tone={airport ? 'mint' : 'surface'}
        style={{
          minHeight: airport ? 116 : 96,
          padding: spacing[4],
          borderRadius: radius.xl,
        }}
      >
        <XStack
          flexDirection={direction}
          justifyContent="space-between"
          alignItems="flex-start"
          gap={spacing[3]}
        >
          <YStack
            flex={1}
            alignItems={align}
            gap={spacing[1]}
          >
            <JzText
              variant="caption"
              textDirection={textDirection}
              style={{
                color: palette.textSecondary,
              }}
            >
              {label}
            </JzText>

            {airport && localized ? (
              <>
                <XStack
                  flexDirection={direction}
                  alignItems="center"
                  gap={spacing[2]}
                >
                  <JzText
                    variant="heading2"
                    textDirection="ltr"
                    style={{
                      color: palette.textPrimary,
                    }}
                  >
                    {airport.airportCode}
                  </JzText>

                  <View
                    style={{
                      paddingHorizontal: spacing[2],
                      paddingVertical: spacing[1],
                      borderRadius: radius.full,
                      backgroundColor:
                        palette.successSurface,
                    }}
                  >
                    <JzText
                      variant="caption"
                      textDirection="ltr"
                      style={{
                        color: colors.mint600,
                      }}
                    >
                      {airport.currency}
                    </JzText>
                  </View>
                </XStack>

                <JzText
                  variant="title"
                  textDirection={textDirection}
                  numberOfLines={1}
                  style={{
                    color: palette.textPrimary,
                  }}
                >
                  {localized.city}, {localized.country}
                </JzText>

                <JzText
                  variant="bodySmall"
                  textDirection={textDirection}
                  numberOfLines={2}
                  style={{
                    color: palette.textSecondary,
                  }}
                >
                  {localized.airport}
                </JzText>
              </>
            ) : (
              <>
                <JzText
                  variant="title"
                  textDirection={textDirection}
                  style={{
                    color: palette.textPrimary,
                  }}
                >
                  {emptyTitle}
                </JzText>

                <JzText
                  variant="bodySmall"
                  textDirection={textDirection}
                  style={{
                    color: palette.textMuted,
                  }}
                >
                  {emptyHelper}
                </JzText>
              </>
            )}
          </YStack>

          <View
            style={{
              width: 42,
              height: 42,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: palette.border,
              backgroundColor: airport
                ? palette.successSurface
                : palette.surfaceMuted,
            }}
          >
            <JzIcon
              name={airport ? 'edit' : 'search'}
              size={20}
              color={
                airport
                  ? colors.mint600
                  : palette.textSecondary
              }
              strokeWidth={2.1}
            />
          </View>
        </XStack>
      </JzGlassPanel>
    </Pressable>
  );
}
