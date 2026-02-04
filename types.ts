
export interface RegistrationEntry {
  id: string;
  playerName: string;
  totalAmount: number;
  lastFiveDigits: string;
  fullNote: string;
  status: 'pending' | 'matched' | 'partial' | 'unmatched';
  matchedId?: string;
  /** 對帳結果說明：加總是否足夠、多出/少出等 */
  reconciliationNote?: string;
  /** 標記是否為留言匹配（帳號不同） */
  messageMatched?: boolean;
  /** 留言匹配時，記錄銀行的後五碼 */
  matchedBankDigits?: string;
}

export interface BankEntry {
  id: string;
  date: string;
  time: string;
  summary: string;
  amount: number;
  note: string;
  bankInfo: string;
  lastFiveDigits: string;
  message: string;
  status: 'available' | 'matched';
  matchedId?: string;
  /** 標記是否為留言匹配（帳號不同） */
  messageMatched?: boolean;
}

export interface ReconciliationResult {
  registrationId: string;
  bankEntryId: string;
  matchScore: number; // 0 to 100
  matchReason: string;
}

export enum MatchType {
  EXACT = 'EXACT',
  AMOUNT_ONLY = 'AMOUNT_ONLY',
  DIGITS_ONLY = 'DIGITS_ONLY',
  AI_FUZZY = 'AI_FUZZY',
  NONE = 'NONE'
}
