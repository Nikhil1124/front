/** Chef dashboard "Kitchen" tab — prep status + a custom broadcast to residents. */
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Card, Txt, Btn, Row, Spacer } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { hapticSuccess, hapticError } from '@/utils/haptics';
import { FormScroll } from '@/components/ui/FormScroll';
import { ChefGroceriesShortcut } from '@/features/staff/ChefGroceriesShortcut';
import { useActiveMeal } from '@/features/staff/useActiveMeal';

const ANNOUNCEMENTS = [
  'Special Dessert today! 🍨',
  'Serving started! Come get hot portions! 🍽️',
  'Delay of 10 mins due to prep ⏰',
  'Limited portions available. Hurry! 🏃‍♂️',
  'Chai is ready in the dining area! ☕',
];

export default function ChefKitchenTab() {
  const [prepState, setPrepState] = useState('PREPPING');
  const [chefBroadcast, setChefBroadcast] = useState('');
  const sendRoleNotification = usePGowStore((s) => s.sendRoleNotification);
  const { activeMeal } = useActiveMeal();

  // Prep status resets whenever which meal is "active" changes, same as the dashboard this
  // tab was extracted from.
  useEffect(() => {
    setPrepState('PREPPING');
  }, [activeMeal?.id]);

  /** One server broadcast addressed to residents — the only thing that reaches their phones. */
  const broadcastToResidents = async (title: string, body: string) => {
    const ok = await sendRoleNotification('RESIDENT', title, body, 'ANNOUNCEMENT', 'HIGH');
    if (!ok) Alert.alert('Not sent', 'The broadcast did not go out. Check your connection and try again.');
    return ok;
  };

  const sendCustomAnnouncement = async () => {
    if (!chefBroadcast.trim()) {
      hapticError();
      Alert.alert('Validation', 'Please enter or select a message to send.');
      return;
    }
    // Goes to the server, addressed to residents. It used to raise a local toast on the chef's
    // own phone — the one person in the building who already knew.
    const ok = await broadcastToResidents('🍳 Kitchen Update', chefBroadcast.trim());
    if (!ok) return;
    hapticSuccess();
    setChefBroadcast('');
    Alert.alert('Success', '🔔 Announcement sent to all residents!');
  };

  return (
    <FormScroll contentContainerStyle={{ padding: 18, paddingBottom: 100, gap: 14 }}>
      <ChefGroceriesShortcut />

      <Txt size={15} weight="900" color={Colors.textPrimary}>Kitchen Preparation Status</Txt>
      <Spacer size={8} />
      <Card containerColor={Colors.surface} borderRadius={16} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
        <Row gap={8}>
          {['PREPPING 🥕', 'COOKING 🔥', 'READY 🍽️'].map((s) => {
            const sel = prepState === s.split(' ')[0];
            return (
              <Btn key={s} onPress={() => setPrepState(s.split(' ')[0])} containerColor={sel ? Colors.primary : Colors.surfaceMuted} textColor={sel ? '#FFFFFF' : Colors.textSecondary} borderRadius={10} height={42} style={{ flex: 1 }}>
                <Txt size={11} weight="800" color={sel ? '#FFFFFF' : Colors.textSecondary}>{s}</Txt>
              </Btn>
            );
          })}
        </Row>
        {prepState === 'READY' && (
          <>
            <Spacer size={14} />
            <Btn onPress={async () => { if (await broadcastToResidents('🍽️ Meal is Served', 'Meal is ready! Please come collect your hot portions!')) Alert.alert('Success', '🔔 Alert dispatched to all residents!'); }} containerColor={Colors.primary} textColor="#FFFFFF" borderRadius={10} height={44}>
              <Txt size={12} weight="800" color="#FFFFFF">Broadcast 'Meal is Served' to Residents 📢</Txt>
            </Btn>
          </>
        )}
      </Card>

      <Spacer size={18} />
      <Txt size={15} weight="900" color={Colors.textPrimary}>Broadcast Custom Message to Residents</Txt>
      <Spacer size={8} />
      <Card containerColor={Colors.surface} borderRadius={16} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
        <OutlinedTextField placeholder="Type custom kitchen update..." value={chefBroadcast} onChangeText={setChefBroadcast} focusedBorderColor={Colors.primary} multiline numberOfLines={3} style={{ marginBottom: 10 }} />
        <Txt size={10} weight="700" color={Colors.textMuted}>Tap to quick-populate template:</Txt>
        <Spacer size={6} />
        <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {ANNOUNCEMENTS.map((msg) => (
            <Btn key={msg} onPress={() => setChefBroadcast(msg)} containerColor={Colors.surfaceElevated} textColor={Colors.primaryDark} borderRadius={8} height={30} contentStyle={{ paddingHorizontal: 10 }}>
              <Txt size={10} weight="800" color={Colors.primaryDark}>{msg}</Txt>
            </Btn>
          ))}
        </FormScroll>
        <Spacer size={14} />
        <Btn onPress={sendCustomAnnouncement} disabled={!chefBroadcast.trim()} containerColor={Colors.primary} textColor="#FFFFFF" borderRadius={10} height={42}>
          <Txt size={12} weight="800" color="#FFFFFF">Send Announcement to Residents 🚀</Txt>
        </Btn>
      </Card>
    </FormScroll>
  );
}
