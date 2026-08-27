/**
 * The facility-checks room/item grid (Working / Needs Attention / Broken), persisted on this
 * device only.
 *
 * ponytail: there is no backend concept for this — checked pg-backend for anything named
 * checklist/inspection/facility and found nothing. `HousekeepingDashboard`'s "Save Progress"
 * used to show a confirmation dialog that read "Your inspection progress has been securely
 * saved to the server" and then discarded the whole tree the moment the component unmounted;
 * nothing was ever saved anywhere, server or otherwise. This at least makes the save real —
 * AsyncStorage, same pattern as the grocery cart and wishlist — so progress survives an app
 * restart. It does not sync across devices and there is no history of who changed what when.
 * Upgrade path: a real `pg-backend` endpoint (a `facility_checks` table keyed by pg_id, room,
 * item) if this ever needs to be visible to more than the one device that filled it in.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ChecklistItemStatus = "Working" | "Needs Attention" | "Not Working";

export interface ChecklistItem {
  name: string;
  status: ChecklistItemStatus;
}

export interface ChecklistRoom {
  room: string;
  items: ChecklistItem[];
}

export type ChecklistTree = Record<string, ChecklistRoom[]>;

const DEFAULT_TREE: ChecklistTree = {
  Electrical: [
    { room: "Room 201", items: [{ name: "Lights", status: "Working" }, { name: "Fan", status: "Working" }, { name: "Switches", status: "Working" }] },
    { room: "Room 202", items: [{ name: "Lights", status: "Working" }, { name: "Fan", status: "Working" }, { name: "Switches", status: "Working" }] },
    { room: "Room 203", items: [{ name: "Lights", status: "Working" }, { name: "Fan", status: "Working" }, { name: "Switches", status: "Working" }] },
  ],
  Cleanliness: [
    { room: "Building Cleanliness", items: [{ name: "Rooms", status: "Working" }, { name: "Bathrooms", status: "Working" }, { name: "Common Area", status: "Working" }, { name: "Corridors", status: "Working" }, { name: "Waste Disposal", status: "Working" }] },
  ],
  "Kitchen Hygiene": [
    { room: "Kitchen Check", items: [{ name: "Cooking Area", status: "Working" }, { name: "Utensils", status: "Working" }, { name: "Food Storage", status: "Working" }, { name: "Refrigerator", status: "Working" }, { name: "Waste Disposal", status: "Working" }] },
  ],
  General: [
    { room: "General Facilities", items: [{ name: "Doors & Windows", status: "Working" }, { name: "Pest Control", status: "Working" }] },
  ],
  Plumbing: [
    { room: "Plumbing Checks", items: [{ name: "Water Supply", status: "Working" }, { name: "Leaks", status: "Working" }, { name: "Drainage", status: "Working" }] },
  ],
};

interface MaintenanceChecklistState {
  tree: ChecklistTree;
  setItemStatus: (category: string, room: string, itemName: string, status: ChecklistItemStatus) => void;
}

export const useMaintenanceChecklist = create<MaintenanceChecklistState>()(
  persist(
    (set) => ({
      tree: DEFAULT_TREE,
      setItemStatus: (category, room, itemName, status) =>
        set((state) => {
          const rooms = state.tree[category] ?? [];
          const nextRooms = rooms.map((r) =>
            r.room !== room
              ? r
              : { ...r, items: r.items.map((it) => (it.name === itemName ? { ...it, status } : it)) }
          );
          return { tree: { ...state.tree, [category]: nextRooms } };
        }),
    }),
    {
      name: "pgow-maintenance-checklist",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useMaintenanceChecklist;
