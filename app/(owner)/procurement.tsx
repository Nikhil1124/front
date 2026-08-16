import { ProcurementScreen } from '@/features/procurement/ProcurementScreen';

// mode is left undefined on purpose — ProcurementScreen already resolves owner vs manager
// from the store itself when no mode is passed (see its own `effectiveMode` fallback).
export default ProcurementScreen;
