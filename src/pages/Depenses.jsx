import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase/config';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, getDoc, updateDoc, getDocs } from "firebase/firestore";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts';
// IMPORT DES ICÔNES LUCIDE
import { Pencil, Check, X, Wallet, TrendingDown, Calendar, User, PlusCircle } from 'lucide-react';

export default function Depenses() {
  const [depenses, setDepenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nomUtilisateur, setNomUtilisateur] = useState('Chargement...');

  const [type, setType] = useState("Loyer");
  const [montant, setMontant] = useState("");
  const [autreNom, setAutreNom] = useState("");
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ type: '', montant: '' });

  const typesDepense = ["Loyer", "Connexion", "Salaire", "Achat coton", "Transport", "Achat peluche", "Cotisation", "Électricité", "Autre"];
  const COLORS = ['#4A3228', '#A62626', '#10B981', '#F59E0B', '#3B82F6', '#EC4899', '#6B7280', '#06B6D4', '#D1D5DB'];

  useEffect(() => {
    fetchDepenses();
    getConnectedUserName();
  }, []);

  const getConnectedUserName = async () => {
    const user = auth.currentUser;
    if (user) {
      try {
        const userDoc = await getDoc(doc(db, "utilisateurs", user.uid));
        if (userDoc.exists()) setNomUtilisateur(userDoc.data().nom);
      } catch (e) { setNomUtilisateur("Admin"); }
    }
  };

  const fetchDepenses = () => {
    const q = query(collection(db, "depenses"), orderBy("timestamp", "desc"));
    return onSnapshot(q, (snap) => {
      setDepenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  };

  const handleAjouter = async (e) => {
  e.preventDefault();
  if (!montant) return;

  const depenseType = type === "autre" ? autreNom : type;

  // 1️⃣ Calcul du total des ventes du mois à partir de la collection "commandes"
  const now = new Date();
  const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
  const finMois = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  let totalVentesMois = 0;
  try {
    const commandesSnap = await getDocs(collection(db, "commandes"));
    commandesSnap.forEach(doc => {
      const data = doc.data();
      const date = data.timestamp?.toDate?.();
      if (!date) return;
      if (date >= debutMois && date <= finMois) {
        if (data.statut === "payé" && data.statut_paiement === "TOTALEMENT_PAYÉ") {
          totalVentesMois += Number(data.prixTotal) || 0;
        } else if (data.statut === "prépayé") {
          totalVentesMois += Number(data.montantRembourse) || 0;
        }
      }
    });
  } catch (err) {
    alert("Erreur lors du calcul du total des ventes : " + err.message);
    return;
  }

  // 2️⃣ Définition des pourcentages comme dans Repartition
  const repartition = {
    "Loyer": 0.4*0.3,
    "Connexion": 0.4*0.1,
    "Salaire": 0.4*0.3,
    "Électricité": 0.4*0.15,
    "Autre": 0.4*0.15,
    "Cotisation": 0.3,
    "Achat peluche": 0.3*0.4,
    "Achat coton": 0.3*0.3,
    "Transport": 0.3*0.3
  };

  const limite = totalVentesMois * (repartition[depenseType] || 1);

  // 3️⃣ Calcul des dépenses déjà faites ce mois pour ce type
  const dejaDepense = depenses
    .filter(d => {
      const dDate = new Date(d.timestamp?.toDate());
      return d.type === depenseType &&
             dDate.getMonth() === now.getMonth() &&
             dDate.getFullYear() === now.getFullYear();
    })
    .reduce((acc,curr)=> acc + (Number(curr.montant)||0), 0);

  // 4️⃣ Vérification de la limite
  if(Number(montant) + dejaDepense > limite){
    alert(`Impossible d'ajouter cette dépense.\nLimite pour ce type ce mois : ${limite.toLocaleString()} F\nDéjà dépensé : ${dejaDepense.toLocaleString()} F`);
    return;
  }

  // 5️⃣ Ajout de la dépense si ok
  try {
    await addDoc(collection(db, "depenses"), {
      type: depenseType,
      typeOriginal: type,
      montant: Number(montant),
      faitPar: nomUtilisateur,
      date: new Date().toLocaleDateString('fr-FR'),
      timestamp: serverTimestamp()
    });
    setMontant(""); 
    setAutreNom(""); 
    setType("Loyer");
  } catch (err) { 
    alert(err.message); 
  }
};

  const startEdit = (d) => {
    setEditId(d.id);
    setEditForm({ type: d.type, montant: d.montant });
  };

  const saveEdit = async (id) => {
    try {
      await updateDoc(doc(db, "depenses", id), {
        type: editForm.type,
        montant: Number(editForm.montant)
      });
      setEditId(null);
    } catch (err) { alert(err.message); }
  };

  // Logique Graphes (Inchangée)
  const dataType = typesDepense.map(t => ({
    name: t.toUpperCase(),
    value: depenses.filter(d => d.typeOriginal === t || d.type === t).reduce((acc, curr) => acc + (Number(curr.montant) || 0), 0)
  })).filter(item => item.value > 0);

  const dataMois = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin"].map((nom, index) => ({
    name: nom,
    montant: depenses.filter(d => d.timestamp?.toDate().getMonth() === index).reduce((acc, curr) => acc + (Number(curr.montant) || 0), 0)
  }));

  return (
    <div className="space-y-8 pb-20 font-sans">
      {/* HEADER STATS */}
      <div className="bg-[#4A3228] p-8 rounded-[2.5rem] text-white flex justify-between items-center shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
             <TrendingDown size={20} className="text-red-400" />
             <h2 className="text-3xl font-black uppercase italic tracking-tighter">Flux de Caisse</h2>
          </div>
          <p className="text-red-400 text-[10px] font-black uppercase tracking-widest italic flex items-center gap-2">
            <User size={12} /> {nomUtilisateur}
          </p>
        </div>
        <div className="bg-white/10 p-5 rounded-3xl border border-white/10 text-right">
          <span className="text-[10px] font-black opacity-50 uppercase block mb-1">Total Dépenses</span>
          <span className="text-3xl font-black text-red-400">{depenses.reduce((a,b)=>a+(Number(b.montant)||0),0).toLocaleString()} F</span>
        </div>
        <Wallet size={120} className="absolute -right-10 -bottom-10 opacity-5" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* FORMULAIRE */}
        <div className="lg:col-span-1">
          <form onSubmit={handleAjouter} className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 sticky top-5">
            <div className="flex items-center gap-2 mb-6">
              <PlusCircle size={18} className="text-[#A62626]" />
              <h3 className="text-[10px] font-black uppercase text-gray-400">Nouvelle Sortie</h3>
            </div>
            <div className="space-y-4">
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl border-none text-sm font-bold focus:ring-2 focus:ring-[#A62626]">
                {typesDepense.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
              {type === "autre" && <input type="text" value={autreNom} onChange={(e) => setAutreNom(e.target.value)} placeholder="Précisez le motif..." className="w-full p-4 bg-red-50 rounded-2xl border-none text-sm font-bold" required />}
              <input type="number" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="Montant (FCFA)" className="w-full p-4 bg-gray-50 rounded-2xl border-none text-sm font-bold" required />
              <button className="w-full bg-[#A62626] text-white py-5 rounded-2xl font-black uppercase text-[10px] shadow-lg hover:bg-[#4A3228] transition-all">Valider la dépense</button>
            </div>
          </form>
        </div>

        {/* GRAPHIQUES & TABLEAU */}
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-[2.5rem] border h-72 flex flex-col items-center shadow-sm">
               <h4 className="text-[10px] font-black uppercase text-gray-400 mb-4">Répartition Catégories</h4>
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={dataType} innerRadius={50} outerRadius={75} paddingAngle={5} dataKey="value">{dataType.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart>
               </ResponsiveContainer>
            </div>
            <div className="bg-white p-6 rounded-[2.5rem] border h-72 shadow-sm">
               <h4 className="text-[10px] font-black uppercase text-gray-400 mb-4">Évolution Mensuelle</h4>
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataMois}><XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} /><Tooltip cursor={{fill: '#f8fafc'}} /><Bar dataKey="montant" fill="#A62626" radius={[4, 4, 0, 0]} /></BarChart>
               </ResponsiveContainer>
            </div>
          </div>

          {/* TABLEAU AVEC LUCIDE */}
          <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase">
                <tr>
                  <th className="p-6">Motif</th>
                  <th className="p-6">Auteur</th>
                  <th className="p-6 text-right">Montant</th>
                  <th className="p-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {depenses.map(d => (
                  <tr key={d.id} className="text-xs hover:bg-gray-50 transition-colors">
                    <td className="p-6 font-black text-[#4A3228]">
                      {editId === d.id ? (
                        <input type="text" value={editForm.type} onChange={e => setEditForm({...editForm, type: e.target.value})} className="p-2 border-2 border-[#A62626] rounded-xl bg-white w-full uppercase" />
                      ) : (
                        <span className="uppercase">{d.type}</span>
                      )}
                      <div className="flex items-center gap-1 text-[9px] text-gray-300 font-bold mt-1">
                        <Calendar size={10} /> {d.date}
                      </div>
                    </td>
                    <td className="p-6">
                       <span className="flex items-center gap-2 font-bold text-gray-500 italic">
                         <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center"><User size={12} className="text-[#A62626]" /></div>
                         {d.faitPar}
                       </span>
                    </td>
                    <td className="p-6 text-right font-black text-[#A62626] text-sm">
                      {editId === d.id ? (
                        <input type="number" value={editForm.montant} onChange={e => setEditForm({...editForm, montant: e.target.value})} className="p-2 border-2 border-[#A62626] rounded-xl bg-white w-24 text-right" />
                      ) : (
                        <>{Number(d.montant).toLocaleString()} F</>
                      )}
                    </td>
                    <td className="p-6 text-center">
                      {editId === d.id ? (
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => saveEdit(d.id)} className="p-2 bg-green-100 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all">
                            <Check size={18} />
                          </button>
                          <button onClick={() => setEditId(null)} className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all">
                            <X size={18} />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(d)} className="p-2 bg-gray-50 text-gray-400 rounded-xl hover:bg-[#4A3228] hover:text-white transition-all shadow-sm">
                          <Pencil size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}