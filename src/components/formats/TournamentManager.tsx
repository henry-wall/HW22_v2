// TournamentManager.tsx
import { useState, useEffect } from "react";
import MixedDoublesScheduler from "./MixedDoublesScheduler";

interface TournamentTab {
  id: string;
  name: string;
  active: boolean;
}

export default function TournamentManager() {
  const [tabs, setTabs] = useState<TournamentTab[]>(() => {
    const saved = localStorage.getItem("tournamentTabs");
    return saved
      ? JSON.parse(saved)
      : [{ id: "tab-1", name: "Torneio 1", active: true }];
  });

  useEffect(() => {
    localStorage.setItem("tournamentTabs", JSON.stringify(tabs));
  }, [tabs]);

  const addTab = () => {
    if (tabs.length >= 6) {
      alert("Máximo de 6 torneios atingido!");
      return;
    }
    const newTab: TournamentTab = {
      id: `tab-${Date.now()}`,
      name: `Torneio ${tabs.length + 1}`,
      active: true
    };
    setTabs([...tabs, newTab]);
  };

  const removeTab = (id: string) => {
    if (tabs.length <= 1) {
      alert("Você precisa manter pelo menos um torneio!");
      return;
    }
    setTabs(tabs.filter(tab => tab.id !== id));
    // Limpar dados do torneio removido
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(`mixedDoublesData_${id}`)) {
        localStorage.removeItem(key);
      }
    });
  };

  const updateTabName = (id: string, name: string) => {
    setTabs(tabs.map(tab => tab.id === id ? { ...tab, name } : tab));
  };

  const activeTab = tabs.find(tab => tab.active) || tabs[0];

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* Painel de Controle */}
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold" style={{ color: "#FB0395", fontFamily: "'Century Gothic', 'Arial Narrow', Arial, sans-serif" }}>
          Gerenciador de Torneios
        </h1>
        <button
          onClick={addTab}
          className="px-4 py-2 bg-green-500 text-white rounded font-bold"
          style={{ fontFamily: "'Century Gothic', 'Arial Narrow', Arial, sans-serif" }}
        >
          ➕ Novo Torneio
        </button>
      </div>

      {/* Abas */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map(tab => (
          <div key={tab.id} className="flex">
            <button
              className={`px-4 py-2 rounded-t ${tab.active ? 'bg-white text-black' : 'bg-gray-200 text-gray-700'}`}
              onClick={() => setTabs(tabs.map(t => ({ ...t, active: t.id === tab.id })))}
              style={{ fontFamily: "'Century Gothic', 'Arial Narrow', Arial, sans-serif" }}
            >
              {tab.name}
            </button>
            <button
              className="px-2 bg-red-500 text-white rounded-r"
              onClick={() => removeTab(tab.id)}
              disabled={tabs.length <= 1}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Torneio Ativo */}
      <div className="border rounded">
        <div className="bg-slate-100 p-2">
          <input
            type="text"
            value={activeTab.name}
            onChange={(e) => updateTabName(activeTab.id, e.target.value)}
            className="px-2 py-1 rounded border"
            style={{ fontFamily: "'Century Gothic', 'Arial Narrow', Arial, sans-serif" }}
          />
        </div>
        <div className="p-4">
          <MixedDoublesScheduler
            key={activeTab.id}
            storagePrefix={`mixedDoublesData_${activeTab.id}`}
          />
        </div>
      </div>
    </div>
  );
}