import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, CheckCircle, AlertTriangle, Clock, X } from 'lucide-react';

// Configuración de la API
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbyEvxwyMHS8hYVTDnyCELlCxLu_gBNpQWb5wxdozXfXeSFb8SF7DyXPkWDBNbU5-eSw/exec';

const API_CONFIG = {
  ASISTENCIAS_PF: `${API_BASE_URL}?sheet=asistencias`,
  ASISTENCIAS_PROFES: `${API_BASE_URL}?sheet=asistencias_profes`,
  REVISIONES: API_BASE_URL,
  MAESTRO_GRUPOS: `${API_BASE_URL}?sheet=maestro_grupos`,
  ESTUDIANTES: `${API_BASE_URL}?sheet=estudiantes`
};

const App = () => {
  const [currentPage, setCurrentPage] = useState('pendientes');
  const [asistenciasPF, setAsistenciasPF] = useState([]);
  const [asistenciasProfes, setAsistenciasProfes] = useState([]);
  const [revisiones, setRevisiones] = useState([]);
  const [maestroGrupos, setMaestroGrupos] = useState([]);
  const [estudiantes, setEstudiantes] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [filters, setFilters] = useState({
    profesor: '',
    grupo: '',
    cancha: '',
    soloInconsistencias: false
  });
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [notas, setNotas] = useState('');

  // Cargar datos desde la API
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      console.log('Cargando datos para fecha:', selectedDate);
      
      // Hacer peticiones en paralelo
      const [resPF, resProfes, resMaestro, resEstudiantes] = await Promise.all([
        fetch(API_CONFIG.ASISTENCIAS_PF),
        fetch(API_CONFIG.ASISTENCIAS_PROFES),
        fetch(API_CONFIG.MAESTRO_GRUPOS),
        fetch(API_CONFIG.ESTUDIANTES)
      ]);

      const dataPF = await resPF.json();
      const dataProfes = await resProfes.json();
      const dataMaestro = await resMaestro.json();
      const dataEstudiantes = await resEstudiantes.json();

      console.log('Respuestas completas de API:', {
        dataPF,
        dataProfes,
        dataMaestro,
        dataEstudiantes
      });

      // Validar que las respuestas tengan la estructura correcta
      if (!dataPF?.data || !dataProfes?.data || !dataMaestro?.data) {
        console.error('Estructura de datos incorrecta:', {
          dataPF: dataPF?.data ? 'OK' : 'ERROR',
          dataProfes: dataProfes?.data ? 'OK' : 'ERROR',
          dataMaestro: dataMaestro?.data ? 'OK' : 'ERROR',
          dataEstudiantes: dataEstudiantes?.data ? 'OK' : 'ERROR'
        });
        throw new Error('Las respuestas de la API no tienen la estructura esperada. Verifica que el Apps Script esté desplegado correctamente.');
      }

      console.log('Datos recibidos:', {
        asistenciasPF: dataPF.count,
        asistenciasProfes: dataProfes.count,
        maestroGrupos: dataMaestro.count,
        estudiantes: dataEstudiantes?.count || 0
      });

      // Crear mapa de estudiantes ID -> Nombre (con validación)
      const estudiantesMap = {};
      if (dataEstudiantes?.data && Array.isArray(dataEstudiantes.data)) {
        dataEstudiantes.data.forEach(est => {
          if (est?.ID && est?.Nombre) {
            estudiantesMap[est.ID] = est.Nombre;
          }
        });
        console.log('Estudiantes cargados:', Object.keys(estudiantesMap).length);
      } else {
        console.warn('No se pudieron cargar los estudiantes. Se mostrarán los IDs.');
      }
      setEstudiantes(estudiantesMap);

      // Filtrar por fecha seleccionada
      const asistenciasFiltradas = dataPF.data.filter(a => a.Fecha === selectedDate);
      const asistenciasProfesFiltr = dataProfes.data.filter(a => a.Fecha === selectedDate);

      console.log('Datos filtrados por fecha:', {
        asistenciasPF: asistenciasFiltradas.length,
        asistenciasProfes: asistenciasProfesFiltr.length
      });

      setAsistenciasPF(asistenciasFiltradas);
      setAsistenciasProfes(asistenciasProfesFiltr);
      setMaestroGrupos(dataMaestro.data);
      setRevisiones([]);
      
    } catch (error) {
      console.error('Error cargando datos:', error);
      alert(`Error al cargar datos: ${error.message}\n\nRevisa la consola del navegador (F12) para más detalles.`);
    }
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Comparar asistencias y detectar inconsistencias
  const compararAsistencias = () => {
    const clases = {};

    // Agrupar por Fecha + Grupo_Codigo
    [...asistenciasPF, ...asistenciasProfes].forEach(asistencia => {
      const key = `${asistencia.Fecha}_${asistencia.Grupo_Codigo}`;
      if (!clases[key]) {
        clases[key] = {
          fecha: asistencia.Fecha,
          grupo: asistencia.Grupo_Codigo,
          estudiantes: {}
        };
      }

      const estudianteKey = asistencia.Estudiante_ID;
      if (!clases[key].estudiantes[estudianteKey]) {
        clases[key].estudiantes[estudianteKey] = {
          id: estudianteKey,
          nombre: estudiantes[estudianteKey] || estudianteKey,
          pf: null,
          profe: null
        };
      }

      // Determinar si viene del PF o del Profe
      if (asistencia.Enviado_Por === 'usuario' || asistenciasPF.includes(asistencia)) {
        clases[key].estudiantes[estudianteKey].pf = asistencia;
      } else {
        clases[key].estudiantes[estudianteKey].profe = asistencia;
      }
    });

    // Agregar información del maestro de grupos
    Object.keys(clases).forEach(key => {
      const clase = clases[key];
      const infoGrupo = maestroGrupos.find(g => g.Codigo === clase.grupo);
      if (infoGrupo) {
        clase.horario = infoGrupo.Hora;
        clase.profesor = infoGrupo.Profe;  // ✅ CORREGIDO: Profesor → Profe
        clase.cancha = infoGrupo.Cancha;
      }
    });

    return clases;
  };

  // Detectar tipo de inconsistencia
  const detectarInconsistencia = (estudiante) => {
    const { pf, profe } = estudiante;

    // Reposición (solo en PF)
    if (pf && pf.Tipo_Clase === 'Reposicion') {
      return { tipo: 'reposicion', color: 'blue', icono: '🔵' };
    }

    // Falta registro en PF pero profesor sí marcó
    if (!pf && profe) {
      return { tipo: 'falta_pf', color: 'yellow', icono: '⚠️', mensaje: 'Falta en PF' };
    }

    // El profesor no marcó asistencia = Ausente implícito
    if (pf && !profe) {
      const estadoPF = pf.Estado.toLowerCase();
      
      // Si el PF dice presente pero el profesor no marcó nada = CONFLICTO
      if (estadoPF === 'presente') {
        return { 
          tipo: 'conflicto', 
          color: 'red', 
          icono: '❌', 
          mensaje: 'PF: Presente vs Profe: Ausente (no marcó)' 
        };
      }
      
      // Si el PF dice ausente y el profesor no marcó nada = COINCIDEN
      if (estadoPF === 'ausente') {
        return { 
          tipo: 'coincide_ausente', 
          color: 'gray', 
          icono: '⚪',
          mensaje: 'Ambos ausentes'
        };
      }
      
      // Si el PF dice justificado y el profesor no marcó = Alerta
      if (estadoPF === 'justificado' || estadoPF === 'justificada') {
        return { 
          tipo: 'justificado_vs_ausente', 
          color: 'yellow', 
          icono: '⚠️', 
          mensaje: 'PF: Justificado vs Profe: Ausente (no marcó)' 
        };
      }
    }

    // Comparar estados cuando ambos existen
    if (pf && profe) {
      const estadoPF = pf.Estado.toLowerCase();
      const estadoProfe = profe.Estado.toLowerCase();

      if (estadoPF === estadoProfe) {
        if (estadoPF === 'presente') {
          return { tipo: 'coincide', color: 'green', icono: '✅' };
        } else {
          return { tipo: 'coincide_ausente', color: 'gray', icono: '⚪' };
        }
      } else {
        return { 
          tipo: 'conflicto', 
          color: 'red', 
          icono: '❌', 
          mensaje: `PF: ${pf.Estado} vs Profe: ${profe.Estado}` 
        };
      }
    }

    return { tipo: 'desconocido', color: 'gray', icono: '❓' };
  };

  // Filtrar clases según filtros activos
  const filtrarClases = (clases) => {
    return Object.keys(clases).filter(key => {
      const clase = clases[key];
      
      if (filters.profesor && clase.profesor !== filters.profesor) return false;
      if (filters.grupo && clase.grupo !== filters.grupo) return false;
      if (filters.cancha && clase.cancha !== filters.cancha) return false;
      
      if (filters.soloInconsistencias) {
        const tieneInconsistencia = Object.values(clase.estudiantes).some(est => {
          const inc = detectarInconsistencia(est);
          return inc.tipo === 'conflicto' || inc.tipo === 'falta_pf' || inc.tipo === 'falta_profe';
        });
        if (!tieneInconsistencia) return false;
      }

      return true;
    });
  };

  // Agrupar clases por horario
  const agruparPorHorario = (clases, keys) => {
    const grupos = {};
    keys.forEach(key => {
      const clase = clases[key];
      const horario = clase.horario || 'Sin horario';
      if (!grupos[horario]) {
        grupos[horario] = [];
      }
      grupos[horario].push({ key, ...clase });
    });
    return grupos;
  };

  // Abrir modal de revisión
  const abrirModalRevision = (clase) => {
    setModalData(clase);
    setNotas('');
    setShowModal(true);
  };

  // Aprobar clase
  const aprobarClase = async () => {
    if (!modalData) return;

    const revision = {
      ID_Revision: `REV_${Date.now()}`,
      Fecha: modalData.fecha,
      Grupo_Codigo: modalData.grupo,
      profesor: modalData.profesor || 'Sin asignar',  // ✅ CORREGIDO: Profesor → profesor (minúscula)
      Estado_Revision: 'Aprobado',
      Notas: notas,
      Revisado_Por: 'Coordinador',
      Timestamp: new Date().toISOString()
    };

    try {
      await fetch(API_CONFIG.REVISIONES, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(revision)
      });

      console.log('Revisión aprobada:', revision);
      
      setRevisiones([...revisiones, revision]);
      setShowModal(false);
      alert('Clase aprobada exitosamente ✅');
    } catch (error) {
      console.error('Error aprobando clase:', error);
      alert('Error al guardar la revisión. Revisa la consola.');
    }
  };

  // Dejar pendiente
  const dejarPendiente = async () => {
    if (!modalData) return;

    const revision = {
      ID_Revision: `REV_${Date.now()}`,
      Fecha: modalData.fecha,
      Grupo_Codigo: modalData.grupo,
      profesor: modalData.profesor || 'Sin asignar',  // ✅ CORREGIDO: Profesor → profesor (minúscula)
      Estado_Revision: 'Pendiente',
      Notas: notas,
      Revisado_Por: 'Coordinador',
      Timestamp: new Date().toISOString()
    };

    try {
      await fetch(API_CONFIG.REVISIONES, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(revision)
      });

      console.log('Revisión pendiente:', revision);
      
      setRevisiones([...revisiones, revision]);
      setShowModal(false);
      alert('Clase marcada como pendiente ⏸️');
    } catch (error) {
      console.error('Error marcando como pendiente:', error);
      alert('Error al guardar la revisión. Revisa la consola.');
    }
  };

  const clases = compararAsistencias();
  const clasesKeys = filtrarClases(clases);
  const clasesPorHorario = agruparPorHorario(clases, clasesKeys);

  // Obtener listas únicas para filtros
  const profesores = [...new Set(maestroGrupos.map(g => g.Profe).filter(Boolean))];  // ✅ CORREGIDO: Profesor → Profe
  const grupos = [...new Set(maestroGrupos.map(g => g.Codigo).filter(Boolean))];
  const canchas = [...new Set(maestroGrupos.map(g => g.Cancha).filter(Boolean))];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CheckCircle size={28} />
            Sistema de Reconciliación de Asistencias
          </h1>
          <div className="flex gap-4">
            <button
              onClick={() => setCurrentPage('pendientes')}
              className={`px-4 py-2 rounded ${currentPage === 'pendientes' ? 'bg-white text-blue-600' : 'bg-blue-700'}`}
            >
              Pendientes
            </button>
            <button
              onClick={() => setCurrentPage('historial')}
              className={`px-4 py-2 rounded ${currentPage === 'historial' ? 'bg-white text-blue-600' : 'bg-blue-700'}`}
            >
              Historial
            </button>
          </div>
        </div>
      </header>

      {/* Filtros */}
      <div className="max-w-7xl mx-auto p-4 bg-white rounded-lg shadow-md my-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar size={20} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </div>

          <select
            value={filters.profesor}
            onChange={(e) => setFilters({ ...filters, profesor: e.target.value })}
            className="border rounded px-3 py-2"
          >
            <option value="">Todos los profesores</option>
            {profesores.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <select
            value={filters.grupo}
            onChange={(e) => setFilters({ ...filters, grupo: e.target.value })}
            className="border rounded px-3 py-2"
          >
            <option value="">Todos los grupos</option>
            {grupos.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          <select
            value={filters.cancha}
            onChange={(e) => setFilters({ ...filters, cancha: e.target.value })}
            className="border rounded px-3 py-2"
          >
            <option value="">Todas las canchas</option>
            {canchas.map(c => <option key={c} value={c}>Cancha {c}</option>)}
          </select>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.soloInconsistencias}
              onChange={(e) => setFilters({ ...filters, soloInconsistencias: e.target.checked })}
              className="w-4 h-4"
            />
            <span>Solo inconsistencias</span>
          </label>

          <button
            onClick={() => setFilters({ profesor: '', grupo: '', cancha: '', soloInconsistencias: false })}
            className="ml-auto px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* Leyenda */}
      <div className="max-w-7xl mx-auto px-4 mb-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="font-bold mb-2">Leyenda:</h3>
          <div className="flex gap-6 flex-wrap text-sm">
            <span className="flex items-center gap-2"><span className="text-green-600">✅</span> Coincide (Presente)</span>
            <span className="flex items-center gap-2"><span className="text-red-600">❌</span> Conflicto (Estados diferentes)</span>
            <span className="flex items-center gap-2"><span className="text-yellow-600">⚠️</span> Falta en una fuente</span>
            <span className="flex items-center gap-2"><span className="text-blue-600">🔵</span> Reposición</span>
            <span className="flex items-center gap-2"><span className="text-gray-500">⚪</span> Coincide (Ausente)</span>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-7xl mx-auto p-4">
        {loading ? (
          <div className="text-center py-12">
            <Clock className="animate-spin mx-auto mb-4" size={48} />
            <p>Cargando datos...</p>
          </div>
        ) : currentPage === 'pendientes' ? (
          <>
            <h2 className="text-2xl font-bold mb-4">Clases del {selectedDate}</h2>
            
            {Object.keys(clasesPorHorario).sort().map(horario => (
              <div key={horario} className="mb-6">
                <h3 className="text-xl font-semibold bg-gray-100 p-3 rounded-t-lg border-b-2 border-blue-500">
                  {horario}
                </h3>
                
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {clasesPorHorario[horario].map(clase => {
                    const estudiantesArray = Object.values(clase.estudiantes);
                    const tieneInconsistencia = estudiantesArray.some(est => {
                      const inc = detectarInconsistencia(est);
                      return inc.tipo === 'conflicto' || inc.tipo === 'falta_pf' || inc.tipo === 'falta_profe';
                    });

                    return (
                      <div
                        key={clase.key}
                        className={`bg-white rounded-lg shadow-md p-4 border-l-4 ${
                          tieneInconsistencia ? 'border-red-500' : 'border-green-500'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-bold text-lg">{clase.grupo}</h4>
                            <p className="text-sm text-gray-600">{clase.profesor}</p>
                            <p className="text-xs text-gray-500">Cancha {clase.cancha}</p>
                          </div>
                          {tieneInconsistencia && (
                            <AlertTriangle className="text-red-500" size={24} />
                          )}
                        </div>

                        <div className="space-y-2 mb-3">
                          {estudiantesArray.map(estudiante => {
                            const inc = detectarInconsistencia(estudiante);
                            return (
                              <div
                                key={estudiante.id}
                                className={`p-2 rounded text-sm ${
                                  inc.color === 'green' ? 'bg-green-50' :
                                  inc.color === 'red' ? 'bg-red-50' :
                                  inc.color === 'yellow' ? 'bg-yellow-50' :
                                  inc.color === 'blue' ? 'bg-blue-50' :
                                  'bg-gray-50'
                                }`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="font-medium">{inc.icono} {estudiante.nombre}</span>
                                  {inc.mensaje && (
                                    <span className="text-xs text-gray-600">{inc.mensaje}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <button
                          onClick={() => abrirModalRevision(clase)}
                          className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                        >
                          Revisar clase
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {clasesKeys.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg shadow-md">
                <p className="text-gray-500">No hay clases para mostrar con los filtros seleccionados</p>
              </div>
            )}
          </>
        ) : (
          <div>
            <h2 className="text-2xl font-bold mb-4">Historial de Revisiones</h2>
            <div className="bg-white rounded-lg shadow-md p-6">
              {revisiones.length === 0 ? (
                <p className="text-gray-500 text-center">No hay revisiones en el historial</p>
              ) : (
                <div className="space-y-3">
                  {revisiones.map(rev => (
                    <div key={rev.ID_Revision} className="border-b pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-lg">{rev.Grupo_Codigo} - {rev.Fecha}</p>
                          <p className="text-sm text-gray-600 mb-1">Profesor: {rev.profesor}</p>
                          <p className={`text-sm font-medium ${rev.Estado_Revision === 'Aprobado' ? 'text-green-600' : 'text-yellow-600'}`}>
                            {rev.Estado_Revision}
                          </p>
                          {rev.Notas && <p className="text-sm text-gray-600 mt-2 italic">"{rev.Notas}"</p>}
                        </div>
                        <span className="text-xs text-gray-400">{new Date(rev.Timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de revisión */}
      {showModal && modalData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-2xl font-bold">{modalData.grupo}</h3>
                  <p className="text-gray-600">{modalData.profesor} - Cancha {modalData.cancha}</p>
                  <p className="text-sm text-gray-500">{modalData.horario}</p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-3 mb-6">
                <h4 className="font-bold">Detalle de estudiantes:</h4>
                {Object.values(modalData.estudiantes).map(estudiante => {
                  const inc = detectarInconsistencia(estudiante);
                  return (
                    <div key={estudiante.id} className="border rounded p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{inc.icono} {estudiante.nombre}</span>
                        <span className={`text-sm px-2 py-1 rounded ${
                          inc.color === 'red' ? 'bg-red-100 text-red-700' :
                          inc.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                          inc.color === 'green' ? 'bg-green-100 text-green-700' :
                          inc.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {inc.tipo}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-gray-50 p-2 rounded">
                          <p className="font-medium text-gray-600">PF:</p>
                          <p>{estudiante.pf ? estudiante.pf.Estado : 'No registrado'}</p>
                        </div>
                        <div className="bg-gray-50 p-2 rounded">
                          <p className="font-medium text-gray-600">Profesor:</p>
                          <p>{estudiante.profe ? estudiante.profe.Estado : 'Ausente (no marcó)'}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mb-6">
                <label className="block font-medium mb-2">Notas del coordinador:</label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="w-full border rounded p-3 h-24"
                  placeholder="Agregar observaciones o notas sobre esta clase..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={aprobarClase}
                  className="flex-1 py-3 bg-green-600 text-white rounded font-medium hover:bg-green-700 transition"
                >
                  ✅ Aprobar clase
                </button>
                <button
                  onClick={dejarPendiente}
                  className="flex-1 py-3 bg-yellow-600 text-white rounded font-medium hover:bg-yellow-700 transition"
                >
                  ⏸️ Dejar pendiente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
