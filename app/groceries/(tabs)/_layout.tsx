/**
 * Groceries mini-app tabs shell — the same flat bottom Dock Owner and Guest use (see
 * HeadlessDockTabButton.tsx). Keeps the mini-app visually consistent with the rest of
 * PGow instead of looking like a bolted-on separate product.
 */
import { View, StyleSheet } from 'react-native';
import { Tabs, TabTrigger, TabSlot } from 'expo-router/ui';

import { Dock, HeadlessDockTabButton, useDock } from '@/components/HeadlessDockTabButton';
import { Colors } from '@/theme';

export default function GroceriesTabsLayout() {
  const { dockStyle, contentPaddingBottom } = useDock();

  return (
    <Tabs style={styles.root}>
      <View style={{ flex: 1, paddingBottom: contentPaddingBottom }}>
        <TabSlot />
      </View>

      <Dock style={dockStyle}>
        <TabTrigger name="index" href="/groceries" asChild>
          <HeadlessDockTabButton icon="home" label="Home" />
        </TabTrigger>
        <TabTrigger name="orders" href="/groceries/orders" asChild>
          <HeadlessDockTabButton icon="receipt" label="Orders" />
        </TabTrigger>
        <TabTrigger name="categories" href="/groceries/categories" asChild>
          <HeadlessDockTabButton icon="grid" label="Categories" />
        </TabTrigger>
        <TabTrigger name="wishlist" href="/groceries/wishlist" asChild>
          <HeadlessDockTabButton icon="heart" label="Wishlist" />
        </TabTrigger>
        <TabTrigger name="profile" href="/groceries/profile" asChild>
          <HeadlessDockTabButton icon="person" label="Profile" />
        </TabTrigger>
      </Dock>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
});
