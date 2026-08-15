import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAPlqfkjH85GR5w3YrYb9xGUMREdmCP1Qg",
  authDomain: "app-atelier-defd9.firebaseapp.com",
  projectId: "app-atelier-defd9",
  storageBucket: "app-atelier-defd9.firebasestorage.app",
  messagingSenderId: "878541475060",
  appId: "1:878541475060:web:808e6bedc2cafd32e4e2a1",
  measurementId: "G-6TKCHM61D7"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

const INITIAL_CLIENTES = [];
const INITIAL_PEDIDOS = [];
const INITIAL_TELAS = [];
const INITIAL_AVIOS = [];

const MEDIDAS_LISTA = [
  'Contorno de Busto', 'Altura de Busto', 'Separación de Busto', 'Radio', 
  'Contorno de Cintura', 'Contorno de Cadera', 'Altura de Cadera',
  'Contorno de Cuello', 'Ancho de Hombros', 'Ancho de Espalda', 'Largo de Espalda', 'Ancho de Pecho',
  'Contorno de Brazo', 'Contorno de Muñeca', 'Largo de Manga', 'Altura de Codo',
  'Altura Tiro de Pantalón', 'Largo de Pantalón', 'Largo de Falda', 'Altura de Rodilla'
];

const ESTADOS_PEDIDO = ['Eligiendo telas', 'Midiendo', 'En proceso', 'Pruebas', 'Finalizado'];

