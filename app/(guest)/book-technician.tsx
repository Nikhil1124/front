/**
 * Book a Technician Screen — Resident booking entry-point.
 * Standardized Cyber Mint design, matched exactly to the reference screenshots.
 */
import { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, ChoiceChips, OutlinedTextField } from '@/components/ui';
import { AnimatedPress } from '@/components/ui/AnimatedPress';
import { HubScreenWrapper } from '@/components/HubScreenWrapper';
import { Colors, Palette, Radii } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import { useAuthStore } from '@/store/authStore';
import * as requestsApi from '@/features/requests/useComplaints';
import { qk } from '@/data/queryKeys';
import { formatDateTime } from '@/utils/format';
import type { RequestRecord } from '@/features/requests/useComplaints';

const REPAIR_CATEGORIES = ['Plumbing', 'Electrical', 'Carpenter', 'AC Repair', 'RO Servicing', 'Pest Control'];

const TIME_SLOTS = [
  '09:00 AM - 11:00 AM',
  '11:00 AM - 01:00 PM',
  '01:00 PM - 03:00 PM',
  '03:00 PM - 05:00 PM',
  '05:00 PM - 07:00 PM'
];

function getNext7Days(): string[] {
  const list: string[] = [];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    list.push(`${day} ${month} ${year}`);
  }
  return list;
}

