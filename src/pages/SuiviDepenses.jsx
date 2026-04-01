import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { collection, onSnapshot, getDocs } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function SuiviDepenses() {
  const currentMonth = new Date().toISOString().slice(0,7);
  const [moisSelectionne, setMoisSelectionne] = useState(currentMonth);
  const [depensesPrevues, setDepensesPrevues] = useState([]);
  const [depensesEffectuees, setDepensesEffectuees] = useState([]);

  // Récupération des budgets mensuels
  useEffect(() => {
    const fetchBudget = async () => {
      const snap = await getDocs(collection(db, 'budgetMensuel'));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDepensesPrevues(data.filter(d => d.mois >= currentMonth));
    };
    fetchBudget();
  }, [currentMonth]);

  // Récupération des dépenses du mois
  useEffect(() => {
    const [year, month] = moisSelectionne.split("-");
    const debutMois = new Date(parseInt(year), parseInt(month)-1, 1);
    const finMois = new Date(parseInt(year), parseInt(month), 0,23,59,59);

    const unsub = onSnapshot(collection(db, 'depenses'), snap => {
      const data = snap.docs.map(d => d.data())
        .filter(d => {
          const t = d.timestamp?.toDate();
          return t >= debutMois && t <= finMois;
        });
      setDepensesEffectuees(data);
    });

    return () => unsub();
  }, [moisSelectionne]);

  // Calcul du tableau avec reste à dépenser (stable avec useMemo)
  const tableau = useMemo(() => {
    return depensesPrevues.map(budget => {
      const dejaDepense = depensesEffectuees
        .filter(d => d.type === budget.type)
        .reduce((acc, d) => acc + Number(d.montant || 0), 0);
      const reste = (budget.montant || 0) - dejaDepense;
      return {
        type: budget.type,
        montant: budget.montant,
        dejaDepense,
        reste: reste > 0 ? reste : 0
      };
    });
  }, [depensesPrevues, depensesEffectuees]);

  // Préparer les données du graphique
  const resteGraphData = useMemo(() => tableau.map(t => ({ name: t.type, reste: t.reste })), [tableau]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <label className="font-black text-[#4A3228] uppercase text-xs">Sélection du mois :</label>
        <input
          type="month"
          value={moisSelectionne}
          onChange={(e) => setMoisSelectionne(e.target.value)}
          className="bg-gray-50 border-none rounded-xl p-2 font-bold text-[#4A3228] cursor-pointer"
        />
      </div>

      <table className="min-w-full bg-white border rounded-2xl overflow-hidden shadow-sm mt-6">
        <thead>
          <tr className="bg-gray-50 text-gray-500 uppercase text-xs font-bold">
            <th className="p-3 border-b">Type</th>
            <th className="p-3 border-b">Montant prévu</th>
            <th className="p-3 border-b">Déjà dépensé</th>
            <th className="p-3 border-b">Reste</th>
          </tr>
        </thead>
        <tbody>
          {tableau.map((row, idx) => (
            <tr key={idx} className="text-sm text-gray-700">
              <td className="p-3 border-b">{row.type}</td>
              <td className="p-3 border-b">{row.montant.toLocaleString()} F</td>
              <td className="p-3 border-b">{row.dejaDepense.toLocaleString()} F</td>
              <td className="p-3 border-b font-black text-green-600">{row.reste.toLocaleString()} F</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="bg-white p-6 rounded-2xl shadow-sm mt-8">
        <h3 className="text-xs font-black uppercase text-[#4A3228] mb-4">Évolution du reste à dépenser</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={resteGraphData}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="reste" fill="#059669" radius={[10,10,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}