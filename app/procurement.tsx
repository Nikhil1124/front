/**
 * Shared, not owner-only — a chef can raise a requisition here too (pg-backend's own
 * procurement/service.py: create_order allows OWNER, MANAGER or CHEF as the raiser), and the
 * server already scopes what each role sees (chef: only their own requests; owner/manager:
 * the whole property's queue — list_orders in procurement/service.py). ProcurementScreen
 * itself decides which tabs to show based on role.
 */
import { ProcurementScreen } from '@/features/procurement/ProcurementScreen';

export default ProcurementScreen;
