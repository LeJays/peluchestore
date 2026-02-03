import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";

export default function Catalogue() {
  const [categories, setCategories] = useState([]);
  const [peluches, setPeluches] = useState([]);
  const [newCat, setNewCat] = useState("");
  const [formPeluche, setFormPeluche] = useState({ categorie: '', prix_vente: '', taille: '', couleur: '' });

  const listeCouleurs = ["Blanc", "Marron", "Orange", "Rose", "Rouge", "Violet"].sort();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const catSnap = await getDocs(collection(db, "categories"));
    const pelSnap = await getDocs(collection(db, "peluches"));
    setCategories(catSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    
    const data = pelSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Tri par taille
    setPeluches(data.sort((a, b) => (parseInt(a.taille) || 0) - (parseInt(b.taille) || 0)));
  };

  const addCategory = async (e) => {
    e.preventDefault();
    if (!newCat) return;
    await addDoc(collection(db, "categories"), { nom: newCat.toUpperCase() });
    setNewCat("");
    fetchData();
  };

  const addPeluche = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "peluches"), { 
      ...formPeluche, 
      stock: 0, 
      prix_vente: Number(formPeluche.prix_vente)
    });
    setFormPeluche({ categorie: '', prix_vente: '', taille: '', couleur: '' });
    fetchData();
  };

  const deleteModel = async (id) => {
    if(window.confirm("Supprimer ce modèle ?")) {
      await deleteDoc(doc(db, "peluches", id));
      fetchData();
    }
  };

  // --- LOGIQUE DE GROUPEMENT ---
  const peluchesParCategorie = categories.map(cat => ({
    nom: cat.nom,
    items: peluches.filter(p => p.categorie === cat.nom)
  })).filter(group => group.items.length > 0);

  return (
    <div className="p-2 md:p-6 space-y-10">
      
      {/* SECTION FORMULAIRES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Catégories */}
        <div className="lg:col-span-4 bg-white p-6 rounded-[2rem] shadow-xl border-2 border-gray-50">
          <h3 className="text-[#4A3228] font-black mb-6 flex items-center gap-2 uppercase text-sm">
            <i className="fa-solid fa-tags text-[#A62626]"></i> Nouvelles Catégories
          </h3>
          <form onSubmit={addCategory} className="flex flex-col gap-3">
            <input 
              type="text" 
              placeholder="Ex: OURS, LAPINS..." 
              className="w-full p-4 bg-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-[#A62626] font-bold"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
            />
            <button type="submit" className="w-full bg-[#4A3228] text-white p-4 rounded-2xl font-black hover:bg-[#A62626] transition-all shadow-lg active:scale-95">
              AJOUTER LA CATÉGORIE
            </button>
          </form>
          <div className="mt-6 flex flex-wrap gap-2">
            {categories.map(c => (
              <span key={c.id} className="px-4 py-2 bg-[#F9F5F0] text-[#4A3228] text-[10px] font-black rounded-xl border border-gray-200 uppercase tracking-tighter">
                {c.nom}
              </span>
            ))}
          </div>
        </div>

        {/* Formulaire Peluche (Sans prix d'achat) */}
        <div className="lg:col-span-8 bg-white p-6 rounded-[2rem] shadow-xl border-2 border-gray-50">
          <h3 className="text-[#4A3228] font-black mb-6 flex items-center gap-2 uppercase text-sm">
            <i className="fa-solid fa-circle-plus text-[#A62626]"></i> Enregistrer un Modèle
          </h3>
          <form onSubmit={addPeluche} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <select className="p-4 bg-gray-100 rounded-2xl font-bold text-sm" 
              value={formPeluche.categorie} onChange={e => setFormPeluche({...formPeluche, categorie: e.target.value})} required>
              <option value="">-- Catégorie --</option>
              {categories.map(c => <option key={c.id} value={c.nom}>{c.nom}</option>)}
            </select>

            <input type="text" placeholder="Taille (ex: 120cm)" className="p-4 bg-gray-100 rounded-2xl font-bold text-sm" 
              value={formPeluche.taille} onChange={e => setFormPeluche({...formPeluche, taille: e.target.value})} required />
            
            <select className="p-4 bg-gray-100 rounded-2xl font-bold text-sm" 
              value={formPeluche.couleur} onChange={e => setFormPeluche({...formPeluche, couleur: e.target.value})} required>
              <option value="">-- Couleur --</option>
              {listeCouleurs.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <input type="number" placeholder="Prix Vente (FCFA)" className="p-4 bg-gray-100 rounded-2xl font-black text-[#A62626] text-sm lg:col-span-2" 
              value={formPeluche.prix_vente} onChange={e => setFormPeluche({...formPeluche, prix_vente: e.target.value})} required />

            <button className="bg-[#A62626] text-white p-4 rounded-2xl font-black uppercase text-xs hover:bg-[#4A3228] transition-all shadow-xl active:scale-95">
              ENREGISTRER LE MODÈLE
            </button>
          </form>
        </div>
      </div>

      {/* AFFICHAGE PAR CATÉGORIE (Tableau sans prix d'achat) */}
      <div className="space-y-8">
        {peluchesParCategorie.length === 0 && (
            <div className="bg-white p-20 rounded-[3rem] text-center text-gray-300 italic font-bold">Le catalogue est vide.</div>
        )}

        {peluchesParCategorie.map(groupe => (
          <div key={groupe.nom} className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-[#4A3228] p-5 flex justify-between items-center">
              <h3 className="text-white font-black tracking-widest uppercase flex items-center gap-3">
                <span className="w-2 h-8 bg-[#A62626] rounded-full"></span> {groupe.nom}
              </h3>
              <span className="text-[10px] text-red-200 font-bold">{groupe.items.length} MODÈLES</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#FDFCFB] text-[10px] font-black text-gray-400 uppercase border-b">
                    <th className="p-6">Taille</th>
                    <th className="p-6">Couleur</th>
                    <th className="p-6">Prix Vente</th>
                    <th className="p-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {groupe.items.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-all">
                      <td className="p-6 font-black text-xl text-[#A62626]">{p.taille}</td>
                      <td className="p-6">
                        <span className="px-4 py-1.5 bg-gray-100 rounded-full font-bold text-xs border uppercase">
                          {p.couleur}
                        </span>
                      </td>
                      <td className="p-6 font-black text-[#4A3228] text-lg">
                        {p.prix_vente.toLocaleString()} <span className="text-sm font-normal">FCFA</span>
                      </td>
                      <td className="p-6 text-right">
                        <button 
                          onClick={() => deleteModel(p.id)} 
                          className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-sm flex items-center justify-center ml-auto"
                        >
                          <i className="fa-solid fa-trash-can text-lg"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}