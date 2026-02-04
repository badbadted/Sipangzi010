import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { RegistrationEntry, BankEntry } from '../types';

interface Props {
  registrations: RegistrationEntry[];
  bankEntries: BankEntry[];
}

const StatsSummary: React.FC<Props> = ({ registrations, bankEntries }) => {
  const stats = {
    matched: registrations.filter((r) => r.status === 'matched').length,
    partial: registrations.filter((r) => r.status === 'partial').length,
    pending: registrations.filter((r) => r.status === 'pending' || r.status === 'unmatched').length,
  };

  const totalRegistration = registrations.reduce((s, r) => s + r.totalAmount, 0);
  const totalReceived = bankEntries.reduce((s, b) => s + b.amount, 0);
  const diff = totalReceived - totalRegistration;

  const data = [
    { name: '完全匹配', value: stats.matched, color: '#10b981' },
    { name: '需核對', value: stats.partial, color: '#f59e0b' },
    { name: '待核對', value: stats.pending, color: '#94a3b8' },
  ];

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full flex flex-col lg:flex-row items-center">
      <div className="w-full h-48 lg:w-1/2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius={50}
              outerRadius={70}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-4 w-full px-4">
        <h3 className="font-semibold text-slate-700 border-b pb-2">對帳概況</h3>
        <div className="grid grid-cols-1 gap-2">
          {data.map((item) => (
            <div key={item.name} className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-sm text-slate-600">{item.name}</span>
              </div>
              <span className="font-bold text-slate-800">
                {item.value} <span className="text-xs font-normal text-slate-400">筆</span>
              </span>
            </div>
          ))}
          <div className="pt-2 mt-2 border-t flex justify-between">
            <span className="text-sm font-semibold">總計</span>
            <span className="font-bold">{registrations.length} 筆</span>
          </div>
        </div>
        <div className="pt-3 mt-3 border-t space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600">報名總金額</span>
            <span className="font-bold font-mono text-slate-800">${totalRegistration.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600">目前收到金額</span>
            <span className="font-bold font-mono text-slate-800">${totalReceived.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-sm pt-1">
            <span className="text-slate-600">差異</span>
            <span
              className={`font-bold font-mono ${
                diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-amber-600' : 'text-slate-600'
              }`}
            >
              {diff > 0 ? '+' : ''}${diff.toLocaleString()}
              {diff > 0 ? '（多收）' : diff < 0 ? '（少收）' : '（相符）'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsSummary;
