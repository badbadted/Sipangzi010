
import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Building2,
  CheckCircle2,
  AlertCircle,
  Search,
  ArrowRightLeft,
  ChevronDown,
  Trash2,
  Banknote,
  Plus,
  Undo2,
  X
} from 'lucide-react';
import { RegistrationEntry, BankEntry } from './types';
import { basicReconciliation } from './services/reconciliationService';
import DataInputModal from './components/DataInputModal';
import StatsSummary from './components/StatsSummary';

const App: React.FC = () => {
  const [registrations, setRegistrations] = useState<RegistrationEntry[]>([]);
  const [bankEntries, setBankEntries] = useState<BankEntry[]>([]);
  const [activeModal, setActiveModal] = useState<'reg' | 'bank' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [bankImportProgress, setBankImportProgress] = useState<number | null>(null);
  type StatusFilter = 'all' | 'matched' | 'partial' | 'pending';
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  type ActiveTab = 'registrations' | 'unmatchedBank';
  const [activeTab, setActiveTab] = useState<ActiveTab>('registrations');
  const [manualMatchReg, setManualMatchReg] = useState<RegistrationEntry | null>(null);
  const [manualMatchReason, setManualMatchReason] = useState('');
  const [manualMatchBank, setManualMatchBank] = useState<BankEntry | null>(null);
  const [bankMatchSearch, setBankMatchSearch] = useState('');

  // Auto-run basic matching whenever data changes
  useEffect(() => {
    if (registrations.length > 0 && bankEntries.length > 0) {
      // Filter out manually matched entries before reconciliation
      const manualMatchedRegIds = new Set(
        registrations
          .filter((r) => r.reconciliationNote?.startsWith('[人工新增]'))
          .map((r) => r.id)
      );
      const manualMatchedBankIds = new Set(
        bankEntries
          .filter((b) => b.summary === '[人工新增]')
          .map((b) => b.id)
      );

      const regsToReconcile = registrations.filter((r) => !manualMatchedRegIds.has(r.id));
      const banksToReconcile = bankEntries.filter((b) => !manualMatchedBankIds.has(b.id));

      if (regsToReconcile.length > 0 && banksToReconcile.length > 0) {
        const { registrations: updatedRegs, bankEntries: updatedBank } = basicReconciliation(regsToReconcile, banksToReconcile);

        // Merge back with manually matched entries
        const finalRegs = registrations.map((r) => {
          if (manualMatchedRegIds.has(r.id)) return r;
          const updated = updatedRegs.find((ur) => ur.id === r.id);
          return updated || r;
        });
        const finalBanks = bankEntries.map((b) => {
          if (manualMatchedBankIds.has(b.id)) return b;
          const updated = updatedBank.find((ub) => ub.id === b.id);
          return updated || b;
        });

        const anyChange = finalRegs.some(
          (r, i) => r.status !== registrations[i]?.status || r.reconciliationNote !== registrations[i]?.reconciliationNote
        );
        if (anyChange) {
          setRegistrations(finalRegs);
          setBankEntries(finalBanks);
        }
      }
    }
  }, [registrations.length, bankEntries.length]);

  const handleImportReg = (text: string) => {
    const lines = text.trim().split('\n');
    const newRegs: RegistrationEntry[] = lines.slice(1)
      .map((line, idx) => {
        const cols = line.split('\t');
        const playerName = cols[0]?.trim();
        const amountStr = cols[1]?.replace(/[^0-9.]/g, '');
        const totalAmount = parseFloat(amountStr || '0');
        const lastFiveDigits = (cols[3] || cols[2] || '').trim().slice(-5);

        // Validate required fields
        if (!playerName || !amountStr || totalAmount <= 0 || !lastFiveDigits) {
          return null;
        }

        return {
          id: `reg-${Date.now()}-${idx}`,
          playerName,
          totalAmount,
          lastFiveDigits,
          fullNote: cols[2] || '',
          status: 'pending' as const
        };
      })
      .filter((reg): reg is RegistrationEntry => reg !== null);

    setRegistrations(prev => [...prev, ...newRegs]);
    setActiveModal(null);
  };

  const handleImportBank = async (text: string) => {
    const lines = text.trim().split('\n');
    const dataLines = lines.slice(1).filter((line) => line.trim());
    const total = dataLines.length;
    if (total === 0) {
      setActiveModal(null);
      return;
    }
    setBankImportProgress(0);
    const CHUNK_SIZE = 80;
    const timestamp = Date.now();
    const newBanks: BankEntry[] = [];
    for (let i = 0; i < dataLines.length; i += CHUNK_SIZE) {
      const chunk = dataLines.slice(i, i + CHUNK_SIZE);
      chunk.forEach((line, idx) => {
        const cols = line.split('\t');
        newBanks.push({
          id: `bank-${timestamp}-${i + idx}`,
          date: cols[0] || '',
          time: cols[1] || '',
          summary: cols[2] || '',
          amount: parseFloat(cols[4]?.replace(/[^0-9.]/g, '') || '0'),
          note: cols[5] || '',
          bankInfo: cols[6] || '',
          lastFiveDigits: cols[7] || '',
          message: cols[8] || '',
          status: 'available'
        });
      });
      setBankImportProgress(Math.round(((i + chunk.length) / total) * 100));
      await new Promise((r) => setTimeout(r, 20));
    }
    setBankEntries((prev) => [...prev, ...newBanks]);
    setBankImportProgress(null);
    setActiveModal(null);
  };

  const resetAll = () => {
    if (confirm('確定要清除所有數據嗎？')) {
      setRegistrations([]);
      setBankEntries([]);
    }
  };

  // Manual matching handler - creates a new bank entry with the registration amount
  const handleManualMatch = () => {
    if (!manualMatchReg || !manualMatchReason.trim()) return;

    const now = new Date();
    const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const bankId = `bank-manual-${Date.now()}`;

    // Create new bank entry
    const newBankEntry: BankEntry = {
      id: bankId,
      date: dateStr,
      time: timeStr,
      summary: '[人工新增]',
      amount: manualMatchReg.totalAmount,
      note: manualMatchReason.trim(),
      bankInfo: '',
      lastFiveDigits: manualMatchReg.lastFiveDigits,
      message: `人工新增 - ${manualMatchReg.playerName}`,
      status: 'matched',
      matchedId: manualMatchReg.id
    };

    // Update registration status
    setRegistrations((prev) =>
      prev.map((r) =>
        r.id === manualMatchReg.id
          ? {
              ...r,
              status: 'matched',
              matchedId: bankId,
              reconciliationNote: `[人工新增] ${manualMatchReason.trim()}`
            }
          : r
      )
    );

    // Add the new bank entry
    setBankEntries((prev) => [...prev, newBankEntry]);

    // Reset modal state
    setManualMatchReg(null);
    setManualMatchReason('');
  };

  // Open manual match modal
  const openManualMatchFromReg = (reg: RegistrationEntry) => {
    setManualMatchReg(reg);
    setManualMatchReason('');
  };

  // Restore/undo manual match
  const handleRestoreManualMatch = (reg: RegistrationEntry) => {
    if (!reg.matchedId || !reg.reconciliationNote?.startsWith('[人工新增]')) return;

    // Remove the manually created bank entry
    setBankEntries((prev) => prev.filter((b) => b.id !== reg.matchedId));

    // Reset registration status
    setRegistrations((prev) =>
      prev.map((r) =>
        r.id === reg.id
          ? { ...r, status: 'pending', matchedId: undefined, reconciliationNote: undefined }
          : r
      )
    );
  };

  // Open bank-to-registration match modal
  const openManualMatchFromBank = (bank: BankEntry) => {
    setManualMatchBank(bank);
    setBankMatchSearch('');
  };

  // Handle bank-to-registration match
  const handleBankToRegMatch = (reg: RegistrationEntry) => {
    if (!manualMatchBank) return;

    const diff = manualMatchBank.amount - reg.totalAmount;
    let note = `[手動對應] 銀行：$${manualMatchBank.amount.toLocaleString()} (${manualMatchBank.date} ${manualMatchBank.time})`;
    if (diff > 0) {
      note += ` 多出 $${diff.toLocaleString()}`;
    } else if (diff < 0) {
      note += ` 少出 $${Math.abs(diff).toLocaleString()}`;
    }

    // Update registration
    setRegistrations((prev) =>
      prev.map((r) =>
        r.id === reg.id
          ? { ...r, status: 'matched', matchedId: manualMatchBank.id, reconciliationNote: note }
          : r
      )
    );

    // Update bank entry
    setBankEntries((prev) =>
      prev.map((b) =>
        b.id === manualMatchBank.id
          ? { ...b, status: 'matched', matchedId: reg.id }
          : b
      )
    );

    setManualMatchBank(null);
    setBankMatchSearch('');
  };

  // Filter available registrations for bank matching
  const availableRegsForBankMatch = useMemo(() => {
    if (!manualMatchBank) return [];
    let regs = registrations.filter(
      (r) => r.status === 'pending' || r.status === 'partial' || r.status === 'unmatched'
    );
    if (bankMatchSearch) {
      regs = regs.filter(
        (r) =>
          r.playerName.includes(bankMatchSearch) ||
          r.lastFiveDigits.includes(bankMatchSearch) ||
          r.totalAmount.toString().includes(bankMatchSearch)
      );
    }
    return regs;
  }, [registrations, manualMatchBank, bankMatchSearch]);

  const filteredBySearch = registrations.filter(
    (r) => r.playerName.includes(searchQuery) || r.lastFiveDigits.includes(searchQuery)
  );
  const filteredRegs = useMemo(() => {
    if (statusFilter === 'all') return filteredBySearch;
    if (statusFilter === 'pending') return filteredBySearch.filter((r) => r.status === 'pending' || r.status === 'unmatched');
    return filteredBySearch.filter((r) => r.status === statusFilter);
  }, [filteredBySearch, statusFilter]);

  const STATUS_PRIORITY: Record<string, number> = { matched: 2, partial: 1, pending: 0, unmatched: 0 };
  const sortedRegs = useMemo(
    () => [...filteredRegs].sort((a, b) => STATUS_PRIORITY[b.status] - STATUS_PRIORITY[a.status]),
    [filteredRegs]
  );

  // Filter unmatched bank entries
  const unmatchedBankEntries = useMemo(() => {
    return bankEntries.filter((b) => b.status === 'available');
  }, [bankEntries]);

  const filteredUnmatchedBank = useMemo(() => {
    if (!searchQuery) return unmatchedBankEntries;
    return unmatchedBankEntries.filter(
      (b) =>
        b.lastFiveDigits.includes(searchQuery) ||
        b.message.includes(searchQuery) ||
        b.note.includes(searchQuery) ||
        b.bankInfo.includes(searchQuery)
    );
  }, [unmatchedBankEntries, searchQuery]);

  return (
    <div className="min-h-screen pb-20">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <ArrowRightLeft size={24} />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                比賽對帳智慧助手
              </h1>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={resetAll}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                title="清除數據"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Header Stats & Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
              onClick={() => setActiveModal('reg')}
              className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group flex flex-col items-start text-left"
            >
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors mb-4">
                <Users size={28} />
              </div>
              <h3 className="text-lg font-bold mb-1">匯入報名資料</h3>
              <p className="text-sm text-slate-500">上傳選手姓名、應繳金額與後五碼</p>
              <div className="mt-4 text-xs font-semibold text-indigo-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                立即匯入 <ChevronDown size={14} />
              </div>
            </button>

            <button 
              onClick={() => setActiveModal('bank')}
              className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all group flex flex-col items-start text-left"
            >
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors mb-4">
                <Building2 size={28} />
              </div>
              <h3 className="text-lg font-bold mb-1">匯入銀行流水</h3>
              <p className="text-sm text-slate-500">上傳對帳單、金額與轉帳備註</p>
              <div className="mt-4 text-xs font-semibold text-emerald-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                立即匯入 <ChevronDown size={14} />
              </div>
            </button>
          </div>
          
          <div>
            <StatsSummary registrations={registrations} bankEntries={bankEntries} />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('registrations')}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'registrations'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users size={16} className="inline-block mr-2 -mt-0.5" />
            報名資料
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-slate-100">{registrations.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('unmatchedBank')}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'unmatchedBank'
                ? 'border-amber-600 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Banknote size={16} className="inline-block mr-2 -mt-0.5" />
            未匹配銀行流水
            <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
              unmatchedBankEntries.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100'
            }`}>{unmatchedBankEntries.length}</span>
          </button>
        </div>

        {/* Search & Status filter */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder={activeTab === 'registrations' ? '搜尋姓名或後五碼...' : '搜尋後五碼、備註或轉帳留言...'}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {activeTab === 'registrations' && (
            <div className="flex items-center gap-2 w-full md:w-auto">
              <label htmlFor="status-filter" className="text-sm font-medium text-slate-600 whitespace-nowrap">狀態篩選：</label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="flex-1 md:w-40 px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              >
                <option value="all">全部</option>
                <option value="matched">完全匹配</option>
                <option value="partial">待確認</option>
                <option value="pending">未繳費</option>
              </select>
            </div>
          )}
        </div>

        {/* Data Tables */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            {activeTab === 'registrations' ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase w-16">序號</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">狀態</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">選手姓名</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">報名金額</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">預計後五碼</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">對帳結果</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase w-24">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedRegs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-20 text-center text-slate-400">
                        {filteredBySearch.length === 0 ? '尚未匯入資料，請點擊上方按鈕匯入。' : '沒有符合篩選條件的資料。'}
                      </td>
                    </tr>
                  ) : (
                    sortedRegs.map((reg, index) => (
                      <tr key={reg.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-4 text-slate-500 font-mono text-sm">{index + 1}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {reg.status === 'matched' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600">
                              <CheckCircle2 size={12} /> 完全匹配
                            </span>
                          ) : reg.status === 'partial' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-600">
                              <AlertCircle size={12} /> 待確認
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
                              未繳費
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-900">{reg.playerName}</td>
                        <td className="px-6 py-4 text-right font-mono font-medium text-slate-700">
                          ${reg.totalAmount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-500">{reg.lastFiveDigits}</td>
                        <td className="px-6 py-4">
                          <div className="flex-1 min-w-[200px]">
                            {reg.reconciliationNote ? (
                              <span className={`text-sm ${reg.status === 'matched' ? 'text-emerald-700 font-medium' : reg.reconciliationNote.includes('少出') ? 'text-amber-700' : reg.reconciliationNote.includes('多出') ? 'text-blue-700' : 'text-slate-700'}`}>
                                {reg.reconciliationNote}
                              </span>
                            ) : (
                              <p className="text-sm text-slate-400 italic">尚未找到相符交易</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {(reg.status === 'pending' || reg.status === 'partial' || reg.status === 'unmatched') && (
                            <button
                              onClick={() => openManualMatchFromReg(reg)}
                              className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                              title="人工新增款項"
                            >
                              <Plus size={16} />
                            </button>
                          )}
                          {reg.status === 'matched' && reg.reconciliationNote?.startsWith('[人工新增]') && (
                            <button
                              onClick={() => handleRestoreManualMatch(reg)}
                              className="p-2 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                              title="還原（取消人工新增）"
                            >
                              <Undo2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase w-16">序號</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">日期</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">時間</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">金額</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">後五碼</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">對方銀行</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">轉帳留言/備註</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase w-20">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUnmatchedBank.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-20 text-center text-slate-400">
                        {bankEntries.length === 0
                          ? '尚未匯入銀行流水，請點擊上方按鈕匯入。'
                          : unmatchedBankEntries.length === 0
                          ? '所有銀行流水都已匹配到選手。'
                          : '沒有符合搜尋條件的資料。'}
                      </td>
                    </tr>
                  ) : (
                    filteredUnmatchedBank.map((bank, index) => (
                      <tr key={bank.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-4 text-slate-500 font-mono text-sm">{index + 1}</td>
                        <td className="px-6 py-4 text-slate-700">{bank.date}</td>
                        <td className="px-6 py-4 text-slate-500">{bank.time}</td>
                        <td className="px-6 py-4 text-right font-mono font-medium text-amber-600">
                          ${bank.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-500">{bank.lastFiveDigits}</td>
                        <td className="px-6 py-4 text-slate-600">{bank.bankInfo || '-'}</td>
                        <td className="px-6 py-4">
                          <div className="flex-1 min-w-[200px]">
                            {bank.message || bank.note ? (
                              <span className="text-sm text-slate-700">
                                {bank.message || bank.note}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-400 italic">無備註</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => openManualMatchFromBank(bank)}
                            className="p-2 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                            title="對應選手"
                          >
                            <Users size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      {activeModal === 'reg' && (
        <DataInputModal
          title="匯入報名資料"
          placeholder="小選手姓名	總金額	備註	匯款帳號後5碼..."
          onImport={handleImportReg}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'bank' && (
        <DataInputModal
          title="匯入銀行流水"
          placeholder="日期	時間	摘要	提	存	存摺備註	對方銀行	後五碼	轉帳留言..."
          onImport={handleImportBank}
          onClose={() => setActiveModal(null)}
          importProgress={bankImportProgress}
        />
      )}

      {/* Manual Match Modal - Enter Reason */}
      {manualMatchReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md m-4">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold text-slate-900">人工新增款項</h2>
              <button
                onClick={() => { setManualMatchReg(null); setManualMatchReason(''); }}
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-sm text-slate-500 mb-1">選手資訊</div>
                <div className="font-semibold text-slate-900">{manualMatchReg.playerName}</div>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="font-mono text-indigo-600 font-semibold">${manualMatchReg.totalAmount.toLocaleString()}</span>
                  <span className="text-slate-500">後五碼: {manualMatchReg.lastFiveDigits}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  新增原因 <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  rows={3}
                  placeholder="請輸入人工新增款項的原因，例如：現金收款、其他帳戶轉入..."
                  value={manualMatchReason}
                  onChange={(e) => setManualMatchReason(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setManualMatchReg(null); setManualMatchReason(''); }}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleManualMatch}
                  disabled={!manualMatchReason.trim()}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl transition-colors"
                >
                  確認新增
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bank to Registration Match Modal */}
      {manualMatchBank && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col m-4">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-lg font-bold text-slate-900">對應選手</h2>
                <p className="text-sm text-slate-500 mt-1">
                  銀行流水：<span className="font-mono font-semibold text-amber-600">${manualMatchBank.amount.toLocaleString()}</span>
                  {' '}| {manualMatchBank.date} {manualMatchBank.time}
                  {' '}| 後五碼：<span className="font-mono text-slate-600">{manualMatchBank.lastFiveDigits}</span>
                </p>
              </div>
              <button
                onClick={() => { setManualMatchBank(null); setBankMatchSearch(''); }}
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="搜尋選手姓名、金額或後五碼..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                  value={bankMatchSearch}
                  onChange={(e) => setBankMatchSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {availableRegsForBankMatch.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  {registrations.filter((r) => r.status !== 'matched').length === 0
                    ? '沒有待匹配的選手'
                    : '沒有符合搜尋條件的選手'}
                </div>
              ) : (
                <div className="space-y-2">
                  {availableRegsForBankMatch.map((reg) => {
                    const diff = manualMatchBank.amount - reg.totalAmount;
                    return (
                      <div
                        key={reg.id}
                        className="p-4 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-xl cursor-pointer transition-all group"
                        onClick={() => handleBankToRegMatch(reg)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-lg text-slate-900">{reg.playerName}</span>
                              <span className="font-mono font-medium text-slate-700">${reg.totalAmount.toLocaleString()}</span>
                              {diff === 0 && (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">金額相符</span>
                              )}
                              {diff > 0 && (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                  多 ${diff.toLocaleString()}
                                </span>
                              )}
                              {diff < 0 && (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                  少 ${Math.abs(diff).toLocaleString()}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                              <span className="font-mono">後五碼: {reg.lastFiveDigits}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                reg.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {reg.status === 'partial' ? '待確認' : '未繳費'}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 rounded-lg">
                              <CheckCircle2 size={12} /> 確認對應
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer Branding */}
      <footer className="mt-20 border-t py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-slate-400">© 2024 比賽對帳智慧助手 · 提升賽事管理效率</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
