/**
 * GuestFeedbackComplaintsTab — Contextually Optimized Grievance & Feedback Portal.
 *
 * Smart Contextual Modes:
 *   1. "Raise Complaint" Mode:
 *      - Shows Complaint Categories (Food, Room Cleanliness, Wi-Fi, Plumbing, Electricity, Staff Issue).
 *      - Shows Issue Title & Detailed Description input fields.
 *      - Shows Photo & Video Evidence attachments.
 *      - Red CTA: "🚨 Broadcast Official Complaint".
 *
 *   2. "Write Feedback" Mode:
 *      - Shows "Rate Your PG Experience" (5 rating cards + live score breakdown).
 *      - Shows Feedback Title & Constructive Review input fields.
 *      - Teal CTA: "🌟 Send Constructive Review".
 *
 *   3. Submissions Filter:
 *      - Filter tabs: All Submissions • Complaints 🚨 • Feedback 🌟.
 */
import { useState } from 'react';
import {
  View, ScrollView, StyleSheet, Alert, Modal, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { Card, Txt, Row, Col, Spacer, IconBtn, LoadingState, ErrorState, StatusChip, toneFor, AnimatedPress } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { Colors, Palette, Radii } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import type { FeedbackComplaintEntity } from '@/types';
import { useComplaintsQuery } from '@/features/requests/useComplaints';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { AppHeader, HeaderChip } from '@/components/AppHeader';
import { useDockScroll } from '@/components/HeadlessDockTabButton';

const COMPLAINT_CATEGORIES = [
  { label: 'Food Quality', icon: 'restaurant-outline' },
  { label: 'Room Cleanliness', icon: 'bed-outline' },
  { label: 'Wi-Fi & Internet', icon: 'wifi-outline' },
  { label: 'Plumbing & Repairs', icon: 'build-outline' },
  { label: 'Water & Electricity', icon: 'flash-outline' },
  { label: 'Staff Issue', icon: 'people-outline' },
];

export function GuestFeedbackComplaintsTab() {
  const dockScroll = useDockScroll();
  const activePgId = useAuthStore((s) => s.activePgId);
  const {
    data: submissions = [],
    isLoading: submissionsLoading,
    error: submissionsError,
    refetch: refetchSubmissions } = useComplaintsQuery(activePgId ?? undefined);
  const submit = usePGowStore((s) => s.submitFeedbackComplaint);
  const toast = useToast();
  const { refreshing, onRefresh } = usePullToRefresh();

  const [submissionType, setSubmissionType] = useState<'COMPLAINT' | 'FEEDBACK'>('COMPLAINT');
  const [listFilter, setListFilter] = useState<'ALL' | 'COMPLAINT' | 'FEEDBACK'>('ALL');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Food Quality');

  // Category ratings (1-5)
  const [mealRating, setMealRating] = useState(5);
  const [cleanRating, setCleanRating] = useState(5);
  const [mgrRating, setMgrRating] = useState(5);
  const [staffRating, setStaffRating] = useState(5);
  const [otherRating, setOtherRating] = useState(5);

  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaIsVideo, setMediaIsVideo] = useState(false);
  const [mediaName, setMediaName] = useState<string | null>(null);
  const [preview, setPreview] = useState<FeedbackComplaintEntity | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<{ title?: string; description?: string }>({});

  const attach = async (kind: 'photo' | 'video') => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission required', 'Allow media library access to attach photo or video evidence.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === 'video' ? ['videos'] : ['images'],
      quality: 0.85 });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    setMediaUri(asset.uri);
    setMediaIsVideo(kind === 'video');
    setMediaName(asset.fileName ?? (kind === 'video' ? 'Video attachment' : 'Photo attachment'));
    toast('success', 'Media Attached', kind === 'video' ? 'Video asset selected.' : 'Photo asset selected.');
  };

  const calculatedOverall = (mealRating + cleanRating + mgrRating + staffRating + otherRating) / 5;

  const handleSubmit = async () => {
    if (isSubmitting) return;
    const nextErrors = {
      title: title.trim() ? undefined : 'Give it a short title',
      description: description.trim() ? undefined : 'Describe what happened',
    };
    setFormErrors(nextErrors);
    if (nextErrors.title || nextErrors.description) return;
    setIsSubmitting(true);
    try {
      const r = await submit(
        title, description, category, submissionType,
        mediaUri, mediaIsVideo, mealRating, cleanRating, mgrRating, staffRating, otherRating
      );
      if (r.ok) {
        toast('success', submissionType === 'COMPLAINT' ? 'Complaint Broadcast' : 'Feedback Submitted', 'Your ticket has been sent to property management.');
        setTitle(''); setDescription(''); setMediaUri(null); setMediaName(null);
        refetchSubmissions();
      } else {
        Alert.alert('Submission Failed', r.error ?? 'Unknown error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSubmissions = submissions.filter((item) => {
    if (listFilter === 'ALL') return true;
    return item.type === listFilter;
  });

  return (
    <View style={styles.root}>
      {/* ── 1. COMPACT TEAL GRADIENT HEADER ── */}
      <AppHeader
        title="Grievance & Feedback"
        subtitle="We listen. We act. We improve."
        actions={
          <HeaderChip
            icon="headset-outline"
            label="Support desk"
            onPress={() => toast('info', 'Support Desk', 'Property management receives and acts on all grievances within 24h.')}
          />
        }
      />

      {/* ── SCROLLABLE CONTENT ── */}
      <ScrollView
        {...dockScroll}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* ── 2. TOP ACTION CARDS (Complaint vs Feedback) ── */}
        <Row gap={12} style={styles.topCardsRow}>
          {/* Card 1: Raise Complaint */}
          <AnimatedPress accessibilityRole="button"
            onPress={() => { setSubmissionType('COMPLAINT'); }}
            style={[styles.actionCard, styles.complaintCard, submissionType === 'COMPLAINT' && styles.complaintCardActive]}
          >
            <Row justify="space-between" align="flex-start">
              <View style={styles.complaintIconWrap}>
                <Ionicons name="document-text-outline" size={22} color={Colors.danger} />
                <View style={styles.alertBadgeDot}>
                  <Ionicons name="alert" size={10} color="#FFFFFF" />
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.danger} />
            </Row>
            <Spacer size={12} />
            <Txt size={15} weight="900" color={Colors.danger}>Raise Complaint</Txt>
            <Txt size={11} color="#991B1B" style={{ marginTop: 3, lineHeight: 15 }}>
              Report an issue or request support
            </Txt>
          </AnimatedPress>

          {/* Card 2: Write Feedback */}
          <AnimatedPress accessibilityRole="button"
            onPress={() => { setSubmissionType('FEEDBACK'); }}
            style={[styles.actionCard, styles.feedbackCard, submissionType === 'FEEDBACK' && styles.feedbackCardActive]}
          >
            <Row justify="space-between" align="flex-start">
              <View style={styles.feedbackIconWrap}>
                <Ionicons name="document-text-outline" size={22} color={Colors.primary} />
                <View style={styles.starBadgeDot}>
                  <Ionicons name="star" size={10} color="#FFFFFF" />
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
            </Row>
            <Spacer size={12} />
            <Txt size={15} weight="900" color={Colors.textPrimary}>Write Feedback</Txt>
            <Txt size={11} color={Colors.textSecondary} style={{ marginTop: 3, lineHeight: 15 }}>
              Share your experience and suggestions
            </Txt>
          </AnimatedPress>
        </Row>

        {/* ── 3. DYNAMIC CONTENT BASED ON SELECTED MODE ── */}
        {submissionType === 'COMPLAINT' ? (
          <>
            {/* COMPLAINT CATEGORY SELECTION */}
            <Txt size={15} weight="800" color={Colors.textPrimary} style={{ marginTop: 22, marginBottom: 10 }}>
              Select Complaint Category
            </Txt>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              bounces={false}
              overScrollMode="never"
              style={{ marginHorizontal: -16 }}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
            >
              {COMPLAINT_CATEGORIES.map((c) => {
                const active = category === c.label;
                return (
                  <AnimatedPress accessibilityState={{ selected: !!active }} accessibilityRole="button"
                    key={c.label}
                    onPress={() => { setCategory(c.label); }}
                    style={[styles.catPill, active && styles.catPillActive]}
                  >
                    <Ionicons name={c.icon as any} size={16} color={active ? '#FFFFFF' : Colors.textSecondary} />
                    <Txt size={12} weight="800" color={active ? '#FFFFFF' : Colors.textPrimary} style={{ marginLeft: 6 }}>
                      {c.label}
                    </Txt>
                  </AnimatedPress>
                );
              })}
            </ScrollView>

            {/* COMPLAINT FORM INPUTS */}
            <Spacer size={18} />
            <View style={styles.inputWrapper}>
              <View style={styles.inputIconPrefix}>
                <Ionicons name="alert-circle-outline" size={18} color={Colors.danger} />
              </View>
              <OutlinedTextField
                label="Issue Title (e.g. Broken Fan in Room 204)"
                value={title}
                onChangeText={(v) => { setTitle(v); if (formErrors.title) setFormErrors((e) => ({ ...e, title: undefined })); }}
                error={formErrors.title}
                focusedBorderColor={Colors.danger}
                borderRadius={Radii.card}
                style={{ flex: 1 }}
              />
            </View>

            <Spacer size={12} />
            <View style={styles.inputWrapper}>
              <View style={[styles.inputIconPrefix, { alignSelf: 'flex-start', marginTop: 12 }]}>
                <Ionicons name="document-text-outline" size={18} color={Colors.danger} />
              </View>
              <OutlinedTextField
                label="Describe the issue in detail..."
                value={description}
                onChangeText={(v) => { setDescription(v); if (formErrors.description) setFormErrors((e) => ({ ...e, description: undefined })); }}
                error={formErrors.description}
                multiline
                numberOfLines={4}
                focusedBorderColor={Colors.danger}
                borderRadius={Radii.card}
                style={{ flex: 1, minHeight: 90 }}
              />
            </View>

            {/* ATTACH PHOTO/VIDEO EVIDENCE */}
            <Spacer size={14} />
            <Txt size={12} weight="800" color={Colors.textSecondary}>
              Attach Photo or Video Evidence <Txt weight="400" color={Colors.textSecondary}>(Optional)</Txt>
            </Txt>
            <Spacer size={8} />
            <Row gap={10}>
              <AnimatedPress accessibilityRole="button" onPress={() => attach('photo')} style={styles.attachBtn}>
                <Ionicons name="image-outline" size={20} color={Colors.danger} />
                <Col style={{ marginLeft: 8 }}>
                  <Txt size={12} weight="800" color={Colors.textPrimary}>Add Photo</Txt>
                  <Txt size={9} color={Colors.textSecondary}>Upload from gallery</Txt>
                </Col>
              </AnimatedPress>

              <AnimatedPress accessibilityRole="button" onPress={() => attach('video')} style={styles.attachBtn}>
                <Ionicons name="videocam-outline" size={20} color={Colors.danger} />
                <Col style={{ marginLeft: 8 }}>
                  <Txt size={12} weight="800" color={Colors.textPrimary}>Add Video</Txt>
                  <Txt size={9} color={Colors.textSecondary}>Upload from gallery</Txt>
                </Col>
              </AnimatedPress>
            </Row>

            {mediaUri && (
              <View style={styles.mediaPreviewChip}>
                <Ionicons name={mediaIsVideo ? "videocam" : "image"} size={16} color={Colors.danger} />
                <Txt size={11} weight="700" color={Colors.textPrimary} numberOfLines={1} style={{ flex: 1, marginLeft: 6 }}>
                  {mediaName ?? 'Attached Asset'}
                </Txt>
                <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Close" accessibilityRole="button" onPress={() => { setMediaUri(null); setMediaName(null); }}>
                  <Ionicons name="close-circle" size={18} color={Colors.danger} />
                </AnimatedPress>
              </View>
            )}

            {/* COMPLAINT SUBMIT CTA */}
            <Spacer size={18} />
            <AnimatedPress accessibilityRole="button"
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={[styles.submitCtaBtn, { backgroundColor: Colors.danger }]}
            >
              <Ionicons name="megaphone" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Col align="center">
                <Txt size={15} weight="900" color="#FFFFFF">
                  Broadcast Official Complaint
                </Txt>
                <Txt size={10} color="rgba(255,255,255,0.78)" style={{ marginTop: 2 }}>
                  Your issue will be sent immediately to the management team
                </Txt>
              </Col>
            </AnimatedPress>
          </>
        ) : (
          <>
            {/* RATE YOUR PG EXPERIENCE */}
            <Row justify="space-between" align="center" style={{ marginTop: 22, marginBottom: 12 }}>
              <Txt size={16} weight="800" color={Colors.textPrimary}>Rate Your PG Experience</Txt>
              <View style={styles.overallScoreChip}>
                <Ionicons name="star" size={13} color={Colors.warning} />
                <Txt size={11} weight="800" color={Colors.textPrimary} style={{ marginLeft: 4 }}>
                  Overall Rating: {calculatedOverall.toFixed(1)} / 5.0
                </Txt>
              </View>
            </Row>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              bounces={false}
              overScrollMode="never"
              style={{ marginHorizontal: -16 }}
              contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingTop: 2, paddingBottom: 8 }}
            >
              <RatingCard title="Daily Meals (Mess)" icon="restaurant-outline" rating={mealRating} onChange={setMealRating} />
              <RatingCard title="Service & Cleanliness" icon="sparkles-outline" rating={cleanRating} onChange={setCleanRating} />
              <RatingCard title="Manager Responses" icon="person-outline" rating={mgrRating} onChange={setMgrRating} />
              <RatingCard title="Staff Behaviour" icon="people-outline" rating={staffRating} onChange={setStaffRating} />
              <RatingCard title="Others & Facilities" icon="business-outline" rating={otherRating} onChange={setOtherRating} />
            </ScrollView>

            {/* FEEDBACK FORM INPUTS */}
            <Spacer size={16} />
            <View style={styles.inputWrapper}>
              <View style={styles.inputIconPrefix}>
                <Ionicons name="star-outline" size={18} color={Colors.primary} />
              </View>
              <OutlinedTextField
                label="Feedback Title (e.g. Chef is doing great!)"
                value={title}
                onChangeText={(v) => { setTitle(v); if (formErrors.title) setFormErrors((e) => ({ ...e, title: undefined })); }}
                error={formErrors.title}
                focusedBorderColor={Colors.primary}
                borderRadius={Radii.card}
                style={{ flex: 1 }}
              />
            </View>

            <Spacer size={12} />
            <View style={styles.inputWrapper}>
              <View style={[styles.inputIconPrefix, { alignSelf: 'flex-start', marginTop: 12 }]}>
                <Ionicons name="chatbox-outline" size={18} color={Colors.primary} />
              </View>
              <OutlinedTextField
                label="Share your experience & suggestions..."
                value={description}
                onChangeText={(v) => { setDescription(v); if (formErrors.description) setFormErrors((e) => ({ ...e, description: undefined })); }}
                error={formErrors.description}
                multiline
                numberOfLines={4}
                focusedBorderColor={Colors.primary}
                borderRadius={Radii.card}
                style={{ flex: 1, minHeight: 90 }}
              />
            </View>

            {/* FEEDBACK SUBMIT CTA */}
            <Spacer size={18} />
            <AnimatedPress accessibilityRole="button"
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={[styles.submitCtaBtn, { backgroundColor: Colors.primaryDark }]}
            >
              <Ionicons name="heart" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Col align="center">
                <Txt size={15} weight="900" color="#FFFFFF">
                  Send Constructive Review
                </Txt>
                <Txt size={10} color="rgba(255,255,255,0.78)" style={{ marginTop: 2 }}>
                  Your feedback helps us continuously improve your experience
                </Txt>
              </Col>
            </AnimatedPress>
          </>
        )}

        {/* ── 4. MY RECENT SUBMISSIONS WITH DYNAMIC FILTERING ── */}
        <Row justify="space-between" align="center" style={{ marginTop: 28, marginBottom: 12 }}>
          <Txt size={17} weight="800" color={Colors.textPrimary}>My Recent Submissions</Txt>
          <AnimatedPress accessibilityRole="button" onPress={() => toast('info', 'Submissions', 'Showing your grievance & review tickets.')}>
            <Row align="center" gap={4}>
              <Txt size={13} weight="700" color={Colors.primary}>View All</Txt>
              <Ionicons name="chevron-forward" size={13} color={Colors.primary} />
            </Row>
          </AnimatedPress>
        </Row>

        {/* SUBMISSION LIST FILTER TABS */}
        <Row gap={8} style={{ marginBottom: 14 }}>
          <AnimatedPress accessibilityRole="button"
            style={[styles.filterChip, listFilter === 'ALL' && styles.filterChipActive]}
            onPress={() => { setListFilter('ALL'); }}
          >
            <Txt size={11} weight="800" color={listFilter === 'ALL' ? '#FFFFFF' : Colors.textSecondary}>
              All ({submissions.length})
            </Txt>
          </AnimatedPress>
          <AnimatedPress accessibilityRole="button"
            style={[styles.filterChip, listFilter === 'COMPLAINT' && styles.filterChipComplaintActive]}
            onPress={() => { setListFilter('COMPLAINT'); }}
          >
            <Txt size={11} weight="800" color={listFilter === 'COMPLAINT' ? '#FFFFFF' : Colors.textSecondary}>
              Complaints 🚨 ({submissions.filter((s) => s.type === 'COMPLAINT').length})
            </Txt>
          </AnimatedPress>
          <AnimatedPress accessibilityRole="button"
            style={[styles.filterChip, listFilter === 'FEEDBACK' && styles.filterChipFeedbackActive]}
            onPress={() => { setListFilter('FEEDBACK'); }}
          >
            <Txt size={11} weight="800" color={listFilter === 'FEEDBACK' ? '#FFFFFF' : Colors.textSecondary}>
              Feedback 🌟 ({submissions.filter((s) => s.type === 'FEEDBACK').length})
            </Txt>
          </AnimatedPress>
        </Row>

        {submissionsLoading ? (
          <LoadingState label="Loading your submissions…" fill={false} />
        ) : submissionsError ? (
          <ErrorState error={submissionsError} title="Could not load submissions" onRetry={refetchSubmissions} fill={false} />
        ) : filteredSubmissions.length === 0 ? (
          <View style={styles.emptySubmissionsCard}>
            <Ionicons name="chatbubbles-outline" size={28} color={Colors.primary} />
            <Txt size={13} weight="700" color={Colors.textSecondary} style={{ marginTop: 8 }}>
              No {listFilter === 'ALL' ? 'submissions' : listFilter === 'COMPLAINT' ? 'complaints' : 'feedback'} logged yet.
            </Txt>
          </View>
        ) : (
          filteredSubmissions.map((item) => {
            let catIcon: any = 'grid-outline';
            if (item.category.includes('Wi-Fi')) catIcon = 'wifi-outline';
            if (item.category.includes('Food')) catIcon = 'restaurant-outline';
            if (item.category.includes('Clean')) catIcon = 'sparkles-outline';
            if (item.type === 'FEEDBACK') catIcon = 'star-outline';

            return (
              <AnimatedPress accessibilityRole="button"
                key={item.id}
                onPress={() => router.push({ pathname: '/ticket/[id]', params: { id: item.id } })}
                style={styles.submissionCard}
              >
                <Row justify="space-between" align="center">
                  <Row gap={10} style={{ flex: 1, paddingRight: 8 }}>
                    <View style={styles.subCatIconWrap}>
                      <Ionicons name={catIcon} size={20} color={item.type === 'COMPLAINT' ? Colors.danger : Colors.primaryDark} />
                    </View>

                    <Col style={{ flex: 1 }}>
                      <Row gap={6} align="center">
                        <Txt size={10} weight="900" color={item.type === 'COMPLAINT' ? Colors.danger : Colors.primary} style={{ letterSpacing: 0.5 }}>
                          {item.type === 'COMPLAINT' ? 'COMPLAINT' : 'FEEDBACK'} • {item.category.toUpperCase()}
                        </Txt>
                      </Row>
                      <Txt size={14} weight="800" color={Colors.textPrimary} numberOfLines={1} style={{ marginTop: 2 }}>
                        {item.title}
                      </Txt>
                      <Txt size={11} color={Colors.textSecondary} numberOfLines={2} style={{ marginTop: 2 }}>
                        {item.description}
                      </Txt>
                    </Col>
                  </Row>

                  <Row align="center" gap={4}>
                    <StatusChip label={item.status} tone={toneFor(item.status)} />
                    <Ionicons name="chevron-forward" size={14} color={Colors.textSecondary} />
                  </Row>
                </Row>

                {/* Administrator reply box */}
                {item.adminResponse && (
                  <View style={styles.adminReplyBox}>
                    <Row gap={6} align="center">
                      <Ionicons name="shield-checkmark" size={14} color={Colors.primary} />
                      <Txt size={10} weight="900" color={Colors.primary} style={{ letterSpacing: 0.5 }}>
                        ADMINISTRATOR WORKFLOW REPLY
                      </Txt>
                    </Row>
                    <Txt size={11} color={Colors.textPrimary} style={{ marginTop: 4, lineHeight: 16 }}>
                      {item.adminResponse}
                    </Txt>
                  </View>
                )}
              </AnimatedPress>
            );
          })
        )}

        <Spacer size={32} />
      </ScrollView>

      {/* Preview Modal */}
      <Modal visible={preview != null} transparent animationType="fade">
        <View style={styles.backdrop}>
          <Card containerColor="#FFFFFF" borderRadius={Radii.card} borderWidth={1} borderColor="#DCE9EA" padding={[16, 16]} style={{ width: '92%' }}>
            {preview && (
              <>
                <Row justify="space-between" align="center">
                  <Txt size={12} weight="800" color={Colors.textSecondary}>{preview.isVideo ? 'VIDEO ATTACHMENT' : 'PHOTO EVIDENCE'}</Txt>
                  <IconBtn onPress={() => setPreview(null)} icon="close" size={20} tint={Colors.textPrimary} />
                </Row>
                <Spacer size={12} />
                <View style={styles.previewBox}>
                  <Ionicons name={preview.isVideo ? "videocam" : "image"} size={48} color={Colors.primary} />
                  <Txt size={12} color={Colors.textPrimary} style={{ marginTop: 8 }}>{preview.title}</Txt>
                </View>
              </>
            )}
          </Card>
        </View>
      </Modal>
    </View>
  );
}

