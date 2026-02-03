import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, onSnapshot } from "firebase/firestore";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Wallet, AlertTriangle, PieChart as PieIcon, Hourglass, TrendingUp, Package } from 'lucide-react';

export default function Inventaire() {
  const [peluches, setPeluches] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "peluches"), (snap) => {
      setPeluches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setChargement(false);
    });
    return unsub;
  }, []);

  // --- 1. CALCULS DES VALEURS DU TRÉSOR ---
  const valeurAchatTotale = peluches.reduce((acc, p) => acc + (Number(p.prix_achat || 0) * Number(p.stock || 0)), 0);
  const valeurVenteTotale = peluches.reduce((acc, p) => acc + (Number(p.prix_vente || 0) * Number(p.stock || 0)), 0);
  const margeEstimée = valeurVenteTotale - valeurAchatTotale;

  // --- 2. ALERTES DE RUPTURE (< 5) ---
  const alertesRupture = peluches.filter(p => (p.stock || 0) < 5 && (p.stock || 0) > 0);
  const rupturesTotale = peluches.filter(p => (p.stock || 0) === 0);

  // --- 3. ANALYSE PAR CATÉGORIE (RÉPARTITION DU CAPITAL) ---
  const dataCategories = peluches.reduce((acc, p) => {
    const cat = p.categorie || "Sans catégorie";
    const valeur = Number(p.prix_achat || 0) * Number(p.stock || 0);
    const existing = acc.find(item => item.name === cat);
    if (existing) existing.value += valeur;
    else acc.push({ name: cat, value: valeur });
    return acc;
  }, []).filter(item => item.value > 0);

  const COLORS = ['#4A3228', '#A62626', '#D97706', '#059669', '#2563EB', '#7C3AED'];

  return (
    <div className="space-y-8 pb-20 font-sans">
      
      {/* SECTION 1 : LA VALEUR DU STOCK (LE TRÉSOR) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Valeur d'Achat</p>
            <h2 className="text-3xl font-black text-[#4A3228]">{valeurAchatTotale.toLocaleString()} F</h2>
            <p className="text-[9px] font-bold text-gray-400 mt-2 italic">Capital actuellement immobilisé</p>
          </div>
          <Wallet className="absolute right-[-10px] bottom-[-10px] text-gray-50 size-24 group-hover:text-gray-100 transition-colors" />
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-[10px] font-black text-red-400 uppercase tracking-[0.2em] mb-2">Vente Potentielle</p>
            <h2 className="text-3xl font-black text-[#A62626]">{valeurVenteTotale.toLocaleString()} F</h2>
            <p className="text-[9px] font-bold text-red-300 mt-2 italic">Chiffre d'affaires attendu</p>
          </div>
          <TrendingUp className="absolute right-[-10px] bottom-[-10px] text-red-50/50 size-24" />
        </div>

        <div className="bg-[#4A3228] p-8 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-[10px] font-black opacity-50 uppercase tracking-[0.2em] mb-2">Marge Estimée</p>
            <h2 className="text-3xl font-black text-yellow-500">{margeEstimée.toLocaleString()} F</h2>
            <p className="text-[9px] font-bold text-yellow-500/50 mt-2 italic">Bénéfice brut prévisionnel</p>
          </div>
          <Package className="absolute right-[-10px] bottom-[-10px] text-white/5 size-24" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* SECTION 2 : ALERTES DE RUPTURE */}
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-50">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-50 rounded-2xl text-red-600"><AlertTriangle size={20}/></div>
              <h3 className="text-xs font-black uppercase text-[#4A3228] tracking-widest">Top Urgence Réappro</h3>
            </div>
            <span className="bg-red-600 text-white text-[10px] px-3 py-1 rounded-full font-black">{alertesRupture.length}</span>
          </div>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {alertesRupture.length === 0 && rupturesTotale.length === 0 && (
              <p className="text-center py-10 text-gray-400 italic text-sm font-bold">Tout est sous contrôle ! ✅</p>
            )}
            {alertesRupture.map(p => (
              <div key={p.id} className="flex justify-between items-center p-4 bg-orange-50 rounded-2xl border border-orange-100">
                <div>
                  <p className="font-black text-[#4A3228] text-xs uppercase">{p.categorie} {p.taille}</p>
                  <p className="text-[10px] text-orange-600 font-bold uppercase">{p.couleur}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-orange-600">{p.stock}</p>
                  <p className="text-[8px] font-black uppercase text-orange-400 tracking-tighter">Restants</p>
                </div>
              </div>
            ))}
            {rupturesTotale.map(p => (
              <div key={p.id} className="flex justify-between items-center p-4 bg-red-50 rounded-2xl border border-red-100 opacity-80">
                <p className="font-black text-red-600 text-xs uppercase italic line-through">{p.categorie} {p.taille}</p>
                <span className="bg-red-600 text-white text-[8px] font-black px-2 py-1 rounded-lg">RUPTURE</span>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 3 : ANALYSE PAR CATÉGORIE (L'ÉQUILIBRE) */}
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-50">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-brown-50 rounded-2xl text-[#4A3228]"><PieIcon size={20}/></div>
            <h3 className="text-xs font-black uppercase text-[#4A3228] tracking-widest">Répartition du Capital</h3>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dataCategories} innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value">
                  {dataCategories.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value) => `${value.toLocaleString()} F`} />
                <Legend iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 'bold'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-center text-gray-400 mt-4 font-bold uppercase italic tracking-tighter">
            Où est bloqué votre argent ? (Valeur d'achat par catégorie)
          </p>
        </div>

        {/* SECTION 4 : LES DORMEURS (STOCK MORT) */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] shadow-sm border border-gray-50 overflow-hidden">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-blue-50 rounded-2xl text-blue-600"><Hourglass size={20}/></div>
            <div>
              <h3 className="text-xs font-black uppercase text-[#4A3228] tracking-widest">Articles Immobiles (Dormeurs)</h3>
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">En stock depuis longtemps sans mouvement</p>
            </div>
          </div>
          
          {/* Note: Pour cette section, on simule ici les articles avec un gros stock qui ne partent pas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {peluches.filter(p => p.stock > 15).slice(0, 3).map(p => (
              <div key={p.id} className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100 flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
                  <Package size={20} className="text-gray-300" />
                </div>
                <h4 className="font-black text-[#4A3228] text-xs uppercase">{p.categorie} {p.taille}</h4>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-4">{p.couleur}</p>
                <div className="bg-white px-4 py-2 rounded-xl border border-gray-100">
                  <p className="text-lg font-black text-blue-600">{p.stock}</p>
                  <p className="text-[8px] font-black text-gray-400 uppercase">Unités à liquider</p>
                </div>
                <button className="mt-4 text-[9px] font-black text-blue-600 underline uppercase tracking-widest hover:text-[#A62626]">
                  Lancer une promotion
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}