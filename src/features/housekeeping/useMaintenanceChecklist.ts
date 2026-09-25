/**
 * The facility-checks grid (Working / Needs Attention / Not Working).
 *
 * The rooms are the property's own, as the owner set them up — floors and room numbers, from
 * `GET /v1/pgs/{id}/rooms`. They used to be a fixed "Room 201 / 202 / 203" at every property.
 * The building-wide checks (cleanliness, kitchen, plumbing, general) are the same everywhere.
 *
 * ponytail: the statuses are still kept on this phone only — pg-backend has no checklist
 * table. They are kept per property, so someone working at two never sees one's checks on
 * the other's rooms, and they are cleared on sign-out. Upgrade path: a `facility_checks`
 * table keyed by pg_id, room, item, if they ever need to reach the owner or another phone.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";

import { API } from "../../config";
import { apiFetch } from "../../data/apiClient";
import { qk } from "../../data/queryKeys";

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

interface PgRoom {
  floor_number: number;
  room_number: string;
}

/** Checked in every room the owner set up. */
const ROOM_ITEMS = ["Lights", "Fan", "Switches"];

/** The same at every property. */
const BUILDING: Record<string, { room: string; items: string[] }[]> = {
  Cleanliness: [{ room: "Building Cleanliness", items: ["Rooms", "Bathrooms", "Common Area", "Corridors", "Waste Disposal"] }],
  "Kitchen Hygiene": [{ room: "Kitchen Check", items: ["Cooking Area", "Utensils", "Food Storage", "Refrigerator", "Waste Disposal"] }],
  General: [{ room: "General Facilities", items: ["Doors & Windows", "Pest Control"] }],
  Plumbing: [{ room: "Plumbing Checks", items: ["Water Supply", "Leaks", "Drainage"] }],
};

const key = (category: string, room: string, item: string) => `${category}|${room}|${item}`;

function buildChecklist(rooms: PgRoom[], statuses: Record<string, ChecklistItemStatus>): ChecklistTree {
  const group = (category: string, room: string, items: string[]): ChecklistRoom => ({
    room,
    items: items.map((name) => ({ name, status: statuses[key(category, room, name)] ?? "Working" })),
  });
  const tree: ChecklistTree = {
    Electrical: rooms.map((r) => group("Electrical", `Floor ${r.floor_number} · Room ${r.room_number}`, ROOM_ITEMS)),
  };
  for (const [category, groups] of Object.entries(BUILDING)) {
    tree[category] = groups.map((g) => group(category, g.room, g.items));
  }
  return tree;
}

interface MaintenanceChecklistState {
  /** pgId → "category|room|item" → status. Only what someone actually changed. */
  statuses: Record<string, Record<string, ChecklistItemStatus>>;
  setItemStatus: (pgId: string, category: string, room: string, itemName: string, status: ChecklistItemStatus) => void;
}

export const useMaintenanceChecklist = create<MaintenanceChecklistState>()(
  persist(
    (set) => ({
      statuses: {},
      setItemStatus: (pgId, category, room, itemName, status) =>
        set((state) => ({
          statuses: {
            ...state.statuses,
            [pgId]: { ...state.statuses[pgId], [key(category, room, itemName)]: status },
          },
        })),
    }),
    {
      name: "pgow-maintenance-checklist",
      storage: createJSONStorage(() => AsyncStorage),
      // v0 was one tree for the phone, on made-up rooms; nothing in it maps onto real ones.
      version: 1,
      migrate: () => ({ statuses: {} }),
    }
  )
);

/** The checklist for this property: its real rooms, the building-wide checks, and whatever
 *  has been marked on this phone. `hasRooms` false means the owner has not set rooms up yet. */
export function useFacilityChecklist(pgId: string | null) {
  const { data: rooms = [], isLoading } = useQuery({
    queryKey: qk.properties.rooms(pgId ?? ""),
    queryFn: () => apiFetch<PgRoom[]>(API.PG_ROOMS(pgId!)),
    enabled: !!pgId,
  });
  const statuses = useMaintenanceChecklist((s) => (pgId ? s.statuses[pgId] : undefined));
  const save = useMaintenanceChecklist((s) => s.setItemStatus);
  return {
    tree: buildChecklist(rooms, statuses ?? {}),
    roomsLoading: isLoading,
    hasRooms: rooms.length > 0,
    setItemStatus: (category: string, room: string, itemName: string, status: ChecklistItemStatus) => {
      if (pgId) save(pgId, category, room, itemName, status);
    },
  };
}

export default useMaintenanceChecklist;
