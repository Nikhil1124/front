import { apiFetch } from '@/data/apiClient';
import { API } from '@/config';
import { uploadToPresignedUrl } from '@/features/kyc/useKyc';
import type { Dish, DishDietaryType, MealType } from '@/types';

/**
 * The property's own dish catalog, kept by the server (`/v1/dishes`). It was an in-memory
 * mock, so every dish a chef made vanished when the app restarted.
 *
 * Built-in dishes are not here: they ship with the app, photos and all (see broadcast.tsx).
 */

type DishOut = {
  id: string;
  pg_id: string;
  name: string;
  description: string;
  category: string;
  meal_types: MealType[];
  dietary_type: DishDietaryType | null;
  image_url: string | null;
  source: 'custom';
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateDishInput = {
  name: string;
  category: string;
  mealTypes: MealType[];
  description?: string;
  dietaryType?: DishDietaryType | null;
  /** A photo just picked on this phone, or the dish's current photo link. */
  imageUrl?: string;
};
export type UpdateDishInput = Partial<CreateDishInput>;

const toDish = (d: DishOut): Dish => ({
  id: d.id,
  name: d.name,
  imageUrl: d.image_url ?? undefined,
  category: d.category,
  description: d.description || undefined,
  dietaryType: d.dietary_type ?? undefined,
  source: d.source,
  pgId: d.pg_id,
  mealTypes: d.meal_types,
  isActive: d.is_active,
  createdAt: d.created_at,
  updatedAt: d.updated_at,
});

/** A photo picked on this phone goes up to storage first; the dish then records its key.
 *  An `https:` link is the dish's existing photo and needs nothing. */
async function uploadIfLocal(pgId: string, uri?: string): Promise<string | undefined> {
  if (!uri || !/^(file|content):/.test(uri)) return undefined;
  const contentType = /\.png$/i.test(uri) ? 'image/png' : 'image/jpeg';
  const { upload_url, object_key } = await apiFetch<{ upload_url: string; object_key: string }>(
    API.DISH_IMAGE_UPLOAD_URL(pgId),
    { method: 'POST', body: JSON.stringify({ content_type: contentType }) },
  );
  await uploadToPresignedUrl(upload_url, uri, contentType);
  return object_key;
}

const toBody = (data: UpdateDishInput, imageKey?: string) => ({
  ...(data.name !== undefined ? { name: data.name } : {}),
  ...(data.category !== undefined ? { category: data.category } : {}),
  ...(data.mealTypes !== undefined ? { meal_types: data.mealTypes } : {}),
  ...(data.description !== undefined ? { description: data.description } : {}),
  ...(data.dietaryType !== undefined ? { dietary_type: data.dietaryType } : {}),
  ...(imageKey ? { image_key: imageKey } : {}),
});

export const dishService = {
  async getPGDishes(pgId: string): Promise<Dish[]> {
    const rows = await apiFetch<DishOut[]>(API.DISHES(pgId));
    return rows.map(toDish);
  },

  async createCustomDish(pgId: string, data: CreateDishInput): Promise<Dish> {
    const imageKey = await uploadIfLocal(pgId, data.imageUrl);
    const created = await apiFetch<DishOut>(API.DISHES(pgId), {
      method: 'POST',
      body: JSON.stringify(toBody(data, imageKey)),
    });
    return toDish(created);
  },

  async updateCustomDish(pgId: string, dishId: string, data: UpdateDishInput): Promise<Dish> {
    const imageKey = await uploadIfLocal(pgId, data.imageUrl);
    const updated = await apiFetch<DishOut>(API.DISH(dishId), {
      method: 'PATCH',
      body: JSON.stringify(toBody(data, imageKey)),
    });
    return toDish(updated);
  },

  async archiveCustomDish(dishId: string): Promise<void> {
    await apiFetch<DishOut>(API.DISH_ARCHIVE(dishId), { method: 'POST' });
  },
};
