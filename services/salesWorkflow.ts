import { AppState, SelectedExcelFile } from '@/types/sales';
import { SavedWorkbook } from './workbookStorage';

export function changeSalesMessage(state: AppState, message: string): AppState {
  return { ...state, pastedMessage: message, parsedMessage: null, successMessage: null, errorMessage: null };
}

export function canUpdateSales(state: AppState): boolean {
  return !!state.selectedFile && !!state.parsedMessage && !state.isLoading;
}

// Acquired before the first await, independent of React's next render.
export function createOperationLock() {
  let busy = false;
  return {
    acquire() { if (busy) return false; busy = true; return true; },
    release() { busy = false; },
  };
}

export async function chooseReplacement(
  pick: () => Promise<SelectedExcelFile | null>,
  replace: (file: SelectedExcelFile) => Promise<SavedWorkbook>,
): Promise<SavedWorkbook | null> {
  const file = await pick();
  return file ? replace(file) : null;
}
