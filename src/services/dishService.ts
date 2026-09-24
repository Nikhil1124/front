import type { Dish } from '@/types';

/**
 * Service abstraction for dish catalog API.
 * Currently uses mock delays and localStorage/in-memory data for frontend implementation.
 * Ready to be swapped with FastAPI + PostgreSQL endpoints.
 */

// In-memory mock storage (simulate DB)
let MOCK_DB_DISHES: Dish[] = [];

// Simulate network delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type CreateDishInput = Omit<Dish, 'id' | 'createdAt' | 'updatedAt' | 'source' | 'isActive'>;
export type UpdateDishInput = Partial<CreateDishInput>;

export const dishService = {
  /**
   * Fetch custom dishes for a specific PG.
   * Enforces the core business rule: A custom dish belongs to one PG only.
   */
  async getPGDishes(pgId: string): Promise<Dish[]> {
    await delay(300);
    // Filter active dishes that belong to this exact PG
    return MOCK_DB_DISHES.filter((d) => d.pgId === pgId && d.isActive && d.source === 'custom');
  },

  async createCustomDish(pgId: string, data: CreateDishInput): Promise<Dish> {
    await delay(500);
    const newDish: Dish = {
      ...data,
      id: `dish_${Date.now()}`,
      pgId,
      source: 'custom',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    MOCK_DB_DISHES.push(newDish);
    return newDish;
  },

  async updateCustomDish(dishId: string, data: UpdateDishInput): Promise<Dish> {
    await delay(500);
    const idx = MOCK_DB_DISHES.findIndex((d) => d.id === dishId);
    if (idx === -1) throw new Error('Dish not found');
    
    const updated = {
      ...MOCK_DB_DISHES[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    MOCK_DB_DISHES[idx] = updated;
    return updated;
  },

  async archiveCustomDish(dishId: string): Promise<void> {
    await delay(400);
    const idx = MOCK_DB_DISHES.findIndex((d) => d.id === dishId);
    if (idx === -1) throw new Error('Dish not found');
    MOCK_DB_DISHES[idx].isActive = false;
    MOCK_DB_DISHES[idx].updatedAt = new Date().toISOString();
  },
};
