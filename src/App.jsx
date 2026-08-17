import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, getDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";

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
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

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

export default function App() {
  const [user, setUser] = useState(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [loadingRol, setLoadingRol] = useState(true);

  const [vista, setVista] = useState('dashboard');
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');
  
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const [isLoginView, setIsLoginView] = useState(true); 
  const [authLoading, setAuthLoading] = useState(true); 

  const [busquedaDashboard, setBusquedaDashboard] = useState('');
  const [filtroEstadoDashboard, setFiltroEstadoDashboard] = useState('TODOS');

  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [telaSeleccionada, setTelaSeleccionada] = useState(null);
  const [avioSeleccionado, setAvioSeleccionado] = useState(null);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  
  const [isSaving, setIsSaving] = useState(false);

  const formRef = useRef(null);
  const [formDirty, setFormDirty] = useState(false);

  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const [modalConfirm, setModalConfirm] = useState({ isOpen: false, text: '', action: null, buttons: null });

  const [modalRechazo, setModalRechazo] = useState({ isOpen: false, pedidoId: null, motivo: '' });
  
  // Modal para agregar pago parcial táctil
  const [modalPago, setModalPago] = useState({ isOpen: false, pedidoId: null });
  const [montoPagoInput, setMontoPagoInput] = useState('');
  const [metodoPagoInput, setMetodoPagoInput] = useState('Efectivo');
  
  const [editandoEstadoId, setEditandoEstadoId] = useState(null);
  const [nuevoEstadoTexto, setNuevoEstadoTexto] = useState('');

  const [clientes, setClientes] = useState(INITIAL_CLIENTES);
  const [pedidos, setPedidos] = useState(INITIAL_PEDIDOS);
  const [telas, setTelas] = useState(INITIAL_TELAS);
  const [avios, setAvios] = useState(INITIAL_AVIOS);

  const [calc, setCalc] = useState({ cm: 0, costoMetro: 0, avios: 0, horas: 0, valorHora: 0, margen: 0, precioPersonalizado: 0 });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setLoadingRol(true);
        try {
          const docRef = doc(db, "usuarios_roles", currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().rol === 'admin') {
            setEsAdmin(true);
          } else {
            setEsAdmin(false);
          }
        } catch (err) {
          console.error("Error consultando rol:", err);
          setEsAdmin(false);
        }
        setLoadingRol(false);
        window.history.replaceState({ vista: 'dashboard' }, '');
      } else {
        setEsAdmin(false);
        setLoadingRol(false);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const handlePopState = (event) => {
      if (fotoAmpliada) {
        setFotoAmpliada(null);
        window.history.pushState({ vista }, '');
        return;
      }
      if (modalConfirm.isOpen) {
        setModalConfirm({ isOpen: false, text: '', action: null, buttons: null });
        window.history.pushState({ vista }, '');
        return;
      }
      if (modalRechazo.isOpen) {
        setModalRechazo({ isOpen: false, pedidoId: null, motivo: '' });
        window.history.pushState({ vista }, '');
        return;
      }
      if (modalPago.isOpen) {
        setModalPago({ isOpen: false, pedidoId: null });
        window.history.pushState({ vista }, '');
        return;
      }
      if (menuAbierto) {
        setMenuAbierto(false);
        window.history.pushState({ vista }, '');
        return;
      }

      const targetVista = event.state?.vista || 'dashboard';

      if ((vista === 'nuevo-cliente' || vista === 'editar-cliente') && formDirty) {
        window.history.pushState({ vista }, ''); 
        setModalConfirm({
          isOpen: true,
          text: "⚠️ Tienes información sin guardar. ¿Qué deseas hacer?",
          buttons: [
            { text: "Salir sin guardar", action: () => { setFormDirty(false); window.history.pushState({ vista: targetVista }, ''); setVista(targetVista); }, style: "bg-red-950/40 text-red-400 border border-red-900/50 hover:bg-red-900/40" },
            { text: "Guardar ahora", action: () => { if(formRef.current) formRef.current.requestSubmit(); }, style: "bg-white text-stone-950 hover:bg-stone-200" }
          ]
        });
        return;
      }

      if (event.state && event.state.vista) {
        setVista(event.state.vista);
      } else {
        setVista('dashboard');
      }
      setFormDirty(false);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user, fotoAmpliada, modalConfirm.isOpen, modalRechazo.isOpen, modalPago.isOpen, menuAbierto, vista, formDirty]);

  const cambiarVista = (nuevaVista) => {
    if ((vista === 'nuevo-cliente' || vista === 'editar-cliente') && formDirty) {
      setModalConfirm({
        isOpen: true,
        text: "⚠️ Tienes información sin guardar. ¿Qué deseas hacer?",
        buttons: [
          { text: "Salir sin guardar", action: () => { setFormDirty(false); window.history.pushState({ vista: nuevaVista }, ''); setVista(nuevaVista); setMenuAbierto(false); }, style: "bg-red-950/40 text-red-400 border border-red-900/50 hover:bg-red-900/40" },
          { text: "Guardar ahora", action: () => { if(formRef.current) formRef.current.requestSubmit(); }, style: "bg-white text-stone-950 hover:bg-stone-200" }
        ]
      });
      return;
    }

    window.history.pushState({ vista: nuevaVista }, '');
    setVista(nuevaVista);
    setMenuAbierto(false);
    setFormDirty(false);
  };

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
      const clienteABorrar = clientes.find(c => c.id === id);
      if (clienteABorrar) {
        const pedidosDelCliente = pedidos.filter(p => p.cliente === clienteABorrar.nombre);
        const promesasDeBorrado = pedidosDelCliente.map(p => deleteDoc(doc(db, "pedidos", String(p.id))));
        await Promise.all(promesasDeBorrado);
      }
      await deleteDoc(doc(db, "clientes", String(id)));
      if (clienteSeleccionado?.id === id) cambiarVista('clientes');
    } catch (err) {
      alert("Error al eliminar cliente: " + err.message);
    }
  };
  
  const borrarTela = async (id) => {
    try {
      await deleteDoc(doc(db, "telas", String(id)));
      if (telaSeleccionada?.id === id) cambiarVista('catalogo');
    } catch (err) {
      alert("Error al eliminar tela: " + err.message);
    }
  };

  const borrarAvio = async (id) => {
    try {
      await deleteDoc(doc(db, "avios", String(id)));
      if (avioSeleccionado?.id === id) cambiarVista('catalogo-avios');
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
      
      setFormDirty(false);
      cambiarVista('clientes');
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
      
      setFormDirty(false);
      cambiarVista('detalle-cliente');
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
      cambiarVista('catalogo');
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
      cambiarVista('detalle-tela');
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
      cambiarVista('catalogo-avios');
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
      cambiarVista('detalle-avio');
    } catch (err) {
      alert("Error al actualizar avío: " + err.message);
    }
  };

  const crearPedido = async (e) => {
    e.preventDefault();
    if (isSaving) return; 
    setIsSaving(true);
    try {
      const fd = new FormData(e.target);
      const timestamp = Date.now();
      
      const numeroSecuencial = pedidos.length > 0 ? pedidos.length + 1 : 1;
      const id = 'PED-' + String(numeroSecuencial).padStart(3, '0');

      const nombreCliente = esAdmin ? fd.get('clienteNombre') : (user.displayName || user.email);
      const telefonoCliente = esAdmin ? '' : (fd.get('telefono') || '');
      const descripcionDetalle = esAdmin ? '' : (fd.get('descripcionDetalle') || '');

      const estadoInicial = esAdmin ? 'Eligiendo telas' : 'Pendiente de Aprobación';

      const nuevo = { 
          id,
          createdAt: timestamp,
          cliente: nombreCliente, 
          telefono: telefonoCliente,
          prenda: fd.get('prenda'), 
          estado: estadoInicial, 
          entrega: '', 
          descripcionDetalle: descripcionDetalle,
          precio: 0, 
          pagado: false,
          pagos: [], 
          tela: fd.get('tela') || '',
          foto: fd.get('foto') || '',
          fotos: fd.get('foto') ? [fd.get('foto')] : [],
          ocultoDashboard: false,
          materialesCosto: 0,
          manoObraCosto: 0,
          gastos: 0,
          motivoRechazo: ''
      };

      await setDoc(doc(db, "pedidos", String(id)), nuevo);

      if (!esAdmin) {
        const nombreBuscado = nombreCliente.toLowerCase();
        const telefonoBuscado = telefonoCliente.trim();

        const clienteEncontrado = clientes.find(c => {
          const coincideNombre = c.nombre && c.nombre.toLowerCase() === nombreBuscado;
          const coincideTelefono = telefonoBuscado && c.telefono && c.telefono.trim() === telefonoBuscado;
          return coincideNombre || coincideTelefono;
        });

        if (!clienteEncontrado) {
          const nuevoClienteId = Date.now();
          const medidasVacias = {};
          MEDIDAS_LISTA.forEach(m => medidasVacias[m] = '');
          const fichaCliente = {
            id: nuevoClienteId,
            nombre: nombreCliente,
            telefono: telefonoBuscado,
            medidas: medidasVacias
          };
          await setDoc(doc(db, "clientes", String(nuevoClienteId)), fichaCliente);
        } else if (!clienteEncontrado.telefono && telefonoBuscado) {
          const clienteActualizado = {
            ...clienteEncontrado,
            telefono: telefonoBuscado
          };
          await setDoc(doc(db, "clientes", String(clienteEncontrado.id)), clienteActualizado);
        }
      }

      cambiarVista('dashboard');
    } catch (err) {
      alert("Error al crear pedido: " + err.message);
    } finally {
      setIsSaving(false);
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
          manoObraCosto: manoObra,
          gastos: materiales
        };
        await setDoc(doc(db, "pedidos", String(pedidoId)), actualizado, { merge: true });
      }
      cambiarVista('dashboard');
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
        await setDoc(doc(db, "pedidos", String(id)), { ...pedido, estado: nuevoEstado, motivoRechazo: nuevoEstado === 'Rechazado' ? pedido.motivoRechazo : '' }, { merge: true });
        if (pedidoSeleccionado?.id === id) {
          setPedidoSeleccionado(prev => ({ ...prev, estado: nuevoEstado }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const aceptarSolicitud = async (id) => {
    try {
      const pedido = pedidos.find(p => p.id === id);
      if (pedido) {
        await setDoc(doc(db, "pedidos", String(id)), { ...pedido, estado: 'Eligiendo telas', motivoRechazo: '' }, { merge: true });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const registrarPagoParcial = async () => {
    if (!modalPago.pedidoId) return;
    const monto = Number(montoPagoInput);
    if (!monto || monto <= 0) {
      alert("Ingresa un monto válido");
      return;
    }
    try {
      const pedido = pedidos.find(p => p.id === modalPago.pedidoId);
      if (!pedido) return;

      const pagosActuales = pedido.pagos || [];
      const nuevoPago = {
        id: Date.now(),
        monto,
        metodo: metodoPagoInput,
        fecha: new Date().toLocaleDateString()
      };
      const listaActualizada = [...pagosActuales, nuevoPago];
      const totalAbonado = listaActualizada.reduce((acc, curr) => acc + curr.monto, 0);
      const estaPagado = pedido.precio > 0 && totalAbonado >= pedido.precio;

      const actualizado = {
        ...pedido,
        pagos: listaActualizada,
        pagado: estaPagado
      };

      await setDoc(doc(db, "pedidos", String(pedido.id)), actualizado, { merge: true });
      if (pedidoSeleccionado?.id === pedido.id) {
        setPedidoSeleccionado(actualizado);
      }
      setModalPago({ isOpen: false, pedidoId: null });
      setMontoPagoInput('');
    } catch (err) {
      alert("Error al registrar pago: " + err.message);
    }
  };

  const eliminarPagoParcial = async (pagoId) => {
    if (!pedidoSeleccionado) return;
    try {
      const pagosActuales = pedidoSeleccionado.pagos || [];
      const listaActualizada = pagosActuales.filter(p => p.id !== pagoId);
      const totalAbonado = listaActualizada.reduce((acc, curr) => acc + curr.monto, 0);
      const estaPagado = pedidoSeleccionado.precio > 0 && totalAbonado >= pedidoSeleccionado.precio;

      const actualizado = {
        ...pedidoSeleccionado,
        pagos: listaActualizada,
        pagado: estaPagado
      };

      await setDoc(doc(db, "pedidos", String(pedidoSeleccionado.id)), actualizado, { merge: true });
      setPedidoSeleccionado(actualizado);
    } catch (err) {
      alert("Error al eliminar pago: " + err.message);
    }
  };

  const confirmarRechazoAdmin = async () => {
    if (!modalRechazo.pedidoId) return;
    try {
      const pedido = pedidos.find(p => p.id === modalRechazo.pedidoId);
      if (pedido) {
        await setDoc(doc(db, "pedidos", String(modalRechazo.pedidoId)), { 
          ...pedido, 
          estado: 'Rechazado', 
          motivoRechazo: modalRechazo.motivo,
          ocultoDashboard: true 
        }, { merge: true });
      }
      setModalRechazo({ isOpen: false, pedidoId: null, motivo: '' });
    } catch (err) {
      alert("Error al rechazar pedido: " + err.message);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isLoginView) {
        await signInWithEmailAndPassword(auth, loginUser, loginPass);
      } else {
        await createUserWithEmailAndPassword(auth, loginUser, loginPass);
      }
    } catch (err) {
      if (err.code === 'auth/invalid-credential') setError('Correo o contraseña incorrectos');
      else if (err.code === 'auth/email-already-in-use') setError('El correo ya está registrado');
      else if (err.code === 'auth/weak-password') setError('La contraseña debe tener al menos 6 caracteres');
      else setError(err.message);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Error al salir:", err);
    }
  };

  const pedidosVisibles = pedidos.filter(p => {
    if (p.ocultoDashboard) return false;
    
    if (!esAdmin) {
      const nombreUsuario = user.displayName || user.email;
      if (p.cliente !== nombreUsuario) return false;
    } else {
      if (p.estado === 'Pendiente de Aprobación' || p.estado === 'Rechazado') return false;
    }

    const coincideFiltro = filtroEstadoDashboard === 'TODOS' || p.estado === filtroEstadoDashboard;
    const textoBusqueda = busquedaDashboard.trim().toLowerCase();
    const coincideBusqueda = !textoBusqueda || 
      p.cliente.toLowerCase().includes(textoBusqueda) || 
      p.prenda.toLowerCase().includes(textoBusqueda) ||
      p.id.toLowerCase().includes(textoBusqueda);
    return coincideFiltro && coincideBusqueda;
  }).sort((a, b) => {
    const timeA = Number(a.createdAt) || Number(a.id.replace('PED-', '')) || 0;
    const timeB = Number(b.createdAt) || Number(b.id.replace('PED-', '')) || 0;
    return timeB - timeA;
  });

  const solicitudesPendientesAdmin = pedidos.filter(p => {
    if (p.ocultoDashboard) return false;
    return p.estado === 'Pendiente de Aprobación';
  }).sort((a, b) => {
    const timeA = Number(a.createdAt) || Number(a.id.replace('PED-', '')) || 0;
    const timeB = Number(b.createdAt) || Number(b.id.replace('PED-', '')) || 0;
    return timeB - timeA;
  });

  const pedidosParaCalculadora = pedidos.filter(p => !p.ocultoDashboard).sort((a, b) => {
    const timeA = Number(a.createdAt) || Number(a.id.replace('PED-', '')) || 0;
    const timeB = Number(b.createdAt) || Number(b.id.replace('PED-', '')) || 0;
    return timeB - timeA;
  });

  const clientesFiltrados = clientes.filter(c => c.nombre.toLowerCase().includes(busqueda.toLowerCase()));

  const gananciasPorMes = pedidos.reduce((acc, p) => {
    if (!p.entrega || p.precio <= 0) return acc;
    const mesAnio = p.entrega.slice(0, 7);
    const gastos = p.gastos || 0;
    const gananciaPedido = p.precio > 0 ? (p.precio - gastos) : 0;
    
    if (!acc[mesAnio]) {
      acc[mesAnio] = { ingresos: 0, ganancia: 0, cantidad: 0, pedidos: [] };
    }
    acc[mesAnio].ingresos += p.precio;
    acc[mesAnio].ganancia += gananciaPedido;
    acc[mesAnio].cantidad += 1;
    acc[mesAnio].pedidos.push({ ...p, gananciaPedido });
    return acc;
  }, {});

  if (authLoading || loadingRol) {
    return <div className="min-h-screen bg-stone-950 flex justify-center items-center text-stone-400">Cargando aplicación...</div>;
  }

  if (!user) {
    return (
        <div translate="no" className="notranslate min-h-screen bg-stone-950 text-white flex items-center justify-center p-4 md:p-8 font-sans">
            <div className={`p-6 md:p-8 rounded-3xl w-full max-w-sm backdrop-blur-xl transition-all duration-500 border ${isLoginView ? 'bg-stone-900/40 border-stone-800' : 'bg-stone-900/60 border-stone-600 shadow-2xl shadow-stone-800/50'}`}>
                
                <h1 className="text-3xl font-bold mb-1 text-center tracking-tighter">
                  {isLoginView ? 'Atelier' : 'Nueva Cuenta'}
                </h1>
                <p className="text-center text-stone-400 text-sm mb-8 transition-opacity">
                  {isLoginView ? 'Ingresa para continuar' : 'Regístrate para solicitar pedidos'}
                </p>
                
                <form onSubmit={handleEmailAuth} className="space-y-4">
                    <input 
                        type="email"
                        placeholder="Correo electrónico" 
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
                    
                    <button 
                      type="submit" 
                      className={`w-full py-3 rounded-xl font-bold transition-all duration-300 ${isLoginView ? 'bg-white text-stone-950 hover:bg-stone-200' : 'bg-stone-800 text-white hover:bg-stone-700 border border-stone-600'}`}
                    >
                        {isLoginView ? 'Iniciar Sesión' : 'Registrarme'}
                    </button>
                </form>

                <div className="mt-6 flex items-center justify-center space-x-2">
                    <div className="h-px bg-stone-800 w-full"></div>
                    <span className="text-xs text-stone-500 uppercase tracking-widest">O</span>
                    <div className="h-px bg-stone-800 w-full"></div>
                </div>

                <button 
                    onClick={handleGoogleLogin} 
                    type="button" 
                    className="w-full mt-6 bg-stone-950 text-white py-3 rounded-xl font-bold border border-stone-800 hover:bg-stone-900 transition-colors flex items-center justify-center gap-2"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continuar con Google
                </button>

                <p className="mt-6 text-center text-sm text-stone-400">
                    {isLoginView ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
                    <button 
                        onClick={() => setIsLoginView(!isLoginView)} 
                        className="text-white hover:underline font-bold transition-colors"
                    >
                        {isLoginView ? 'Regístrate aquí' : 'Inicia sesión'}
                    </button>
                </p>

            </div>
        </div>
    );
  }

  return (
    <div translate="no" className="notranslate min-h-screen bg-stone-950 text-white p-4 md:p-8 font-sans selection:bg-white selection:text-stone-950">
      <div className="fixed inset-0 opacity-20 pointer-events-none bg-[url('https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070')] bg-cover bg-center" />

      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .print-ficha-exclusiva, .print-ficha-exclusiva * {
            visibility: visible !important;
          }
          .print-ficha-exclusiva {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: white !important;
            color: black !important;
            z-index: 999999;
            padding: 20px;
            display: block !important;
          }
        }
      `}</style>

      <nav className="relative z-10 max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center mb-8 md:mb-12 gap-4">
        <h1 className="text-2xl font-bold tracking-tighter cursor-pointer self-start md:self-auto" onClick={() => cambiarVista('dashboard')}>
          Atelier {esAdmin ? <span className="text-xs bg-stone-800 text-stone-300 px-2 py-0.5 rounded-full ml-2">Admin</span> : <span className="text-xs bg-stone-800 text-stone-300 px-2 py-0.5 rounded-full ml-2">Cliente</span>}
        </h1>
        <div className="flex gap-4 md:gap-8 text-sm text-stone-400 font-medium overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
          <button onClick={() => cambiarVista('dashboard')} className={`whitespace-nowrap ${vista === 'dashboard' ? 'text-white' : ''}`}>Mis Pedidos</button>
          
          {esAdmin && (
            <>
              <button onClick={() => cambiarVista('solicitudes')} className={`whitespace-nowrap relative inline-flex items-center ${vista === 'solicitudes' ? 'text-white' : ''}`}>
                <span>Solicitudes</span>
                {solicitudesPendientesAdmin.length > 0 && (
                  <span className="ml-2 bg-amber-500 text-stone-950 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none inline-block">
                    {solicitudesPendientesAdmin.length}
                  </span>
                )}
              </button>
              <button onClick={() => cambiarVista('clientes')} className={`whitespace-nowrap ${vista === 'clientes' ? 'text-white' : ''}`}>Clientes</button>
              <button onClick={() => cambiarVista('catalogo')} className={`whitespace-nowrap ${vista === 'catalogo' ? 'text-white' : ''}`}>Catálogo Telas</button>
              <button onClick={() => cambiarVista('catalogo-avios')} className={`whitespace-nowrap ${vista === 'catalogo-avios' ? 'text-white' : ''}`}>Catálogo Avios</button>
              <button onClick={() => cambiarVista('calculadora')} className={`whitespace-nowrap ${vista === 'calculadora' ? 'text-white' : ''}`}>Calculadora</button>
              <button onClick={() => cambiarVista('ganancias')} className={`whitespace-nowrap ${vista === 'ganancias' ? 'text-white' : ''}`}>Ganancias</button>
            </>
          )}

          <button onClick={handleLogout} className="text-red-400 text-xs ml-auto md:ml-4 whitespace-nowrap">Salir</button>
        </div>
      </nav>

      <main className="relative z-10 max-w-6xl mx-auto">
        {vista === 'dashboard' && (
          <div>
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="w-full md:w-auto flex-1">
                <input 
                  type="text" 
                  placeholder="Buscar pedido por prenda o ID..." 
                  value={busquedaDashboard}
                  onChange={(e) => setBusquedaDashboard(e.target.value)}
                  className="w-full bg-stone-900/50 border border-stone-800 p-4 rounded-2xl outline-none text-sm text-white backdrop-blur-md" 
                />
              </div>
              {!esAdmin && (
                <button 
                  onClick={() => cambiarVista('nuevo-pedido')}
                  className="w-full md:w-auto bg-white text-stone-950 px-6 py-4 rounded-2xl font-bold text-sm whitespace-nowrap hover:bg-stone-200 transition-colors"
                >
                  + Solicitar Pedido
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {pedidosVisibles.length === 0 ? (
                <p className="col-span-full text-stone-500 text-center py-10 italic">No tienes pedidos activos registrados.</p>
              ) : (
                pedidosVisibles.map(p => {
                  const gastos = p.gastos || 0;
                  const gananciaPedido = p.precio > 0 ? (p.precio - gastos) : 0;
                  const esRechazado = p.estado === 'Rechazado';
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => { setPedidoSeleccionado(p); cambiarVista('detalle-pedido'); }} 
                      className={`bg-stone-900/40 backdrop-blur-md border p-6 rounded-3xl relative cursor-pointer transition-colors ${esRechazado ? 'border-red-900/60 bg-red-950/10' : 'border-stone-800 hover:border-stone-600'}`}
                    >
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (esAdmin) {
                            setModalConfirm({ 
                              isOpen: true, 
                              text: "¿Qué deseas hacer con este pedido?", 
                              buttons: [
                                { text: "Solo quitar del Dashboard", action: () => ocultarPedidoDashboard(p.id), style: "bg-stone-800 text-white hover:bg-stone-700" },
                                { text: "Eliminar definitivamente (Historial)", action: () => borrarPedidoDefinitivo(p.id), style: "bg-red-950/40 text-red-400 border border-red-900/50 hover:bg-red-900/40" }
                              ]
                            }); 
                          } else {
                            setModalConfirm({ 
                              isOpen: true, 
                              text: "¿Estás seguro de que quieres eliminar esta solicitud de pedido?", 
                              action: () => borrarPedidoDefinitivo(p.id) 
                            });
                          }
                        }} 
                        className="absolute top-4 right-4 text-stone-600 hover:text-red-400 text-xs"
                      >
                        ✕
                      </button>
                      
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-[10px] uppercase tracking-widest text-stone-500">{p.id}</span>
                        <span className={`text-[10px] uppercase px-2 py-1 rounded ${esRechazado ? 'bg-red-950 text-red-400 border border-red-900/50' : (p.pagado ? 'bg-emerald-900 text-emerald-300' : 'bg-stone-800 text-stone-300')}`}>
                          {esRechazado ? 'Rechazado' : (p.pagado ? 'Pagado' : 'Pendiente de Pago')}
                        </span>
                      </div>

                      <h3 className="text-lg font-semibold">{esAdmin ? p.cliente : p.prenda}</h3>
                      {esAdmin && <p className="text-stone-400 text-sm mb-2">{p.prenda} {p.tela && `(${p.tela})`}</p>}

                      {esAdmin ? (
                        <div onClick={(e) => e.stopPropagation()} className="mb-2">
                          {editandoEstadoId === p.id ? (
                            <div className="flex gap-1 mt-1">
                              <input 
                                type="text"
                                value={nuevoEstadoTexto}
                                onChange={(e) => setNuevoEstadoTexto(e.target.value)}
                                className="w-full bg-stone-950 border border-stone-700 p-1.5 rounded-xl text-xs text-white outline-none"
                                placeholder="Escribe el estado..."
                                autoFocus
                              />
                              <button 
                                onClick={async () => {
                                  if (nuevoEstadoTexto.trim()) {
                                    await actualizarEstado(p.id, nuevoEstadoTexto.trim());
                                  }
                                  setEditandoEstadoId(null);
                                }}
                                className="bg-white text-stone-950 px-2.5 rounded-xl text-xs font-bold"
                              >
                                ✓
                              </button>
                              <button 
                                onClick={() => setEditandoEstadoId(null)}
                                className="bg-stone-800 text-stone-400 px-2 rounded-xl text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between bg-stone-950/40 border border-stone-800/80 px-3 py-2 rounded-xl text-xs">
                              <span className="text-stone-300">Estado: <strong className="text-white">{p.estado}</strong></span>
                              <button 
                                onClick={() => {
                                  setEditandoEstadoId(p.id);
                                  setNuevoEstadoTexto(p.estado);
                                }}
                                className="text-stone-400 hover:text-white p-1 transition-colors"
                                title="Editar estado"
                              >
                                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-stone-400 text-sm mb-2">Estado: <strong className={esRechazado ? "text-red-400" : "text-white"}>{p.estado}</strong></p>
                      )}

                      {esRechazado && p.motivoRechazo && (
                        <div className="bg-red-950/30 border border-red-900/40 p-3 rounded-xl mb-3 text-xs text-red-300">
                          <strong>Motivo de rechazo:</strong> {p.motivoRechazo}
                        </div>
                      )}

                      {(p.fotos?.[0] || p.foto) && <img src={p.fotos?.[0] || p.foto} alt="Pedido" className="w-full h-24 object-cover rounded-xl mb-3 border border-stone-800" />}
                      
                      <div className="mb-4">
                        <p className="text-xl font-bold">{p.precio > 0 ? `$${p.precio.toLocaleString()}` : 'Presupuesto a confirmar'}</p>
                        {esAdmin && p.precio > 0 && (
                          <p className="text-xs text-emerald-400 font-medium">Ganancia: +${gananciaPedido.toLocaleString()}</p>
                        )}
                      </div>

                      {(() => {
                        const telefonoContacto = p.telefono || clientes.find(c => c.nombre.toLowerCase() === p.cliente.toLowerCase())?.telefono;
                        if (!telefonoContacto) return null;
                        const mensaje = esAdmin 
                          ? `Hola ${p.cliente}, te escribo desde Atelier por tu pedido de ${p.prenda} para coordinar detalles y fotos.`
                          : `Hola, le escribo por mi pedido de ${p.prenda} (${p.id}) en Atelier.`;
                        const urlWhatsapp = `https://wa.me/${telefonoContacto.replace(/\D/g, '')}?text=${encodeURIComponent(mensaje)}`;

                        return (
                          <a
                            href={urlWhatsapp}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="mt-3 w-full bg-emerald-950/40 border border-emerald-900/50 text-emerald-300 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-emerald-900/40 transition-colors"
                          >
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                            </svg>
                            {esAdmin ? 'Coordinar por WhatsApp' : 'Contactar por WhatsApp'}
                          </a>
                        );
                      })()}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {esAdmin && vista === 'solicitudes' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Solicitudes de Pedidos Pendientes</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {solicitudesPendientesAdmin.length === 0 ? (
                <p className="col-span-full text-stone-500 text-center py-10 italic">No hay nuevas solicitudes de pedidos pendientes de aprobación.</p>
              ) : (
                solicitudesPendientesAdmin.map(p => (
                  <div key={p.id} className="bg-stone-900/40 backdrop-blur-md border border-amber-900/50 p-6 rounded-3xl relative flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-[10px] uppercase tracking-widest text-stone-500">{p.id}</span>
                        <span className="text-[10px] uppercase px-2 py-1 rounded bg-amber-950 text-amber-300 border border-amber-900/50">
                          Pendiente de Aprobación
                        </span>
                      </div>

                      <h3 className="text-lg font-semibold">{p.cliente}</h3>
                      <p className="text-stone-300 text-sm mb-2">Prenda: <strong>{p.prenda}</strong></p>
                      
                      {p.descripcionDetalle && (
                        <div className="bg-stone-950/60 border border-stone-800 p-3 rounded-xl mb-3 text-xs text-stone-300">
                          <strong className="text-stone-400 block mb-1">Detalles (Color, forma, tela):</strong>
                          {p.descripcionDetalle}
                        </div>
                      )}

                      {(p.fotos?.[0] || p.foto) && <img src={p.fotos?.[0] || p.foto} alt="Pedido" className="w-full h-24 object-cover rounded-xl mb-4 border border-stone-800" />}
                    </div>

                    <div className="flex gap-2 mt-4 pt-4 border-t border-stone-800">
                      <button 
                        onClick={() => {
                          setModalRechazo({ isOpen: true, pedidoId: p.id, motivo: '' });
                        }}
                        className="flex-1 bg-red-950/40 text-red-400 border border-red-900/50 py-2.5 rounded-xl text-xs font-bold hover:bg-red-900/40 transition-colors"
                      >
                        Rechazar
                      </button>
                      <button 
                        onClick={() => aceptarSolicitud(p.id)}
                        className="flex-1 bg-white text-stone-950 py-2.5 rounded-xl text-xs font-bold hover:bg-stone-200 transition-colors"
                      >
                        Aceptar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {vista === 'detalle-pedido' && pedidoSeleccionado && (() => {
          const arrayFotos = pedidoSeleccionado.fotos || (pedidoSeleccionado.foto ? [pedidoSeleccionado.foto] : []);
          const esRechazado = pedidoSeleccionado.estado === 'Rechazado';
          
          const pagosRealizados = pedidoSeleccionado.pagos || [];
          const totalAbonado = pagosRealizados.reduce((acc, curr) => acc + curr.monto, 0);
          const precioTotal = pedidoSeleccionado.precio || 0;
          const saldoPendiente = Math.max(0, precioTotal - totalAbonado);
          const porcentajePagado = precioTotal > 0 ? Math.min(100, Math.round((totalAbonado / precioTotal) * 100)) : 0;

          return (
            <div className={`bg-stone-900/40 backdrop-blur-md border p-6 md:p-10 rounded-3xl max-w-3xl mx-auto relative ${esRechazado ? 'border-red-900/60' : 'border-stone-800'}`}>
              <button onClick={() => cambiarVista('dashboard')} className="absolute top-6 right-6 text-stone-400 hover:text-white bg-stone-800/50 px-3 py-1.5 rounded-xl text-xs">Volver</button>
              
              <h2 className="text-2xl font-bold mb-1">Detalle del Pedido</h2>
              <p className="text-stone-400 text-sm mb-6">Cliente: {pedidoSeleccionado.cliente}</p>

              {esRechazado && pedidoSeleccionado.motivoRechazo && (
                <div className="bg-red-950/40 border border-red-900/60 p-4 rounded-2xl mb-6 text-sm text-red-300">
                  <strong>Solicitud Rechazada.</strong> Motivo: {pedidoSeleccionado.motivoRechazo}
                </div>
              )}
              
              {esAdmin ? (
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      const fd = new FormData(e.target);
                      const nuevoEstado = fd.get('estado');
                      const actualizado = {
                          ...pedidoSeleccionado,
                          prenda: fd.get('prenda'),
                          tela: fd.get('tela'),
                          precio: Number(fd.get('precio')),
                          gastos: Number(fd.get('gastos')) || 0,
                          estado: nuevoEstado,
                          motivoRechazo: nuevoEstado === 'Rechazado' ? pedidoSeleccionado.motivoRechazo : '',
                          ocultoDashboard: nuevoEstado === 'Rechazado' ? true : pedidoSeleccionado.ocultoDashboard
                      };
                      await setDoc(doc(db, "pedidos", String(pedidoSeleccionado.id)), actualizado, { merge: true });
                      setPedidoSeleccionado(actualizado);
                      cambiarVista('dashboard');
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
                            <label className="text-stone-500 pl-1 text-xs">Tela</label>
                            <select name="tela" defaultValue={pedidoSeleccionado.tela} className="w-full bg-stone-950 p-3 rounded-xl border border-stone-800 outline-none">
                                <option value="">Ninguna</option>
                                {telas.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-stone-500 pl-1 text-xs">Precio Total ($)</label>
                            <input name="precio" type="number" defaultValue={pedidoSeleccionado.precio} className="w-full bg-stone-950 p-3 rounded-xl border border-stone-800 outline-none" />
                        </div>
                        <div>
                            <label className="text-stone-500 pl-1 text-xs">Gastos ($)</label>
                            <input name="gastos" type="number" defaultValue={pedidoSeleccionado.gastos !== undefined ? pedidoSeleccionado.gastos : 0} className="w-full bg-stone-950 p-3 rounded-xl border border-stone-800 outline-none" />
                        </div>
                        <div className="col-span-1 sm:col-span-2">
                            <label className="text-stone-500 pl-1 text-xs">Estado Logístico / Confección (Punto 4)</label>
                            <select name="estado" defaultValue={pedidoSeleccionado.estado} className="w-full bg-stone-950 p-3 rounded-xl border border-stone-800 outline-none font-bold text-white" required>
                                <option value="Pendiente de Aprobación">Pendiente de Aprobación</option>
                                <option value="Eligiendo telas">Eligiendo telas</option>
                                <option value="En confección / Pruebas">En confección / Pruebas</option>
                                <option value="Listo para retirar en el taller">Listo para retirar en el taller</option>
                                <option value="En camino (Envío a domicilio)">En camino (Envío a domicilio)</option>
                                <option value="Entregado con éxito">Entregado con éxito</option>
                                <option value="Rechazado">Rechazado</option>
                            </select>
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-stone-800 text-white py-3 rounded-xl font-bold mb-6 hover:bg-stone-700">Guardar Información</button>
                </form>
              ) : (
                <div className="space-y-4 mb-6 text-sm bg-stone-950/50 p-4 rounded-2xl border border-stone-800">
                  <p><strong>Prenda:</strong> {pedidoSeleccionado.prenda}</p>
                  {pedidoSeleccionado.descripcionDetalle && (
                    <p><strong>Detalles (Color, forma, tela):</strong> {pedidoSeleccionado.descripcionDetalle}</p>
                  )}
                  <p><strong>Estado Actual:</strong> <span className={esRechazado ? "text-red-400 font-bold" : "text-white font-bold"}>{pedidoSeleccionado.estado}</span></p>
                  <p><strong>Precio Total:</strong> {pedidoSeleccionado.precio > 0 ? `$${pedidoSeleccionado.precio.toLocaleString()}` : 'A presupuestar'}</p>
                </div>
              )}

              {/* SECCIÓN PUNTO 3: CONTROL DE PAGOS Y CUOTAS (Visible en PC y Celu) */}
              <div className="bg-stone-950/80 border border-stone-800 p-6 rounded-2xl mb-6 shadow-inner">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                  <h3 className="text-base font-bold text-white">Control de Pagos y Adelantos</h3>
                  <span className={`text-xs px-3 py-1.5 rounded-full font-bold ${pedidoSeleccionado.pagado ? 'bg-emerald-950 text-emerald-300 border border-emerald-900/50' : 'bg-amber-950 text-amber-300 border border-amber-900/50'}`}>
                    {pedidoSeleccionado.pagado ? 'Pagado Total' : `Saldo Pendiente: $${saldoPendiente.toLocaleString()}`}
                  </span>
                </div>

                {/* Barra de progreso */}
                <div className="w-full bg-stone-900 h-3 rounded-full overflow-hidden mb-4 border border-stone-800">
                  <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${porcentajePagado}%` }}></div>
                </div>

                <div className="flex justify-between text-xs text-stone-400 mb-5">
                  <span>Abonado: <strong className="text-white">${totalAbonado.toLocaleString()}</strong></span>
                  <span>Total prenda: <strong className="text-white">${precioTotal.toLocaleString()}</strong> ({porcentajePagado}%)</span>
                </div>

                {/* Lista de pagos parciales */}
                {pagosRealizados.length > 0 && (
                  <div className="space-y-2.5 mb-5">
                    <p className="text-xs text-stone-400 uppercase tracking-wider font-semibold">Historial de entregas de dinero:</p>
                    {pagosRealizados.map((pago) => (
                      <div key={pago.id} className="flex justify-between items-center bg-stone-900/90 p-3 rounded-xl border border-stone-800 text-xs">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-emerald-400 text-sm">${pago.monto.toLocaleString()}</span>
                          <span className="bg-stone-800 text-stone-300 px-2 py-0.5 rounded text-[11px]">{pago.metodo}</span>
                          <span className="text-stone-500 text-[11px]">{pago.fecha}</span>
                        </div>
                        {esAdmin && (
                          <button 
                            onClick={() => eliminarPagoParcial(pago.id)}
                            className="text-stone-400 hover:text-red-400 p-1 font-bold text-sm"
                            title="Eliminar pago"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Botón táctil para agregar nuevo pago (visible para admin en PC y celu) */}
                {esAdmin && (
                  <button
                    onClick={() => setModalPago({ isOpen: true, pedidoId: pedidoSeleccionado.id })}
                    className="w-full bg-white text-stone-950 py-3.5 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-2 hover:bg-stone-200 transition-colors shadow-lg active:scale-98"
                  >
                    + Registrar Nuevo Pago / Seña
                  </button>
                )}
              </div>

              {(() => {
                const telefonoContacto = pedidoSeleccionado.telefono || clientes.find(c => c.nombre.toLowerCase() === pedidoSeleccionado.cliente.toLowerCase())?.telefono;
                if (!telefonoContacto) return null;
                const mensaje = esAdmin 
                  ? `Hola ${pedidoSeleccionado.cliente}, te escribo desde Atelier por tu pedido de ${pedidoSeleccionado.prenda}.`
                  : `Hola, le escribo por los detalles de mi pedido de ${pedidoSeleccionado.prenda} (${pedidoSeleccionado.id}).`;
                const urlWhatsapp = `https://wa.me/${telefonoContacto.replace(/\D/g, '')}?text=${encodeURIComponent(mensaje)}`;

                return (
                  <a
                    href={urlWhatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-8 w-full bg-emerald-950/40 border border-emerald-900/50 text-emerald-300 py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-emerald-900/40 transition-colors block text-center"
                  >
                    <svg className="w-4 h-4 fill-current inline-block" viewBox="0 0 24 24">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                    </svg>
                    {esAdmin ? 'Abrir chat de WhatsApp con el cliente' : 'Contactar con el Atelier por WhatsApp'}
                  </a>
                );
              })()}

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

              {esAdmin && (
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
              )}
            </div>
          );
        })()}

        {vista === 'nuevo-pedido' && (
           <form onSubmit={crearPedido} className="bg-stone-900/40 p-6 md:p-8 rounded-3xl border border-stone-800 max-w-lg mx-auto">
             <h2 className="text-2xl font-bold mb-6">Solicitar Nuevo Pedido</h2>
             
             {esAdmin ? (
               <select name="clienteNombre" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" required>
                 <option value="">Seleccionar Cliente</option>
                 {clientes.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
               </select>
             ) : (
               <div className="mb-4 bg-stone-950 p-3 rounded-xl border border-stone-800 text-sm text-stone-400">
                 Cliente: <span className="text-white font-bold">{user.displayName || user.email}</span>
               </div>
             )}

             <input name="prenda" placeholder="¿Qué prenda deseas mandar a hacer?" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" required />
             
             {!esAdmin && (() => {
               const nombreActual = user.displayName || user.email;
               const clienteExistente = clientes.find(c => c.nombre && c.nombre.toLowerCase() === nombreActual.toLowerCase());
               const tieneTelefonoRegistrado = clienteExistente && clienteExistente.telefono && clienteExistente.telefono.trim() !== '';

               if (tieneTelefonoRegistrado) {
                 return <input type="hidden" name="telefono" value={clienteExistente.telefono} />;
               }

               return (
                 <input name="telefono" placeholder="Teléfono Móvil (Ej: 3434...)" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" required />
               );
             })()}

             <div>
               <label className="block text-xs text-stone-400 mb-1">Descripción del pedido (Color, forma, tela...)</label>
               <textarea 
                 name="descripcionDetalle" 
                 rows="3" 
                 placeholder="Detalla aquí color, forma, tipo de tela, etc..." 
                 className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none text-sm text-white resize-none" 
                 required 
               />
             </div>
             
             {esAdmin && (
               <>
                 <select name="tela" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none">
                   <option value="">Seleccionar Tela (Opcional)</option>
                   {telas.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                 </select>
                 <input name="foto" placeholder="URL Foto del Pedido (Opcional)" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
               </>
             )}

             <div className="flex gap-3">
               <button type="button" onClick={() => cambiarVista('dashboard')} className="w-full bg-stone-800 text-white py-3 rounded-xl font-bold hover:bg-stone-700">Cancelar</button>
               <button type="submit" disabled={isSaving} className="w-full bg-white text-stone-950 py-3 rounded-xl font-bold">
                 {isSaving ? 'Enviando...' : 'Enviar Solicitud'}
               </button>
             </div>
           </form>
        )}

        {esAdmin && vista === 'nuevo-cliente' && (
           <form ref={formRef} onChange={() => setFormDirty(true)} onSubmit={guardarCliente} className="bg-stone-900/40 p-6 md:p-8 rounded-3xl border border-stone-800 max-w-lg mx-auto">
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
             
             <div className="flex gap-3 mt-4">
               <button type="button" onClick={() => cambiarVista('clientes')} className="w-full bg-stone-800 text-white py-3 rounded-xl font-bold">Cancelar</button>
               <button type="submit" disabled={isSaving} className="w-full bg-white text-stone-950 py-3 rounded-xl font-bold">Guardar</button>
             </div>
           </form>
        )}

        {esAdmin && vista === 'editar-cliente' && clienteSeleccionado && (
           <form ref={formRef} onChange={() => setFormDirty(true)} onSubmit={actualizarCliente} className="bg-stone-900/40 p-6 md:p-8 rounded-3xl border border-stone-800 max-w-lg mx-auto">
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
             
             <div className="flex gap-3 mt-4">
               <button type="button" onClick={() => cambiarVista('detalle-cliente')} className="w-full bg-stone-800 text-white py-3 rounded-xl font-bold">Cancelar</button>
               <button type="submit" className="w-full bg-white text-stone-950 py-3 rounded-xl font-bold">Guardar Cambios</button>
             </div>
           </form>
        )}

        {esAdmin && vista === 'nueva-tela' && (
           <form onSubmit={guardarTela} className="bg-stone-900/40 p-6 md:p-8 rounded-3xl border border-stone-800 max-w-lg mx-auto">
             <h2 className="text-2xl font-bold mb-6">Nueva Tela</h2>
             <input name="nombre" placeholder="Nombre" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" required />
             <input name="desc" placeholder="Descripción" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <input name="uso" placeholder="Uso" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <input name="stock" placeholder="Stock" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <input name="precio" type="number" placeholder="Precio por metro ($)" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <input name="foto" placeholder="URL Foto" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <button type="submit" className="w-full mt-6 bg-white text-stone-950 py-3 rounded-xl font-bold">Guardar Tela</button>
           </form>
        )}

        {esAdmin && vista === 'nuevo-avio' && (
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

        {esAdmin && vista === 'editar-tela' && telaSeleccionada && (
           <form onSubmit={actualizarTelaEditada} className="bg-stone-900/40 p-6 md:p-8 rounded-3xl border border-stone-800 max-w-lg mx-auto">
             <h2 className="text-2xl font-bold mb-6">Editar Tela</h2>
             <input name="nombre" defaultValue={telaSeleccionada.nombre} placeholder="Nombre" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" required />
             <input name="desc" defaultValue={telaSeleccionada.descripcion} placeholder="Descripción" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <input name="uso" defaultValue={telaSeleccionada.uso} placeholder="Uso" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <input name="stock" defaultValue={telaSeleccionada.stock} placeholder="Stock" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <input name="precio" type="number" defaultValue={telaSeleccionada.precio || ''} placeholder="Precio por metro ($)" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <input name="foto" defaultValue={telaSeleccionada.foto} placeholder="URL Foto" className="w-full bg-stone-950 p-3 rounded-xl mb-4 border border-stone-800 outline-none" />
             <button type="submit" className="w-full mt-6 bg-white text-stone-950 py-3 rounded-xl font-bold">Guardar Cambios</button>
           </form>
        )}

        {esAdmin && vista === 'editar-avio' && avioSeleccionado && (
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

        {esAdmin && vista === 'catalogo' && (
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
                      <img src={t.foto} alt={t.nombre} className="w-full h-32 object-cover cursor-pointer" onClick={() => { setTelaSeleccionada(t); cambiarVista('detalle-tela'); }} />
                      <div className="p-4">
                        <h3 className="font-bold cursor-pointer hover:underline" onClick={() => { setTelaSeleccionada(t); cambiarVista('detalle-tela'); }}>{t.nombre}</h3>
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

        {esAdmin && vista === 'catalogo-avios' && (
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
                      <img src={a.foto} alt={a.nombre} className="w-full h-32 object-cover cursor-pointer" onClick={() => { setAvioSeleccionado(a); cambiarVista('detalle-avio'); }} />
                      <div className="p-4">
                        <h3 className="font-bold cursor-pointer hover:underline" onClick={() => { setAvioSeleccionado(a); cambiarVista('detalle-avio'); }}>{a.nombre}</h3>
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

        {esAdmin && vista === 'detalle-tela' && telaSeleccionada && (
          <div className="bg-stone-900/40 backdrop-blur-md border border-stone-800 p-6 md:p-8 rounded-3xl max-w-xl mx-auto relative">
            <button onClick={() => cambiarVista('catalogo')} className="absolute top-4 right-4 text-stone-400 hover:text-white">Volver</button>
            <img src={telaSeleccionada.foto} alt={telaSeleccionada.nombre} className="w-full h-48 object-cover rounded-2xl mb-6 border border-stone-800" />
            <h2 className="text-2xl font-bold mb-2">{telaSeleccionada.nombre}</h2>
            <p className="text-stone-400 text-sm mb-2"><strong>Descripción:</strong> {telaSeleccionada.descripcion}</p>
            <p className="text-stone-400 text-sm mb-2"><strong>Uso:</strong> {telaSeleccionada.uso}</p>
            <p className="text-stone-400 text-sm mb-2"><strong>Stock:</strong> {telaSeleccionada.stock}</p>
            <p className="text-stone-400 text-sm mb-6"><strong>Precio por metro:</strong> {telaSeleccionada.precio ? `$${telaSeleccionada.precio.toLocaleString()}` : 'No especificado'}</p>
            <button onClick={() => cambiarVista('editar-tela')} className="w-full bg-white text-stone-950 py-3 rounded-xl font-bold">Editar Tela</button>
          </div>
        )}

        {esAdmin && vista === 'detalle-avio' && avioSeleccionado && (
          <div className="bg-stone-900/40 backdrop-blur-md border border-stone-800 p-6 md:p-8 rounded-3xl max-w-xl mx-auto relative">
            <button onClick={() => cambiarVista('catalogo-avios')} className="absolute top-4 right-4 text-stone-400 hover:text-white">Volver</button>
            <img src={avioSeleccionado.foto} alt={avioSeleccionado.nombre} className="w-full h-48 object-cover rounded-2xl mb-6 border border-stone-800" />
            <h2 className="text-2xl font-bold mb-2">{avioSeleccionado.nombre}</h2>
            <p className="text-stone-400 text-sm mb-2"><strong>Descripción:</strong> {avioSeleccionado.descripcion}</p>
            <p className="text-stone-400 text-sm mb-2"><strong>Uso:</strong> {avioSeleccionado.uso}</p>
            <p className="text-stone-400 text-sm mb-6"><strong>Stock:</strong> {avioSeleccionado.stock}</p>
            <button onClick={() => cambiarVista('editar-avio')} className="w-full bg-white text-stone-950 py-3 rounded-xl font-bold">Editar Avío</button>
          </div>
        )}

        {esAdmin && vista === 'clientes' && (
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
                      <h3 className="text-lg font-semibold cursor-pointer hover:underline" onClick={() => { setClienteSeleccionado(c); cambiarVista('detalle-cliente'); }}>{c.nombre}</h3>
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

        {esAdmin && vista === 'detalle-cliente' && clienteSeleccionado && (
          <>
            <div className="bg-stone-900/40 backdrop-blur-md border border-stone-800 p-6 md:p-8 rounded-3xl max-w-2xl mx-auto relative">
              <button onClick={() => cambiarVista('clientes')} className="absolute top-4 right-4 text-stone-400 hover:text-white">Volver</button>
              <h2 className="text-3xl font-bold mb-1">{clienteSeleccionado.nombre}</h2>
              <p className="text-stone-400 text-sm mb-6">{clienteSeleccionado.telefono}</p>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <button onClick={() => cambiarVista('editar-cliente')} className="bg-stone-800 px-4 py-3 sm:py-2 rounded-xl text-sm sm:text-xs border border-stone-700 hover:bg-stone-700 font-medium">Editar Datos y Medidas</button>
                <button onClick={() => window.print()} className="bg-stone-800 px-4 py-3 sm:py-2 rounded-xl text-sm sm:text-xs border border-stone-700 hover:bg-stone-700 font-medium">Imprimir Ficha</button>
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
                    const esRechazado = p.estado === 'Rechazado';
                    return (
                    <div key={p.id} className={`bg-stone-950/40 border p-4 rounded-2xl flex flex-col gap-3 relative ${esRechazado ? 'border-red-900/50' : 'border-stone-800'}`}>
                      <button 
                        onClick={() => setModalConfirm({ isOpen: true, text: "¿Estás segura de que quieres eliminar definitivamente este pedido?", action: () => borrarPedidoDefinitivo(p.id) })} 
                        className="absolute top-4 right-4 text-stone-600 hover:text-red-400 text-xs"
                      >
                        ✕
                      </button>
                      
                      <div className="flex justify-between items-center pr-6">
                        <span className="text-xs font-bold">{p.prenda} (<span className={esRechazado ? "text-red-400" : ""}>{p.estado}</span>)</span>
                        <span className="text-xs text-stone-400">{p.entrega}</span>
                      </div>

                      {p.descripcionDetalle && (
                        <p className="text-xs text-stone-300 bg-stone-900/60 p-2.5 rounded-xl border border-stone-800"><strong>Detalles:</strong> {p.descripcionDetalle}</p>
                      )}

                      {esRechazado && p.motivoRechazo && (
                        <p className="text-xs text-red-300 bg-red-950/40 p-2 rounded-xl"><strong>Motivo rechazo:</strong> {p.motivoRechazo}</p>
                      )}
                      
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

            <div className="print-ficha-exclusiva hidden">
              <div className="border-b-2 border-black pb-4 mb-6">
                <h1 className="text-3xl font-bold tracking-tight text-black">ATELIER - FICHA DE CLIENTE</h1>
              </div>
              <div className="mb-6 space-y-1">
                <p className="text-xl font-bold text-black">Cliente: {clienteSeleccionado.nombre}</p>
                <p className="text-sm text-gray-700">Teléfono: {clienteSeleccionado.telefono}</p>
              </div>
              <h3 className="text-md font-bold uppercase tracking-wider border-b border-gray-400 pb-1 mb-4 text-black">Medidas Registradas</h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                {Object.entries(clienteSeleccionado.medidas || {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-gray-200 py-1.5">
                    <span className="text-gray-800 font-medium">{k}:</span>
                    <span className="font-bold text-black">{v || 'N/A'}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {esAdmin && vista === 'calculadora' && (
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
                  {pedidosParaCalculadora.map(p => <option key={p.id} value={p.id}>{p.cliente} - {p.prenda}</option>)}
                </select>
                <button type="submit" className="w-full bg-white text-stone-950 py-3 rounded-xl font-bold">Asignar Precio</button>
              </form>
            </div>

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

        {esAdmin && vista === 'ganancias' && (
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

                    <div className="space-y-3">
                      {datos.pedidos.map(p => (
                        <div 
                          key={p.id}
                          onClick={() => { setPedidoSeleccionado(p); cambiarVista('detalle-pedido'); }}
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

      {esAdmin && menuAbierto && (
        <div className="fixed bottom-24 right-4 md:right-8 z-50 flex flex-col gap-3">
          <button onClick={() => {cambiarVista('nuevo-cliente'); setMenuAbierto(false)}} className="bg-stone-800 p-4 rounded-xl text-sm border border-stone-700 hover:bg-stone-700 shadow-lg">Nuevo Cliente</button>
          <button onClick={() => {cambiarVista('nuevo-pedido'); setMenuAbierto(false)}} className="bg-stone-800 p-4 rounded-xl text-sm border border-stone-700 hover:bg-stone-700 shadow-lg">Nuevo Pedido</button>
          <button onClick={() => {cambiarVista('nueva-tela'); setMenuAbierto(false)}} className="bg-stone-800 p-4 rounded-xl text-sm border border-stone-700 hover:bg-stone-700 shadow-lg">Nueva Tela</button>
          <button onClick={() => {cambiarVista('nuevo-avio'); setMenuAbierto(false)}} className="bg-stone-800 p-4 rounded-xl text-sm border border-stone-700 hover:bg-stone-700 shadow-lg">Nuevo Avío</button>
        </div>
      )}

      {esAdmin && (
        <button onClick={() => setMenuAbierto(!menuAbierto)} className="fixed bottom-6 right-6 md:bottom-8 md:right-8 w-14 h-14 bg-white text-stone-950 rounded-full text-2xl z-50 shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform">+</button>
      )}

      {/* MODAL PARA AGREGAR NUEVO PAGO / SEÑA (PUNTO 3) */}
      {modalPago.isOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/90 p-4">
          <div className="bg-stone-900 border border-stone-800 p-6 md:p-8 rounded-3xl max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold mb-2 text-white">Registrar Pago / Adelanto</h3>
            <p className="text-stone-400 text-xs mb-4">Ingresa el monto recibido por parte del cliente:</p>
            
            <div className="space-y-3 mb-6">
              <div>
                <label className="text-xs text-stone-500 pl-1">Monto ($)</label>
                <input 
                  type="number"
                  value={montoPagoInput}
                  onChange={(e) => setMontoPagoInput(e.target.value)}
                  placeholder="Ej: 15000"
                  className="w-full bg-stone-950 p-3 rounded-xl border border-stone-800 text-sm text-white outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-stone-500 pl-1">Método de pago / Nota</label>
                <select 
                  value={metodoPagoInput}
                  onChange={(e) => setMetodoPagoInput(e.target.value)}
                  className="w-full bg-stone-950 p-3 rounded-xl border border-stone-800 text-sm text-white outline-none"
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Mercado Pago">Mercado Pago</option>
                  <option value="Tarjeta">Tarjeta</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setModalPago({ isOpen: false, pedidoId: null })}
                className="flex-1 bg-stone-800 text-white py-3 rounded-xl font-bold text-xs hover:bg-stone-700 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={registrarPagoParcial}
                className="flex-1 bg-white text-stone-950 py-3 rounded-xl font-bold text-xs hover:bg-stone-200 transition-colors"
              >
                Aceptar y Sumar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalRechazo.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4">
          <div className="bg-stone-900 border border-stone-800 p-6 md:p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl">
            <h3 className="text-xl font-bold mb-2 text-white">Motivo de Rechazo</h3>
            <p className="text-stone-400 text-xs mb-4">Por favor, indica el motivo por el cual se rechaza este pedido:</p>
            <textarea 
              rows="3"
              value={modalRechazo.motivo}
              onChange={(e) => setModalRechazo(prev => ({ ...prev, motivo: e.target.value }))}
              placeholder="Ej: Taller saturado en esa fecha / Tela sin stock..."
              className="w-full bg-stone-950 p-3 rounded-xl border border-stone-800 text-sm text-white outline-none mb-6 resize-none"
              required
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setModalRechazo({ isOpen: false, pedidoId: null, motivo: '' })}
                className="flex-1 bg-stone-800 text-white py-3 rounded-xl font-bold text-xs hover:bg-stone-700 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmarRechazoAdmin}
                className="flex-1 bg-red-950 text-red-300 border border-red-900/50 py-3 rounded-xl font-bold text-xs hover:bg-red-900/40 transition-colors"
              >
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}

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

      {modalConfirm.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4">
          <div className="bg-stone-900 border border-stone-800 p-6 md:p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-white">Atención</h3>
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