export default function App() {
  const [user, setUser] = useState(null);
  const [vista, setVista] = useState('dashboard');
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');
  
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Estados para detalles y edición
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [telaSeleccionada, setTelaSeleccionada] = useState(null);
  const [avioSeleccionado, setAvioSeleccionado] = useState(null);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  
  // Estado para prevenir doble clic al guardar
  const [isSaving, setIsSaving] = useState(false);

  // Estado para la foto ampliada y confirmación UI
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const [modalConfirm, setModalConfirm] = useState({ isOpen: false, text: '', action: null, buttons: null });

  // Estados sincronizados con Firebase Firestore
  const [clientes, setClientes] = useState(INITIAL_CLIENTES);
  const [pedidos, setPedidos] = useState(INITIAL_PEDIDOS);
  const [telas, setTelas] = useState(INITIAL_TELAS);
  const [avios, setAvios] = useState(INITIAL_AVIOS);

  const [calc, setCalc] = useState({ cm: 0, costoMetro: 0, avios: 0, horas: 0, valorHora: 0, margen: 0, precioPersonalizado: 0 });

  useEffect(() => {
    if (!user) return;
    
    const unsubClientes = onSnapshot(collection(db, "clientes"), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setClientes(list);
    }, (err) => console.error("Error leyendo clientes:", err));

    const unsubPedidos = onSnapshot(collection(db, "pedidos"), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setPedidos(list);
    }, (err) => console.error("Error leyendo pedidos:", err));

    const unsubTelas = onSnapshot(collection(db, "telas"), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setTelas(list);
    }, (err) => console.error("Error leyendo telas:", err));

    const unsubAvios = onSnapshot(collection(db, "avios"), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setAvios(list);
    }, (err) => console.error("Error leyendo avios:", err));

    return () => {
      unsubClientes();
      unsubPedidos();
      unsubTelas();
      unsubAvios();
    };
  }, [user]);

  const metrosCalculados = calc.cm / 100;
  const materiales = (metrosCalculados * calc.costoMetro) + calc.avios;
  const manoObra = calc.horas * calc.valorHora;
  const costoTotal = materiales + manoObra;
  const calculoNormal = costoTotal * (1 + calc.margen / 100);
  const precioFinal = calc.precioPersonalizado > 0 ? calc.precioPersonalizado : calculoNormal;
  const gananciaNeta = manoObra + (precioFinal - costoTotal);

  const borrarCliente = async (id) => {
    try {
      await deleteDoc(doc(db, "clientes", String(id)));
      if (clienteSeleccionado?.id === id) setVista('clientes');
    } catch (err) {
      alert("Error al eliminar cliente: " + err.message);
    }
  };
  
  const borrarTela = async (id) => {
    try {
      await deleteDoc(doc(db, "telas", String(id)));
      if (telaSeleccionada?.id === id) setVista('catalogo');
    } catch (err) {
      alert("Error al eliminar tela: " + err.message);
    }
  };

  const borrarAvio = async (id) => {
    try {
      await deleteDoc(doc(db, "avios", String(id)));
      if (avioSeleccionado?.id === id) setVista('catalogo-avios');
    } catch (err) {
      alert("Error al eliminar avío: " + err.message);
    }
  };

  const actualizarStock = async (id, nuevoStock) => {
    try {
      const tela = telas.find(t => t.id === id);
      if (tela) {
        await setDoc(doc(db, "telas", String(id)), { ...tela, stock: nuevoStock }, { merge: true });
      }
    } catch (err) {
      console.error("Error stock:", err);
    }
  };

  const actualizarStockAvio = async (id, nuevoStock) => {
    try {
      const avio = avios.find(a => a.id === id);
      if (avio) {
        await setDoc(doc(db, "avios", String(id)), { ...avio, stock: nuevoStock }, { merge: true });
      }
    } catch (err) {
      console.error("Error stock avio:", err);
    }
  };

  const guardarCliente = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
      const fd = new FormData(e.target);
      const medidas = {};
      MEDIDAS_LISTA.forEach(m => medidas[m] = fd.get(m));
      const id = Date.now();
      const nuevo = { id, nombre: fd.get('nombre'), telefono: fd.get('telefono'), medidas };
      await setDoc(doc(db, "clientes", String(id)), nuevo);
      setVista('clientes');
    } catch (err) {
      alert("Error al guardar cliente: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const actualizarCliente = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData(e.target);
      const medidas = {};
      MEDIDAS_LISTA.forEach(m => medidas[m] = fd.get(m));
      const actualizado = { ...clienteSeleccionado, nombre: fd.get('nombre'), telefono: fd.get('telefono'), medidas };
      await setDoc(doc(db, "clientes", String(clienteSeleccionado.id)), actualizado);
      setClienteSeleccionado(actualizado);
      setVista('detalle-cliente');
    } catch (err) {
      alert("Error al actualizar cliente: " + err.message);
    }
  };

  const guardarTela = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData(e.target);
      const id = Date.now();
      const nueva = { 
        id, 
        nombre: fd.get('nombre'), 
        descripcion: fd.get('desc'), 
        uso: fd.get('uso'), 
        stock: fd.get('stock'), 
        precio: Number(fd.get('precio')) || 0,
        foto: fd.get('foto') 
      };
      await setDoc(doc(db, "telas", String(id)), nueva);
      setVista('catalogo');
    } catch (err) {
      alert("Error al guardar tela: " + err.message);
    }
  };

  const actualizarTelaEditada = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData(e.target);
      const actualizada = { 
        ...telaSeleccionada, 
        nombre: fd.get('nombre'), 
        descripcion: fd.get('desc'), 
        uso: fd.get('uso'), 
        stock: fd.get('stock'), 
        precio: Number(fd.get('precio')) || 0,
        foto: fd.get('foto') 
      };
      await setDoc(doc(db, "telas", String(telaSeleccionada.id)), actualizada);
      setTelaSeleccionada(actualizada);
      setVista('detalle-tela');
    } catch (err) {
      alert("Error al actualizar tela: " + err.message);
    }
  };

  const guardarAvio = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData(e.target);
      const id = Date.now();
      const nuevo = { id, nombre: fd.get('nombre'), descripcion: fd.get('desc'), uso: fd.get('uso'), stock: fd.get('stock'), foto: fd.get('foto') };
      await setDoc(doc(db, "avios", String(id)), nuevo);
      setVista('catalogo-avios');
    } catch (err) {
      alert("Error al guardar avío: " + err.message);
    }
  };

  const actualizarAvioEditado = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData(e.target);
      const actualizado = { 
        ...avioSeleccionado, 
        nombre: fd.get('nombre'), 
        descripcion: fd.get('desc'), 
        uso: fd.get('uso'), 
        stock: fd.get('stock'), 
        foto: fd.get('foto') 
      };
      await setDoc(doc(db, "avios", String(avioSeleccionado.id)), actualizado);
      setAvioSeleccionado(actualizado);
      setVista('detalle-avio');
    } catch (err) {
      alert("Error al actualizar avío: " + err.message);
    }
  };

  const crearPedido = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData(e.target);
      const id = 'PED-' + Date.now().toString().slice(-4);
      const nuevo = { 
          id,
          cliente: fd.get('clienteNombre'), 
          prenda: fd.get('prenda'), 
          estado: 'Eligiendo telas', 
          entrega: fd.get('fecha'), 
          precio: 0, 
          pagado: false, 
          tela: fd.get('tela'),
          foto: fd.get('foto') || '',
          fotos: fd.get('foto') ? [fd.get('foto')] : [],
          ocultoDashboard: false,
          materialesCosto: 0,
          manoObraCosto: 0,
          gastos: 0
      };
      await setDoc(doc(db, "pedidos", String(id)), nuevo);
      setVista('dashboard');
    } catch (err) {
      alert("Error al crear pedido: " + err.message);
    }
  };

  const asignarPrecioAPedido = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData(e.target);
      const pedidoId = fd.get('pedidoId');
      const pedido = pedidos.find(p => p.id === pedidoId);
      if (pedido) {
        const actualizado = { 
          ...pedido, 
          precio: precioFinal,
          materialesCosto: materiales,
          manoObraCosto: manoObra
        };
        await setDoc(doc(db, "pedidos", String(pedidoId)), actualizado, { merge: true });
      }
      setVista('dashboard');
    } catch (err) {
      alert("Error al asignar precio: " + err.message);
    }
  };

  const ocultarPedidoDashboard = async (id) => {
    try {
      const pedido = pedidos.find(p => p.id === id);
      if (pedido) {
        await setDoc(doc(db, "pedidos", String(id)), { ...pedido, ocultoDashboard: true }, { merge: true });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const borrarPedidoDefinitivo = async (id) => {
    try {
      await deleteDoc(doc(db, "pedidos", String(id)));
    } catch (err) {
      alert("Error al borrar pedido: " + err.message);
    }
  };

  const actualizarEstado = async (id, nuevoEstado) => {
    try {
      const pedido = pedidos.find(p => p.id === id);
      if (pedido) {
        await setDoc(doc(db, "pedidos", String(id)), { ...pedido, estado: nuevoEstado }, { merge: true });
        if (pedidoSeleccionado?.id === id) {
          setPedidoSeleccionado(prev => ({ ...prev, estado: nuevoEstado }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const togglePago = async (id) => {
    try {
      const pedido = pedidos.find(p => p.id === id);
      if (pedido) {
        await setDoc(doc(db, "pedidos", String(id)), { ...pedido, pagado: !pedido.pagado }, { merge: true });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (loginUser.trim() === 'Kamurina' && loginPass === 'glj-2007') {
        setUser({ uid: 'Kamurina' });
    } else {
        setError('Usuario o contraseña incorrectos');
    }
  };

  const pedidosVisibles = pedidos.filter(p => !p.ocultoDashboard);
  const clientesFiltrados = clientes.filter(c => c.nombre.toLowerCase().includes(busqueda.toLowerCase()));

  // Agrupación de ganancias mensuales incluyendo lista de pedidos
  const gananciasPorMes = pedidos.reduce((acc, p) => {
    if (!p.entrega || p.precio <= 0) return acc;
    const mesAnio = p.entrega.slice(0, 7); // Formato YYYY-MM
    const mat = p.materialesCosto || 0;
    const mano = p.manoObraCosto || (p.precio > 0 ? p.precio * 0.4 : 0);
    const gastos = p.gastos || 0;
    const gananciaPedido = mano + (p.precio - (mat + mano + gastos));
    
    if (!acc[mesAnio]) {
      acc[mesAnio] = { ingresos: 0, ganancia: 0, cantidad: 0, pedidos: [] };
    }
    acc[mesAnio].ingresos += p.precio;
    acc[mesAnio].ganancia += gananciaPedido;
    acc[mesAnio].cantidad += 1;
    acc[mesAnio].pedidos.push({ ...p, gananciaPedido });
    return acc;
  }, {});

  if (!user) {
    return (
        <div className="min-h-screen bg-stone-950 text-white flex items-center justify-center p-4 md:p-8 font-sans">
            <div className="bg-stone-900/40 p-6 md:p-8 rounded-3xl w-full max-w-sm border border-stone-800 backdrop-blur-xl">
                <h1 className="text-3xl font-bold mb-8 text-center tracking-tighter">Atelier</h1>
                <form onSubmit={handleLogin} className="space-y-4">
                    <input 
                        placeholder="Usuario" 
                        value={loginUser}
                        onChange={(e) => setLoginUser(e.target.value)}
                        className="w-full bg-stone-950 p-3 rounded-xl border border-stone-800 outline-none focus:border-stone-500 transition-colors" 
                        required 
                    />
                    <input 
                        type="password" 
                        placeholder="Contraseña" 
                        value={loginPass}
                        onChange={(e) => setLoginPass(e.target.value)}
                        className="w-full bg-stone-950 p-3 rounded-xl border border-stone-800 outline-none focus:border-stone-500 transition-colors" 
                        required 
                    />
                    {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                    <button type="submit" className="w-full bg-white text-stone-950 py-3 rounded-xl font-bold hover:bg-stone-200 transition-colors">
                        Iniciar Sesión
                    </button>
                </form>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-white p-4 md:p-8 font-sans selection:bg-white selection:text-stone-950">
      <div className="fixed inset-0 opacity-20 pointer-events-none bg-[url('https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070')] bg-cover bg-center" />

      {/* Navegación Responsive */}
      <nav className="relative z-10 max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center mb-8 md:mb-12 gap-4">
        <h1 className="text-2xl font-bold tracking-tighter cursor-pointer self-start md:self-auto" onClick={() => setVista('dashboard')}>Atelier</h1>
        <div className="flex gap-4 md:gap-8 text-sm text-stone-400 font-medium overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
          <button onClick={() => setVista('dashboard')} className={`whitespace-nowrap ${vista === 'dashboard' ? 'text-white' : ''}`}>Dashboard</button>
          <button onClick={() => setVista('clientes')} className={`whitespace-nowrap ${vista === 'clientes' ? 'text-white' : ''}`}>Clientes</button>
          <button onClick={() => setVista('catalogo')} className={`whitespace-nowrap ${vista === 'catalogo' ? 'text-white' : ''}`}>Catálogo Telas</button>
          <button onClick={() => setVista('catalogo-avios')} className={`whitespace-nowrap ${vista === 'catalogo-avios' ? 'text-white' : ''}`}>Catálogo Avios</button>
          <button onClick={() => setVista('calculadora')} className={`whitespace-nowrap ${vista === 'calculadora' ? 'text-white' : ''}`}>Calculadora</button>
          <button onClick={() => setVista('ganancias')} className={`whitespace-nowrap ${vista === 'ganancias' ? 'text-white' : ''}`}>Ganancias</button>
          <button onClick={() => setUser(null)} className="text-red-400 text-xs ml-auto md:ml-4 whitespace-nowrap">Salir</button>
        </div>
      </nav>

      <main className="relative z-10 max-w-6xl mx-auto">
        {vista === 'dashboard' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {pedidosVisibles.length === 0 ? (
              <p className="col-span-full text-stone-500 text-center py-10 italic">No existen pedidos activos.</p>
            ) : (
              pedidosVisibles.map(p => {
                const mat = p.materialesCosto || 0;
                const mano = p.manoObraCosto || 0;
                const gastos = p.gastos || 0;
                const gananciaPedido = p.precio > 0 ? mano + (p.precio - (mat + mano + gastos)) : 0;
                return (
                  <div 
                    key={p.id} 
                    onClick={() => { setPedidoSeleccionado(p); setVista('detalle-pedido'); }} 
                    className="bg-stone-900/40 backdrop-blur-md border border-stone-800 p-6 rounded-3xl relative cursor-pointer hover:border-stone-600 transition-colors"
                  >
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setModalConfirm({ 
                          isOpen: true, 
                          text: "¿Qué deseas hacer con este pedido?", 
                          buttons: [
                            { text: "Solo quitar del Dashboard", action: () => ocultarPedidoDashboard(p.id), style: "bg-stone-800 text-white hover:bg-stone-700" },
                            { text: "Eliminar definitivamente (Historial)", action: () => borrarPedidoDefinitivo(p.id), style: "bg-red-950/40 text-red-400 border border-red-900/50 hover:bg-red-900/40" }
                          ]
                        }); 
                      }} 
                      className="absolute top-4 right-4 text-stone-600 hover:text-red-400 text-xs"
                    >
                      ✕
                    </button>
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[10px] uppercase tracking-widest text-stone-500">{p.id}</span>
                      <button onClick={(e) => { e.stopPropagation(); togglePago(p.id); }} className={`text-[10px] uppercase px-2 py-1 rounded ${p.pagado ? 'bg-emerald-900 text-emerald-300' : 'bg-stone-800'}`}>
                        {p.pagado ? 'Pagado' : 'Pendiente'}
                      </button>
                    </div>
                    <h3 className="text-lg font-semibold">{p.cliente}</h3>
                    <p className="text-stone-400 text-sm mb-2">{p.prenda} {p.tela && `(${p.tela})`}</p>
                    {(p.fotos?.[0] || p.foto) && <img src={p.fotos?.[0] || p.foto} alt="Pedido" className="w-full h-24 object-cover rounded-xl mb-3 border border-stone-800" />}
                    
                    <div className="mb-4">
                      <p className="text-xl font-bold">{p.precio > 0 ? `$${p.precio.toLocaleString()}` : 'Sin precio'}</p>
                      {p.precio > 0 && (
                        <p className="text-xs text-emerald-400 font-medium">Ganancia: +${gananciaPedido.toLocaleString()}</p>
                      )}
                    </div>

                    <select onClick={(e) => e.stopPropagation()} value={p.estado} onChange={(e) => actualizarEstado(p.id, e.target.value)} className="w-full bg-stone-950/50 border border-stone-800 p-2 rounded-xl text-xs outline-none">
                      {ESTADOS_PEDIDO.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                );
              })
            )}
          </div>
        )}

        {vista === 'detalle-pedido' && pedidoSeleccionado && (() => {
          const arrayFotos = pedidoSeleccionado.fotos || (pedidoSeleccionado.foto ? [pedidoSeleccionado.foto] : []);
          return (
            <div className="bg-stone-900/40 backdrop-blur-md border border-stone-800 p-6 md:p-8 rounded-3xl max-w-2xl mx-auto relative">
              <button onClick={() => setVista('dashboard')} className="absolute top-4 right-4 text-stone-400 hover:text-white">Volver</button>
              
              <h2 className="text-2xl font-bold mb-1">Detalle del Pedido</h2>
              <p className="text-stone-400 text-sm mb-6">Cliente: {pedidoSeleccionado.cliente}</p>
              
              <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const fd = new FormData(e.target);
                    const actualizado = {
                        ...pedidoSeleccionado,
                        prenda: fd.get('prenda'),
                        entrega: fd.get('entrega'),
                        tela: fd.get('tela'),
                        precio: Number(fd.get('precio')),
                        gastos: Number(fd.get('gastos')) || 0,
                        estado: fd.get('estado')
                    };
                    await setDoc(doc(db, "pedidos", String(pedidoSeleccionado.id)), actualizado, { merge: true });
                    setPedidoSeleccionado(actualizado);
                    
                    setVista('dashboard');
                    
                  } catch (err) {
                    alert("Error al actualizar pedido: " + err.message);
                  }
              }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 text-sm">
                      <div>
                          <label className="text-stone-500 pl-1 text-xs">Prenda</label>
                          <input name="prenda" defaultValue={pedidoSeleccionado.prenda} className="w-full bg-stone-950 p-3 rounded-xl border border-stone-800 outline-none" required />
                      </div>
                      <div>
                          <label className="text-stone-500 pl-1 text-xs">Fecha de Entrega</label>
                          <input name="entrega" type="date" defaultValue={pedidoSeleccionado.entrega} className="w-full bg-stone-950 p-3 rounded-xl border border-stone-800 outline-none" required />
                      </div>
                      <div>
                          <label className="text-stone-500 pl-1 text-xs">Tela</label>
                          <select name="tela" defaultValue={pedidoSeleccionado.tela} className="w-full bg-stone-950 p-3 rounded-xl border border-stone-800 outline-none">
                              <option value="">Ninguna</option>
                              {telas.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="text-stone-500 pl-1 text-xs">Precio ($)</label>
                          <input name="precio" type="number" defaultValue={pedidoSeleccionado.precio} className="w-full bg-stone-950 p-3 rounded-xl border border-stone-800 outline-none" />
                      </div>
                      <div>
                          <label className="text-stone-500 pl-1 text-xs">Gastos ($)</label>
                          <input name="gastos" type="number" defaultValue={pedidoSeleccionado.gastos || ''} className="w-full bg-stone-950 p-3 rounded-xl border border-stone-800 outline-none" />
                      </div>
                      <div className="col-span-1 sm:col-span-2">
                          <label className="text-stone-500 pl-1 text-xs">Estado</label>
                          <select name="estado" defaultValue={pedidoSeleccionado.estado} className="w-full bg-stone-950 p-3 rounded-xl border border-stone-800 outline-none">
                              {ESTADOS_PEDIDO.map(e => <option key={e} value={e}>{e}</option>)}
                          </select>
                      </div>
                  </div>
                  <button type="submit" className="w-full bg-stone-800 text-white py-3 rounded-xl font-bold mb-8 hover:bg-stone-700">Guardar Información</button>
              </form>

              <h3 className="text-lg font-semibold mb-4">Fotos del Trabajo</h3>
              {arrayFotos.length === 0 ? (
                  <p className="text-stone-500 text-xs italic mb-4">No hay fotos guardadas en este pedido.</p>
              ) : (
                  <div className="flex gap-2 overflow-x-auto pb-4 mb-4">
                    {arrayFotos.map((img, i) => (
                      <img 
                        key={i} 
                        src={img} 
                        alt={`Trabajo ${i+1}`} 
                        className="w-32 h-32 object-cover rounded-xl border border-stone-800 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" 
                        onClick={() => setFotoAmpliada(img)}
                      />
                    ))}
                  </div>
              )}

              <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const url = e.target.nuevaFoto.value;
                    const fotosActualizadas = [...arrayFotos, url];
                    const actualizado = { ...pedidoSeleccionado, fotos: fotosActualizadas };
                    await setDoc(doc(db, "pedidos", String(pedidoSeleccionado.id)), actualizado, { merge: true });
                    setPedidoSeleccionado(actualizado);
                    e.target.reset();
                  } catch (err) {
                    alert("Error al agregar foto: " + err.message);
                  }
              }} className="flex flex-col sm:flex-row gap-2">
                  <input name="nuevaFoto" placeholder="URL nueva foto..." className="w-full bg-stone-900/50 p-3 rounded-xl border border-stone-800 outline-none text-sm" required />
                  <button type="submit" className="bg-white text-stone-950 px-4 py-3 sm:py-2 rounded-xl text-sm font-bold whitespace-nowrap">Agregar Foto</button>
              </form>
            </div>
          );
        })()}

        {vista === 'nuevo-cliente' && (
           <form onSubmit={guardarCliente} className="bg-stone-900/40 p-6 md:p-8 rounded-3xl border border-stone-800 max-w-lg mx-auto">
             <h2 className="text-2xl font-bold mb-6">Nuevo Cliente</h2>
             <input name="nombre" placeholder="Nombre" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" required />
             <input name="telefono" placeholder="Teléfono" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" required />
             
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-4">
               {MEDIDAS_LISTA.map(m => (
                 <div key={m} className="flex flex-col gap-1">
                   <label className="text-stone-500 pl-1">{m}</label>
                   <input name={m} className="bg-stone-950 p-2 rounded border border-stone-800 outline-none" />
                 </div>
               ))}
             </div>
             
             <button 
               type="submit" 
               disabled={isSaving} 
               className={`w-full mt-4 bg-white text-stone-950 py-3 rounded-xl font-bold transition-opacity ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
             >
               {isSaving ? 'Guardando...' : 'Guardar'}
             </button>
           </form>
        )}

        {vista === 'editar-cliente' && clienteSeleccionado && (
           <form onSubmit={actualizarCliente} className="bg-stone-900/40 p-6 md:p-8 rounded-3xl border border-stone-800 max-w-lg mx-auto">
             <h2 className="text-2xl font-bold mb-6">Editar Cliente y Medidas</h2>
             <input name="nombre" defaultValue={clienteSeleccionado.nombre} placeholder="Nombre" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" required />
             <input name="telefono" defaultValue={clienteSeleccionado.telefono} placeholder="Teléfono" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" required />
             
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-4">
               {MEDIDAS_LISTA.map(m => (
                 <div key={m} className="flex flex-col gap-1">
                   <label className="text-stone-500 pl-1">{m}</label>
                   <input name={m} defaultValue={clienteSeleccionado.medidas?.[m] || ''} className="bg-stone-950 p-2 rounded border border-stone-800 outline-none" />
                 </div>
               ))}
             </div>
             
             <button type="submit" className="w-full mt-4 bg-white text-stone-950 py-3 rounded-xl font-bold">Guardar Cambios</button>
           </form>
        )}

        {vista === 'nuevo-pedido' && (
           <form onSubmit={crearPedido} className="bg-stone-900/40 p-6 md:p-8 rounded-3xl border border-stone-800 max-w-lg mx-auto">
             <h2 className="text-2xl font-bold mb-6">Nuevo Pedido</h2>
             <select name="clienteNombre" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" required>
               <option value="">Seleccionar Cliente</option>
               {clientes.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
             </select>
             <input name="prenda" placeholder="Prenda" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" required />
             <input name="fecha" type="date" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" required />
             <select name="tela" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none">
               <option value="">Seleccionar Tela (Opcional)</option>
               {telas.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
             </select>
             <input name="foto" placeholder="URL Foto del Pedido (Opcional)" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <button type="submit" className="w-full mt-6 bg-white text-stone-950 py-3 rounded-xl font-bold">Guardar Pedido</button>
           </form>
        )}

        {vista === 'nueva-tela' && (
           <form onSubmit={guardarTela} className="bg-stone-900/40 p-6 md:p-8 rounded-3xl border border-stone-800 max-w-lg mx-auto">
             <h2 className="text-2xl font-bold mb-6">Nueva Tela</h2>
             <input name="nombre" placeholder="Nombre" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" required />
             <input name="desc" placeholder="Descripción" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <input name="uso" placeholder="Uso" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <input name="stock" placeholder="Stock" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <input name="precio" type="number" placeholder="Precio por metro ($) (Opcional)" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <input name="foto" placeholder="URL Foto" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <button type="submit" className="w-full mt-6 bg-white text-stone-950 py-3 rounded-xl font-bold">Guardar Tela</button>
           </form>
        )}

        {vista === 'nuevo-avio' && (
           <form onSubmit={guardarAvio} className="bg-stone-900/40 p-6 md:p-8 rounded-3xl border border-stone-800 max-w-lg mx-auto">
             <h2 className="text-2xl font-bold mb-6">Nuevo Avío</h2>
             <input name="nombre" placeholder="Nombre" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" required />
             <input name="desc" placeholder="Descripción" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <input name="uso" placeholder="Uso" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <input name="stock" placeholder="Stock" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <input name="foto" placeholder="URL Foto" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <button type="submit" className="w-full mt-6 bg-white text-stone-950 py-3 rounded-xl font-bold">Guardar Avío</button>
           </form>
        )}

        {vista === 'editar-tela' && telaSeleccionada && (
           <form onSubmit={actualizarTelaEditada} className="bg-stone-900/40 p-6 md:p-8 rounded-3xl border border-stone-800 max-w-lg mx-auto">
             <h2 className="text-2xl font-bold mb-6">Editar Tela</h2>
             <input name="nombre" defaultValue={telaSeleccionada.nombre} placeholder="Nombre" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" required />
             <input name="desc" defaultValue={telaSeleccionada.descripcion} placeholder="Descripción" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <input name="uso" defaultValue={telaSeleccionada.uso} placeholder="Uso" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <input name="stock" defaultValue={telaSeleccionada.stock} placeholder="Stock" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <input name="precio" type="number" defaultValue={telaSeleccionada.precio || ''} placeholder="Precio por metro ($) (Opcional)" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <input name="foto" defaultValue={telaSeleccionada.foto} placeholder="URL Foto" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <button type="submit" className="w-full mt-6 bg-white text-stone-950 py-3 rounded-xl font-bold">Guardar Cambios</button>
           </form>
        )}

        {vista === 'editar-avio' && avioSeleccionado && (
           <form onSubmit={actualizarAvioEditado} className="bg-stone-900/40 p-6 md:p-8 rounded-3xl border border-stone-800 max-w-lg mx-auto">
             <h2 className="text-2xl font-bold mb-6">Editar Avío</h2>
             <input name="nombre" defaultValue={avioSeleccionado.nombre} placeholder="Nombre" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" required />
             <input name="desc" defaultValue={avioSeleccionado.descripcion} placeholder="Descripción" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <input name="uso" defaultValue={avioSeleccionado.uso} placeholder="Uso" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <input name="stock" defaultValue={avioSeleccionado.stock} placeholder="Stock" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <input name="foto" defaultValue={avioSeleccionado.foto} placeholder="URL Foto" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <button type="submit" className="w-full mt-6 bg-white text-stone-950 py-3 rounded-xl font-bold">Guardar Cambios</button>
           </form>
        )}

        {vista === 'catalogo' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {telas.length === 0 ? (
                  <p className="col-span-full text-stone-500 text-center py-10 italic">No existen telas registradas.</p>
              ) : (
                  telas.map(t => (
                    <div key={t.id} className="bg-stone-900/40 backdrop-blur-md border border-stone-800 rounded-3xl overflow-hidden relative">
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setModalConfirm({ isOpen: true, text: "¿Estás segura de que quieres eliminar esta tela del catálogo?", action: () => borrarTela(t.id) }); 
                        }} 
                        className="absolute top-2 right-2 text-white bg-black/50 p-2 rounded-full hover:bg-red-900 z-10 text-xs"
                      >
                        ✕
                      </button>
                      <img src={t.foto} alt={t.nombre} className="w-full h-32 object-cover cursor-pointer" onClick={() => { setTelaSeleccionada(t); setVista('detalle-tela'); }} />
                      <div className="p-4">
                        <h3 className="font-bold cursor-pointer hover:underline" onClick={() => { setTelaSeleccionada(t); setVista('detalle-tela'); }}>{t.nombre}</h3>
                        <p className="text-xs text-stone-400">{t.descripcion} - {t.uso}</p>
                        {t.precio > 0 && <p className="text-xs text-emerald-400 font-semibold mt-1">${t.precio.toLocaleString()} / m</p>}
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-stone-400">Stock:</span>
                            <input
                                type="text"
                                value={t.stock}
                                onChange={(e) => actualizarStock(t.id, e.target.value)}
                                className="bg-stone-950 p-1 rounded border border-stone-800 w-20 text-xs text-center focus:border-white outline-none"
                            />
                        </div>
                      </div>
                    </div>
                  ))
              )}
          </div>
        )}

        {vista === 'catalogo-avios' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {avios.length === 0 ? (
                  <p className="col-span-full text-stone-500 text-center py-10 italic">No existen avios registrados.</p>
              ) : (
                  avios.map(a => (
                    <div key={a.id} className="bg-stone-900/40 backdrop-blur-md border border-stone-800 rounded-3xl overflow-hidden relative">
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setModalConfirm({ isOpen: true, text: "¿Estás segura de que quieres eliminar este avío del catálogo?", action: () => borrarAvio(a.id) }); 
                        }} 
                        className="absolute top-2 right-2 text-white bg-black/50 p-2 rounded-full hover:bg-red-900 z-10 text-xs"
                      >
                        ✕
                      </button>
                      <img src={a.foto} alt={a.nombre} className="w-full h-32 object-cover cursor-pointer" onClick={() => { setAvioSeleccionado(a); setVista('detalle-avio'); }} />
                      <div className="p-4">
                        <h3 className="font-bold cursor-pointer hover:underline" onClick={() => { setAvioSeleccionado(a); setVista('detalle-avio'); }}>{a.nombre}</h3>
                        <p className="text-xs text-stone-400">{a.descripcion} - {a.uso}</p>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-stone-400">Stock:</span>
                            <input
                                type="text"
                                value={a.stock}
                                onChange={(e) => actualizarStockAvio(a.id, e.target.value)}
                                className="bg-stone-950 p-1 rounded border border-stone-800 w-20 text-xs text-center focus:border-white outline-none"
                            />
                        </div>
                      </div>
                    </div>
                  ))
              )}
          </div>
        )}

        {vista === 'detalle-tela' && telaSeleccionada && (
          <div className="bg-stone-900/40 backdrop-blur-md border border-stone-800 p-6 md:p-8 rounded-3xl max-w-xl mx-auto relative">
            <button onClick={() => setVista('catalogo')} className="absolute top-4 right-4 text-stone-400 hover:text-white">Volver</button>
            <img src={telaSeleccionada.foto} alt={telaSeleccionada.nombre} className="w-full h-48 object-cover rounded-2xl mb-6 border border-stone-800" />
            <h2 className="text-2xl font-bold mb-2">{telaSeleccionada.nombre}</h2>
            <p className="text-stone-400 text-sm mb-2"><strong>Descripción:</strong> {telaSeleccionada.descripcion}</p>
            <p className="text-stone-400 text-sm mb-2"><strong>Uso:</strong> {telaSeleccionada.uso}</p>
            <p className="text-stone-400 text-sm mb-2"><strong>Stock:</strong> {telaSeleccionada.stock}</p>
            <p className="text-stone-400 text-sm mb-6"><strong>Precio por metro:</strong> {telaSeleccionada.precio ? `$${telaSeleccionada.precio.toLocaleString()}` : 'No especificado'}</p>
            <button onClick={() => setVista('editar-tela')} className="w-full bg-white text-stone-950 py-3 rounded-xl font-bold">Editar Tela</button>
          </div>
        )}

        {vista === 'detalle-avio' && avioSeleccionado && (
          <div className="bg-stone-900/40 backdrop-blur-md border border-stone-800 p-6 md:p-8 rounded-3xl max-w-xl mx-auto relative">
            <button onClick={() => setVista('catalogo-avios')} className="absolute top-4 right-4 text-stone-400 hover:text-white">Volver</button>
            <img src={avioSeleccionado.foto} alt={avioSeleccionado.nombre} className="w-full h-48 object-cover rounded-2xl mb-6 border border-stone-800" />
            <h2 className="text-2xl font-bold mb-2">{avioSeleccionado.nombre}</h2>
            <p className="text-stone-400 text-sm mb-2"><strong>Descripción:</strong> {avioSeleccionado.descripcion}</p>
            <p className="text-stone-400 text-sm mb-2"><strong>Uso:</strong> {avioSeleccionado.uso}</p>
            <p className="text-stone-400 text-sm mb-6"><strong>Stock:</strong> {avioSeleccionado.stock}</p>
            <button onClick={() => setVista('editar-avio')} className="w-full bg-white text-stone-950 py-3 rounded-xl font-bold">Editar Avío</button>
          </div>
        )}

        {vista === 'clientes' && (
          <div>
            <input type="text" placeholder="Buscar cliente..." className="w-full bg-stone-900/50 border border-stone-800 p-4 rounded-2xl mb-6 outline-none" onChange={(e) => setBusqueda(e.target.value)} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {clientesFiltrados.length === 0 ? (
                  <p className="col-span-full text-stone-500 text-center py-10 italic">No existen clientes.</p>
              ) : (
                  clientesFiltrados.map(c => (
                    <div key={c.id} className="bg-stone-900/40 backdrop-blur-md border border-stone-800 p-6 rounded-3xl relative">
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setModalConfirm({ isOpen: true, text: "¿Estás segura de que quieres eliminar este cliente?", action: () => borrarCliente(c.id) }); 
                        }} 
                        className="absolute top-4 right-4 text-stone-600 hover:text-red-400"
                      >
                        ✕
                      </button>
                      <h3 className="text-lg font-semibold cursor-pointer hover:underline" onClick={() => { setClienteSeleccionado(c); setVista('detalle-cliente'); }}>{c.nombre}</h3>
                      <p className="text-stone-400 text-xs mb-4">{c.telefono}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] text-stone-500">
                        {Object.entries(c.medidas || {}).map(([k, v]) => <div key={k}>{k}: {v}</div>)}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {vista === 'detalle-cliente' && clienteSeleccionado && (
          <div className="bg-stone-900/40 backdrop-blur-md border border-stone-800 p-6 md:p-8 rounded-3xl max-w-2xl mx-auto relative">
            <button onClick={() => setVista('clientes')} className="absolute top-4 right-4 text-stone-400 hover:text-white">Volver</button>
            <h2 className="text-3xl font-bold mb-1">{clienteSeleccionado.nombre}</h2>
            <p className="text-stone-400 text-sm mb-6">{clienteSeleccionado.telefono}</p>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <button onClick={() => setVista('editar-cliente')} className="bg-stone-800 px-4 py-3 sm:py-2 rounded-xl text-sm sm:text-xs border border-stone-700 hover:bg-stone-700 font-medium">Editar Datos y Medidas</button>
              <button 
                onClick={() => setModalConfirm({ isOpen: true, text: "¿Estás segura de que quieres eliminar este cliente?", action: () => borrarCliente(clienteSeleccionado.id) })} 
                className="bg-red-950/40 text-red-400 px-4 py-3 sm:py-2 rounded-xl text-sm sm:text-xs border border-red-900/50 hover:bg-red-900/40 font-medium"
              >
                Eliminar Cliente
              </button>
            </div>

            <h3 className="text-lg font-semibold mb-3">Medidas Registradas</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs mb-8 bg-stone-950/50 p-4 rounded-2xl border border-stone-800">
              {Object.entries(clienteSeleccionado.medidas || {}).map(([k, v]) => (
                <div key={k} className="text-stone-300"><strong>{k}:</strong> {v || 'N/A'}</div>
              ))}
            </div>

            <h3 className="text-lg font-semibold mb-3">Historial de Pedidos</h3>
            <div className="space-y-4">
              {pedidos.filter(p => p.cliente === clienteSeleccionado.nombre).length === 0 ? (
                <p className="text-stone-500 text-xs italic">No hay pedidos registrados para este cliente.</p>
              ) : (
                pedidos.filter(p => p.cliente === clienteSeleccionado.nombre).map(p => {
                  const arrayFotos = p.fotos || (p.foto ? [p.foto] : []);
                  return (
                  <div key={p.id} className="bg-stone-950/40 border border-stone-800 p-4 rounded-2xl flex flex-col gap-3 relative">
                    <button 
                      onClick={() => setModalConfirm({ isOpen: true, text: "¿Estás segura de que quieres eliminar definitivamente este pedido?", action: () => borrarPedidoDefinitivo(p.id) })} 
                      className="absolute top-4 right-4 text-stone-600 hover:text-red-400 text-xs"
                    >
                      ✕
                    </button>
                    
                    <div className="flex justify-between items-center pr-6">
                      <span className="text-xs font-bold">{p.prenda} ({p.estado})</span>
                      <span className="text-xs text-stone-400">{p.entrega}</span>
                    </div>
                    
                    <div className="text-sm font-semibold">{p.precio > 0 ? `$${p.precio.toLocaleString()}` : 'Sin precio asignado'}</div>

                    {arrayFotos.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {arrayFotos.map((img, i) => (
                          <img 
                            key={i} 
                            src={img} 
                            alt={`Trabajo ${i+1}`} 
                            className="w-24 h-24 object-cover rounded-xl border border-stone-800 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" 
                            onClick={() => setFotoAmpliada(img)}
                          />
                        ))}
                      </div>
                    )}

                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        const url = e.target.nuevaFoto.value;
                        const fotosActualizadas = [...arrayFotos, url];
                        const actualizado = { ...p, fotos: fotosActualizadas };
                        await setDoc(doc(db, "pedidos", String(p.id)), actualizado, { merge: true });
                        e.target.reset();
                      } catch (err) {
                        alert("Error al agregar foto: " + err.message);
                      }
                    }} className="flex flex-col sm:flex-row gap-2 mt-1">
                      <input name="nuevaFoto" placeholder="URL nueva foto..." className="w-full bg-stone-900/50 p-2 rounded-xl border border-stone-800 outline-none text-xs" required />
                      <button type="submit" className="bg-stone-800 px-4 py-2 rounded-xl text-xs border border-stone-700 hover:bg-stone-700 font-medium">Agregar</button>
                    </form>
                  </div>
                )})
              )}
            </div>
          </div>
        )}

        {vista === 'calculadora' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-stone-900/40 backdrop-blur-md border border-stone-800 p-6 md:p-8 rounded-3xl md:col-span-2">
              <h2 className="text-2xl mb-6 font-light">Calculadora (Tela en Centímetros)</h2>
              
              <div className="mb-4">
                <label className="block text-xs text-stone-400 mb-1">Cargar precio desde Catálogo de Telas (Opcional):</label>
                <select 
                  onChange={e => {
                    const telaNombre = e.target.value;
                    const telaEncontrada = telas.find(t => t.nombre === telaNombre);
                    if (telaEncontrada && telaEncontrada.precio) {
                      setCalc(prev => ({ ...prev, costoMetro: Number(telaEncontrada.precio) }));
                    }
                  }}
                  className="w-full bg-stone-950/50 p-3 rounded-xl border border-stone-800 outline-none text-sm text-white"
                >
                  <option value="">Seleccionar tela del catálogo...</option>
                  {telas.map(t => <option key={t.id} value={t.nombre}>{t.nombre} {t.precio ? `($${t.precio.toLocaleString()}/m)` : '(Sin precio)'}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <input type="number" placeholder="Centímetros de tela (cm)" value={calc.cm || ''} onChange={e => setCalc({...calc, cm: Number(e.target.value)})} className="bg-stone-950/50 p-3 rounded-xl border border-stone-800 outline-none" />
                <input type="number" placeholder="Costo por Metro ($)" value={calc.costoMetro || ''} onChange={e => setCalc({...calc, costoMetro: Number(e.target.value)})} className="bg-stone-950/50 p-3 rounded-xl border border-stone-800 outline-none" />
                <input type="number" placeholder="Avíos ($)" value={calc.avios || ''} onChange={e => setCalc({...calc, avios: Number(e.target.value)})} className="bg-stone-950/50 p-3 rounded-xl border border-stone-800 outline-none" />
                <input type="number" placeholder="Horas" value={calc.horas || ''} onChange={e => setCalc({...calc, horas: Number(e.target.value)})} className="bg-stone-950/50 p-3 rounded-xl border border-stone-800 outline-none" />
                <input type="number" placeholder="Valor Hora ($)" value={calc.valorHora || ''} onChange={e => setCalc({...calc, valorHora: Number(e.target.value)})} className="bg-stone-950/50 p-3 rounded-xl border border-stone-800 outline-none" />
                <input type="number" placeholder="Margen %" value={calc.margen || ''} onChange={e => setCalc({...calc, margen: Number(e.target.value)})} className="bg-stone-950/50 p-3 rounded-xl border border-stone-800 outline-none" />
                <input type="number" placeholder="Precio Personalizado ($)" value={calc.precioPersonalizado || ''} onChange={e => setCalc({...calc, precioPersonalizado: Number(e.target.value)})} className="bg-stone-950/50 p-3 rounded-xl border border-stone-800 outline-none sm:col-span-2" />
              </div>
              <div className="text-2xl font-bold mb-6 text-center">Total a Cobrar: ${precioFinal.toLocaleString()}</div>
              <form onSubmit={asignarPrecioAPedido} className="border-t border-stone-800 pt-6">
                <label className="block text-sm text-stone-400 mb-2">Asignar a pedido:</label>
                <select name="pedidoId" className="w-full bg-stone-950/50 p-3 rounded-xl border border-stone-800 mb-4 text-white outline-none">
                  {pedidosVisibles.map(p => <option key={p.id} value={p.id}>{p.cliente} - {p.prenda}</option>)}
                </select>
                <button type="submit" className="w-full bg-white text-stone-950 py-3 rounded-xl font-bold">Asignar Precio</button>
              </form>
            </div>

            {/* Resumen de Ganancias */}
            <div className="bg-stone-900/40 backdrop-blur-md border border-stone-800 p-6 rounded-3xl flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-4 border-b border-stone-800 pb-2">Resumen de Ganancias</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-stone-400">
                    <span>Costo Materiales:</span>
                    <span className="text-white">${materiales.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-stone-400">
                    <span>Mano de Obra (Tuya):</span>
                    <span className="text-white">${manoObra.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-stone-400 border-t border-stone-800/50 pt-2">
                    <span>Costo Total:</span>
                    <span className="text-white">${costoTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-stone-400">
                    <span>Precio Venta:</span>
                    <span className="text-white">${precioFinal.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 bg-stone-950/60 p-4 rounded-2xl border border-stone-800 text-center">
                <span className="block text-xs uppercase tracking-widest text-stone-500 mb-1">Ganancia Neta Total</span>
                <span className="text-2xl font-bold text-emerald-400">${gananciaNeta.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {vista === 'ganancias' && (
          <div className="bg-stone-900/40 backdrop-blur-md border border-stone-800 p-6 md:p-8 rounded-3xl max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Ganancias Mensuales</h2>
            {Object.keys(gananciasPorMes).length === 0 ? (
              <p className="text-stone-500 text-center py-10 italic">No hay pedidos con precios asignados para calcular ganancias.</p>
            ) : (
              <div className="space-y-6">
                {Object.entries(gananciasPorMes).map(([mes, datos]) => (
                  <div key={mes} className="bg-stone-950/60 border border-stone-800 p-5 rounded-2xl">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-stone-800 pb-4 mb-4">
                      <div>
                        <h3 className="text-lg font-semibold uppercase tracking-wider text-stone-300">Mes: {mes}</h3>
                        <p className="text-xs text-stone-500">{datos.cantidad} pedido(s) facturado(s)</p>
                      </div>
                      <div className="flex gap-6 text-right">
                        <div>
                          <span className="block text-[10px] text-stone-500 uppercase">Ingresos Totales</span>
                          <span className="text-base font-semibold">${datos.ingresos.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-stone-500 uppercase">Ganancia Neta</span>
                          <span className="text-xl font-bold text-emerald-400">${datos.ganancia.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Lista de pedidos del mes interactivos */}
                    <div className="space-y-3">
                      {datos.pedidos.map(p => (
                        <div 
                          key={p.id}
                          onClick={() => { setPedidoSeleccionado(p); setVista('detalle-pedido'); }}
                          className="bg-stone-900/60 border border-stone-800/80 p-4 rounded-xl cursor-pointer hover:border-stone-600 transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2"
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-stone-200">{p.cliente} - {p.prenda}</span>
                              <span className={`text-[9px] uppercase px-2 py-0.5 rounded ${p.pagado ? 'bg-emerald-900 text-emerald-300' : 'bg-stone-800 text-stone-300'}`}>
                                {p.pagado ? 'Pagado' : 'Pendiente'}
                              </span>
                            </div>
                            <p className="text-[11px] text-stone-400">Entrega: {p.entrega}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold">${p.precio.toLocaleString()}</span>
                            <span className="block text-xs text-emerald-400 font-medium">+${p.gananciaPedido.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* --- MENU FLOTANTE --- */}
      {menuAbierto && (
        <div className="fixed bottom-24 right-4 md:right-8 z-50 flex flex-col gap-3">
          <button onClick={() => {setVista('nuevo-cliente'); setMenuAbierto(false)}} className="bg-stone-800 p-4 rounded-xl text-sm border border-stone-700 hover:bg-stone-700 shadow-lg">Nuevo Cliente</button>
          <button onClick={() => {setVista('nuevo-pedido'); setMenuAbierto(false)}} className="bg-stone-800 p-4 rounded-xl text-sm border border-stone-700 hover:bg-stone-700 shadow-lg">Nuevo Pedido</button>
          <button onClick={() => {setVista('nueva-tela'); setMenuAbierto(false)}} className="bg-stone-800 p-4 rounded-xl text-sm border border-stone-700 hover:bg-stone-700 shadow-lg">Nueva Tela</button>
          <button onClick={() => {setVista('nuevo-avio'); setMenuAbierto(false)}} className="bg-stone-800 p-4 rounded-xl text-sm border border-stone-700 hover:bg-stone-700 shadow-lg">Nuevo Avío</button>
        </div>
      )}

      <button onClick={() => setMenuAbierto(!menuAbierto)} className="fixed bottom-6 right-6 md:bottom-8 md:right-8 w-14 h-14 bg-white text-stone-950 rounded-full text-2xl z-50 shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform">+</button>

      {/* Modal de Foto Ampliada */}
      {fotoAmpliada && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setFotoAmpliada(null)}
        >
          <button 
            className="absolute top-6 right-6 text-white bg-stone-900/50 p-2 rounded-full hover:bg-red-500/80 transition-colors z-[101]"
            onClick={() => setFotoAmpliada(null)}
          >
            ✕
          </button>
          <img 
            src={fotoAmpliada} 
            alt="Ampliada" 
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" 
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}

      {/* Modal UI de Confirmación con Soporte para Múltiples Botones */}
      {modalConfirm.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4">
          <div className="bg-stone-900 border border-stone-800 p-6 md:p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-white">Confirmar Acción</h3>
            <p className="text-stone-400 text-sm mb-8">{modalConfirm.text}</p>
            
            {modalConfirm.buttons ? (
              <div className="flex flex-col gap-3">
                {modalConfirm.buttons.map((btn, idx) => (
                  <button 
                    key={idx}
                    onClick={() => {
                      btn.action();
                      setModalConfirm({ isOpen: false, text: '', action: null, buttons: null });
                    }}
                    className={`w-full py-3 rounded-xl font-bold transition-colors ${btn.style}`}
                  >
                    {btn.text}
                  </button>
                ))}
                <button 
                  onClick={() => setModalConfirm({ isOpen: false, text: '', action: null, buttons: null })} 
                  className="w-full mt-2 text-stone-500 hover:text-white text-sm transition-colors py-2"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="flex gap-4">
                <button 
                  onClick={() => setModalConfirm({ isOpen: false, text: '', action: null, buttons: null })} 
                  className="flex-1 bg-stone-800 text-white py-3 rounded-xl font-bold hover:bg-stone-700 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    if (modalConfirm.action) modalConfirm.action();
                    setModalConfirm({ isOpen: false, text: '', action: null, buttons: null });
                  }} 
                  className="flex-1 bg-red-950/40 text-red-400 py-3 rounded-xl font-bold border border-red-900/50 hover:bg-red-900/40 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}