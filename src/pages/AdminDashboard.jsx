import React, { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { auth, db } from '../firebase/config'; 
import { onAuthStateChanged, signOut } from "firebase/auth"; 
import { doc, getDoc, collection, getDocs, deleteDoc } from "firebase/firestore"; 
import { Trash2 } from 'lucide-react'; // Import de l'icône poubelle
import Dashboard from './Dashboard'; 
import Catalogue from './Catalogue'; 
import Stock from './Stock'; 
import Livraisons from './Livraisons'; 
import Finance from './Finance';
import Depenses from './Depenses'; 
import Performance from './Performances'; 
import Inventaire from './Inventaire'; 
import Repartition from './Repartition';
import SuiviDepenses from './SuiviDepenses'; 

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userName, setUserName] = useState("Administrateur"); 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, "utilisateurs", user.uid);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            setUserName(userData.name || userData.nom || user.email.split('@')[0]);
          } else {
            setUserName(user.displayName || user.email.split('@')[0]);
          }
        } catch (error) {
          console.error("Erreur récupération profil:", error);
          setUserName(user.email.split('@')[0]);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // FONCTION DE SUPPRESSION TOTALE
  const handleClearAllData = async () => {
    const confirmFirst = window.confirm("⚠️ ATTENTION : Voulez-vous vraiment supprimer TOUTES les données (Commandes, Dépenses, Mouvements) ?");
    
    if (confirmFirst) {
      const confirmSecond = window.confirm("Dernière vérification : Cette action est irréversible. Effacer tout ?");
      
      if (confirmSecond) {
        const collectionsToDelete = ["commandes", "depenses", "mouvements_stock"];
        
        try {
          for (const collName of collectionsToDelete) {
            const querySnapshot = await getDocs(collection(db, collName));
            const deletePromises = querySnapshot.docs.map(document => deleteDoc(doc(db, collName, document.id)));
            await Promise.all(deletePromises);
          }
          toast("Base de données nettoyée avec succès !");
        } catch (error) {
          console.error("Erreur lors de la suppression:", error);
          toast("Une erreur est survenue lors de la suppression.");
        }
      }
    }
  };

  const handleLogout = () => {
    signOut(auth).catch((error) => console.error("Erreur déconnexion:", error));
  };

  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: 'fa-chart-pie' },
    { id: 'catalogue', label: 'Modèles & Catalogue', icon: 'fa-box-open' },
    { id: 'stock', label: 'Mouvements Stock', icon: 'fa-right-left' },
    { id: 'livraisons', label: 'Suivi Livraisons', icon: 'fa-truck-fast' },
    { id: 'finance', label: 'Finance & Capital', icon: 'fa-wallet' },
    { id: 'depenses', label: 'Gestion Dépenses', icon: 'fa-money-bill-trend-up' },
    { id: 'performance', label: 'Performances', icon: 'fa-ranking-star' },
    { id: 'repartition', label: 'Répartition Fonds', icon: 'fa-pie-chart' },
    { id: 'suivi-depenses', label: 'Suivi Dépenses', icon: 'fa-table' },
    { id: 'inventaire', label: 'Inventaire Global', icon: 'fa-clipboard-list' }
  ];

  return (
    <div className="flex h-screen w-full bg-[#FDFCFB] overflow-hidden font-['Inter']">
      <Toaster 
        position="top-right" 
        reverseOrder={false}
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1A1C23',
            color: '#fff',
            padding: '20px 30px',
            borderRadius: '24px',
            fontSize: '15px',
            fontWeight: '900',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            maxWidth: '500px',
            border: '2px solid #A62626',
          },
        }}
      />
      
      {/* --- MENU MOBILE --- */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-[60] bg-[#1A1C23] p-4 flex justify-between items-center text-white">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center overflow-hidden">
                <img src="/logo.jpeg" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <span className="font-black tracking-tighter text-lg uppercase">PelucheStore</span>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-2xl p-2 bg-white/10 rounded-lg">
          {isSidebarOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* --- SIDEBAR --- */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`
        fixed md:relative z-50 w-72 h-full bg-[#1A1C23] text-white flex flex-col shrink-0 transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-8 flex flex-col items-start border-b border-white/5 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-white rounded-2xl p-1 flex items-center justify-center shadow-lg overflow-hidden shrink-0">
              <img src="/logo.jpeg" alt="Peluche Store Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tighter flex flex-col leading-none">
                <span className="text-blue-400">Peluche</span>
                <span className="text-orange-400">Store</span>
              </h2>
              <p className="text-[9px] font-bold text-gray-400 tracking-widest mt-1 opacity-60">CAMEROON 🇨🇲</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 overflow-y-auto space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
              className={`
                w-full p-4 rounded-2xl font-bold flex items-center gap-4 transition-all
                ${activeTab === item.id ? 'bg-[#A62626] shadow-lg' : 'text-gray-400 hover:bg-white/5 hover:text-white'}
              `}
            >
              <i className={`fa-solid ${item.icon} w-6 text-center`}></i>
              <span className="text-sm tracking-wide">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto border-t border-white/5 bg-[#14161d]">
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/10">
            <div className="w-12 h-12 bg-[#A62626] rounded-full flex items-center justify-center text-xl font-black text-white shrink-0 uppercase">
              {userName.charAt(0)}
            </div>
            <div className="truncate">
              <p className="text-sm font-black truncate tracking-tight text-white capitalize">{userName}</p>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse"></span>
                <p className="text-[10px] text-[#10B981] font-black uppercase tracking-widest italic">● CONNECTÉ</p>
              </div>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full mt-3 p-3 text-red-400 hover:bg-red-500/10 rounded-xl text-[10px] font-black tracking-widest transition-all uppercase">
             DECONNEXION
          </button>
        </div>
      </aside>

      {/* --- ZONE PRINCIPALE --- */}
      <main className="flex-1 h-full overflow-y-auto flex flex-col w-full">
        <header className="p-6 md:p-10 pt-24 md:pt-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border border-gray-100 gap-6">
            <div>
              <p className="text-[#A62626] text-[10px] font-black tracking-[0.2em] mb-2 uppercase">Peluche Store Management</p>
              <h1 className="text-3xl md:text-5xl font-black text-[#4A3228] leading-none">
                {navItems.find(i => i.id === activeTab)?.label}
              </h1>
            </div>

            {/* BOUTON TOUT SUPPRIMER */}
            <button 
              onClick={handleClearAllData}
              className="flex items-center gap-2 bg-red-50 text-red-600 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all border border-red-100 shadow-sm"
            >
              <Trash2 size={16} />
              Réinitialiser les données
            </button>
          </div>
        </header>

        <section className="px-6 md:px-10 pb-10 flex-1">
          <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-sm border border-gray-50 min-h-[500px]">
             {activeTab === 'dashboard' ? <Dashboard /> : 
              activeTab === 'catalogue' ? <Catalogue /> : 
              activeTab === 'stock' ? <Stock /> : 
              activeTab === 'livraisons' ? <Livraisons /> : 
              activeTab === 'finance' ? <Finance /> : 
              activeTab === 'depenses' ? <Depenses /> : 
              activeTab === 'performance' ? <Performance /> : 
              activeTab === 'repartition' ? <Repartition /> :
              activeTab === 'suivi-depenses' ? <SuiviDepenses /> :
              activeTab === 'inventaire' ? <Inventaire /> : null}
          </div>
        </section>
      </main>
    </div>
  );
}