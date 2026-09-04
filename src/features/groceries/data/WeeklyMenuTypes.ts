export interface MenuIngredient {
  productId: string; // ID of the product in []
  name: string;
  quantity: string;
  image: string | null;
  price: number;
  originalPrice?: number;
  unit: string;
  /** How many packs the day's recipe needs — the number `quantity` is a display string of. */
  packs: number;
}

export interface DayMenuConfig {
  day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
  type: "veg" | "nonVeg" | "pureVeg";
  title: string;
  menu: string[];
  ingredients: MenuIngredient[];
}

export type WeeklyMenuConfig = Record<string, DayMenuConfig>;
