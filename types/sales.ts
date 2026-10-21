export interface ParsedSalesMessage {
  date: string;
  dsf: string;
  todayValue: number;
}

export interface ExcelUpdateResult {
  fileName: string;
  sheetName: string;
  rowNumber: number;
  columnNumber: number;
  updatedValue: number;
  outputUri: string;
  downloadUrl?: string;
  wasOriginalUpdated: boolean;
  backupUri?: string;
}

export interface SelectedExcelFile {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
}

export interface AppState {
  selectedFile: SelectedExcelFile | null;
  pastedMessage: string;
  parsedMessage: ParsedSalesMessage | null;
  statusMessage: Message;
  statusStep: Message | null;
  errorMessage: Message | null;
  successMessage: Message | null;
  isLoading: boolean;
  updateResult: ExcelUpdateResult | null;
}
import type { Message } from '@/localization';

