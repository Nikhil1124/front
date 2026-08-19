export interface MenuIngredient {
  productId: string; // ID of the product in []
  name: string;
  quantity: string;
  image: string | null;
  price: number;
  originalPrice?: number;
  unit: string;
}

export interface DayMenuConfig {
  day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
  type: "veg" | "nonVeg" | "pureVeg";
  title: string;
  menu: string[];
  ingredients: MenuIngredient[];
}

export type WeeklyMenuConfig = Record<string, DayMenuConfig>;
