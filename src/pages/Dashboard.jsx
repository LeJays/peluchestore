import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, onSnapshot } from "firebase/firestore";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid, Legend, PieChart, Pie, Cell
} from 'recharts';
import { 
  Wallet, ShoppingBag, Package, Truck, AlertCircle, ArrowUpRight, TrendingUp, Box
} from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    caJour: 0,
    commandesMois: 0,
    stockTotal: 0,
    alertesStock: 0,
    livraisonsAttente: 0,
    fluxFinancier: [],
    dernieresVentes: [],
    repartitionPaiement: []
  });

  const COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#EF4444'];

  useEffect(() => {
    const aujourdhui = new Date();
    aujourdhui.setHours(0,0,0,0);
    const debutMois = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1);

    const unsubCommandes = onSnapshot(collection(db, "commandes"), (snap) => {
      const allCommandes = snap.docs.map(d => {
        const data = d.data();
        // SÉCURITÉ DATE : On convertit le timestamp ou on met la date du jour si vide
        let dateJS = new Date();
        if (data.timestamp?.toDate) {
            dateJS = data.timestamp.toDate();
        } else if (data.dateJS?.seconds) {
            dateJS = new Date(data.dateJS.seconds * 1000);
        }

        return { ...data, id: d.id, dateJS };
      });

      onSnapshot(collection(db, "depenses"), (snapDep) => {
        const allDeps = snapDep.docs.map(d => ({
          ...d.data(),
          dateJS: d.data().timestamp?.toDate ? d.data().timestamp.toDate() : new Date()
        }));

        onSnapshot(collection(db, "mouvements_stock"), (snapMouv) => {
          const allMouvements = snapMouv.docs.map(d => ({
            ...d.data(),
            dateJS: d.data().timestamp?.toDate ? d.data().timestamp.toDate() : new Date()
          }));

          const moisNoms = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
          
          const fluxData = Array.from({ length: 6 }, (_, i) => {
            const target = new Date();
            target.setMonth(target.getMonth() - i);
            const m = target.getMonth();
            const y = target.getFullYear();

            const commandesDuMois = allCommandes.filter(c => c.dateJS.getMonth() === m && c.dateJS.getFullYear() === y);
            
            const ventesReelles = commandesDuMois.reduce((acc, c) => {
              const montant = c.statut === 'payé' ? (Number(c.prixTotal) || 0) : (Number(c.montantRembourse) || 0);
              return acc + montant;
            }, 0);

            const depenses = allDeps
              .filter(dp => dp.dateJS.getMonth() === m && dp.dateJS.getFullYear() === y)
              .reduce((acc, dp) => acc + (Number(dp.montant) || 0), 0);

            const unitesSorties = commandesDuMois.reduce((acc, c) => acc + (Number(c.quantite) || 1), 0);
            
            const unitesEntrees = allMouvements
              .filter(mv => mv.dateJS.getMonth() === m && mv.dateJS.getFullYear() === y && (mv.type === "ENTREE" || mv.type === "AJOUT"))
              .reduce((acc, mv) => acc + (Number(mv.quantite) || 0), 0);

            return { 
              name: moisNoms[m], 
              entrees: ventesReelles, 
              sorties: depenses, 
              profit: ventesReelles - depenses,
              uSorties: unitesSorties,
              uEntrees: unitesEntrees 
            };
          }).reverse();

          const modes = ['Orange Money', 'Mobile Money', 'Cash'];
          const repartition = modes.map(m => ({
            name: m,
            value: allCommandes.filter(c => c.paiement === m).length
          })).filter(v => v.value > 0);

          setStats(prev => ({ 
            ...prev, 
            caJour: allCommandes.filter(c => c.dateJS >= aujourdhui).reduce((acc, c) => acc + (c.statut === 'payé' ? Number(c.prixTotal || 0) : Number(c.montantRembourse || 0)), 0),
            commandesMois: allCommandes.filter(c => c.dateJS >= debutMois).length, 
            livraisonsAttente: allCommandes.filter(c => c.statut_livraison === "EN_ATTENTE").length,
            dernieresVentes: allCommandes.length > 0 ? [...allCommandes].sort((a,b) => b.dateJS - a.dateJS).slice(0, 4) : [],
            fluxFinancier: fluxData,
            repartitionPaiement: repartition
          }));
        });
      });
    });

    onSnapshot(collection(db, "peluches"), (snap) => {
      const p = snap.docs.map(d => d.data());
      setStats(prev => ({ 
        ...prev, 
        stockTotal: p.reduce((acc, item) => acc + (Number(item.stock) || 0), 0), 
        alertesStock: p.filter(item => Number(item.stock) < 5).length 
      }));
    });
  }, []);

  return (
    <div className="space-y-8 pb-10">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <QuickCard title="CA AUJOURD'HUI" value={`${stats.caJour.toLocaleString()} F`} subtitle="Argent réel encaissé" icon={<Wallet className="text-green-600" />} color="bg-green-50" />
        <QuickCard title="VENTES MOIS" value={stats.commandesMois} subtitle="Nombre de ventes" icon={<ShoppingBag className="text-blue-600" />} color="bg-blue-50" />
        <QuickCard title="STOCK GLOBAL" value={stats.stockTotal} subtitle="Articles en rayon" icon={<Package className="text-amber-600" />} color="bg-amber-50" />
        <QuickCard title="À LIVRER" value={stats.livraisonsAttente} subtitle="Livraisons en attente" icon={<Truck className="text-indigo-600" />} color="bg-indigo-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <div><h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Analyse de Flux</h3><p className="text-xl font-black text-[#4A3228]">VENTES VS DÉPENSES</p></div>
            <TrendingUp className="text-green-500" size={30} />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.fluxFinancier}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                <YAxis axisLine={false} tickLine={false} fontSize={10} tickFormatter={(v) => `${v/1000}k`} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '20px', border: 'none'}} />
                <Legend iconType="circle" />
                <Bar dataKey="entrees" fill="#10B981" radius={[10, 10, 0, 0]} name="Ventes Réelles (F)" barSize={35} />
                <Bar dataKey="sorties" fill="#EF4444" radius={[10, 10, 0, 0]} name="Dépenses (F)" barSize={35} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm">
           <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-6 text-center">Modes de Paiement</h3>
           <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.repartitionPaiement} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {stats.repartitionPaiement.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div><h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest italic">Gestion des Stocks</h3><p className="text-xl font-black text-[#4A3228]">UNITÉS ENTRÉES VS SORTIES</p></div>
          <Box className="text-amber-500" size={24} />
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.fluxFinancier}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} /><YAxis axisLine={false} tickLine={false} fontSize={10} /><Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '15px'}} /><Legend />
              <Bar dataKey="uEntrees" fill="#3B82F6" radius={[8, 8, 0, 0]} name="Peluches Entrées" barSize={30} />
              <Bar dataKey="uSorties" fill="#EC4899" radius={[8, 8, 0, 0]} name="Peluches Sorties" barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-[#4A3228] p-8 rounded-[3rem] text-white flex flex-col justify-center shadow-xl">
           <div className="flex items-center gap-4 mb-4"><div className="p-4 bg-red-500 rounded-2xl shadow-lg"><AlertCircle size={24} /></div><h4 className="text-xs font-black uppercase tracking-widest text-red-400">Alertes Stock</h4></div>
           <p className="text-5xl font-black">{stats.alertesStock}</p>
        </div>
        <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm">
          <h3 className="text-[10px] font-black uppercase text-gray-400 mb-6 tracking-widest">Dernières Activités</h3>
          <div className="space-y-4">
            {stats.dernieresVentes.map(v => (
              <div key={v.id} className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl border border-transparent hover:border-gray-200 transition-all">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-green-600 shadow-sm"><ArrowUpRight size={18}/></div>
                    <div>
                       <p className="text-[11px] font-black text-[#4A3228] uppercase">{v.nomArticle || "Peluches"}</p>
                       <p className="text-[9px] font-bold text-gray-400 uppercase italic">
                         {v.vendeur} • {v.dateJS ? v.dateJS.toLocaleDateString('fr-FR') : 'Date...'}
                       </p>
                    </div>
                 </div>
                 <p className="text-sm font-black text-[#A62626]">{Number(v.prixTotal || 0).toLocaleString()} F</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickCard({ title, value, subtitle, icon, color }) {
  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm hover:translate-y-[-5px] transition-all duration-300">
      <div className="flex items-center gap-4">
        <div className={`p-4 rounded-2xl ${color}`}>{icon}</div>
        <div><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{title}</p><p className="text-xl font-black text-[#4A3228]">{value}</p><p className="text-[9px] font-bold text-gray-300 italic">{subtitle}</p></div>
      </div>
    </div>
  );
}