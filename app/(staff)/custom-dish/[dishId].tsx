import { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Txt, Btn, Row, Spacer, AnimatedPress } from '@/components/ui';
import { OutlinedTextField } from '@/components/ui/OutlinedTextField';
import { AppHeader, HeaderChip } from '@/components/AppHeader';
import { Colors, Radii } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { useCustomDishesQuery, useUpdateDishMutation, useArchiveDishMutation } from '@/features/meals/useDishes';
import { useToast } from '@/hooks/useToast';
import type { DishDietaryType, MealType } from '@/types';

export default function EditCustomDishScreen() {
  const { dishId } = useLocalSearchParams<{ dishId: string }>();
  const toast = useToast();
  const activePgId = useAuthStore((s) => s.activePgId);
  const { data: dishes, isLoading } = useCustomDishesQuery(activePgId ?? undefined);
  
  const updateDishMutation = useUpdateDishMutation(activePgId ?? undefined);
  const archiveDishMutation = useArchiveDishMutation(activePgId ?? undefined);

  const dish = dishes?.find(d => d.id === dishId);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [mealTypes, setMealTypes] = useState<MealType[]>([]);
  const [description, setDescription] = useState('');
  const [dietaryType, setDietaryType] = useState<DishDietaryType | undefined>();
  const [imageUrl, setImageUrl] = useState<string | undefined>();

  const CATEGORIES = ['Breakfast', 'Rice & Dal', 'Curry', 'South Indian', 'Bread', 'Snacks', 'Other'];
  const MEAL_TYPES: { id: MealType; label: string }[] = [
    { id: 'breakfast', label: 'Breakfast' },
    { id: 'lunch', label: 'Lunch' },
    { id: 'dinner', label: 'Dinner' }
  ];
  const DIETARY: { id: DishDietaryType; label: string }[] = [
    { id: 'veg', label: 'Veg' },
    { id: 'non_veg', label: 'Non-veg' },
    { id: 'eggitarian', label: 'Egg' },
  ];

  useEffect(() => {
    if (dish) {
      setName(dish.name);
      setCategory(dish.category);
      setMealTypes(dish.mealTypes);
      setDescription(dish.description ?? '');
      setDietaryType(dish.dietaryType);
      setImageUrl(dish.imageUrl);
    }
  }, [dish]);

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
    if (!dishId) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast('error', 'Validation Error', 'Dish name is required');
      return;
    }
    if (!dietaryType) {
      toast('error', 'Validation Error', 'Choose veg, non-veg or egg');
      return;
    }
    if (mealTypes.length === 0) {
      toast('error', 'Validation Error', 'Select at least one meal type');
      return;
    }

    try {
      await updateDishMutation.mutateAsync({
        dishId,
        data: {
          name: trimmedName,
          category,
          mealTypes,
          imageUrl,
          description: description.trim(),
          dietaryType,
        }
      });
      toast('success', 'Custom Dish Updated', `${trimmedName} was updated successfully.`);
      router.back();
    } catch (error) {
      toast('error', 'Failed to update', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleArchive = () => {
    if (!dishId) return;
    Alert.alert(
      "Archive Dish?",
      "Archiving this dish removes it from the catalog, but keeps it in your delivery history.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Archive", 
          style: "destructive",
          onPress: async () => {
            try {
              await archiveDishMutation.mutateAsync(dishId);
              toast('success', 'Dish Archived', 'The dish was removed from the catalog.');
              router.back();
            } catch (err) {
              toast('error', 'Error', 'Failed to archive dish.');
            }
          }
        }
      ]
    );
  };

  if (isLoading || !dish) {
    return (
      <View style={styles.root}>
        <AppHeader title="Edit Custom Dish" onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Txt color={Colors.textMuted}>Loading dish details...</Txt>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AppHeader 
        title="Edit Custom Dish" 
        onBack={() => router.back()} 
        actions={
          <Row gap={8}>
             <HeaderChip icon="trash" label="Archive" onPress={handleArchive} />
          </Row>
        }
      />
      
      <ScrollView contentContainerStyle={styles.content}>
        <AnimatedPress onPress={handlePickImage} style={styles.imagePickerPlaceholder}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%', borderRadius: Radii.card }} />
          ) : (
            <>
              <Ionicons name="camera" size={32} color={Colors.textMuted} />
              <Txt size={14} color={Colors.textMuted} style={{ marginTop: 8 }}>Tap to change photo</Txt>
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

        {/* Decides the meal's veg / non-veg label when this dish is on the menu. */}
        <Txt size={13} weight="700" color={Colors.textPrimary}>Veg or non-veg? *</Txt>
        <Spacer size={8} />
        <View style={styles.chipContainer}>
          {DIETARY.map((d) => {
            const isSelected = dietaryType === d.id;
            return (
              <AnimatedPress
                key={d.id}
                onPress={() => setDietaryType(d.id)}
                style={[styles.chip, isSelected && styles.chipActive]}
              >
                <Txt size={12} weight="700" color={isSelected ? Colors.textInverse : Colors.textPrimary}>{d.label}</Txt>
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
          loading={updateDishMutation.isPending}
          containerColor={Colors.primary} 
          textColor={Colors.textInverse}
        >
          Save Changes
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
