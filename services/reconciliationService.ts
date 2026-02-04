
import { RegistrationEntry, BankEntry } from '../types';

function setNote(reg: RegistrationEntry, note: string) {
  reg.reconciliationNote = note;
}

export function basicReconciliation(
  registrations: RegistrationEntry[],
  bankEntries: BankEntry[]
): { registrations: RegistrationEntry[]; bankEntries: BankEntry[] } {
  const updatedRegs = registrations.map((r) => ({ ...r, reconciliationNote: undefined as string | undefined }));
  const updatedBank = [...bankEntries];

  // 1. Exact Match: Last 5 Digits + Amount (一對一)
  updatedRegs.forEach((reg) => {
    if (reg.status === 'matched') return;

    const matchIndex = updatedBank.findIndex(
      (bank) =>
        bank.status === 'available' &&
        bank.lastFiveDigits === reg.lastFiveDigits &&
        bank.amount === reg.totalAmount
    );

    if (matchIndex !== -1) {
      const bank = updatedBank[matchIndex];
      reg.status = 'matched';
      reg.matchedId = bank.id;
      setNote(reg, `對應銀行入帳: ${bank.note || '銀行存款'} - $${bank.amount.toLocaleString()}`);
      bank.status = 'matched';
      bank.matchedId = reg.id;
    }
  });

  // 2. 相同後五碼加總處理：多筆報名可能對應一筆匯款，以加總判斷是否足夠
  const pendingRegs = updatedRegs.filter((r) => r.status !== 'matched');
  const groups = new Map<string, RegistrationEntry[]>();
  pendingRegs.forEach((reg) => {
    const key = reg.lastFiveDigits || 'none';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(reg);
  });

  groups.forEach((regs, digits) => {
    if (digits === 'none' || regs.length === 0) return;
    const availableBanks = updatedBank.filter(
      (b) => b.status === 'available' && b.lastFiveDigits === digits
    );
    if (availableBanks.length === 0) return;

    const groupSum = regs.reduce((s, r) => s + r.totalAmount, 0);
    const bankAmount = availableBanks.reduce((s, b) => s + b.amount, 0);
    const sumStr = `$${groupSum.toLocaleString()}`;
    const bankStr = `$${bankAmount.toLocaleString()}`;

    if (groupSum === bankAmount) {
      // 加總與銀行一致 → 足夠，整組視為匹配
      availableBanks.forEach((b) => {
        b.status = 'matched';
        b.matchedId = regs[0].id;
      });
      regs.forEach((reg, i) => {
        reg.status = 'matched';
        if (i === 0) reg.matchedId = availableBanks[0].id;
        setNote(reg, `加總 ${sumStr}，銀行 ${bankStr}，足夠`);
      });
      return;
    }

    if (bankAmount > groupSum) {
      const diff = bankAmount - groupSum;
      regs.forEach((reg) => {
        reg.status = 'partial';
        setNote(reg, `加總 ${sumStr}，銀行 ${bankStr}，多出 $${diff.toLocaleString()}`);
      });
      return;
    }

    if (bankAmount < groupSum) {
      const diff = groupSum - bankAmount;
      regs.forEach((reg) => {
        reg.status = 'partial';
        setNote(reg, `加總 ${sumStr}，銀行 ${bankStr}，少出 $${diff.toLocaleString()}`);
      });
    }
  });

  // 3. 僅後五碼相符、尚未處理到的（無銀行或已處理完）：標記為 partial，若無 reconciliationNote 則不覆寫
  updatedRegs.forEach((reg) => {
    if (reg.status === 'matched' || reg.reconciliationNote) return;
    const matchIndex = updatedBank.findIndex(
      (bank) => bank.status === 'available' && bank.lastFiveDigits === reg.lastFiveDigits
    );
    if (matchIndex !== -1) {
      const bank = updatedBank[matchIndex];
      reg.status = 'partial';
      const bankStr = `$${bank.amount.toLocaleString()}`;
      if (reg.totalAmount < bank.amount) {
        setNote(reg, `後五碼相符，金額多出 $${(bank.amount - reg.totalAmount).toLocaleString()}（銀行 ${bankStr}）`);
      } else if (reg.totalAmount > bank.amount) {
        setNote(reg, `後五碼相符，金額少出 $${(reg.totalAmount - bank.amount).toLocaleString()}（銀行 ${bankStr}）`);
      } else {
        setNote(reg, `後五碼相符，金額相符（銀行 ${bankStr}）`);
      }
    }
  });

  // 4. 留言匹配：未匹配銀行流水的留言內容是否包含選手名稱
  updatedBank.forEach((bank) => {
    if (bank.status !== 'available' || !bank.message) return;

    // 尋找名稱出現在留言中的未匹配選手
    const matchingReg = updatedRegs.find(
      (reg) =>
        (reg.status === 'pending' || reg.status === 'unmatched') &&
        !reg.reconciliationNote &&
        reg.playerName &&
        bank.message.includes(reg.playerName)
    );

    if (matchingReg) {
      const bankStr = `$${bank.amount.toLocaleString()}`;
      const diff = bank.amount - matchingReg.totalAmount;

      matchingReg.status = 'matched';
      matchingReg.matchedId = bank.id;
      matchingReg.messageMatched = true;
      matchingReg.matchedBankDigits = bank.lastFiveDigits;

      let note = `[留言匹配] 銀行留言含「${matchingReg.playerName}」，帳號後五碼: ${bank.lastFiveDigits || '無'} (非 ${matchingReg.lastFiveDigits})`;
      if (diff > 0) {
        note += `，多 $${diff.toLocaleString()}`;
      } else if (diff < 0) {
        note += `，少 $${Math.abs(diff).toLocaleString()}`;
      }
      setNote(matchingReg, note);

      bank.status = 'matched';
      bank.matchedId = matchingReg.id;
      bank.messageMatched = true;
    }
  });

  return { registrations: updatedRegs, bankEntries: updatedBank };
}
