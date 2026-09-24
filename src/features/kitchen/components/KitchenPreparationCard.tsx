
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Row, Btn, Col, AnimatedPress } from '@/components/ui';
import { Colors, Radii } from '@/theme';

export type PrepStage = 'PREPPING' | 'COOKING' | 'READY';

interface KitchenPreparationCardProps {
  currentStage: PrepStage;
  onStageChange: (stage: PrepStage) => void;
  estimatedTime: string;
  portionsPrepared: number;
  expectedResidents: number;
  onBroadcastReady: () => void;
}

export function KitchenPreparationCard({
  currentStage,
  onStageChange,
  estimatedTime,
  portionsPrepared,
  expectedResidents,
  onBroadcastReady,
}: KitchenPreparationCardProps) {

  const stages: { id: PrepStage; label: string; iconName: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'PREPPING', label: 'PREPPING', iconName: 'restaurant-outline' },
    { id: 'COOKING', label: 'COOKING', iconName: 'flame' },
    { id: 'READY', label: 'READY', iconName: 'restaurant' },
  ];

  return (
    <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[20, 20]}>
      <Row justify="space-between" align="flex-start" style={{ marginBottom: 16 }}>
        <Row gap={10} align="flex-start" style={{ flex: 1, paddingRight: 8 }}>
          <Ionicons name="restaurant-outline" size={22} color={Colors.primary} />
          <Col style={{ flex: 1 }}>
            <Txt size={15} weight="800" color={Colors.textPrimary} numberOfLines={1}>Kitchen Preparation Status</Txt>
            <Txt size={12} weight="600" color={Colors.textMuted} numberOfLines={1} style={{ marginTop: 2 }}>Current meal preparation status</Txt>
          </Col>
        </Row>
      </Row>

      <Row gap={8} style={{ marginBottom: 20 }}>
        {stages.map((stage) => {
          const isSel = currentStage === stage.id;
          // In the mock design, READY is a solid green when selected, others are muted orange
          let bgColor: string = Colors.surfaceMuted;
          let textColor: string = Colors.textSecondary;
          if (isSel) {
            if (stage.id === 'PREPPING') { bgColor = '#FFF4ED'; textColor = '#C25D00'; }
            if (stage.id === 'COOKING') { bgColor = '#FFF4ED'; textColor = '#C25D00'; }
            if (stage.id === 'READY') { bgColor = '#E8F0E4'; textColor = Colors.primaryDark; }
          }

          return (
            <AnimatedPress 
              key={stage.id} 
              onPress={() => onStageChange(stage.id)}
              style={[styles.stageBtn, { backgroundColor: bgColor }]}
            >
              <Ionicons name={stage.iconName} size={14} color={textColor} />
              <Txt size={11} weight="800" color={textColor} style={{ marginLeft: 6 }}>{stage.label}</Txt>
              {isSel && stage.id === 'READY' && <Ionicons name="checkmark-circle" size={14} color={Colors.primary} style={{ marginLeft: 4 }} />}
            </AnimatedPress>
          );
        })}
      </Row>

      <Row gap={8} style={{ marginBottom: 20 }}>
        <View style={styles.metricCard}>
          <Row gap={4} align="center">
            <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
            <Txt size={10} weight="700" color={Colors.textSecondary} numberOfLines={2}>Est. Time</Txt>
          </Row>
          <Txt size={15} weight="800" color={Colors.textPrimary} style={{ marginTop: 6 }} numberOfLines={1}>{estimatedTime}</Txt>
        </View>

        <View style={styles.metricCard}>
          <Row gap={4} align="center">
            <Ionicons name="restaurant-outline" size={14} color={Colors.textSecondary} />
            <Txt size={10} weight="700" color={Colors.textSecondary} numberOfLines={2}>Prepared</Txt>
          </Row>
          <Txt size={15} weight="800" color={Colors.textPrimary} style={{ marginTop: 6 }} numberOfLines={1}>{portionsPrepared} / {expectedResidents + 4}</Txt>
        </View>

        <View style={styles.metricCard}>
          <Row gap={4} align="center">
            <Ionicons name="people-outline" size={14} color={Colors.textSecondary} />
            <Txt size={10} weight="700" color={Colors.textSecondary} numberOfLines={2}>Expected</Txt>
          </Row>
          <Txt size={15} weight="800" color={Colors.textPrimary} style={{ marginTop: 6 }} numberOfLines={1}>{expectedResidents}</Txt>
        </View>
      </Row>

      <Btn 
        onPress={onBroadcastReady} 
        containerColor={Colors.primaryDark} 
        textColor={Colors.textInverse} 
        borderRadius={Radii.control} 
        height={48}
      >
        <Ionicons name="megaphone-outline" size={18} color={Colors.textInverse} />
        <Txt size={13} weight="800" color={Colors.textInverse} style={{ marginLeft: 8 }}>Broadcast 'Meal is Served' to Residents <Ionicons name="chevron-forward" size={14} color={Colors.textInverse}/></Txt>
      </Btn>
    </Card>
  );
}

const styles = StyleSheet.create({
  stageBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 44,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCard: {
    flex: 1,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radii.card,
    padding: 12,
  }
});
