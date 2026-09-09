import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Col, Row, Txt } from '@/components/ui';
import { Colors } from '@/theme';

export type TimelineStep = {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'upcoming';
  subLabel?: string;
};

export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <View style={styles.container}>
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        
        return (
          <View key={step.id} style={styles.stepContainer}>
            {/* Vertical Line */}
            {!isLast && (
              <View style={[
                styles.line, 
                step.status === 'completed' ? styles.lineCompleted : styles.lineUpcoming
              ]} />
            )}

            {/* Node */}
            <View style={[
              styles.node,
              step.status === 'completed' && styles.nodeCompleted,
              step.status === 'current' && styles.nodeCurrent,
              step.status === 'upcoming' && styles.nodeUpcoming
            ]}>
              {step.status === 'completed' && <Ionicons name="checkmark" size={10} color="#FFF" />}
              {step.status === 'current' && <View style={styles.dotCurrent} />}
            </View>

            {/* Content */}
            <Col style={styles.content}>
              <Txt style={[
                styles.label, 
                step.status === 'upcoming' ? styles.labelUpcoming : styles.labelActive
              ]}>
                {step.label}
              </Txt>
              {step.subLabel && (
                <Txt style={styles.subLabel}>{step.subLabel}</Txt>
              )}
            </Col>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingLeft: 8, paddingVertical: 8 },
  stepContainer: { flexDirection: 'row', position: 'relative', minHeight: 48 },
  
  line: { position: 'absolute', top: 22, bottom: -6, left: 9, width: 2, zIndex: 1 },
  lineCompleted: { backgroundColor: Colors.primary },
  lineUpcoming: { backgroundColor: Colors.borderSubtle },
  
  node: { width: 20, height: 20, borderRadius: 10, marginTop: 2, zIndex: 2, alignItems: 'center', justifyContent: 'center' },
  nodeCompleted: { backgroundColor: Colors.primary },
  nodeCurrent: { backgroundColor: '#FFF', borderWidth: 2, borderColor: Colors.primary },
  nodeUpcoming: { backgroundColor: '#FFF', borderWidth: 2, borderColor: Colors.borderSubtle },
  dotCurrent: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  
  content: { marginLeft: 16, paddingBottom: 24, flex: 1, justifyContent: 'flex-start' },
  label: { fontSize: 14, fontWeight: '700' },
  labelActive: { color: Colors.textPrimary },
  labelUpcoming: { color: Colors.textSecondary },
  subLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
});
