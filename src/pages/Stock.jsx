import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, doc, increment, query, orderBy, getDoc } from "firebase/firestore";

export default function Stock() {
  const [sousOnglet, setSousOnglet] = useState('etat'); 
  const [peluches, setPeluches] = useState([]);
  const [entrees, setEntrees] = useState([]);
  const [sorties, setSorties] = useState([]); // Pour l'historique des sorties
  const [nomUtilisateur, setNomUtilisateur] = useState('');
  const [formEntree, setFormEntree] = useState({ pelucheId: '', quantite: '' });

  const [formSortie, setFormSortie] = useState({
    client: '',
    tel: '',
    pelucheId: '',
    quantite: 1,
    lieu: '',
    paiement: 'Orange Money',
    statut: 'payé',
    prixTotal: 0
  });

  useEffect(() => {
    fetchData();
    getConnectedUserName();
  }, []);

  // --- CALCUL AUTOMATIQUE DU PRIX TOTAL ---
  useEffect(() => {
    if (formSortie.pelucheId) {
      const p = peluches.find(item => item.id === formSortie.pelucheId);
      if (p && p.prix_vente) {
        const total = Number(p.prix_vente) * Number(formSortie.quantite);
        setFormSortie(prev => ({ ...prev, prixTotal: total }));
      }
    } else {
      setFormSortie(prev => ({ ...prev, prixTotal: 0 }));
    }
  }, [formSortie.pelucheId, formSortie.quantite, peluches]);

  const getConnectedUserName = async () => {
    const user = auth.currentUser;
    if (user) {
      // On essaye de récupérer le nom depuis ton document utilisateur ou le displayName de Firebase
      setNomUtilisateur(user.displayName || user.email.split('@')[0]);
    }
  };

  const fetchData = async () => {
    const pelSnap = await getDocs(collection(db, "peluches"));
    setPeluches(pelSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    const qEntrees = query(collection(db, "mouvements_stock"), orderBy("date", "desc"));
    const entSnap = await getDocs(qEntrees);
    setEntrees(entSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    const qSorties = query(collection(db, "commandes"), orderBy("timestamp", "desc"));
    const sortSnap = await getDocs(qSorties);
    setSorties(sortSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const handleEntree = async (e) => {
    e.preventDefault();
    const p = peluches.find(item => item.id === formEntree.pelucheId);
    const nomComplet = `${p.taille} ${p.couleur} ${p.categorie}`;

    try {
      await addDoc(collection(db, "mouvements_stock"), {
        pelucheId: formEntree.pelucheId,
        nomArticle: nomComplet,
        quantite: Number(formEntree.quantite),
        auteur: nomUtilisateur || "Admin",
        date: new Date().toLocaleString('fr-FR'),
        type: 'ENTREE'
      });

      await updateDoc(doc(db, "peluches", formEntree.pelucheId), {
        stock: increment(Number(formEntree.quantite))
      });

      alert("Entrée enregistrée !");
      setFormEntree({ pelucheId: '', quantite: '' });
      fetchData();
    } catch (err) { alert(err.message); }
  };

  const handleSortie = async (e) => {
    e.preventDefault();
    const p = peluches.find(item => item.id === formSortie.pelucheId);
    if (!p || p.stock < formSortie.quantite) return alert("Stock insuffisant !");

    const nomArticle = `${p.taille} ${p.couleur} ${p.categorie}`;

    try {
      // LOGIQUE FINANCIÈRE : 
      // Si 'payé' -> Attente de livraison pour encaisser
      // Si 'prépayé' -> C'est une dette directe
      const statutInitialPaiement = formSortie.statut === 'payé' ? 'ATTENTE_LIVRAISON' : 'DETTE_NON_PAYEE';

      const commandeRef = await addDoc(collection(db, "commandes"), {
        ...formSortie,
        nomArticle,
        date: new Date().toLocaleString('fr-FR'),
        vendeur: nomUtilisateur || "Admin",
        statut_livraison: 'EN_ATTENTE',
        statut_paiement: statutInitialPaiement, // Champ clé pour Finance.jsx
        montantRembourse: 0,
        timestamp: new Date()
      });

      // On retire toujours de l'inventaire immédiatement
      await updateDoc(doc(db, "peluches", formSortie.pelucheId), {
        stock: increment(-Number(formSortie.quantite))
      });

      alert("Sortie validée ! L'article est retiré du stock.");
      setFormSortie({ client: '', tel: '', pelucheId: '', quantite: 1, lieu: '', paiement: 'Orange Money', statut: 'payé', prixTotal: 0 });
      fetchData();
    } catch (err) { alert(err.message); }
  };

  const modifierStockDirect = async (id, nouvelleValeur) => {
    const valeur = parseInt(nouvelleValeur);
    if (isNaN(valeur)) return;
    try {
      await updateDoc(doc(db, "peluches", id), { stock: valeur });
      fetchData();
    } catch (err) { alert("Erreur : " + err.message); }
  };

  const peluchesTriees = [...peluches].sort((a, b) => a.categorie.localeCompare(b.categorie));
  const totalGlobal = peluches.reduce((acc, p) => acc + (p.stock || 0), 0);
  const stockParCouleur = peluches.reduce((acc, p) => {
    acc[p.couleur] = (acc[p.couleur] || 0) + (p.stock || 0);
    return acc;
  }, {});
  const categoriesPresentes = [...new Set(peluches.map(p => p.categorie))].sort();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* NAVIGATION SOUS-ONGLETS */}
      <div className="flex gap-2 bg-white p-2 rounded-3xl shadow-sm border w-fit">
        <button onClick={() => setSousOnglet('entree')} className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${sousOnglet === 'entree' ? 'bg-[#A62626] text-white' : 'text-gray-400'}`}>📦 Entrées</button>
        <button onClick={() => setSousOnglet('sortie')} className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${sousOnglet === 'sortie' ? 'bg-[#A62626] text-white' : 'text-gray-400'}`}>📤 Sorties</button>
        <button onClick={() => setSousOnglet('etat')} className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${sousOnglet === 'etat' ? 'bg-[#4A3228] text-white' : 'text-gray-400'}`}>📊 État du Stock</button>
      </div>

      {/* --- VUE : ÉTAT DU STOCK --- */}
      {sousOnglet === 'etat' && (
        <div className="space-y-10">
          <div className="bg-[#4A3228] p-10 rounded-[3rem] text-white flex justify-between items-center shadow-2xl relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-red-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Inventaire Global</p>
              <h2 className="text-6xl font-black">{totalGlobal} <span className="text-xl font-medium opacity-50">pièces</span></h2>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
              <h3 className="text-[#4A3228] font-black mb-6 uppercase text-xs">Par Couleur</h3>
              <div className="space-y-3">
                {Object.entries(stockParCouleur).map(([couleur, qte]) => (
                  <div key={couleur} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                    <span className="font-bold text-[#4A3228]">{couleur}</span>
                    <span className="bg-white px-4 py-1 rounded-xl font-black text-[#A62626] shadow-sm">{qte}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              {categoriesPresentes.map(cat => (
                <div key={cat} className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                  <div className="bg-gray-50 p-5 border-b">
                    <h4 className="font-black text-[#4A3228] uppercase text-xs tracking-widest">{cat}</h4>
                  </div>
                  <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                    {peluches.filter(p => p.categorie === cat).map(p => (
                      <div key={p.id} className="p-4 bg-gray-50 rounded-2xl flex flex-col items-center border border-gray-100 group">
                        <span className="text-2xl font-black text-[#A62626]">{p.taille}</span>
                        <span className="text-[9px] font-bold text-gray-400 uppercase mb-2">{p.couleur}</span>
                        <div className="flex items-center gap-2">
                          <div className={`text-sm font-black px-3 py-1 rounded-lg ${p.stock < 5 ? 'bg-red-500 text-white' : 'bg-[#4A3228] text-white'}`}>{p.stock || 0}</div>
                          <button onClick={() => { const nv = prompt(`Nouveau stock ?`, p.stock); if (nv !== null) modifierStockDirect(p.id, nv); }} className="w-8 h-8 bg-white border rounded-lg text-gray-400 hover:text-[#A62626] flex items-center justify-center"><i className="fa-solid fa-pen-to-square text-[10px]"></i></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- VUE : ENTRÉES --- */}
      {sousOnglet === 'entree' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border h-fit">
            <h3 className="font-black text-[#4A3228] mb-6 uppercase text-xs">Arrivage Colis</h3>
            <form onSubmit={handleEntree} className="space-y-4">
              <select className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-sm outline-none border focus:border-[#A62626]" value={formEntree.pelucheId} onChange={e => setFormEntree({...formEntree, pelucheId: e.target.value})} required>
                <option value="">-- Choisir Article --</option>
                {peluchesTriees.map(p => <option key={p.id} value={p.id}>{p.categorie} | {p.taille} | {p.couleur}</option>)}
              </select>
              <input type="number" placeholder="Quantité reçue" className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none" value={formEntree.quantite} onChange={e => setFormEntree({...formEntree, quantite: e.target.value})} required />
              <button className="w-full bg-[#A62626] text-white p-5 rounded-2xl font-black uppercase text-xs shadow-lg shadow-red-900/20 transition-all">Valider l'entrée</button>
            </form>
          </div>
          <div className="lg:col-span-2 bg-white rounded-[2.5rem] shadow-sm border overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-[10px] font-black uppercase border-b"><tr><th className="p-5">Article</th><th className="p-5">Qté</th><th className="p-5">Auteur</th><th className="p-5">Date</th></tr></thead>
              <tbody className="divide-y">
                {entrees.map(e => (
                  <tr key={e.id} className="text-sm font-bold hover:bg-gray-50/50">
                    <td className="p-5 text-[#A62626] uppercase text-xs">{e.nomArticle}</td>
                    <td className="p-5 font-black text-lg">{e.quantite}</td>
                    <td className="p-5 text-[10px] uppercase text-gray-500">{e.auteur}</td>
                    <td className="p-5 text-gray-400 text-[10px] italic">{e.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- VUE : SORTIES --- */}
      {sousOnglet === 'sortie' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border">
              <h3 className="font-black text-[#4A3228] mb-6 uppercase text-xs">Nouvelle Sortie</h3>
              <form onSubmit={handleSortie} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input type="text" placeholder="Nom du client" className="p-4 bg-gray-50 rounded-2xl font-bold text-sm outline-none border focus:border-[#A62626]" value={formSortie.client} onChange={e => setFormSortie({...formSortie, client: e.target.value})} required />
                  <input type="tel" placeholder="Téléphone" className="p-4 bg-gray-50 rounded-2xl font-bold text-sm outline-none border focus:border-[#A62626]" value={formSortie.tel} onChange={e => setFormSortie({...formSortie, tel: e.target.value})} required />
                </div>
                
                <select className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-sm outline-none border focus:border-[#A62626]" 
                  value={formSortie.pelucheId} 
                  onChange={e => setFormSortie({...formSortie, pelucheId: e.target.value})} 
                  required>
                  <option value="">-- Sélectionner la Peluche --</option>
                  {peluchesTriees.map(p => <option key={p.id} value={p.id} disabled={p.stock <= 0}>{p.categorie} | {p.taille} | {p.couleur} ({p.prix_vente} F)</option>)}
                </select>

                <div className="grid grid-cols-2 gap-4">
                  <input type="number" className="p-4 bg-gray-50 rounded-2xl font-black outline-none border" value={formSortie.quantite} onChange={e => setFormSortie({...formSortie, quantite: e.target.value})} min="1" required />
                  <div className="p-4 bg-[#A62626]/5 text-[#A62626] rounded-2xl font-black text-lg border border-[#A62626]/20">
                    {formSortie.prixTotal.toLocaleString()} F
                  </div>
                </div>

                <input type="text" placeholder="Lieu de livraison" className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-sm outline-none border focus:border-[#A62626]" value={formSortie.lieu} onChange={e => setFormSortie({...formSortie, lieu: e.target.value})} required />
                
                <div className="grid grid-cols-2 gap-4">
                  <select className="p-4 bg-gray-50 rounded-2xl font-bold text-sm border" value={formSortie.paiement} onChange={e => setFormSortie({...formSortie, paiement: e.target.value})}>
                    <option value="Orange Money">Orange Money</option>
                    <option value="Mobile Money">Mobile Money</option>
                    <option value="Cash">Cash</option>
                  </select>
                  <select className={`p-4 rounded-2xl font-black text-sm border ${formSortie.statut === 'payé' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`} value={formSortie.statut} onChange={e => setFormSortie({...formSortie, statut: e.target.value})}>
                    <option value="payé">✅ PAYÉ</option>
                    <option value="prépayé">⏳ PRÉPAYÉ (Dette)</option>
                  </select>
                </div>
                <button className="w-full bg-[#4A3228] text-white p-5 rounded-3xl font-black uppercase text-xs shadow-xl hover:bg-[#A62626] transition-all">Valider la Sortie</button>
              </form>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border h-fit">
              <h4 className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest">Stock Restant</h4>
              <div className="space-y-2">
                {peluchesTriees.filter(p => p.stock > 0).slice(0, 8).map(p => (
                  <div key={p.id} className="flex justify-between text-[10px] font-bold p-2 bg-gray-50 rounded-lg">
                    <span>{p.categorie} {p.taille}</span>
                    <span className="text-[#A62626] font-black">{p.stock}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden">
            <div className="bg-gray-50 p-5 border-b">
              <h3 className="font-black text-[#4A3228] uppercase text-[10px] tracking-widest">Historique des Sorties</h3>
            </div>
            <table className="w-full text-left">
              <thead className="bg-white text-[9px] font-black uppercase text-gray-400 border-b">
                <tr><th className="p-4">Client</th><th className="p-4">Article</th><th className="p-4 text-center">Qté</th><th className="p-4">Total</th><th className="p-4">Date</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorties.slice(0, 10).map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/50">
                    <td className="p-4"><div className="font-bold text-[#4A3228]">{s.client}</div><div className="text-[9px] text-gray-400">{s.lieu}</div></td>
                    <td className="p-4 text-[10px] font-bold text-[#A62626] uppercase">{s.nomArticle}</td>
                    <td className="p-4 text-center font-black">{s.quantite}</td>
                    <td className="p-4 font-black">{Number(s.prixTotal).toLocaleString()} F</td>
                    <td className="p-4 text-[9px] text-gray-400 italic">{s.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}