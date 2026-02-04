
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  Search,
  ArrowRightLeft,
  ChevronDown,
  Trash2
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

  // Auto-run basic matching whenever data changes
  useEffect(() => {
    if (registrations.length > 0 && bankEntries.length > 0) {
      const { registrations: updatedRegs, bankEntries: updatedBank } = basicReconciliation(registrations, bankEntries);
      const anyChange = updatedRegs.some(
        (r, i) => r.status !== registrations[i]?.status || r.reconciliationNote !== registrations[i]?.reconciliationNote
      );
      if (anyChange) {
        setRegistrations(updatedRegs);
        setBankEntries(updatedBank);
      }
    }
  }, [registrations.length, bankEntries.length]);

  const handleImportReg = (text: string) => {
    const lines = text.trim().split('\n');
    const newRegs: RegistrationEntry[] = lines.slice(1).map((line, idx) => {
      const cols = line.split('\t');
      return {
        id: `reg-${Date.now()}-${idx}`,
        playerName: cols[0] || '未知',
        totalAmount: parseFloat(cols[1]?.replace(/[^0-9.]/g, '') || '0'),
        lastFiveDigits: (cols[3] || cols[2] || '').slice(-5),
        fullNote: cols[2] || '',
        status: 'pending'
      };
    });
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

        {/* Search & Status filter */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="搜尋姓名或後五碼..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
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
              <option value="pending">未匹配</option>
            </select>
          </div>
        </div>

        {/* Data Tables */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase w-16">序號</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">狀態</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">選手姓名</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">報名金額</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">預計後五碼</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">對帳結果</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedRegs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center text-slate-400">
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
                            未匹配
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
