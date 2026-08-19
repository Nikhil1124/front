/**
 * GuestFeedbackComplaintsTab — port of Kotlin `GuestFeedbackComplaintsTab`.
 */
import { useState } from 'react';
import { View, StyleSheet, Alert, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Txt, Btn, OutlinedBtn, Row, Col, Spacer, IconBtn, Chip } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { InfoTip } from '@/components/ui/InfoTip';
import { Colors } from '@/theme';
import { usePGowStore } from '@/store/usePGowStore';
import type { SimulatedMedia, FeedbackComplaintEntity } from '@/types';
import { FormScroll } from '@/components/ui/FormScroll';

const MOCK_COMPLAINT_MEDIA: SimulatedMedia[] = [
  { id: '1', name: 'Soggy Roti Photo', isVideo: false, textRepresentation: '📷 Broken fan and soggy roti evidence attached', mockIcon: '🫓' },
  { id: '2', name: 'Slow WiFi Speedtest', isVideo: false, textRepresentation: '📷 Speedtest showing 0.45 Mbps upload', mockIcon: '📶' },
  { id: '3', name: 'Dripping Tap Video', isVideo: true, textRepresentation: '🎥 Leakage in guest room bathroom water tap', mockIcon: '🚰' },
  { id: '4', name: 'No Water in Flush', isVideo: true, textRepresentation: '🎥 Empty toilet tank video submission', mockIcon: '🚽' },
];

const MOCK_FEEDBACK_MEDIA: SimulatedMedia[] = [
  { id: '5', name: 'Clean Room Praise', isVideo: false, textRepresentation: '📷 Fresh sheets and neat bed arrangement', mockIcon: '🧹' },
  { id: '6', name: 'Delicious Sunday Biryani', isVideo: false, textRepresentation: '📷 Special chicken biryani presentation', mockIcon: '🍛' },
  { id: '7', name: 'Courteous Kitchen Staff Video', isVideo: true, textRepresentation: '🎥 Video showing Chef Ramesh polite behavior', mockIcon: '👨‍🍳' },
];

const CATEGORIES = ['Food Quality', 'Room Cleanliness', 'Wi-Fi & Internet', 'Water & Electricity', 'Plumbing/Maintenance', 'Other'];

import { useComplaintsQuery } from '@/features/requests/useComplaints';
import { useAuthStore } from '@/store/authStore';

