import { OwnerLoginScreen } from '@/features/owner/OwnerLoginScreen';

// Staff portal → tab index 2 (Kitchen & Staff). Same underlying form as owner-login,
// just opened on a different tab — see OwnerLoginScreen's own TABS array.
export default function StaffLoginRoute() {
  return <OwnerLoginScreen initialTab={2} />;
}
