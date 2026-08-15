export interface MenuIngredient {
  productId: string; // ID of the product in mockProducts
  name: string;
  quantity: string;
  image: any;
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
