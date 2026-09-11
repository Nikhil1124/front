/**
 * ManageAdScreen — the owner's one sponsored ad.
 *
 * No config exists → nothing is shown to residents at all, and this screen is an empty
 * state with an "Add" button. A config exists → residents see it in
 * `FeaturedMonetizedAdCard`, and this screen shows a summary with Edit/Remove. There is
 * deliberately no on/off toggle sitting next to filled-in fields — removing the ad is how
 * an owner turns it off, matching the backend's own "absence is the off state" model.
 */
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Colors, Radii } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { useAdConfigQuery, useUpsertAdConfigMutation, useDeleteAdConfigMutation, type AdConfig } from '@/features/ads/useAds';
import { Btn, Card, Col, ErrorState, LoadingState, OutlinedBtn, Row, Spacer, Txt } from '@/components/ui';
import { FormScroll } from '@/components/ui/FormScroll';

const BLANK: Omit<AdConfig, 'pg_id'> = {
  brand_name: '',
  tagline: '',
  description: '',
  discount_code: '',
  discount_percent: 0,
  delivery_time: '',
  cuisines: '',
  image_url: '',
  online_url: '',
};

export function ManageAdScreen() {
  const pgId = useAuthStore((s) => s.activePgId);
  const { data, isLoading, isError, error, refetch } = useAdConfigQuery(pgId ?? undefined);
  const upsert = useUpsertAdConfigMutation(pgId ?? undefined);
  const remove = useDeleteAdConfigMutation(pgId ?? undefined);

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [brandError, setBrandError] = useState<string | undefined>();

  // Load the existing ad into the form the moment there is one to edit.
  useEffect(() => {
    if (data) setForm({ ...data });
  }, [data]);

  const set = <K extends keyof typeof BLANK>(key: K, value: (typeof BLANK)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!pgId) return;
    if (!form.brand_name.trim()) {
      setBrandError('Give the ad a brand or business name');
      return;
    }
    try {
      await upsert.mutateAsync({
        pg_id: pgId,
        ...form,
        image_url: form.image_url?.trim() || null,
        online_url: form.online_url?.trim() || null,
      });
      setIsEditing(false);
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Something went wrong.');
    }
  };

  const confirmRemove = () => {
    Alert.alert('Remove ad?', 'Residents will stop seeing this immediately.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await remove.mutateAsync();
          setForm(BLANK);
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <HubScreenWrapper title="Sponsored Ad">
        <LoadingState fill={false} label="Loading…" />
      </HubScreenWrapper>
    );
  }

  if (isError) {
    return (
      <HubScreenWrapper title="Sponsored Ad">
        <ErrorState error={error} title="Could not load your ad" onRetry={refetch} fill={false} />
      </HubScreenWrapper>
    );
  }

  const showForm = isEditing || !data;

  return (
    <HubScreenWrapper title="Sponsored Ad" subtitle="Shown to residents on the RSVP tab">
      {!showForm && data ? (
        <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
          <Row gap={10} align="center">
            <Ionicons name="megaphone" size={20} color={Colors.primary} />
            <Col style={{ flex: 1 }}>
              <Txt variant="cardTitle" color={Colors.textPrimary}>{data.brand_name}</Txt>
              {!!data.tagline && <Txt variant="caption" color={Colors.textMuted}>{data.tagline}</Txt>}
            </Col>
          </Row>
          {!!data.discount_code && (
            <>
              <Spacer size={10} />
              <Txt variant="caption" color={Colors.textSecondary}>
                Code <Txt variant="caption" weight="700" color={Colors.primary}>{data.discount_code}</Txt>
                {data.discount_percent > 0 ? ` · ${data.discount_percent}% off` : ''}
              </Txt>
            </>
          )}
          <Spacer size={16} />
          <Row gap={10}>
            <OutlinedBtn onPress={() => setIsEditing(true)} borderColor={Colors.primary} textColor={Colors.primary} borderRadius={Radii.control} height={42} style={{ flex: 1 }}>
              <Txt variant="body" weight="700" color={Colors.primary}>Edit</Txt>
            </OutlinedBtn>
            <Btn onPress={confirmRemove} loading={remove.isPending} containerColor={Colors.surface} textColor={Colors.danger} borderRadius={Radii.control} height={42} borderWidth={1} borderColor="#FECACA" style={{ flex: 1 }}>
              <Txt variant="body" weight="700" color={Colors.danger}>Remove</Txt>
            </Btn>
          </Row>
        </Card>
      ) : !isEditing ? (
        <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[24, 24]}>
          <Col align="center" gap={10}>
            <Ionicons name="megaphone-outline" size={32} color={Colors.textMuted} />
            <Txt variant="body" weight="700" color={Colors.textPrimary} align="center">No sponsored ad configured</Txt>
            <Txt variant="caption" color={Colors.textMuted} align="center">
              Residents see nothing on the RSVP tab until you add one.
            </Txt>
            <Spacer size={6} />
            <Btn onPress={() => setIsEditing(true)} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={Radii.control} height={44}>
              <Ionicons name="add" size={18} color={Colors.textInverse} />
              <Txt variant="body" weight="700" color={Colors.textInverse} style={{ marginLeft: 6 }}>Add Sponsored Ad</Txt>
            </Btn>
          </Col>
        </Card>
      ) : (
        <FormScroll keyboardShouldPersistTaps="handled">
          <OutlinedTextField label="Brand / business name" required value={form.brand_name} onChangeText={(v) => { set('brand_name', v); if (brandError) setBrandError(undefined); }} error={brandError} placeholder="NutriFit Cloud Kitchen" style={{ marginBottom: 12 }} />
          <OutlinedTextField label="Tagline" value={form.tagline} onChangeText={(v) => set('tagline', v)} placeholder="Chef-crafted healthy meal boxes" style={{ marginBottom: 12 }} />
          <OutlinedTextField label="Description" value={form.description} onChangeText={(v) => set('description', v)} multiline numberOfLines={3} style={{ marginBottom: 12, minHeight: 80 }} />
          <Row gap={10} style={{ marginBottom: 12 }}>
            <OutlinedTextField label="Discount code" value={form.discount_code} onChangeText={(v) => set('discount_code', v)} placeholder="PGNUTRI15" style={{ flex: 1 }} />
            <OutlinedTextField
              label="Discount %"
              value={form.discount_percent ? String(form.discount_percent) : ''}
              onChangeText={(v) => set('discount_percent', Math.max(0, Math.min(100, parseInt(v, 10) || 0)))}
              keyboardType="number-pad"
              placeholder="15"
              style={{ width: 90 }}
            />
          </Row>
          <OutlinedTextField label="Delivery time" value={form.delivery_time} onChangeText={(v) => set('delivery_time', v)} placeholder="12-18 min" style={{ marginBottom: 12 }} />
          <OutlinedTextField label="Cuisines" value={form.cuisines} onChangeText={(v) => set('cuisines', v)} placeholder="Salads, Keto Plates, Grain Bowls" style={{ marginBottom: 12 }} />
          <OutlinedTextField label="Image URL" value={form.image_url ?? ''} onChangeText={(v) => set('image_url', v)} placeholder="https://…" style={{ marginBottom: 12 }} />
          <OutlinedTextField label="Order / website URL" value={form.online_url ?? ''} onChangeText={(v) => set('online_url', v)} placeholder="https://…" style={{ marginBottom: 20 }} />

          <Row gap={10}>
            {data && (
              <OutlinedBtn onPress={() => { setForm({ ...data }); setIsEditing(false); }} borderColor={Colors.borderMuted} textColor={Colors.textSecondary} borderRadius={Radii.control} height={44} style={{ flex: 1 }}>
                <Txt variant="body" weight="700" color={Colors.textSecondary}>Cancel</Txt>
              </OutlinedBtn>
            )}
            <Btn onPress={save} loading={upsert.isPending} containerColor={Colors.primary} textColor={Colors.textInverse} borderRadius={Radii.control} height={44} style={{ flex: 1 }}>
              <Txt variant="body" weight="700" color={Colors.textInverse}>Save Ad</Txt>
            </Btn>
          </Row>
        </FormScroll>
      )}
    </HubScreenWrapper>
  );
}
