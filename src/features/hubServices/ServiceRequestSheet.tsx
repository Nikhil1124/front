import { useState } from 'react';
import { Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Btn, Row, Sheet, Spacer, Txt } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Colors, Radii } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { serviceImage, useRequestHubServiceMutation, type HubService } from './useHubServices';

/**
 * Asking for a `request` service from the catalog. It becomes a ticket — followed in Support
 * like any other — sent to whoever the super admin chose: the property, or PGow's own team.
 */
export function ServiceRequestSheet({ service, onDismiss }: { service: HubService | null; onDismiss: () => void }) {
  const activePgId = useAuthStore((s) => s.activePgId);
  const request = useRequestHubServiceMutation(activePgId ?? undefined);
  const toast = useToast();
  const [note, setNote] = useState('');

  if (!service) return null;
  const who = service.routes_to === 'pgow' ? 'The PGow team' : 'Your property';
  const image = serviceImage(service);

  const close = () => { setNote(''); onDismiss(); };
  const send = () => {
    request.mutate(
      { serviceId: service.id, note: note.trim() },
      {
        onSuccess: () => {
          toast('success', 'Request sent', `${who} has it. Follow it in Support.`);
          close();
        },
        onError: (err) => toast('error', 'Not sent', err instanceof Error ? err.message : 'Please try again.'),
      },
    );
  };

  return (
    <Sheet
      visible
      title={service.title}
      subtitle={service.subtitle || undefined}
      icon="sparkles"
      onDismiss={close}
      footer={
        <Btn onPress={send} loading={request.isPending} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={Radii.control} height={48}>
          <Ionicons name="send" size={16} color={Colors.textInverse} />
          <Txt variant="button" color={Colors.textInverse} style={{ marginLeft: 8 }}>Send request</Txt>
        </Btn>
      }
    >
      <Spacer size={12} />
      {image ? (
        <Row justify="center"><Image source={image} style={{ width: 120, height: 120 }} resizeMode="contain" /></Row>
      ) : null}
      <Spacer size={8} />
      <Txt size={13} color={Colors.textSecondary}>
        {`${who} will get your request and contact you. You can follow it in Support.`}
      </Txt>
      <Spacer size={14} />
      <OutlinedTextField
        label="Anything they should know? (optional)"
        placeholder="e.g. Room 101, after 6 pm"
        value={note}
        onChangeText={setNote}
        multiline
        numberOfLines={3}
      />
    </Sheet>
  );
}
