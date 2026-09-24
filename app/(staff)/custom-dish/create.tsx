import { useState } from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Txt, Btn, Spacer, AnimatedPress } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { AppHeader } from '@/components/AppHeader';
import { Colors, Radii } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { useCreateDishMutation } from '@/features/meals/useDishes';
import { useToast } from '@/hooks/useToast';
import type { MealType } from '@/types';

export default function CreateCustomDishScreen() {
  const toast = useToast();
  const activePgId = useAuthStore((s) => s.activePgId);
  const createDishMutation = useCreateDishMutation(activePgId ?? undefined);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Curry');
  const [mealTypes, setMealTypes] = useState<MealType[]>(['lunch', 'dinner']);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | undefined>();

  const CATEGORIES = ['Breakfast', 'Rice & Dal', 'Curry', 'South Indian', 'Bread', 'Snacks', 'Other'];
  const MEAL_TYPES: { id: MealType; label: string }[] = [
    { id: 'breakfast', label: 'Breakfast' },
    { id: 'lunch', label: 'Lunch' },
    { id: 'dinner', label: 'Dinner' }
  ];

  const handleToggleMealType = (type: MealType) => {
    if (mealTypes.includes(type)) {
      setMealTypes(mealTypes.filter(t => t !== type));
    } else {
      setMealTypes([...mealTypes, type]);
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled) {
      setImageUrl(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast('error', 'Validation Error', 'Dish name is required');
      return;
    }
    if (trimmedName.length > 50) {
      toast('error', 'Validation Error', 'Dish name is too long');
      return;
    }
    if (mealTypes.length === 0) {
      toast('error', 'Validation Error', 'Select at least one meal type');
      return;
    }

    try {
      await createDishMutation.mutateAsync({
        name: trimmedName,
        category,
        mealTypes,
        imageUrl,
        // Description could be added to the Dish type, omitting for now or mapped to an extension
      });
      toast('success', 'Custom Dish Created', `${trimmedName} added to catalog`);
      router.back();
    } catch (error) {
      toast('error', 'Failed to save', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader title="Create Custom Dish" onBack={() => router.back()} />
      
      <ScrollView contentContainerStyle={styles.content}>
        <AnimatedPress onPress={handlePickImage} style={styles.imagePickerPlaceholder}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%', borderRadius: Radii.card }} />
          ) : (
            <>
              <Ionicons name="camera" size={32} color={Colors.textMuted} />
              <Txt size={14} color={Colors.textMuted} style={{ marginTop: 8 }}>Tap to add photo</Txt>
            </>
          )}
        </AnimatedPress>

        <Spacer size={20} />

        <OutlinedTextField 
          label="Dish Name *" 
          placeholder="e.g. Special PG Lemon Rice" 
          value={name} 
          onChangeText={setName} 
          maxLength={50}
        />

        <Spacer size={16} />

        <Txt size={13} weight="700" color={Colors.textPrimary}>Category *</Txt>
        <Spacer size={8} />
        <View style={styles.chipContainer}>
          {CATEGORIES.map(cat => (
            <AnimatedPress 
              key={cat} 
              onPress={() => setCategory(cat)}
              style={[styles.chip, category === cat && styles.chipActive]}
            >
              <Txt size={12} weight="700" color={category === cat ? Colors.textInverse : Colors.textPrimary}>{cat}</Txt>
            </AnimatedPress>
          ))}
        </View>

        <Spacer size={20} />

        <Txt size={13} weight="700" color={Colors.textPrimary}>Supported Meal Types *</Txt>
        <Spacer size={8} />
        <View style={styles.chipContainer}>
          {MEAL_TYPES.map(mt => {
            const isSelected = mealTypes.includes(mt.id);
            return (
              <AnimatedPress 
                key={mt.id} 
                onPress={() => handleToggleMealType(mt.id)}
                style={[styles.chip, isSelected && styles.chipActive]}
              >
                <Txt size={12} weight="700" color={isSelected ? Colors.textInverse : Colors.textPrimary}>{mt.label}</Txt>
              </AnimatedPress>
            );
          })}
        </View>

        <Spacer size={20} />
        
        <OutlinedTextField 
          label="Description (Optional)" 
          placeholder="Short description of the dish" 
          value={description} 
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          maxLength={150}
        />

      </ScrollView>

      <View style={styles.footer}>
        <Btn 
          onPress={handleSave} 
          loading={createDishMutation.isPending}
          containerColor={Colors.primary} 
          textColor={Colors.textInverse}
        >
          Save Custom Dish
        </Btn>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  content: { padding: 16, paddingBottom: 100 },
  imagePickerPlaceholder: {
    height: 160,
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.surface,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
});
