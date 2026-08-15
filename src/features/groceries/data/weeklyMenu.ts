import { productImages } from './productAssets';
import { DayMenuConfig } from './WeeklyMenuTypes';

export const weeklyMenu: Record<string, DayMenuConfig> = {
  Monday: {
    day: "Monday",
    type: "veg",
    title: "Everything for today's PG menu",
    menu: ["Aloo Matar Curry", "Rice", "Dal", "Salad"],
    ingredients: [
      { productId: "potato-001", name: "Potatoes", quantity: "10 kg", image: productImages.v3, price: 250, originalPrice: 380, unit: "10 kg" },
      { productId: "dal-001", name: "Toor Dal", quantity: "5 kg", image: productImages.cat_2, price: 680, originalPrice: 800, unit: "5 kg" },
      { productId: "onion-001", name: "Red Onions", quantity: "10 kg", image: productImages.v2, price: 290, originalPrice: 400, unit: "10 kg" },
      { productId: "oil-001", name: "Cooking Oil", quantity: "5 L", image: productImages.cat_3, price: 590, originalPrice: 720, unit: "5 L" }
    ]
  },
  Tuesday: {
    day: "Tuesday",
    type: "veg",
    title: "Everything for today's PG menu",
    menu: ["Mix Veg Sabzi", "Rice", "Dal", "Salad"],
    ingredients: [
      { productId: "mixveg-001", name: "Mixed Vegetables", quantity: "10 kg", image: productImages.cat_fruits_veg, price: 400, originalPrice: 520, unit: "10 kg" },
      { productId: "onion-001", name: "Red Onions", quantity: "10 kg", image: productImages.v2, price: 290, originalPrice: 400, unit: "10 kg" },
      { productId: "dal-001", name: "Toor Dal", quantity: "5 kg", image: productImages.cat_2, price: 680, originalPrice: 800, unit: "5 kg" },
      { productId: "oil-001", name: "Cooking Oil", quantity: "5 L", image: productImages.cat_3, price: 590, originalPrice: 720, unit: "5 L" }
    ]
  },
  Wednesday: {
    day: "Wednesday",
    type: "nonVeg",
    title: "Everything for today's PG menu",
    menu: ["Chicken Curry", "Rice", "Dal", "Salad"],
    ingredients: [
      { productId: "chicken-001", name: "Chicken", quantity: "5 kg", image: productImages.cat_chicken_eggs, price: 850, originalPrice: 1000, unit: "5 kg" },
      { productId: "onion-001", name: "Onions", quantity: "10 kg", image: productImages.v2, price: 290, originalPrice: 400, unit: "10 kg" },
      { productId: "oil-001", name: "Cooking Oil", quantity: "5 L", image: productImages.cat_3, price: 590, originalPrice: 720, unit: "5 L" },
      { productId: "gingargarlic-001", name: "Ginger & Garlic", quantity: "2 kg", image: productImages.v7, price: 180, originalPrice: 220, unit: "2 kg" },
      { productId: "greenchilli-001", name: "Green Chilli", quantity: "1 kg", image: productImages.v8, price: 90, originalPrice: 110, unit: "1 kg" },
      { productId: "coriander-001", name: "Coriander", quantity: "500 g", image: productImages.v9, price: 50, originalPrice: 65, unit: "500 g" }
    ]
  },
  Thursday: {
    day: "Thursday",
    type: "veg",
    title: "Everything for today's PG menu",
    menu: ["Aloo Palak Sabzi", "Rice", "Dal", "Salad"],
    ingredients: [
      { productId: "potato-001", name: "Potatoes", quantity: "10 kg", image: productImages.v3, price: 250, originalPrice: 380, unit: "10 kg" },
      { productId: "leafygreens-001", name: "Leafy Greens", quantity: "3 kg", image: productImages.v2, price: 150, originalPrice: 180, unit: "3 kg" },
      { productId: "onion-001", name: "Red Onions", quantity: "10 kg", image: productImages.v2, price: 290, originalPrice: 400, unit: "10 kg" },
      { productId: "dal-001", name: "Toor Dal", quantity: "5 kg", image: productImages.cat_2, price: 680, originalPrice: 800, unit: "5 kg" }
    ]
  },
  Friday: {
    day: "Friday",
    type: "nonVeg",
    title: "Everything for today's PG menu",
    menu: ["Egg Curry", "Rice", "Dal", "Salad"],
    ingredients: [
      { productId: "egg-001", name: "Fresh Farm Eggs", quantity: "120 pcs", image: productImages.d19, price: 610, originalPrice: 800, unit: "10 dozen (120 pcs)" },
      { productId: "onion-001", name: "Onions", quantity: "10 kg", image: productImages.v2, price: 290, originalPrice: 400, unit: "10 kg" },
      { productId: "oil-001", name: "Cooking Oil", quantity: "5 L", image: productImages.cat_3, price: 590, originalPrice: 720, unit: "5 L" },
      { productId: "dal-001", name: "Toor Dal", quantity: "5 kg", image: productImages.cat_2, price: 680, originalPrice: 800, unit: "5 kg" }
    ]
  },
  Saturday: {
    day: "Saturday",
    type: "pureVeg",
    title: "Everything for today's PG menu",
    menu: ["Paneer Curry", "Mix Veg", "Dal", "Rice", "Salad", "Curd"],
    ingredients: [
      { productId: "paneer-001", name: "Paneer", quantity: "5 kg", image: productImages.cat_dairy, price: 450, originalPrice: 550, unit: "5 kg" },
      { productId: "mushroom-001", name: "Mushroom", quantity: "3 kg", image: productImages.cat_fruits_veg, price: 300, originalPrice: 360, unit: "3 kg" },
      { productId: "mixveg-001", name: "Mixed Vegetables", quantity: "10 kg", image: productImages.cat_fruits_veg, price: 400, originalPrice: 520, unit: "10 kg" },
      { productId: "onion-001", name: "Onions", quantity: "10 kg", image: productImages.v2, price: 290, originalPrice: 400, unit: "10 kg" },
      { productId: "dal-001", name: "Dal", quantity: "5 kg", image: productImages.cat_2, price: 680, originalPrice: 800, unit: "5 kg" },
      { productId: "curd-001", name: "Curd", quantity: "5 kg", image: productImages.cat_dairy, price: 250, originalPrice: 300, unit: "5 kg" },
      { productId: "leafygreens-001", name: "Leafy Greens", quantity: "3 kg", image: productImages.v2, price: 150, originalPrice: 180, unit: "3 kg" },
      { productId: "rice-001", name: "Rice", quantity: "25 kg", image: productImages.cat_1, price: 1180, originalPrice: 1440, unit: "25 kg" }
    ]
  },
  Sunday: {
    day: "Sunday",
    type: "nonVeg",
    title: "Everything for today's PG menu",
    menu: ["Chicken Biryani", "Raita", "Salad"],
    ingredients: [
      { productId: "chicken-001", name: "Chicken", quantity: "5 kg", image: productImages.cat_chicken_eggs, price: 850, originalPrice: 1000, unit: "5 kg" },
      { productId: "rice-001", name: "Sona Masoori Rice", quantity: "25 kg", image: productImages.cat_1, price: 1180, originalPrice: 1440, unit: "25 kg" },
      { productId: "onion-001", name: "Onions", quantity: "10 kg", image: productImages.v2, price: 290, originalPrice: 400, unit: "10 kg" },
      { productId: "curd-001", name: "Curd", quantity: "5 kg", image: productImages.cat_dairy, price: 250, originalPrice: 300, unit: "5 kg" }
    ]
  }
};
