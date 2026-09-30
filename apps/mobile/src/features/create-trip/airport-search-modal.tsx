import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { XStack, YStack } from 'tamagui';
import { JzText } from '@jahiz/ui';
import {
  colors,
  radius,
  spacing,
  touchTarget,
} from '@jahiz/design-tokens';
import type { AirportDirectoryItem } from '@jahiz/api-contracts';
import {
  airportDirectory,
  getLocalizedAirportText,
} from '@/entities/airport/airport-directory';
import { useJahizLocale } from '@/providers/locale-provider';
import { useJahizTheme } from '@/providers/theme-provider';
import type { RouteSelectionTarget } from './route-types';

type AirportSearchModalProps = {
  visible: boolean;
  target: RouteSelectionTarget;
  selectedAirportCode?: string;
  onClose: () => void;
  onSelect: (airport: AirportDirectoryItem) => void;
};

function AirportRow({
  airport,
  isRtl,
  selected,
  onPress,
}: {
  airport: AirportDirectoryItem;
  isRtl: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const { palette } = useJahizTheme();
  const direction = isRtl ? 'row-reverse' : 'row';
  const align = isRtl ? 'flex-end' : 'flex-start';
  const textDirection = isRtl ? 'rtl' : 'ltr';
  const localized = getLocalizedAirportText(
    airport,
    isRtl,
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${airport.airportCode} ${localized.airport}`}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <XStack
        minHeight={78}
        flexDirection={direction}
        alignItems="center"
        gap={spacing[3]}
        paddingHorizontal={spacing[4]}
        paddingVertical={spacing[3]}
        style={{
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
          backgroundColor: selected
            ? palette.successSurface
            : palette.surface,
        }}
      >
        <View
          style={{
            width: 52,
            height: 52,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.md,
            backgroundColor: selected
              ? colors.mint500
              : palette.surfaceMuted,
          }}
        >
          <JzText
            variant="title"
            textDirection="ltr"
            style={{
              color: selected
                ? colors.navy950
                : palette.textPrimary,
            }}
          >
            {airport.airportCode}
          </JzText>
        </View>

        <YStack
          flex={1}
          alignItems={align}
          gap={spacing[1]}
        >
          <JzText
            variant="bodySmall"
            textDirection={textDirection}
            numberOfLines={1}
            style={{
              color: palette.textPrimary,
            }}
          >
            {localized.airport}
          </JzText>

          <JzText
            variant="caption"
            textDirection={textDirection}
            numberOfLines={1}
            style={{
              color: palette.textSecondary,
            }}
          >
            {localized.city}, {localized.country}
          </JzText>
        </YStack>

        <YStack
          alignItems="center"
          gap={spacing[1]}
        >
          <View
            style={{
              paddingHorizontal: spacing[2],
              paddingVertical: spacing[1],
              borderRadius: radius.full,
              backgroundColor: palette.surfaceMuted,
            }}
          >
            <JzText
              variant="caption"
              textDirection="ltr"
              style={{
                color: palette.textSecondary,
              }}
            >
              {airport.currency}
            </JzText>
          </View>

          {selected ? (
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={colors.mint600}
            />
          ) : null}
        </YStack>
      </XStack>
    </Pressable>
  );
}

export function AirportSearchModal({
  visible,
  target,
  selectedAirportCode,
  onClose,
  onSelect,
}: AirportSearchModalProps) {
  const { isRtl, t } = useJahizLocale();
  const { palette } = useJahizTheme();
  const [query, setQuery] = useState('');
  const direction = isRtl ? 'row-reverse' : 'row';
  const textDirection = isRtl ? 'rtl' : 'ltr';

  useEffect(() => {
    if (visible) {
      setQuery('');
    }
  }, [visible]);

  const filteredAirports = useMemo(() => {
    const normalizedQuery =
      query.trim().toLocaleLowerCase();

    if (!normalizedQuery) {
      return airportDirectory;
    }

    return airportDirectory.filter((airport) =>
      [
        airport.airportCode,
        airport.airportName,
        airport.airportNameAr,
        airport.cityName,
        airport.cityNameAr,
        airport.countryName,
        airport.countryNameAr,
        airport.currency,
      ].some((value) =>
        value
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      ),
    );
  }, [query]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: palette.surface,
        }}
        edges={['top', 'bottom']}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : undefined
          }
        >
          <YStack
            flex={1}
            style={{
              backgroundColor: palette.surface,
            }}
          >
            <YStack
              alignItems="center"
              paddingTop={spacing[2]}
            >
              <View
                style={{
                  width: 42,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor:
                    palette.borderStrong,
                }}
              />
            </YStack>

            <XStack
              flexDirection={direction}
              alignItems="center"
              justifyContent="space-between"
              paddingHorizontal={spacing[4]}
              paddingVertical={spacing[3]}
            >
              <YStack
                alignItems={
                  isRtl ? 'flex-end' : 'flex-start'
                }
              >
                <JzText
                  variant="heading2"
                  textDirection={textDirection}
                  style={{
                    color: palette.textPrimary,
                  }}
                >
                  {target === 'origin'
                    ? t('chooseOrigin')
                    : t('chooseDestination')}
                </JzText>

                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color: palette.textSecondary,
                  }}
                >
                  {t('airportDirectoryHelper')}
                </JzText>
              </YStack>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('close')}
                onPress={onClose}
                hitSlop={8}
              >
                <View
                  style={{
                    width: touchTarget,
                    height: touchTarget,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: touchTarget / 2,
                    backgroundColor:
                      palette.surfaceMuted,
                  }}
                >
                  <Ionicons
                    name="close"
                    size={22}
                    color={palette.textPrimary}
                  />
                </View>
              </Pressable>
            </XStack>

            <XStack
              flexDirection={direction}
              alignItems="center"
              gap={spacing[2]}
              marginHorizontal={spacing[4]}
              marginBottom={spacing[3]}
              minHeight={52}
              paddingHorizontal={spacing[3]}
              style={{
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: palette.borderStrong,
                backgroundColor:
                  palette.inputBackground,
              }}
            >
              <Ionicons
                name="search-outline"
                size={20}
                color={palette.textSecondary}
              />

              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t(
                  'searchAirportPlaceholder',
                )}
                placeholderTextColor={palette.textMuted}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                style={{
                  flex: 1,
                  minHeight: 50,
                  color: palette.textPrimary,
                  fontSize: 16,
                  textAlign: isRtl
                    ? 'right'
                    : 'left',
                  writingDirection: textDirection,
                }}
              />

              {query ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('clearSearch')}
                  onPress={() => setQuery('')}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={palette.textMuted}
                  />
                </Pressable>
              ) : null}
            </XStack>

            <JzText
              variant="caption"
              textDirection={textDirection}
              marginHorizontal={spacing[4]}
              marginBottom={spacing[2]}
              style={{
                color: palette.textSecondary,
              }}
            >
              {query
                ? t('searchResults')
                : t('recentLocations')}
            </JzText>

            <YStack flex={1}>
              {filteredAirports.length > 0 ? (
                <FlashList
                  data={filteredAirports}
                  keyExtractor={(item) =>
                    item.airportCode
                  }
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <AirportRow
                      airport={item}
                      isRtl={isRtl}
                      selected={
                        selectedAirportCode ===
                        item.airportCode
                      }
                      onPress={() => onSelect(item)}
                    />
                  )}
                />
              ) : (
                <YStack
                  flex={1}
                  alignItems="center"
                  justifyContent="center"
                  padding={spacing[8]}
                  gap={spacing[2]}
                >
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: radius.full,
                      backgroundColor:
                        palette.surfaceMuted,
                    }}
                  >
                    <Ionicons
                      name="search-outline"
                      size={28}
                      color={palette.textMuted}
                    />
                  </View>

                  <JzText
                    variant="title"
                    textDirection={textDirection}
                    style={{
                      color: palette.textPrimary,
                    }}
                  >
                    {t('noAirportsFound')}
                  </JzText>

                  <JzText
                    variant="bodySmall"
                    textDirection={textDirection}
                    textAlign="center"
                    style={{
                      color: palette.textSecondary,
                    }}
                  >
                    {t('tryAnotherAirportSearch')}
                  </JzText>
                </YStack>
              )}
            </YStack>
          </YStack>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