export function GuestFeedbackComplaintsTab() {
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: submissions = [] } = useComplaintsQuery(activePgId ?? undefined);
  const submit = usePGowStore((s) => s.submitFeedbackComplaint);

  const [submissionType, setSubmissionType] = useState<'COMPLAINT' | 'FEEDBACK'>('COMPLAINT');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Food Quality');
  const [mealRating, setMealRating] = useState(5);
  const [cleanRating, setCleanRating] = useState(5);
  const [mgrRating, setMgrRating] = useState(5);
  const [staffRating, setStaffRating] = useState(5);
  const [otherRating, setOtherRating] = useState(5);
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaIsVideo, setMediaIsVideo] = useState(false);
  const [mediaName, setMediaName] = useState<string | null>(null);
  const [preview, setPreview] = useState<FeedbackComplaintEntity | null>(null);

  const calculatedOverall = (mealRating + cleanRating + mgrRating + staffRating + otherRating) / 5;
  const mockMedia = submissionType === 'COMPLAINT' ? MOCK_COMPLAINT_MEDIA : MOCK_FEEDBACK_MEDIA;

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Validation', 'Please enter title and description');
      return;
    }
    const r = await submit(title, description, category, submissionType, mediaUri, mediaIsVideo, mealRating, cleanRating, mgrRating, staffRating, otherRating);
    if (r.ok) {
      Alert.alert('Success', submissionType === 'COMPLAINT' ? 'Complaint raised successfully!' : 'Rating & Feedback submitted successfully!');
      setTitle(''); setDescription(''); setMediaUri(null); setMediaName(null);
    } else {
      Alert.alert('Failed', r.error ?? 'Unknown');
    }
  };

  return (
    <FormScroll contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Row gap={6} align="center">
        <Txt variant="screenTitle" weight="900" color={Colors.CyberGreen} style={{ letterSpacing: -0.3 }}>Grievance & Review Portal</Txt>
        <InfoTip text="File official complaints or share constructive feedback. Upload videos or photos of issues for immediate staff resolution." />
      </Row>

      <Card containerColor={Colors.surface} borderRadius={16} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]}>
        <Txt variant="labelSmall" weight="800" color={Colors.SlateMutedText} style={{ letterSpacing: 1 }}>NEW GRIEVANCE OR APPRECIATION</Txt>
        <Spacer size={14} />
        <Row gap={8}>
          <Btn onPress={() => setSubmissionType('COMPLAINT')} containerColor={submissionType === 'COMPLAINT' ? '#FEF2F2' : Colors.surfaceMuted} textColor={submissionType === 'COMPLAINT' ? '#EF4444' : Colors.SlateMutedText} borderRadius={10} height={40} style={{ flex: 1 }} borderWidth={submissionType === 'COMPLAINT' ? 1 : 0} borderColor={Colors.danger}><Txt variant="caption" weight="700" color={submissionType === 'COMPLAINT' ? '#EF4444' : Colors.SlateMutedText}>🚨 Raise Complaint</Txt></Btn>
          <Btn onPress={() => setSubmissionType('FEEDBACK')} containerColor={submissionType === 'FEEDBACK' ? Colors.surfaceElevated : Colors.surfaceMuted} textColor={submissionType === 'FEEDBACK' ? Colors.primary : Colors.SlateMutedText} borderRadius={10} height={40} style={{ flex: 1 }} borderWidth={submissionType === 'FEEDBACK' ? 1 : 0} borderColor={Colors.primary}><Txt variant="caption" weight="700" color={submissionType === 'FEEDBACK' ? Colors.primary : Colors.SlateMutedText}>🌟 Write Feedback</Txt></Btn>
        </Row>

        <Spacer size={14} />
        <Txt variant="caption" weight="700" color={Colors.SlateMutedText}>Select Category</Txt>
        <Spacer size={6} />
        <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {CATEGORIES.map((c) => (
            <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} selectedColor={Colors.CyberGreen} size={11} />
          ))}
        </FormScroll>

        <Spacer size={14} />
        <Txt variant="caption" weight="700" color={Colors.SlateMutedText}>Rate PG Experience & Service Categories</Txt>
        <Spacer size={8} />
        <CategoryRatingSelector title="Daily Meals (Mess)" icon="🍛" rating={mealRating} onChange={setMealRating} />
        <CategoryRatingSelector title="Service & Cleanliness" icon="🧹" rating={cleanRating} onChange={setCleanRating} />
        <CategoryRatingSelector title="Manager Responses" icon="💼" rating={mgrRating} onChange={setMgrRating} />
        <CategoryRatingSelector title="Staff Behaviour" icon="👨‍🍳" rating={staffRating} onChange={setStaffRating} />
        <CategoryRatingSelector title="Others & Facilities" icon="⚙️" rating={otherRating} onChange={setOtherRating} />

        <View style={styles.overallBox}>
          <Row gap={6}><Txt size={16}>⭐</Txt><Txt variant="caption" weight="700" color={Colors.IvoryWhiteText}>Calculated PG Rating Score:</Txt></Row>
          <Txt size={13} weight="900" color={Colors.CyberGreen}>{calculatedOverall.toFixed(1)} / 5.0 ★</Txt>
        </View>

        <Spacer size={14} />
        <OutlinedTextField label="Issue Title (e.g. Broken Fan in Room 204)" value={title} onChangeText={setTitle} testID="complaint_title_input" borderRadius={10} style={{ marginBottom: 12 }} />
        <OutlinedTextField label="Detailed Description (Write complain/feedback)..." value={description} onChangeText={setDescription} testID="complaint_desc_input" multiline numberOfLines={4} borderRadius={10} style={{ marginBottom: 6, minHeight: 100 }} />

        <Spacer size={14} />
        <Txt variant="caption" weight="700" color={Colors.SlateMutedText}>Attach Photo or Video Evidence</Txt>
        <Row gap={8} style={{ marginTop: 6 }}>
          <OutlinedBtn onPress={() => { setMediaUri(`mock_media_photo_${Date.now()}`); setMediaIsVideo(false); setMediaName('Gallery Photo'); }} borderColor={Colors.borderMuted} textColor={Colors.IvoryWhiteText} borderRadius={10} height={38} style={{ flex: 1 }}><Ionicons name="camera" size={16} color={Colors.IvoryWhiteText} /><Txt variant="caption" color={Colors.IvoryWhiteText} style={{ marginLeft: 6 }}>Gallery Photo</Txt></OutlinedBtn>
          <OutlinedBtn onPress={() => { setMediaUri(`mock_media_video_${Date.now()}`); setMediaIsVideo(true); setMediaName('Device Video (Gallery)'); }} borderColor={Colors.borderMuted} textColor={Colors.IvoryWhiteText} borderRadius={10} height={38} style={{ flex: 1 }}><Ionicons name="videocam" size={16} color={Colors.IvoryWhiteText} /><Txt variant="caption" color={Colors.IvoryWhiteText} style={{ marginLeft: 6 }}>Gallery Video</Txt></OutlinedBtn>
        </Row>
        <Spacer size={10} />
        <Txt variant="labelSmall" weight="400" color={Colors.SlateMutedText}>Or Select Sandbox Simulated Media Assets:</Txt>
        <Spacer size={4} />
        <FormScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {mockMedia.map((m) => (
            <TouchableOpacity key={m.id} onPress={() => { setMediaUri(`mock_media_${m.id}`); setMediaIsVideo(m.isVideo); setMediaName(m.name); if (!title) setTitle(m.name); if (!description) setDescription(m.textRepresentation); }} style={styles.mockMediaChip}>
              <Row gap={4}><Txt variant="caption">{m.mockIcon}</Txt><Txt variant="labelSmall" weight="400" color={Colors.IvoryWhiteText}>{m.name}</Txt></Row>
            </TouchableOpacity>
          ))}
        </FormScroll>
        {mediaUri && (
          <View style={styles.mediaBanner}>
            <Row gap={6} style={{ flex: 1 }}>
              <Txt variant="body">{mediaIsVideo ? '🎥' : '📷'}</Txt>
              <Txt variant="caption" weight="700" color={Colors.primaryDark}>{mediaName ?? 'Attached Asset'}</Txt>
            </Row>
            <IconBtn onPress={() => { setMediaUri(null); setMediaName(null); }} icon="close" size={14} tint="#EF4444" containerColor="transparent" />
          </View>
        )}

        <Spacer size={16} />
        <Btn onPress={handleSubmit} containerColor={submissionType === 'COMPLAINT' ? '#EF4444' : Colors.CyberGreen} textColor={submissionType === 'COMPLAINT' ? '#FFFFFF' : Colors.LuxuryPureBlack} borderRadius={12} height={44} testID="submit_complaint_button">
          <Txt variant="body" weight="700" color={submissionType === 'COMPLAINT' ? '#FFFFFF' : Colors.LuxuryPureBlack}>{submissionType === 'COMPLAINT' ? 'Broadcast Official Complaint' : 'Send Constructive Review'}</Txt>
        </Btn>
      </Card>

      <Txt variant="caption" weight="800" color={Colors.SlateMutedText} style={{ letterSpacing: 1 }}>MY RECENT SUBMISSIONS</Txt>
      {submissions.length === 0 ? (
        <View style={styles.emptyBox}><Txt variant="caption" color={Colors.SlateMutedText}>No reports or reviews submitted yet.</Txt></View>
      ) : (
        submissions.map((item) => (
          <Card key={item.id} containerColor={Colors.surface} borderRadius={14} borderWidth={1} borderColor={Colors.borderSubtle} padding={[14, 14]}>
            <Row justify="space-between" align="center">
              <Txt variant="labelSmall" color={Colors.CyberPurple}>{item.category.toUpperCase()}</Txt>
              <View style={[styles.statusPill, { backgroundColor: item.status === 'Resolved' ? '#ECFDF5' : item.status === 'In Progress' ? '#FFFBEB' : '#FEF2F2' }]}>
                <Txt variant="labelSmall" color={item.status === 'Resolved' ? '#10B981' : item.status === 'In Progress' ? '#F59E0B' : '#EF4444'}>{item.status.toUpperCase()}</Txt>
              </View>
            </Row>
            <Spacer size={6} />
            <Txt variant="cardTitle" color={Colors.IvoryWhiteText}>{item.type === 'COMPLAINT' ? '🚨' : '🌟'} {item.title}</Txt>
            <Txt variant="caption" color={Colors.SlateMutedText} style={{ lineHeight: 16 }}>{item.description}</Txt>
            {item.mediaUri && (
              <TouchableOpacity onPress={() => setPreview(item)} style={styles.mediaLink}>
                <Row gap={8} style={{ flex: 1 }}>
                  <Txt size={14}>{item.isVideo ? '🎥' : '📷'}</Txt>
                  <Txt variant="caption" weight="700" color={Colors.CyberGreen}>{item.isVideo ? 'Tap to Play Video Attachment' : 'Tap to View Photo Attachment'}</Txt>
                </Row>
                <Txt variant="labelSmall" color={Colors.SlateMutedText}>VIEW 🔍</Txt>
              </TouchableOpacity>
            )}
            {item.adminResponse && (
              <View style={styles.adminReplyBox}>
                <Txt variant="labelSmall" weight="800" color={Colors.CyberGreen} style={{ letterSpacing: 1 }}>ADMINISTRATOR WORKFLOW REPLY</Txt>
                <Txt variant="caption" color={Colors.IvoryWhiteText} style={{ lineHeight: 15 }}>{item.adminResponse}</Txt>
              </View>
            )}
          </Card>
        ))
      )}

      {/* Preview Modal */}
      <Modal visible={preview != null} transparent animationType="fade">
        <View style={styles.backdrop}>
          <Card containerColor={Colors.surface} borderRadius={16} borderWidth={1} borderColor={Colors.borderSubtle} padding={[16, 16]} style={{ width: '92%' }}>
            {preview && (
              <>
                <Row justify="space-between" align="center">
                  <Txt variant="labelSmall" weight="800" color={Colors.SlateMutedText}>{preview.isVideo ? 'VIDEO CONTROLLER PREVIEW' : 'PHOTO ATTACHMENT VIEW'}</Txt>
                  <IconBtn onPress={() => setPreview(null)} icon="close" size={20} tint={Colors.textPrimary} />
                </Row>
                <Spacer size={12} />
                <View style={styles.previewBox}>
                  {preview.isVideo ? (
                    <Col align="center">
                      <View style={styles.playBtn}><Ionicons name="play" size={32} color={Colors.CyberGreen} /></View>
                      <Spacer size={12} />
                      <Txt variant="caption" color={Colors.IvoryWhiteText}>Playing Video Attachment Stream...</Txt>
                      <Txt size={9} color={Colors.SlateMutedText}>Simulated 30fps Sandbox Frame</Txt>
                    </Col>
                  ) : (
                    <Col align="center">
                      <View style={styles.photoIcon}><Txt size={32}>{preview.category === 'Food Quality' ? '🫓' : preview.category === 'Wi-Fi & Internet' ? '📶' : '🛠️'}</Txt></View>
                      <Spacer size={12} />
                      <Txt variant="caption" weight="700" color={Colors.IvoryWhiteText}>{preview.title}</Txt>
                      <Txt variant="labelSmall" weight="400" color={Colors.SlateMutedText}>Attached sandbox evidence snapshot.</Txt>
                    </Col>
                  )}
                </View>
                <Spacer size={16} />
                <Txt variant="caption" color={Colors.SlateMutedText}>Category: {preview.category} • File: {preview.isVideo ? 'evidence_video.mp4' : 'evidence_photo.jpg'}</Txt>
              </>
            )}
          </Card>
        </View>
      </Modal>
    </FormScroll>
  );
}

