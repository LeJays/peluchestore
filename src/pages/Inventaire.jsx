import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, onSnapshot, query } from "firebase/firestore";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Wallet, AlertTriangle, PieChart as PieIcon, Hourglass, TrendingUp, Package, ShoppingBag, User } from 'lucide-react';

export default function Inventaire() {
  const [peluches, setPeluches] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    // 1. Écoute des peluches
    const unsubPeluches = onSnapshot(collection(db, "peluches"), (snap) => {
      setPeluches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 2. Écoute des commandes
    const unsubCommandes = onSnapshot(collection(db, "commandes"), (snap) => {
      setCommandes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 3. Écoute des dépenses
    const unsubDepenses = onSnapshot(collection(db, "depenses"), (snap) => {
      setDepenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setChargement(false);
    });

    return () => { unsubPeluches(); unsubCommandes(); unsubDepenses(); };
  }, []);

  // --- CALCULS DES VALEURS DU TRÉSOR ---
  const valeurVenteTotale = peluches.reduce((acc, p) => acc + (Number(p.prix_vente || 0) * Number(p.stock || 0)), 0);
  const totalDepenses = depenses.reduce((acc, d) => acc + Number(d.montant || 0), 0);
  
  // Marge = Valeur du stock (prix vente cumulé) - Dépenses cumulées
  const margeOptimisee = valeurVenteTotale - totalDepenses;

  // --- ANALYSE DES SOURCES (Vitrine vs Manuel) ---
  const statsSources = commandes.reduce((acc, c) => {
    const isVitrine = c.vendeur?.toLowerCase() === "vitrine";
    if (isVitrine) acc.vitrine += 1;
    else acc.manuel += 1;
    return acc;
  }, { vitrine: 0, manuel: 0 });

  const dataSources = [
    { name: 'Vitrine (Automatique)', value: statsSources.vitrine },
    { name: 'Manuel (Vendeurs)', value: statsSources.manuel }
  ];

  // --- ALERTES DE RUPTURE ---
  const alertesRupture = peluches.filter(p => (p.stock || 0) < 5 && (p.stock || 0) > 0);
  const rupturesTotale = peluches.filter(p => (p.stock || 0) === 0);

  const COLORS = ['#A62626', '#4A3228', '#D97706', '#059669', '#2563EB'];

  return (
    <div className="space-y-8 pb-20 font-sans">
      
      {/* SECTION 1 : RÉSUMÉ FINANCIER */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Valeur Totale du Stock</p>
            <h2 className="text-3xl font-black text-[#4A3228]">{valeurVenteTotale.toLocaleString()} F</h2>
            <p className="text-[9px] font-bold text-gray-400 mt-2 italic">Potentiel brut en rayon</p>
          </div>
          <TrendingUp className="absolute right-[-10px] bottom-[-10px] text-gray-50 size-24 group-hover:text-gray-100 transition-colors" />
        </div>

        <div className={`p-8 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden ${margeOptimisee >= 0 ? 'bg-[#4A3228]' : 'bg-red-900'}`}>
          <div className="relative z-10">
            <p className="text-[10px] font-black opacity-50 uppercase tracking-[0.2em] mb-2">Performance (Stock - Dépenses)</p>
            <h2 className="text-3xl font-black text-yellow-500">{margeOptimisee.toLocaleString()} F</h2>
            <p className="text-[9px] font-bold text-yellow-500/50 mt-2 italic">Bénéfice projeté après frais</p>
          </div>
          <Wallet className="absolute right-[-10px] bottom-[-10px] text-white/5 size-24" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* SECTION 2 : COMPARAISON VITRINE VS MANUEL */}
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-50">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-blue-50 rounded-2xl text-blue-600"><ShoppingBag size={20}/></div>
            <h3 className="text-xs font-black uppercase text-[#4A3228] tracking-widest">Origine des Commandes</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataSources}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} style={{fontSize: '10px', fontWeight: 'bold'}} />
                <YAxis hide />
                <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                <Bar dataKey="value" radius={[10, 10, 10, 10]} barSize={40}>
                  {dataSources.map((entry, index) => (
                    <Cell key={index} fill={index === 0 ? '#A62626' : '#4A3228'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="text-center p-3 bg-red-50 rounded-2xl">
              <p className="text-xl font-black text-[#A62626]">{statsSources.vitrine}</p>
              <p className="text-[8px] font-black text-[#A62626] uppercase">Via Vitrine</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-2xl">
              <p className="text-xl font-black text-[#4A3228]">{statsSources.manuel}</p>
              <p className="text-[8px] font-black text-[#4A3228] uppercase">Via Vendeurs</p>
            </div>
          </div>
        </div>

        {/* SECTION 3 : ALERTES DE RUPTURE */}
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-50">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-50 rounded-2xl text-orange-600"><AlertTriangle size={20}/></div>
              <h3 className="text-xs font-black uppercase text-[#4A3228] tracking-widest">Alertes Stocks</h3>
            </div>
            <span className="bg-orange-600 text-white text-[10px] px-3 py-1 rounded-full font-black">
              {alertesRupture.length + rupturesTotale.length}
            </span>
          </div>
          
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {alertesRupture.map(p => (
              <div key={p.id} className="flex justify-between items-center p-4 bg-orange-50 rounded-2xl border border-orange-100">
                <p className="font-black text-[#4A3228] text-[10px] uppercase">{p.categorie} {p.taille}</p>
                <div className="text-right">
                  <p className="text-lg font-black text-orange-600">{p.stock}</p>
                  <p className="text-[7px] font-black uppercase text-orange-400">Restants</p>
                </div>
              </div>
            ))}
            {rupturesTotale.map(p => (
              <div key={p.id} className="flex justify-between items-center p-4 bg-red-50 rounded-2xl border border-red-100">
                <p className="font-black text-red-600 text-[10px] uppercase italic line-through">{p.categorie} {p.taille}</p>
                <span className="bg-red-600 text-white text-[8px] font-black px-2 py-1 rounded-lg">VIDE</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* SECTION 4 : LES DORMEURS (STOCK MORT) */}
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-50">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-gray-100 rounded-2xl text-gray-500"><Hourglass size={20}/></div>
          <h3 className="text-xs font-black uppercase text-[#4A3228] tracking-widest">Articles à Forte Densité (Dormeurs)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {peluches.filter(p => p.stock > 10).slice(0, 4).map(p => (
            <div key={p.id} className="p-5 bg-gray-50 rounded-[2rem] border border-gray-100 text-center">
              <h4 className="font-black text-[#4A3228] text-[10px] uppercase truncate">{p.categorie} {p.taille}</h4>
              <p className="text-xl font-black text-blue-600 my-2">{p.stock}</p>
              <div className="text-[7px] font-black text-gray-400 uppercase bg-white py-1 rounded-full border border-gray-100">
                Unités en stock
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}