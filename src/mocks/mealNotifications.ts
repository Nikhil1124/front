// mocks/mealNotifications.ts
// Frontend-only mock data. Replace with real query/service layer later
// (screens -> hooks -> query/mutation -> service -> mock data now / API later).

import { MealNotificationData } from "../types/notification";

export const mockMealNotifications: MealNotificationData[] = [
  {
    id: "notif-lunch-001",
    appLabel: "PGow",
    mealType: "lunch",
    title: "Today's Lunch is Ready!",
    chefName: "Chef Priya",
    menuItems: ["Steamed Rice", "Chicken Curry", "Dal (Toor)", "Spinach Poriyal", "Curd"],
    createdAt: new Date().toISOString(),
    ad: {
      id: "ad-rapido-001",
      brandName: "rapido",
      tagline: "Your ride to office, made simple.",
      ctaLabel: "Book now",
      accentColor: "#FFD100",
      deepLink: "https://example.com/rapido", // placeholder — swap for real deep link
    },
  },
];
