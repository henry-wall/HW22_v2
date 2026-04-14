// src/components/formats/TournamentSelector.tsx
import { useState, useEffect } from "react";
import { useTournamentState } from "../../hooks/useTournamentState";
import { useStorage } from "../../services/storage/StorageContext";
import SyncStatusBadge from "../SyncStatusBadge";
import MixedDoublesScheduler from "./MixedDoublesScheduler";
import KingQueenScheduler from "./KingQueenScheduler";
import Super8Scheduler from "./Super8Scheduler";
import TeamCupScheduler from "./TeamCupScheduler";

type TournamentFormat =
  | "mixed-doubles"
  | "king-queen"
  | "super-8"
  | "team-cup";

interface TournamentTab {
  id: string;
  name: string;
  format: TournamentFormat;
  active: boolean;
}

export default function TournamentSelector() {
  const { migrateLocalToCloud } = useStorage();

  const { data: tabsData, updateField: updateTabsField, syncStatus: tabsSyncStatus, lastSavedAt: tabsLastSavedAt } = useTournamentState<{ tabs: TournamentTab[] }>(
    "wallbt_global_tabs_v2",
    { tabs: [{ id: "tab-1", name: "Torneio 1", format: "mixed-doubles" as TournamentFormat, active: true }] }
  );
  const tabs = tabsData.tabs;
  const setTabs = (newTabs: TournamentTab[]) => updateTabsField("tabs", newTabs);

  // Migrar dados antigos (se houver) para a nova chave sincronizada apenas uma vez
  useEffect(() => {
    const oldLocalTabs = localStorage.getItem("tournamentTabs");
    const newGlobalTabs = localStorage.getItem("wallbt_global_tabs"); // Verificação direta simples

    if (oldLocalTabs && !newGlobalTabs) {
      try {
        const parsed = JSON.parse(oldLocalTabs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTabs(parsed); // Isso disparará o save no novo storage (local ou nuvem)
        }
      } catch (e) {
        console.error("Erro ao migrar abas antigas", e);
      }
    }
  }, []);

  const addTab = (format: TournamentFormat) => {
    if (tabs.length >= 6) {
      alert("Máximo de 6 torneios atingido!");
      return;
    }
    const newTab: TournamentTab = {
      id: `tab-${Date.now()}`,
      name: `${format === "mixed-doubles" ? "Troca Casais" :
        format === "king-queen" ? "Rei/Rainha" :
          format === "super-8" ? "Super 8" : "Team Cup"} ${tabs.length + 1}`,
      format,
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
    // Limpar dados do torneio removido (opcional)
  };

  const updateTabName = (id: string, name: string) => {
    setTabs(tabs.map(tab => tab.id === id ? { ...tab, name } : tab));
  };

  if (!tabs || !Array.isArray(tabs) || tabs.length === 0) {
    return <div className="p-8 text-center">Carregando abas...</div>;
  }

  const activeTab = tabs.find(tab => tab.active) || tabs[0];

  if (tabs.length === 1 && !activeTab.active) {
    // Caso inicial - mostrar menu de seleção
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        {/* 💡 LOGOMARCA */}
        <div className="mb-4 flex justify-center">
          <img
            src="https://i.imgur.com/sQWqNap.png"
            alt="Logomarca Wall BT"
            className="h-24 object-contain"
          />
        </div>

        <h1 className="text-3xl font-bold mb-8 text-[#FB0395]">Wall BT - Torneios</h1>
        <h2 className="text-xl mb-6 font-semibold">
          Escolha o formato do torneio:
        </h2>

        <div className="grid grid-cols-1 gap-4">
          <button
            className="p-4 bg-blue-100 rounded-lg hover:bg-blue-200 transition border border-blue-300"
            onClick={() => addTab("mixed-doubles")}
          >
            <strong className="text-lg">Troca de Casais</strong>
            <p className="text-sm mt-1 text-gray-600">
              Casais mistos em rodízio
            </p>
          </button>

          <button
            className="p-4 bg-pink-100 rounded-lg hover:bg-pink-200 transition border border-pink-300"
            onClick={() => addTab("king-queen")}
          >
            <strong className="text-lg">Rei / Rainha</strong>
            <p className="text-sm mt-1 text-gray-600">
              Um jogador fixo contra todos
            </p>
          </button>

          <button
            className="p-4 bg-purple-100 rounded-lg hover:bg-purple-200 transition border border-purple-300"
            onClick={() => addTab("super-8")}
          >
            <strong className="text-lg">Super 8</strong>
            <p className="text-sm mt-1 text-gray-600">
              Mata-mata com 8 jogadores
            </p>
          </button>

          <button
            className="p-4 bg-amber-100 rounded-lg hover:bg-amber-200 transition border border-amber-300"
            onClick={() => addTab("team-cup")}
          >
            <strong className="text-lg">Team Cup</strong>
            <p className="text-sm mt-1 text-gray-600">
              Times fixos em confronto
            </p>
          </button>
        </div>
      </div>
    );
  }

  const renderActiveTournament = () => {
    const storagePrefix = `tournament_${activeTab.id}`;

    switch (activeTab.format) {
      case "mixed-doubles":
        return <MixedDoublesScheduler key={activeTab.id} storagePrefix={storagePrefix} />;
      case "king-queen":
        return <KingQueenScheduler key={activeTab.id} storagePrefix={storagePrefix} />;
      case "super-8":
        return <Super8Scheduler key={activeTab.id} storagePrefix={storagePrefix} />;
      case "team-cup":
        return <TeamCupScheduler key={activeTab.id} storagePrefix={storagePrefix} />;
      default:
        return <MixedDoublesScheduler key={activeTab.id} storagePrefix={storagePrefix} />;
    }
  };

  // Estado para modal de compartilhamento
  const [showShareModal, setShowShareModal] = useState(false);

  // Obter URL atual para exibir (útil se estiver rodando com --host)
  const currentUrl = window.location.href;

  return (
    <div className="px-1 py-4 sm:p-4 max-w-7xl mx-auto">
      {/* Modal de Compartilhamento */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold mb-4 text-center">📱 Acesso Mobile / Compartilhar</h3>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Para acessar de outro dispositivo na mesma rede Wi-Fi:</p>

              <ol className="list-decimal list-inside text-sm space-y-2 mb-4">
                <li>Certifique-se que o servidor está rodando com <code>npm run dev:host</code></li>
                <li>No computador, verifique o IP exibido no terminal (ex: 192.168.x.x:5173)</li>
                <li>No celular, digite esse endereço no navegador</li>
              </ol>

              <div className="p-3 bg-gray-100 rounded text-center mb-2">
                <span className="text-xs text-gray-500 block">Endereço atual no navegador:</span>
                <code className="text-blue-600 break-all font-bold">{currentUrl}</code>
              </div>

              <div className="border-t pt-2 mt-4 text-xs text-gray-500">
                💡 Dica: Se o endereço acima for "localhost", ele só funciona neste computador. Use o IP da rede local para acesso externo.
              </div>
            </div>

            <div className="mb-4 pt-4 border-t">
              <h4 className="font-bold text-sm mb-2">☁️ Sincronização</h4>
              <p className="text-xs text-gray-600 mb-2">
                Seus dados no PC e no celular estão diferentes? Use este botão no PC para enviar seus dados locais para a nuvem.
              </p>
              <button
                onClick={async () => {
                  await migrateLocalToCloud();
                  setShowShareModal(false);
                }}
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 text-sm font-semibold flex items-center justify-center gap-2"
              >
                📥 Enviar Dados Locais para Nuvem
              </button>
            </div>

            <button
              onClick={() => setShowShareModal(false)}
              className="w-full bg-gray-800 text-white py-2 rounded hover:bg-gray-700 font-semibold"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Painel de Controle */}
      <div className="mb-6 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#FB0395", fontFamily: "'Century Gothic', 'Arial Narrow', Arial, sans-serif" }}>
            Gerenciador de Torneios
          </h1>
          <button
            onClick={() => setShowShareModal(true)}
            className="text-xs text-blue-600 underline hover:text-blue-800 flex items-center gap-1 mt-1"
          >
            📱 Acessar do Celular / Compartilhar
          </button>
        </div>
        <SyncStatusBadge status={tabsSyncStatus} lastSavedAt={tabsLastSavedAt} />

        <div className="flex gap-2">
          <button
            onClick={() => addTab("mixed-doubles")}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
          >
            ➕ Troca Casais
          </button>
          <button
            onClick={() => addTab("king-queen")}
            className="px-3 py-1 bg-pink-500 text-white rounded text-sm"
          >
            ➕ Rei/Rainha
          </button>
          <button
            onClick={() => addTab("super-8")}
            className="px-3 py-1 bg-purple-500 text-white rounded text-sm"
          >
            ➕ Super 8
          </button>
          <button
            onClick={() => addTab("team-cup")}
            className="px-3 py-1 bg-amber-500 text-white rounded text-sm"
          >
            ➕ Team Cup
          </button>
        </div>
      </div>

      {/* Abas */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map(tab => (
          <div key={tab.id} className="flex">
            <button
              className={`px-4 py-2 rounded-t text-sm ${tab.active
                ? 'bg-white text-black border border-b-0'
                : 'bg-gray-200 text-gray-700'
                }`}
              onClick={() => setTabs(tabs.map(t => ({ ...t, active: t.id === tab.id })))}
            >
              {tab.name}
            </button>
            <button
              className="px-2 bg-red-500 text-white rounded-r text-sm"
              onClick={() => removeTab(tab.id)}
              disabled={tabs.length <= 1}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Torneio Ativo */}
      <div className="border-t sm:border sm:rounded shadow-sm overflow-hidden">
        <div className="bg-slate-100 p-2 border-b sm:border-b-0">
          <input
            type="text"
            value={activeTab.name}
            onChange={(e) => updateTabName(activeTab.id, e.target.value)}
            className="px-2 py-1 rounded border text-sm"
            style={{ fontFamily: "'Century Gothic', 'Arial Narrow', Arial, sans-serif" }}
          />
        </div>
        <div className="px-0 py-4 sm:p-4">
          {renderActiveTournament()}
        </div>
      </div>
    </div>
  );
}