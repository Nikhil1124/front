/**
 * GuestHubServicesTab — port of Kotlin `GuestHubServicesTab`.
 * Express PG Laundry card + 2x2 hub service grid + sponsored banner.
 */
import { useState } from 'react';
import { ScrollView, View, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, Row, Col, Spacer } from '@/components/ui';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { GuestLaundryBookingDialog } from '@/components/dialogs/HubDialogs';

export function GuestHubServicesTab() {
  const guest = usePGowStore((s) => s.loggedInGuest);
  const laundryRequests = usePGowStore((s) => s.guestLaundryRequestsState);
  const pushScreen = usePGowStore((s) => s.pushScreen);
  const [showLaundryDialog, setShowLaundryDialog] = useState(false);

  const myLaundry = laundryRequests.filter((r) => r.guestId === guest?.id);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Row justify="space-between" align="center">
        <Txt size={16} weight="900" color={Colors.textPrimary} style={{ letterSpacing: 1 }}>HUB SERVICES & MARKETPLACE</Txt>
        <Ionicons name="storefront" size={20} color={Colors.CyberGreen} />
      </Row>

      {/* Laundry Card */}
      <Card containerColor={Colors.surface} borderRadius={18} borderWidth={1.5} borderColor={Colors.borderSubtle} padding={[16, 16]}>
        <Row justify="space-between" align="center">
          <Row gap={12} style={{ flex: 1 }}>
            <View style={styles.laundryIcon}><Txt size={22}>🧺</Txt></View>
            <Col>
              <Txt size={14} weight="900" color={Colors.textPrimary}>EXPRESS PG LAUNDRY</Txt>
              <Txt size={11} color={Colors.textSecondary}>Wash & Fold • Wash & Iron • Dry Cleaning</Txt>
            </Col>
          </Row>
          <Btn onPress={() => setShowLaundryDialog(true)} containerColor={Colors.CyberPurple} textColor="#FFFFFF" borderRadius={10} height={36} contentStyle={{ paddingHorizontal: 12 }}>
            <Txt size={11} weight="900" color="#FFFFFF">[ Book Pickup ]</Txt>
          </Btn>
        </Row>
        {myLaundry.length > 0 && (
          <>
            <Spacer size={14} /><View style={{ height: 1, backgroundColor: Colors.borderMuted }} /><Spacer size={12} />
            <Txt size={12} weight="700" color={Colors.CyberGreen}>Active Laundry Orders</Txt>
            <Spacer size={8} />
            {myLaundry.slice(0, 2).map((req) => (
              <View key={req.id} style={styles.laundryItem}>
                <Col style={{ flex: 1 }}>
                  <Txt size={12} weight="700" color={Colors.textPrimary}>{req.serviceType} • {req.weightOrCount}</Txt>
                  <Txt size={10} color={Colors.SlateMutedText}>Slot: {req.preferredSlot} • {req.paymentStatus}</Txt>
                </Col>
                <View style={[styles.statusPill, { backgroundColor: req.status === 'Delivered' ? '#ECFDF5' : '#FFFBEB' }]}>
                  <Txt size={10} weight="700" color={req.status === 'Delivered' ? Colors.CyberGreen : Colors.CyberAmber}>{req.status}</Txt>
                </View>
              </View>
            ))}
          </>
        )}
      </Card>

      {/* 2x2 Hub Service Grid */}
      <View style={{ gap: 12 }}>
        <Row gap={12}>
          <HubServiceCard title="GROCERY\n(Bulk Dark Store)" icon="cart" iconColor="#14E2B1" statusText="Ready" statusColor="#14E2B1" buttonText="[ Order Now ]" onPress={() => pushScreen('GROCERIES_SCREEN')} />
          <HubServiceCard title="REPAIRS &\nMAINTENANCE" icon="build" iconColor="#FFA726" statusText="Repairs Due" statusColor="#FFA726" buttonText="[ Log Grievance ]" onPress={() => Alert.alert('Info', 'Redirecting to Repairs Filing Desk...')} />
        </Row>
        <Row gap={12}>
          <HubServiceCard title="DEEP CLEANING\n& SANITATION" icon="sparkles" iconColor="#00DFBC" statusText="Available Slots" statusColor="#00DFBC" buttonText="[ Book Slot ]" onPress={() => Alert.alert('Info', 'Opening Deep Cleaning scheduler...')} />
          <HubServiceCard title="WI-FI & INTERNET\nMANAGEMENT" icon="wifi" iconColor="#00A38C" statusText="Optimal" statusColor="#14E2B1" buttonText="[ Check Plan ]" onPress={() => Alert.alert('Info', 'Verifying High-Speed Router Gateway status...')} />
        </Row>
      </View>

      <Card containerColor={Colors.surfaceElevated} borderRadius={12} borderWidth={1} borderColor={Colors.LuxuryCardBorder} padding={[14, 14]}>
        <Row gap={10} align="center">
          <Txt size={18}>⚡</Txt>
          <Col>
            <Txt size={11} weight="700" color={Colors.textPrimary}>PGow Smart Hub Integrated</Txt>
            <Txt size={10} color={Colors.SlateMutedText} style={{ lineHeight: 14 }}>All services are synchronized directly with your PG landlord's main control panel.</Txt>
          </Col>
        </Row>
      </Card>

      {showLaundryDialog && (
        <GuestLaundryBookingDialog guestId={guest?.id ?? ''} guestName={guest?.name ?? 'Resident'} roomNo={guest?.roomNo ?? '101'} onDismiss={() => setShowLaundryDialog(false)} />
      )}
    </ScrollView>
  );
}

interface HubCardProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  statusText: string;
  statusColor: string;
  buttonText: string;
  onPress: () => void;
}

function HubServiceCard({ title, icon, iconColor, statusText, statusColor, buttonText, onPress }: HubCardProps) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.hubCard, { flex: 1 }]}>
      <Col align="center" style={{ flex: 1, justifyContent: 'space-between' }}>
        <Txt size={10} weight="900" color={Colors.IvoryWhiteText} align="center" style={{ lineHeight: 13 }}>{title}</Txt>
        <View style={[styles.hubIcon, { backgroundColor: `${iconColor}1A` }]}>
          <Ionicons name={icon} size={24} color={iconColor} />
        </View>
        <View style={[styles.hubStatusPill, { backgroundColor: `${statusColor}26` }]}>
          <Txt size={9} weight="700" color={statusColor}>{statusText}</Txt>
        </View>
        <Txt size={11} weight="900" color={Colors.CyberPink} style={{ letterSpacing: 0.5, marginTop: 2 }}>{buttonText}</Txt>
      </Col>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  laundryIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(0,163,140,0.2)', alignItems: 'center', justifyContent: 'center' },
  laundryItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', padding: 10, marginTop: 6 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  hubCard: {
    height: 200, backgroundColor: Colors.LuxurySurfaceDark,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.LuxuryCardBorder,
    padding: 10,
  },
  hubIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  hubStatusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
});
