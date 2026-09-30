import { Tabs } from 'expo-router';
import { JzPremiumTabBar } from '@/components/jz-premium-tab-bar';
import { useJahizLocale } from '@/providers/locale-provider';
import { useJahizTheme } from '@/providers/theme-provider';

export default function TabsLayout() {
  const { isRtl, t } = useJahizLocale();
  const { palette } = useJahizTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        sceneStyle: {
          backgroundColor: palette.background,
        },
      }}
      tabBar={(props) => (
        <JzPremiumTabBar
          {...props}
          isRtl={isRtl}
          labels={{
            index: t('today'),
            plan: t('plan'),
            moves: t('moves'),
            payments: t('payments'),
          }}
        />
      )}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('today') }}
      />
      <Tabs.Screen
        name="plan"
        options={{ title: t('plan') }}
      />
      <Tabs.Screen
        name="moves"
        options={{ title: t('moves') }}
      />
      <Tabs.Screen
        name="payments"
        options={{ title: t('payments') }}
      />
</Tabs>
  );
}