function RatingCard({
  title, icon, rating, onChange }: {
  title: string; icon: keyof typeof Ionicons.glyphMap; rating: number; onChange: (n: number) => void;
}) {
  return (
    <View style={styles.ratingCard}>
      <View style={styles.ratingIconWrap}>
        <Ionicons name={icon} size={22} color={Colors.primaryDark} />
      </View>
      <Txt size={11} weight="800" color={Colors.textPrimary} align="center" style={{ marginTop: 8, height: 28 }}>
        {title}
      </Txt>
      <Row gap={2} style={{ marginTop: 6 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <AnimatedPress hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" key={star} onPress={() => { onChange(star); }}>
            <Ionicons name={star <= rating ? "star" : "star-outline"} size={14} color={Colors.warning} />
          </AnimatedPress>
        ))}
      </Row>
      <Txt size={12} weight="900" color={Colors.textPrimary} style={{ marginTop: 6 }}>
        {rating.toFixed(1)}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFB' },

  // Header

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 16 },

  // Top action cards
  topCardsRow: { marginTop: 14, zIndex: 20 },
  actionCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: Radii.sheet,
    borderWidth: 1, borderColor: '#DCE9EA', padding: 14,
    shadowColor: '#0A6060', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  complaintCard: { backgroundColor: '#FFF5F5', borderColor: '#FECACA' },
  complaintCardActive: { borderWidth: 2, borderColor: Colors.danger },
  feedbackCard: { backgroundColor: '#F0F6F5', borderColor: '#BDD8D6' },
  feedbackCardActive: { borderWidth: 2, borderColor: Colors.primary },

  complaintIconWrap: { width: 42, height: 42, borderRadius: Radii.pill, backgroundColor: Palette.TintRed, alignItems: 'center', justifyContent: 'center' },
  feedbackIconWrap: { width: 42, height: 42, borderRadius: Radii.pill, backgroundColor: Palette.TintGreen, alignItems: 'center', justifyContent: 'center' },
  alertBadgeDot: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: Radii.pill, backgroundColor: Colors.danger, alignItems: 'center', justifyContent: 'center' },
  starBadgeDot: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: Radii.pill, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },

  // Category pills
  catPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: Radii.sheet,
    borderWidth: 1, borderColor: '#DCE9EA',
    paddingHorizontal: 14, paddingVertical: 9 },
  catPillActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },

  // Overall Score Badge
  overallScoreChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.TintAmber, borderRadius: Radii.card, paddingHorizontal: 10, paddingVertical: 5 },

  // Rating card
  ratingCard: {
    width: 110, backgroundColor: '#FFFFFF', borderRadius: Radii.card,
    borderWidth: 1, borderColor: '#DCE9EA',
    padding: 12, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0A6060', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  ratingIconWrap: { width: 40, height: 40, borderRadius: Radii.pill, backgroundColor: Palette.TintGreen, alignItems: 'center', justifyContent: 'center' },

  // Form inputs
  inputWrapper: { flexDirection: 'row', alignItems: 'center' },
  inputIconPrefix: {
    width: 38, height: 38, borderRadius: Radii.pill,
    backgroundColor: Palette.TintGreen, alignItems: 'center', justifyContent: 'center',
    marginRight: 8 },

  attachBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: Radii.card, borderWidth: 1.5, borderColor: '#DCE9EA', borderStyle: 'dashed', padding: 12 },
  mediaPreviewChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.TintGreen, borderRadius: Radii.card, padding: 10, marginTop: 10 },

  // Submit CTA
  submitCtaBtn: {
    borderRadius: Radii.card,
    paddingVertical: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4 },

  // Submissions Filter Chips
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radii.card, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE9EA' },
  filterChipActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
  filterChipComplaintActive: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  filterChipFeedbackActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },

  // Submissions
  submissionCard: { backgroundColor: '#FFFFFF', borderRadius: Radii.card, borderWidth: 1, borderColor: '#DCE9EA', padding: 14, marginBottom: 10, shadowColor: '#0A6060', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  subCatIconWrap: { width: 40, height: 40, borderRadius: Radii.pill, backgroundColor: Palette.TintGreen, alignItems: 'center', justifyContent: 'center' },
  adminReplyBox: { backgroundColor: Palette.TintGreen, borderRadius: Radii.card, padding: 10, marginTop: 10 },
  emptySubmissionsCard: { alignItems: 'center', paddingVertical: 32, backgroundColor: '#FFFFFF', borderRadius: Radii.card, borderWidth: 1, borderColor: '#DCE9EA' },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', alignItems: 'center', justifyContent: 'center' },
  previewBox: { height: 180, backgroundColor: '#F8FAFC', borderRadius: Radii.card, alignItems: 'center', justifyContent: 'center' } });
