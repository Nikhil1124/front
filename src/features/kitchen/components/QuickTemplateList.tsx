import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Txt, Row, AnimatedPress } from '@/components/ui';
import { Colors, Radii } from '@/theme';

interface QuickTemplateListProps {
  onSelectTemplate: (template: string) => void;
}

export function QuickTemplateList({ onSelectTemplate }: QuickTemplateListProps) {
  const templates = [
    { text: 'Special Dessert today!', emoji: '🍨', color: '#E8F5E9', iconColor: '#4CAF50' },
    { text: 'Serving started! Come get hot portions!', emoji: '🍽️', color: '#FFF3E0', iconColor: '#FF9800' },
    { text: 'Delay of 10 mins due to prep', emoji: '⏰', color: '#E8F0FE', iconColor: '#2196F3' },
    { text: 'Limited portions available. Hurry!', emoji: '🏃‍♂️', color: '#F3E5F5', iconColor: '#9C27B0' },
    { text: 'Chai is ready in the dining area!', emoji: '☕', color: '#EFEBE9', iconColor: '#795548' },
  ];

  return (
    <View>
      <Row justify="space-between" align="center" style={{ marginBottom: 12 }}>
        <Row gap={8} align="center" style={{ flex: 1 }}>
          <Ionicons name="document-text-outline" size={20} color={Colors.primaryDark} />
          <Txt size={15} weight="800" color={Colors.textPrimary} numberOfLines={1} style={{ flex: 1 }}>Quick Templates</Txt>
        </Row>
        <AnimatedPress onPress={() => router.push('/templates')}>
          <Row gap={4} align="center">
            <Txt size={13} weight="700" color={Colors.textPrimary}>See All</Txt>
            <Ionicons name="chevron-forward" size={14} color={Colors.textPrimary} />
          </Row>
        </AnimatedPress>
      </Row>

      <View style={styles.grid}>
        {templates.map((tpl, i) => (
          <AnimatedPress 
            key={i} 
            onPress={() => onSelectTemplate(`${tpl.text} ${tpl.emoji}`)}
            style={[styles.templateBtn, { backgroundColor: tpl.color }]}
          >
            <Row gap={8} align="center" style={{ flexShrink: 1 }}>
              <Txt size={14}>{tpl.emoji}</Txt>
              <Txt size={11} weight="700" color={Colors.textPrimary} numberOfLines={2} style={{ flexShrink: 1 }}>
                {tpl.text}
              </Txt>
            </Row>
          </AnimatedPress>
        ))}
        
        <AnimatedPress 
          onPress={() => router.push('/templates')}
          style={[styles.templateBtn, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderSubtle, borderStyle: 'dashed' }]}
        >
          <Row gap={6} align="center" justify="center" style={{ width: '100%' }}>
            <Ionicons name="add" size={16} color={Colors.textSecondary} />
            <Txt size={12} weight="700" color={Colors.textSecondary}>Create Template</Txt>
          </Row>
        </AnimatedPress>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  templateBtn: {
    width: '48%',
    padding: 12,
    borderRadius: Radii.card,
    minHeight: 56,
    justifyContent: 'center',
  }
});
