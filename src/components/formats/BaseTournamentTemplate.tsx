// src/components/formats/BaseTournamentTemplate.tsx
import React, { useState } from "react";

interface BaseTournamentProps {
  tournamentType: "king-queen" | "super-8" | "team-cup";
  title: string;
}

export default function BaseTournamentTemplate({ tournamentType, title }: BaseTournamentProps) {
  const [tournamentName, setTournamentName] = useState("Wall BT - " + title);
  const [numCourts, setNumCourts] = useState(2);
  const [durationType, setDurationType] = useState<"set6" | "shortset" | "supertie">("set6");

  // 💡 CORES SUAVES NO ESTILO AQUARELA
  const courtColors = [
    { bg: "#A0F0FF", border: "#70D0E0", text: "#000" },
    { bg: "#F8A0D0", border: "#E070B0", text: "#000" },
    { bg: "#FFD9A0", border: "#E0B070", text: "#000" },
    { bg: "#D1C0FF", border: "#A080E0", text: "#000" },
    { bg: "#A0F0C0", border: "#70D0A0", text: "#000" },
    { bg: "#FFCBA0", border: "#E0A070", text: "#000" },
  ];

  // Funções placeholder
  const handlePrint = () => {
    alert("Função de impressão será implementada");
  };

  const handleExportCSV = () => {
    alert("Exportação CSV será implementada");
  };

  const handleGenerate = () => {
    alert(`Gerar cronograma para ${title}`);
  };

  return (
    <div
      className="p-6 max-w-7xl mx-auto"
      style={{
        fontFamily: "'Century Gothic', 'Arial Narrow', Arial, sans-serif",
      }}
    >
      {/* 💡 LOGOMARCA */}
      <div className="mb-4 flex justify-center">
        <img
          src="https://i.imgur.com/sQWqNap.png"
          alt="Logomarca Wall BT"
          className="h-24 object-contain"
        />
      </div>

      <h1
        className="text-2xl font-bold mb-4 text-center"
        style={{
          color: "#FB0395",
          fontFamily: "'Century Gothic', 'Arial Narrow', Arial, sans-serif",
        }}
      >
        {tournamentName}
      </h1>

      <div className="bg-slate-50 p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label
              className="block mb-2"
              style={{
                fontFamily: "'Century Gothic', 'Arial Narrow', Arial, sans-serif",
              }}
            >
              Nome do Torneio:
            </label>
            <input
              className="border px-2 py-1 rounded w-full"
              value={tournamentName}
              onChange={(e) => setTournamentName(e.target.value)}
              style={{
                fontFamily: "'Century Gothic', 'Arial Narrow', Arial, sans-serif",
              }}
            />
          </div>

          <div>
            <label
              className="block mb-2"
              style={{
                fontFamily: "'Century Gothic', 'Arial Narrow', Arial, sans-serif",
              }}
            >
              Formato das Partidas:
            </label>
            <select
              className="border px-2 py-1 rounded w-full"
              value={durationType}
              onChange={(e) => setDurationType(e.target.value as any)}
              style={{
                fontFamily: "'Century Gothic', 'Arial Narrow', Arial, sans-serif",
              }}
            >
              <option value="set6">Set 6 games (40 min)</option>
              <option value="shortset">Short Set (25 min)</option>
              <option value="supertie">Super Tie (10 min)</option>
            </select>
          </div>

          <div>
            <label
              className="block mb-2"
              style={{
                fontFamily: "'Century Gothic', 'Arial Narrow', Arial, sans-serif",
              }}
            >
              Número de Quadras:
            </label>
            <input
              type="number"
              min="1"
              max="6"
              className="border px-2 py-1 rounded w-full"
              value={numCourts}
              onChange={(e) => setNumCourts(Number(e.target.value) || 1)}
              style={{
                fontFamily: "'Century Gothic', 'Arial Narrow', Arial, sans-serif",
              }}
            />
          </div>
        </div>

        <button
          className="ml-3 px-3 py-1 rounded transition"
          style={{
            backgroundColor: "#00F1FD",
            color: "black",
            fontWeight: "bold",
            fontFamily: "'Century Gothic', 'Arial Narrow', Arial, sans-serif",
          }}
          onClick={handleGenerate}
        >
          Gerar Cronograma
        </button>

        <div
          className="mt-4 p-3 rounded"
          style={{
            backgroundColor: "#00F1FD20",
            fontFamily: "'Century Gothic', 'Arial Narrow', Arial, sans-serif",
          }}
        >
          <strong>⏱️ Estimativa de Duração ({numCourts} quadra(s)):</strong>
          <br />
          [Número de partidas] × [Formato]
          <br />
          <strong>Tempo total estimado:</strong> [X]h[Y]min
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded p-4 shadow">
          <h2
            className="text-lg font-semibold mb-2"
            style={{
              fontFamily: "'Century Gothic', 'Arial Narrow', Arial, sans-serif",
            }}
          >
            Configuração
          </h2>
          <div className="text-gray-500">
            <p>Este formato ainda está em desenvolvimento.</p>
            <p className="mt-2">
              <strong>Tipo:</strong> {title}
            </p>
          </div>
        </div>

        <div className="bg-white rounded p-4 shadow">
          <div className="flex justify-between items-center mb-2">
            <h2
              className="text-lg font-semibold"
              style={{
                fontFamily: "'Century Gothic', 'Arial Narrow', Arial, sans-serif",
              }}
            >
              Resultados
            </h2>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 rounded text-sm transition"
                style={{
                  backgroundColor: "#00F1FD",
                  color: "black",
                  fontWeight: "bold",
                  fontFamily: "'Century Gothic', 'Arial Narrow', Arial, sans-serif",
                }}
                onClick={handlePrint}
              >
                🖨️ Imprimir
              </button>
              <button
                className="px-3 py-1 rounded text-sm transition"
                style={{
                  backgroundColor: "#FB0395",
                  color: "white",
                  fontWeight: "bold",
                  fontFamily: "'Century Gothic', 'Arial Narrow', Arial, sans-serif",
                }}
                onClick={handleExportCSV}
              >
                📊 Exportar CSV
              </button>
            </div>
          </div>
          <div className="text-gray-500 mt-4">
            Resultados aparecerão aqui quando o formato estiver implementado.
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white rounded p-4 shadow">
        <h2
          className="text-lg font-semibold mb-3"
          style={{
            fontFamily: "'Century Gothic', 'Arial Narrow', Arial, sans-serif",
          }}
        >
          Rodadas
        </h2>
        <div className="text-gray-500">
          As rodadas serão geradas automaticamente após a implementação.
        </div>
      </div>
    </div>
  );
}