export default function BookTechnicianScreen() {
  const guest = usePGowStore((s) => s.loggedInGuest);
  const pgId = useAuthStore((s) => s.activePgId);
  const qc = useQueryClient();

  // Mode state: 'FORM' | 'SUCCESS' | 'HISTORY' | 'DETAIL'
  const [viewMode, setViewMode] = useState<'FORM' | 'SUCCESS' | 'HISTORY' | 'DETAIL'>('FORM');

  // Form State
  const [category, setCategory] = useState<string>('');
  const [reqErrors, setReqErrors] = useState<{ category?: string; description?: string }>({});
  const [description, setDescription] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [preferredDate, setPreferredDate] = useState<string>('');
  const [preferredTime, setPreferredTime] = useState<string>('');

  // Dropdowns Visibility

  // Submission State
  // The next seven days, fixed for as long as this screen is open.
  const next7Days = useMemo(() => getNext7Days(), []);
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string>('');
  const [createdAt, setCreatedAt] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState(false);

  // History / Detail States
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'>('ALL');
  const [selectedRequest, setSelectedRequest] = useState<RequestRecord | null>(null);

  // `listComplaints` (used for `rawRequests` below) never hydrates attachments — only the
  // per-ticket detail endpoint does (same gap `OwnerComplaintsTab.tsx`'s `ActiveItemEvidence`
  // and `BookTechnicianScreen.tsx` were already built around). Without this, a resident who
  // photographed their own issue would never see their own photo on their own request's
  // detail page — `selectedRequest.attachments` from the list fetch is always empty.
  const { data: selectedRequestDetail } = useQuery<RequestRecord>({
    queryKey: qk.requests.detail(pgId ?? '', selectedRequest?.id ?? ''),
    queryFn: () => requestsApi.getComplaint(selectedRequest!.id),
    enabled: viewMode === 'DETAIL' && !!selectedRequest });
  const detailAttachments = selectedRequestDetail?.attachments ?? [];

  // Fetch only this resident's repair requests
  const { data: rawRequests = [], refetch: refetchRequests } = useQuery<RequestRecord[]>({
    queryKey: ['technician-requests-history', pgId, guest?.id],
    queryFn: async () => {
      if (!pgId || !guest?.id) return [];
      const res = await requestsApi.listComplaints(pgId, { kind: 'repair', limit: 100 });
      return res.items.filter((r) => r.raised_by === guest.id);
    },
    enabled: !!pgId && !!guest?.id });

  // Filter requests
  const filteredRequests = rawRequests.filter((r) => {
    if (filter === 'ALL') return true;
    if (filter === 'CLOSED') return r.status === 'resolved' || r.status === 'cancelled';
    if (filter === 'OPEN') return r.status === 'open';
    if (filter === 'IN_PROGRESS') return r.status === 'in_progress' || r.status === 'assigned';
    return r.status.toUpperCase() === filter;
  });

  const handleAddPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 5 - photos.length });
    if (!result.canceled) {
      setPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 5));
    }
  };

  const handleRemovePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleRequestSubmit = async () => {
    const nextErrors = {
      category: category ? undefined : 'Pick the kind of work needed',
      description: description.trim() ? undefined : 'Describe what is wrong',
    };
    setReqErrors(nextErrors);
    if (nextErrors.category || nextErrors.description) return;
    setSubmitting(true);
    try {
      const created = await requestsApi.submitComplaint({
        pg_id: pgId ?? '',
        kind: 'repair',
        category,
        title: `${category} Repair`,
        description,
        service_date: preferredDate && preferredTime ? `${preferredDate} ${preferredTime}` : undefined,
        details: {
          preferredDate,
          preferredTime,
          photosCount: photos.length,
          urgency: 'Scheduled' } });

      // Upload mock/real attachments if present
      if (photos.length > 0) {
        for (const uri of photos) {
          try {
            const { upload_url, object_key } = await requestsApi.getAttachmentUploadUrl(created.id, 'image/jpeg');
            await requestsApi.uploadAttachment(upload_url, uri, 'image/jpeg');
            await requestsApi.addAttachment(created.id, { object_key, content_type: 'image/jpeg' });
          } catch (err) {
            // The ticket itself was created; only the photo did not attach.
            console.warn('[PGow] technician request filed but attachment failed:', err);
          }
        }
      }

      setCreatedId(created.id);
      setCreatedAt(created.created_at);
      setViewMode('SUCCESS');

      // Clear Form
      setCategory('');
      setDescription('');
      setPhotos([]);
      setPreferredDate('');
      setPreferredTime('');

      // Refresh list
      refetchRequests();
      qc.invalidateQueries({ queryKey: qk.requests.list(pgId ?? '') });
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    Alert.alert('Cancel Request', 'Are you sure you want to cancel this technician request?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          setIsCancelling(true);
          try {
            await requestsApi.cancelComplaint(requestId);
            Alert.alert('Success', 'Request has been cancelled.');
            setViewMode('HISTORY');
            refetchRequests();
            qc.invalidateQueries({ queryKey: qk.requests.list(pgId ?? '') });
          } catch (err: any) {
            Alert.alert('Error', err?.message ?? 'Failed to cancel request.');
          } finally {
            setIsCancelling(false);
          }
        } },
    ]);
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Request ID copied to clipboard.');
  };

  const getDisplayId = (id: string, createdAtIso: string) => {
    // Display-only shorthand for the real id, in the reference format TRQ-YYYY-MMDD-NNNN.
    // Dated off the request's own creation time, not "now" — a reopened older request must
    // show the same id every time, not one that drifts to today's date on every viewing.
    const created = createdAtIso ? new Date(createdAtIso) : new Date();
    const yyyy = created.getFullYear();
    const mm = String(created.getMonth() + 1).padStart(2, '0');
    const dd = String(created.getDate()).padStart(2, '0');
    const hash = id.slice(0, 4).toUpperCase();
    return `TRQ-${yyyy}-${mm}${dd}-${hash}`;
  };

  const formatStatus = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'OPEN') return 'Open';
    if (s === 'ASSIGNED') return 'Assigned';
    if (s === 'IN_PROGRESS') return 'In Progress';
    if (s === 'RESOLVED') return 'Resolved';
    if (s === 'CANCELLED') return 'Cancelled';
    return status;
  };

  const getStatusColor = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'RESOLVED') return Colors.success;
    if (s === 'CANCELLED') return Colors.textMuted;
    if (s === 'IN_PROGRESS' || s === 'ASSIGNED') return Colors.warning;
    return Colors.tertiary;
  };

  const getCategoryStyle = (cat: string) => {
    const c = cat.toLowerCase();
    if (c.includes('elect')) {
      return {
        icon: 'flash-outline' as const,
        color: '#F97316', // orange
        bg: '#FFEDD5' };
    }
    if (c.includes('plumb')) {
      return {
        icon: 'water-outline' as const,
        color: '#3B82F6', // blue
        bg: '#DBEAFE' };
    }
    if (c.includes('fan') || c.includes('carpenter')) {
      return {
        icon: 'construct-outline' as const,
        color: Colors.success, // green
        bg: Palette.TintGreen };
    }
    // AC / Snowflake
    return {
      icon: 'snow-outline' as const,
      color: '#A855F7', // purple
      bg: '#F3E8FF' };
  };

  const timelineSteps = [
    { label: 'Request Submitted', done: true, time: selectedRequest ? formatDateTime(Date.parse(selectedRequest.created_at)) : '---' },
    { label: 'Review by Property Team', done: selectedRequest ? selectedRequest.status !== 'open' : false, time: selectedRequest && selectedRequest.status !== 'open' ? 'Reviewing' : '---' },
    { label: 'Assigned to Technician', done: selectedRequest ? ['assigned', 'in_progress', 'resolved'].includes(selectedRequest.status) : false, time: selectedRequest?.assigned_at ? formatDateTime(Date.parse(selectedRequest.assigned_at)) : '---' },
    { label: 'Work In Progress', done: selectedRequest ? ['in_progress', 'resolved'].includes(selectedRequest.status) : false, time: '---' },
    { label: 'Resolved', done: selectedRequest ? selectedRequest.status === 'resolved' : false, time: '---' },
  ];

  if (viewMode === 'SUCCESS') {
    const mockId = getDisplayId(createdId, createdAt);
    return (
      <HubScreenWrapper title="Request Submitted!">
        <View style={{ flex: 1, paddingHorizontal: 24, paddingVertical: 32, justifyContent: 'center', gap: 24 }}>
          <Col align="center" style={{ gap: 12 }}>
            <View style={styles.successBadge}>
              <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
            </View>
            <Txt size={22} weight="700" color={Colors.textPrimary} align="center">Request Submitted!</Txt>
            <Txt size={13} color={Colors.textSecondary} align="center" style={{ lineHeight: 18 }}>
              Your technician request has been sent to the property team.
            </Txt>
          </Col>

          {/* Details Card */}
          <Card containerColor={Colors.surfaceElevated} borderRadius={Radii.sheet} borderWidth={1.5} borderColor={Colors.primary} padding={[20, 20]}>
            <Row justify="space-between" align="center">
              <Txt size={13} color={Colors.textSecondary} weight="600">Request ID</Txt>
              <Row gap={6} align="center">
                <Txt size={14} weight="800" color={Colors.textPrimary}>#{mockId}</Txt>
                <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Copy" accessibilityRole="button" onPress={() => copyToClipboard(mockId)}>
                  <Ionicons name="copy-outline" size={16} color={Colors.primary} />
                </AnimatedPress>
              </Row>
            </Row>
            <Spacer size={12} />
            <Row justify="space-between" align="center">
              <Txt size={13} color={Colors.textSecondary} weight="600">Status</Txt>
              <View style={[styles.statusPillBadge, { backgroundColor: Palette.TintAmber, borderColor: Colors.warning }]}>
                <Txt size={10} weight="900" color={Colors.warning}>OPEN</Txt>
              </View>
            </Row>
          </Card>

          {/* Muted Warning Checklist */}
          <View style={{ gap: 12 }}>
            <Row gap={8} align="center">
              <Ionicons name="notifications-outline" size={16} color={Colors.primary} />
              <Txt size={13} color={Colors.textSecondary}>You will be notified on updates.</Txt>
            </Row>
            <Row gap={8} align="center">
              <Ionicons name="document-text-outline" size={16} color={Colors.primary} />
              <Row gap={4} align="center">
                <Txt size={13} color={Colors.textSecondary}>You can track your request in</Txt>
                <AnimatedPress accessibilityRole="button" onPress={() => setViewMode('HISTORY')}>
                  <Txt size={13} weight="700" color={Colors.primary} style={{ textDecorationLine: 'underline' }}>
                    My Requests
                  </Txt>
                </AnimatedPress>
                <Txt size={13} color={Colors.textSecondary}>.</Txt>
              </Row>
            </Row>
          </View>

          {/* CTA Buttons */}
          <View style={{ gap: 10, marginTop: 12 }}>
            <Btn
              onPress={() => { setViewMode('HISTORY'); }}
              containerColor={Colors.primary}
              textColor={Colors.textInverse}
              borderRadius={Radii.control}
              height={48}
            >
              <Txt variant="body" weight="800" color={Colors.textInverse}>View My Requests</Txt>
            </Btn>
            <OutlinedBtn
              onPress={() => { router.back(); }}
              borderColor={Colors.primary}
              textColor={Colors.primary}
              borderRadius={Radii.control}
              height={48}
            >
              <Txt variant="body" weight="700" color={Colors.primary}>Back to Home</Txt>
            </OutlinedBtn>
          </View>
        </View>
      </HubScreenWrapper>
    );
  }

  if (viewMode === 'HISTORY') {
    return (
      <HubScreenWrapper title="My Technician Requests" onBack={() => setViewMode('FORM')}>
        <View style={{ flex: 1, paddingHorizontal: 24, paddingVertical: 16 }}>
          {/* Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 16 }}>
            {(['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const).map((f) => {
              const isSelected = filter === f;
              return (
                <AnimatedPress accessibilityState={{ selected: !!isSelected }} accessibilityRole="button"
                  key={f}
                  style={[
                    styles.chipBtn,
                    isSelected ? { backgroundColor: Colors.primary, borderColor: Colors.primary } : { backgroundColor: Colors.surface, borderColor: Colors.borderSubtle }
                  ]}
                  onPress={() => { setFilter(f); }}
                >
                  <Txt size={11} weight="700" color={isSelected ? Colors.textInverse : Colors.textPrimary}>
                    {f === 'IN_PROGRESS' ? 'In Progress' : f[0] + f.slice(1).toLowerCase()}
                  </Txt>
                </AnimatedPress>
              );
            })}
          </ScrollView>

          {/* List of Requests */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 32 }}>
            {filteredRequests.length === 0 ? (
              <View style={{ paddingVertical: 64, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="construct-outline" size={48} color={Colors.textMuted} />
                <Spacer size={12} />
                <Txt size={14} weight="700" color={Colors.textSecondary}>No technician requests found</Txt>
                <Txt size={11} color={Colors.textMuted} align="center" style={{ marginTop: 4 }}>Any request you submit will appear here.</Txt>
              </View>
            ) : (
              filteredRequests.map((item) => {
                const statusColor = getStatusColor(item.status);
                const styleAttrs = getCategoryStyle(item.category || '');
                const itemMockId = getDisplayId(item.id, item.created_at);
                const formattedDate = new Date(Date.parse(item.created_at)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

                return (
                  <AnimatedPress
                    key={item.id}
                    scale={0.98}
                    onPress={() => { setSelectedRequest(item); setViewMode('DETAIL'); }}
                  >
                    <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
                      <Row justify="space-between" align="center">
                        <Row gap={10} align="center" style={{ flex: 1 }}>
                          <View style={[styles.categoryIconCircle, { backgroundColor: styleAttrs.bg }]}>
                            <Ionicons name={styleAttrs.icon} size={18} color={styleAttrs.color} />
                          </View>
                          <Col style={{ flex: 1 }}>
                            <Txt size={14} weight="700" color={Colors.textPrimary}>{item.category || 'General'} Repair</Txt>
                            <Txt size={11} color={Colors.textMuted} style={{ marginTop: 1 }}>Room {guest?.roomNo || 'N/A'}</Txt>
                          </Col>
                        </Row>
                        <View style={[styles.statusPillBadge, { backgroundColor: `${statusColor}1A`, borderColor: statusColor }]}>
                          <Txt size={10} weight="900" color={statusColor}>{formatStatus(item.status).toUpperCase()}</Txt>
                        </View>
                      </Row>
                      
                      <Spacer size={12} />
                      <Txt size={13} color={Colors.textSecondary} numberOfLines={2} style={{ lineHeight: 18 }}>
                        {item.description}
                      </Txt>

                      <Spacer size={14} />
                      <Row justify="space-between" align="center">
                        <Txt size={11} color={Colors.textMuted}>ID: {itemMockId}</Txt>
                        <Txt size={11} color={Colors.textMuted}>{formattedDate}</Txt>
                      </Row>
                    </Card>
                  </AnimatedPress>
                );
              })
            )}
          </ScrollView>
        </View>
      </HubScreenWrapper>
    );
  }

  if (viewMode === 'DETAIL' && selectedRequest) {
    const statusColor = getStatusColor(selectedRequest.status);
    const styleAttrs = getCategoryStyle(selectedRequest.category || '');
    const itemMockId = getDisplayId(selectedRequest.id, selectedRequest.created_at);
    const requestedOnStr = new Date(Date.parse(selectedRequest.created_at)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + new Date(Date.parse(selectedRequest.created_at)).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    return (
      <HubScreenWrapper title="Request Details" onBack={() => setViewMode('HISTORY')}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 20, gap: 16 }}>
          {/* Header Info */}
          <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
            <Row justify="space-between" align="flex-start">
              <View style={[styles.statusPillBadge, { backgroundColor: `${statusColor}1A`, borderColor: statusColor }]}>
                <Txt size={10} weight="900" color={statusColor}>{formatStatus(selectedRequest.status).toUpperCase()}</Txt>
              </View>
              <Col align="flex-end">
                <Txt size={10} color={Colors.textMuted} weight="700">REQUEST ID</Txt>
                <Row gap={6} align="center" style={{ marginTop: 2 }}>
                  <Txt size={13} weight="800" color={Colors.textPrimary}>{itemMockId}</Txt>
                  <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Copy" accessibilityRole="button" onPress={() => copyToClipboard(itemMockId)}>
                    <Ionicons name="copy-outline" size={14} color={Colors.primary} />
                  </AnimatedPress>
                </Row>
              </Col>
            </Row>
            <Spacer size={12} />
            <Txt size={11} color={Colors.textMuted}>Requested on {requestedOnStr}</Txt>
          </Card>

          {/* Stepper Timeline */}
          <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
            <Txt size={11} weight="800" color={Colors.textMuted} style={{ letterSpacing: 0.5, marginBottom: 12 }}>STATUS TIMELINE</Txt>
            <View style={{ gap: 16 }}>
              {timelineSteps.map((step, idx) => (
                <Row key={step.label} gap={12} align="flex-start">
                  <View style={[styles.timelineNode, { backgroundColor: step.done ? Colors.primary : Colors.borderMuted }]}>
                    {step.done ? <Ionicons name="checkmark" size={10} color={Colors.textInverse} /> : null}
                  </View>
                  <Col>
                    <Txt size={13} weight={step.done ? '700' : '400'} color={step.done ? Colors.textPrimary : Colors.textMuted}>
                      {step.label}
                    </Txt>
                    <Txt size={10} color={Colors.textMuted} style={{ marginTop: 1 }}>{step.time}</Txt>
                  </Col>
                </Row>
              ))}
            </View>
          </Card>

          {/* Request Info */}
          <Card containerColor={Colors.surface} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
            <Row gap={6} align="center">
              <Ionicons name="flash-outline" size={14} color={Colors.primary} />
              <Txt size={11} weight="800" color={Colors.textMuted} style={{ letterSpacing: 0.5 }}>REQUEST INFORMATION</Txt>
            </Row>
            
            <Spacer size={12} />
            <Txt size={10} color={Colors.textMuted} weight="700">SERVICE TYPE</Txt>
            <Row gap={6} align="center" style={{ marginTop: 4 }}>
              <Ionicons name={styleAttrs.icon} size={14} color={styleAttrs.color} />
              <Txt size={13} weight="700" color={Colors.textPrimary}>{selectedRequest.category || 'General'} Repair</Txt>
            </Row>

            <Spacer size={16} />
            <Txt size={10} color={Colors.textMuted} weight="700">ISSUE DESCRIPTION</Txt>
            <Txt size={13} color={Colors.textSecondary} style={{ marginTop: 4, lineHeight: 18 }}>
              {selectedRequest.description}
            </Txt>

            {detailAttachments.length > 0 ? (
              <>
                <Spacer size={16} />
                <Txt size={10} color={Colors.textMuted} weight="700">PHOTOS</Txt>
                <Row gap={8} style={{ marginTop: 6 }}>
                  {detailAttachments.slice(0, 3).map((a) =>
                    a.url ? (
                      <Image key={a.id} source={{ uri: a.url }} style={styles.detailThumbnail} resizeMode="cover" />
                    ) : (
                      <View key={a.id} style={styles.detailThumbnail}>
                        <Ionicons name="image" size={24} color={Colors.primary} />
                      </View>
                    )
                  )}
                  {detailAttachments.length > 3 ? (
                    <View style={styles.detailThumbnailBadge}>
                      <Txt size={12} weight="800" color={Colors.textSecondary}>
                        +{detailAttachments.length - 3}
                      </Txt>
                    </View>
                  ) : null}
                </Row>
              </>
            ) : null}

            {selectedRequest.service_date ? (
              <>
                <Spacer size={16} />
                <Txt size={10} color={Colors.textMuted} weight="700">PREFERRED TIME</Txt>
                <Txt size={13} weight="700" color={Colors.textPrimary} style={{ marginTop: 4 }}>
                  {selectedRequest.service_date}
                </Txt>
              </>
            ) : null}
          </Card>

          {/* Cancel Request Action */}
          {selectedRequest.status !== 'resolved' && selectedRequest.status !== 'cancelled' && (
            <AnimatedPress accessibilityRole="button"
              onPress={() => handleCancelRequest(selectedRequest.id)}
              disabled={isCancelling}
              style={styles.cancelRequestBtn}
            >
              <Txt size={14} weight="700" color={Colors.danger}>
                {isCancelling ? 'Cancelling…' : 'Cancel Request'}
              </Txt>
            </AnimatedPress>
          )}
        </ScrollView>
      </HubScreenWrapper>
    );
  }

  return (
    <HubScreenWrapper title="Book a Technician">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16, gap: 16 }} showsVerticalScrollIndicator={false}>
          {/* Header Row with emoji Illustration */}
          <Row justify="space-between" align="center" style={{ marginBottom: 4 }}>
            <Col style={{ flex: 1, paddingRight: 8 }}>
              <Txt size={18} weight="700" color={Colors.textPrimary}>Tell us what you need help with.</Txt>
            </Col>
            <View style={styles.illustrationCircle}>
              <Ionicons name="construct" size={30} color={Colors.primary} />
            </View>
          </Row>

          {/* Step 1: Service Type */}
          <Col>
            <Row justify="space-between" align="center">
              <Txt size={13} weight="700" color={Colors.textPrimary}>Service Type *</Txt>
              <AnimatedPress accessibilityRole="button" onPress={() => { setViewMode('HISTORY'); }}>
                <Txt size={12} weight="700" color={Colors.primary}>History ›</Txt>
              </AnimatedPress>
            </Row>
            <Spacer size={8} />
            {/* Six services, five slots, seven days: every list on this form fits on screen.
                They were three separate blurred modals over a scrolling list — three taps and
                a context switch to answer a question whose options could simply be shown. */}
            <ChoiceChips
              options={REPAIR_CATEGORIES}
              value={category || null}
              onChange={(v) => { setCategory(v); if (reqErrors.category) setReqErrors((e) => ({ ...e, category: undefined })); }}
              error={reqErrors.category}
              testID="technician_service"
            />
          </Col>

          {/* Step 2: What's the problem */}
          <Col>
            <Txt size={13} weight="700" color={Colors.textPrimary}>What's the problem? *</Txt>
            <Spacer size={6} />
            <View style={styles.textAreaContainer}>
              <OutlinedTextField
                value={description}
                onChangeText={(v) => { if (v.length <= 500) setDescription(v); if (reqErrors.description) setReqErrors((e) => ({ ...e, description: undefined })); }}
                placeholder="Describe the issue in detail"
                multiline
                numberOfLines={4}
                maxLength={500}
                error={reqErrors.description}
                helper={`${description.length}/500`}
              />
              <Row justify="space-between" align="center" style={{ marginTop: 6 }}>
                <Txt size={11} color={Colors.textMuted}>Example: Bathroom tap is leaking...</Txt>
                <Txt size={11} color={Colors.textMuted}>{description.length}/500</Txt>
              </Row>
            </View>
          </Col>

          {/* Step 3: Photos upload (Optional) */}
          <Col>
            <Txt size={13} weight="700" color={Colors.textPrimary}>Add Photos (Optional)</Txt>
            <Txt size={11} color={Colors.textMuted} style={{ marginTop: 2 }}>Attach photos to help us understand the issue better.</Txt>
            <Spacer size={8} />
            
            <AnimatedPress accessibilityRole="button"
              onPress={photos.length < 5 ? handleAddPhoto : undefined}
              style={[styles.uploadBox, photos.length >= 5 && { opacity: 0.5 }]}
              disabled={photos.length >= 5}
            >
              <Ionicons name="camera-outline" size={26} color={Colors.primary} />
              <Txt size={13} weight="700" color={Colors.primary} style={{ marginTop: 4 }}>Upload Photos</Txt>
              <Txt size={10} color={Colors.textMuted} style={{ marginTop: 2 }}>Max 5 photos</Txt>
            </AnimatedPress>
            
            {photos.length > 0 && (
              <>
                <Spacer size={8} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {photos.map((uri, idx) => (
                    <View key={idx} style={styles.thumbnailContainer}>
                      <View style={styles.thumbnailPlaceholder}>
                        <Ionicons name="image" size={24} color={Colors.primary} />
                        <Txt size={8} color={Colors.textMuted}>Image {idx + 1}</Txt>
                      </View>
                      <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Close" accessibilityRole="button" onPress={() => handleRemovePhoto(idx)} style={styles.removePhotoBtn}>
                        <Ionicons name="close" size={10} color={Colors.textInverse} />
                      </AnimatedPress>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}
          </Col>

          {/* Step 4: Preferred Time (Optional) */}
          <Col>
            <Txt size={13} weight="700" color={Colors.textPrimary}>Preferred Time (Optional)</Txt>
            <Spacer size={8} />
            <ChoiceChips
              options={next7Days}
              value={preferredDate || null}
              onChange={setPreferredDate}
              testID="technician_date"
            />
            <Spacer size={12} />
            <ChoiceChips
              options={TIME_SLOTS}
              value={preferredTime || null}
              onChange={setPreferredTime}
              render={(t) => t.replace(/:00 /g, '').replace(' - ', '–')}
              testID="technician_time"
            />
          </Col>

          {/* Info Card */}
          <Spacer size={4} />
          <Card containerColor={Colors.surfaceElevated} borderRadius={Radii.card} borderWidth={1} borderColor={Colors.primary} padding={[12, 14]}>
            <Row gap={10} align="center">
              <Ionicons name="shield-checkmark-outline" size={18} color={Colors.primary} />
              <Txt size={12} color={Colors.primaryDark} weight="600" style={{ flex: 1, lineHeight: 16 }}>
                Your request will be sent to the property owner and manager. They will get notified and take action.
              </Txt>
            </Row>
          </Card>

          {/* CTA Submit Button */}
          <Spacer size={8} />
          <Btn
            onPress={handleRequestSubmit}
            loading={submitting}
            containerColor={Colors.primary}
            textColor={Colors.textInverse}
            borderRadius={Radii.control}
            height={50}
            testID="submit_technician_btn"
          >
            <Txt variant="body" weight="800" color={Colors.textInverse}>
              {submitting ? 'Requesting…' : 'Request Technician'}
            </Txt>
          </Btn>
        </ScrollView>
      </KeyboardAvoidingView>

    </HubScreenWrapper>
  );
}

const styles = StyleSheet.create({
  illustrationCircle: {
    width: 60,
    height: 60,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.borderGlass },
  textAreaContainer: {
    borderWidth: 1,
    borderColor: Colors.borderMuted,
    borderRadius: Radii.card,
    backgroundColor: Colors.surface,
    padding: 12,
    minHeight: 110 },
  uploadBox: {
    width: '100%',
    height: 110,
    borderRadius: Radii.card,
    borderWidth: 1.5,
    borderColor: Palette.TintGreen,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface },
  thumbnailContainer: {
    position: 'relative',
    width: 80,
    height: 80 },
  thumbnailPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: Radii.card,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center' },
  removePhotoBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: Radii.pill,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10 },
  successBadge: {
    width: 64,
    height: 64,
    borderRadius: Radii.pill,
    backgroundColor: `${Colors.success}1A`,
    alignItems: 'center',
    justifyContent: 'center' },
  statusPillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.badge,
    borderWidth: 1 },
  categoryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center' },
  timelineNode: {
    width: 18,
    height: 18,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center' },
  chipBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radii.control,
    borderWidth: 1 },
  detailThumbnail: {
    width: 50,
    height: 50,
    borderRadius: Radii.control,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceMuted },
  detailThumbnailBadge: {
    width: 50,
    height: 50,
    borderRadius: Radii.control,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9' },
  cancelRequestBtn: {
    width: '100%',
    height: 48,
    borderRadius: Radii.control,
    borderWidth: 1.5,
    borderColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    marginTop: 8 } });
