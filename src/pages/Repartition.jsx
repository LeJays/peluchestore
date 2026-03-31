import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, onSnapshot } from "firebase/firestore";
import { Calendar } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Repartition() {
  // Mois courant par défaut
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [moisSelectionne, setMoisSelectionne] = useState(currentMonth);

  const [totalVentes, setTotalVentes] = useState(0);
  const [repartition, setRepartition] = useState([]);

  const COLORS = ['#4A3228', '#A62626', '#D97706', '#059669', '#2563EB', '#7C3AED'];

  useEffect(() => {
    const [year, month] = moisSelectionne.split('-');
    const debutMois = new Date(parseInt(year), parseInt(month) - 1, 1);
    const finMois = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

    // 1️⃣ Récupérer les commandes du mois
    const unsubCommandes = onSnapshot(collection(db, "commandes"), (snap) => {
      const data = snap.docs.map(doc => doc.data());

      const ventesMois = data.filter(v => {
        const d = v.timestamp?.toDate();
        return d >= debutMois && d <= finMois;
      });

      const total = ventesMois.reduce((acc, v) => {
        let montant = 0;
        if (v.statut === 'payé' && v.statut_paiement === 'TOTALEMENT_PAYÉ') {
          montant = Number(v.prixTotal) || 0;
        } else if (v.statut === 'prépayé') {
          montant = Number(v.montantRembourse) || 0;
        }
        return acc + montant;
      }, 0);

      setTotalVentes(total);

      // 2️⃣ Calcul répartition
      const fonctionnement = total * 0.4;
      const cotisation = total * 0.3;
      const restockage = total * 0.3;

      const repartitionData = [
        {
          name: "Fonctionnement",
          value: fonctionnement,
          details: [
            { name: "Loyer (30%)", value: fonctionnement * 0.3 },
            { name: "Connexion (10%)", value: fonctionnement * 0.1 },
            { name: "Salaire (30%)", value: fonctionnement * 0.3 },
            { name: "Electricité (15%)", value: fonctionnement * 0.15 },
            { name: "Autre (15%)", value: fonctionnement * 0.15 },
          ]
        },
        { name: "Cotisation", value: cotisation },
        {
          name: "Restockage",
          value: restockage,
          details: [
            { name: "Achat peluche (40%)", value: restockage * 0.4 },
            { name: "Achat coton (30%)", value: restockage * 0.3 },
            { name: "Transport (30%)", value: restockage * 0.3 },
          ]
        }
      ];

      setRepartition(repartitionData);
    });

    return () => unsubCommandes();
  }, [moisSelectionne]);

  return (
    <div className="space-y-8 pb-20">
      {/* Sélecteur de mois */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#A62626]/10 rounded-2xl text-[#A62626]">
            <Calendar size={24} />
          </div>
          <div>
            <h3 className="text-sm font-black text-[#4A3228] uppercase">Période d'analyse</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase">Sélectionnez un mois pour voir la répartition</p>
          </div>
        </div>
        <input 
          type="month" 
          value={moisSelectionne}
          onChange={(e) => setMoisSelectionne(e.target.value)}
          className="bg-gray-50 border-none rounded-xl p-3 font-black text-[#4A3228] focus:ring-2 focus:ring-[#A62626] cursor-pointer"
        />
      </div>

      {/* Total Ventes */}
      <div className="bg-white p-6 rounded-[2rem] border-l-8 border-green-500 shadow-sm">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total vendu ce mois</p>
        <h2 className="text-3xl font-black text-[#4A3228] mt-1">{totalVentes.toLocaleString()} F</h2>
      </div>

      {/* Diagramme répartition */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {repartition.map((part, index) => (
          <div key={index} className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
            <h3 className="text-xs font-black uppercase text-[#4A3228] mb-4">{part.name}</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={part.details || [{ name: part.name, value: part.value }]}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  label={(entry) => `${entry.name}: ${Math.round(entry.value).toLocaleString()} F`}
                >
                  {(part.details || [{ name: part.name, value: part.value }]).map((entry, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${Number(value).toLocaleString()} F`} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </div>
  );
}