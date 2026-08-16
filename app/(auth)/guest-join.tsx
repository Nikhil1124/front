import { OwnerLoginScreen } from '@/features/owner/OwnerLoginScreen';

// Resident portal → tab index 3 (Resident / Guest). Same underlying form as owner-login,
// just opened on a different tab — see OwnerLoginScreen's own TABS array.
export default function GuestJoinRoute() {
  return <OwnerLoginScreen initialTab={3} />;
}
