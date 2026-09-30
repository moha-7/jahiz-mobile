import { Image } from 'expo-image';
import { YStack } from 'tamagui';
import { JzText } from '@jahiz/ui';
import { colors, radius } from '@jahiz/design-tokens';

type JzAvatarProps = {
  initials: string;
  imageUri?: string;
  size?: number;
};

export function JzAvatar({ initials, imageUri, size = 44 }: JzAvatarProps) {
  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        transition={180}
        cachePolicy="memory-disk"
      />
    );
  }

  return (
    <YStack
      width={size}
      height={size}
      borderRadius={radius.full}
      backgroundColor={colors.mint100}
      borderWidth={1}
      borderColor={colors.mint500}
      alignItems="center"
      justifyContent="center">
      <JzText variant={size >= 64 ? 'title' : 'bodySmall'} color={colors.navy950}>
        {initials}
      </JzText>
    </YStack>
  );
}