interface RatingProps {
  title: string;
  icon: string;
  rating: number;
  onChange: (n: number) => void;
}

function CategoryRatingSelector({ title, icon, rating, onChange }: RatingProps) {
  return (
    <View style={styles.ratingRow}>
      <Row gap={8} style={{ flex: 1 }}>
        <Txt size={16}>{icon}</Txt>
        <Txt variant="caption" weight="600" color={Colors.IvoryWhiteText}>{title}</Txt>
      </Row>
      <Row gap={4}>
        {[1, 2, 3, 4, 5].map((s) => (
          <TouchableOpacity key={s} onPress={() => onChange(s)} style={[styles.starBox, { backgroundColor: s <= rating ? 'rgba(255,184,0,0.2)' : '#F1F5F9' }]}>
            <Txt size={15} color={s <= rating ? '#FFB800' : Colors.SlateMutedText}>{s <= rating ? '★' : '☆'}</Txt>
          </TouchableOpacity>
        ))}
        <Txt variant="caption" weight="700" color="#FFB800" style={{ marginLeft: 4 }}>{rating.toFixed(1)}</Txt>
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  overallBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ECFDF5', borderRadius: 10, borderWidth: 1, borderColor: '#A7F3D0', padding: 10, marginTop: 8 },
  mockMediaChip: { backgroundColor: '#F1F5F9', borderRadius: 8, padding: 6 },
  mediaBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surfaceElevated, borderRadius: 8, padding: 6, marginTop: 12 },
  emptyBox: { paddingVertical: 12, alignItems: 'center' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  mediaLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surfaceElevated, borderRadius: 8, padding: 8, marginTop: 10 },
  adminReplyBox: { backgroundColor: '#F0FDF9', borderRadius: 10, padding: 12, marginTop: 12 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', alignItems: 'center', justifyContent: 'center' },
  previewBox: { height: 200, backgroundColor: '#F8FAFC', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  playBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: Colors.surfaceElevated, borderWidth: 2, borderColor: Colors.CyberGreen, alignItems: 'center', justifyContent: 'center' },
  photoIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', padding: 8, marginVertical: 3 },
  starBox: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
