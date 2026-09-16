import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii, Palette } from '@/theme';
import { Sheet, ChoiceChips, OutlinedTextField, Btn, Txt, Spacer, Row } from '@/components/ui';
import { usePGowStore } from '@/store/usePGowStore';

export interface BookRepairSheetProps {
  visible: boolean;
  onDismiss: () => void;
}

const REPAIR_TYPES = ['Plumbing', 'Electrical', 'Carpenter', 'AC Repair', 'RO Servicing', 'Pest Control'] as const;
type RepairType = typeof REPAIR_TYPES[number];

const SCHEDULE_TYPES = ['Express • 15 min', 'Schedule'] as const;
type ScheduleType = typeof SCHEDULE_TYPES[number];

export function BookRepairSheet({ visible, onDismiss }: BookRepairSheetProps) {
  const [repairType, setRepairType] = useState<RepairType | null>('Plumbing');
  const [issue, setIssue] = useState('');
  const [scheduleType, setScheduleType] = useState<ScheduleType | null>('Express • 15 min');
  const bookRepair = usePGowStore((s) => s.bookPgRepairService);

  const handleSubmit = () => {
    if (!repairType) return;
    bookRepair(repairType, issue.trim() || `Needs ${repairType}`, scheduleType || 'Express • 15 min');
    onDismiss();
  };

  return (
    <Sheet
      visible={visible}
      title="Book a repair"
      subtitle="Tell us what needs fixing"
      icon="build-outline"
      accent={Colors.primary}
      onDismiss={onDismiss}
      footer={
        <View>
          <Row justify="center" align="center" style={{ marginBottom: 16 }}>
            <Ionicons name="lock-closed-outline" size={14} color={Colors.textMuted} />
            <Txt size={11} color={Colors.textMuted} style={{ marginLeft: 6 }}>
              Your request is secure and confidential
            </Txt>
          </Row>
          <Btn
            onPress={handleSubmit}
            containerColor={Colors.primary}
            textColor={Colors.textInverse}
            borderRadius={Radii.control}
            height={50}
            style={{ width: '100%' }}
          >
            <Txt size={14} weight="700" color={Colors.textInverse}>
              {scheduleType === 'Schedule' ? 'Schedule repair' : 'Request express repair'}
            </Txt>
          </Btn>
        </View>
      }
    >
      <View style={styles.section}>
        <Txt size={14} weight="700" color={Colors.textPrimary} style={styles.sectionTitle}>
          1. What needs repair?
        </Txt>
        <ChoiceChips
          options={REPAIR_TYPES}
          value={repairType}
          onChange={setRepairType}
          testID="book_repair_type"
        />
      </View>

      <Spacer size={24} />

      <View style={styles.section}>
        <Txt size={14} weight="700" color={Colors.textPrimary} style={styles.sectionTitle}>
          2. What's the issue?
        </Txt>
        <OutlinedTextField
          placeholder="Describe the problem briefly"
          value={issue}
          onChangeText={setIssue}
          multiline
          numberOfLines={4}
          maxLength={250}
          testID="book_repair_issue"
        />
        <Txt size={11} color={Colors.textMuted} style={{ marginTop: 4 }}>
          {issue.length}/250
        </Txt>
      </View>

      <Spacer size={24} />

      <View style={styles.section}>
        <Txt size={14} weight="700" color={Colors.textPrimary} style={styles.sectionTitle}>
          3. When do you need help?
        </Txt>
        <ChoiceChips
          options={SCHEDULE_TYPES}
          value={scheduleType}
          onChange={setScheduleType}
          columns={2}
          testID="book_repair_schedule"
        />
        {scheduleType === 'Express • 15 min' && (
          <View style={styles.expressInfoBox}>
            <Ionicons name="time-outline" size={16} color={Colors.primary} />
            <Txt size={12} color={Colors.textPrimary} style={{ marginLeft: 8 }}>
              Technician will be at your PG in approximately 15 minutes.
            </Txt>
          </View>
        )}
      </View>
      
      <Spacer size={8} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 4,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  expressInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.TintGreen,
    padding: 12,
    borderRadius: Radii.control,
    marginTop: 12,
  },
});
