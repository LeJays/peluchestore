import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, onSnapshot, query } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { TrendingUp, ArrowDownCircle, ArrowUpCircle, Target, ShoppingBag, Activity, Calendar } from 'lucide-react';

export default function Performance() {
  // État pour le mois (format YYYY-MM)
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [moisSelectionne, setMoisSelectionne] = useState(currentMonth);

  const [stats, setStats] = useState({
    totalVentes: 0,
    totalDepenses: 0,
    topPeluches: [],
    repartitionDepenses: [],
  });

  const COLORS = ['#4A3228', '#A62626', '#D97706', '#059669', '#2563EB', '#7C3AED'];

  useEffect(() => {
    // Calculer les bornes du mois sélectionné
    const [year, month] = moisSelectionne.split('-');
    const debutMois = new Date(parseInt(year), parseInt(month) - 1, 1);
    const finMois = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

    // 1. ANALYSE DES VENTES (COMMANDES)
    const unsubCommandes = onSnapshot(collection(db, "commandes"), (snap) => {
      const data = snap.docs.map(doc => ({ ...doc.data() }));
      
      // Filtrage précis par date
      const ventesMois = data.filter(v => {
        const d = v.timestamp?.toDate();
        return d >= debutMois && d <= finMois;
      });

      const recapPeluches = ventesMois.reduce((acc, v) => {
        const nom = v.nomArticle || "Inconnu";
        acc[nom] = (acc[nom] || 0) + (Number(v.quantite) || 0);
        return acc;
      }, {});

      const topPeluchesData = Object.entries(recapPeluches)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

      const totalV = ventesMois.reduce((acc, v) => acc + (Number(v.prixTotal) || 0), 0);
      setStats(prev => ({ ...prev, totalVentes: totalV, topPeluches: topPeluchesData }));
    });

    // 2. ANALYSE DES DÉPENSES
    const unsubDepenses = onSnapshot(collection(db, "depenses"), (snap) => {
      const data = snap.docs.map(doc => doc.data());
      
      const depMois = data.filter(d => {
        const dateD = d.timestamp?.toDate();
        return dateD >= debutMois && dateD <= finMois;
      });

      const recapTypes = depMois.reduce((acc, d) => {
        const t = d.typeOriginal || d.type || "autre";
        acc[t] = (acc[t] || 0) + (Number(d.montant) || 0);
        return acc;
      }, {});

      const repartitionData = Object.entries(recapTypes).map(([name, value]) => ({ 
        name: name.toUpperCase(), 
        value 
      }));

      const totalD = depMois.reduce((acc, d) => acc + (Number(d.montant) || 0), 0);
      setStats(prev => ({ 
        ...prev, 
        totalDepenses: totalD, 
        repartitionDepenses: repartitionData 
      }));
    });

    return () => { unsubCommandes(); unsubDepenses(); };
  }, [moisSelectionne]); // Re-déclenche l'effet quand le mois change

  const profitNet = stats.totalVentes - stats.totalDepenses;

  return (
    <div className="space-y-8 pb-20">
      
      {/* SÉLECTEUR DE PÉRIODE */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#A62626]/10 rounded-2xl text-[#A62626]">
            <Calendar size={24} />
          </div>
          <div>
            <h3 className="text-sm font-black text-[#4A3228] uppercase">Période d'analyse</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase">Sélectionnez un mois pour voir l'historique</p>
          </div>
        </div>
        <input 
          type="month" 
          value={moisSelectionne}
          onChange={(e) => setMoisSelectionne(e.target.value)}
          className="bg-gray-50 border-none rounded-xl p-3 font-black text-[#4A3228] focus:ring-2 focus:ring-[#A62626] cursor-pointer"
        />
      </div>

      {/* CARDS RÉCAPITULATIVES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border-l-8 border-green-500 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Recettes</p>
          <h2 className="text-3xl font-black text-[#4A3228] mt-1">{stats.totalVentes.toLocaleString()} F</h2>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border-l-8 border-red-500 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Dépenses</p>
          <h2 className="text-3xl font-black text-[#4A3228] mt-1">{stats.totalDepenses.toLocaleString()} F</h2>
        </div>
        <div className={`p-6 rounded-[2rem] shadow-xl text-white ${profitNet >= 0 ? 'bg-[#4A3228]' : 'bg-red-900'}`}>
          <p className="text-[10px] font-black opacity-50 uppercase tracking-widest">Bénéfice Net</p>
          <h2 className="text-3xl font-black text-yellow-500 mt-1">{profitNet.toLocaleString()} F</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* DIAGRAMME RÉPARTITION DES DÉPENSES */}
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Target className="text-[#A62626]" />
            <h3 className="text-xs font-black uppercase text-[#4A3228]">Répartition des Dépenses</h3>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.repartitionDepenses} innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value">
                  {stats.repartitionDepenses.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 'bold'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SANTÉ FINANCIÈRE */}
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Activity className="text-green-600" />
            <h3 className="text-xs font-black uppercase text-[#4A3228]">Santé Financière</h3>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Entrées', montant: stats.totalVentes },
                { name: 'Sorties', montant: stats.totalDepenses }
              ]}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} fontBold />
                <Tooltip cursor={{fill: '#FDFCFB'}} />
                <Bar dataKey="montant" radius={[10, 10, 0, 0]} barSize={60}>
                  <Cell fill="#059669" />
                  <Cell fill="#A62626" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* TOP 5 PELUCHES VENDUES (VERSION VERTICALE) */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <ShoppingBag className="text-blue-600" />
            <h3 className="text-xs font-black uppercase text-[#4A3228]">Peluches les plus vendues</h3>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.topPeluches}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} fontBold interval={0} angle={-15} textAnchor="end" />
                <YAxis axisLine={false} tickLine={false} fontSize={10} />
                <Tooltip cursor={{fill: '#FDFCFB'}} />
                <Bar dataKey="qty" radius={[12, 12, 0, 0]} barSize={50}>
                  {stats.topPeluches.map((entry, index) => (
                    <Cell key={index} fill={index === 0 ? '#A62626' : '#4A3228'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}