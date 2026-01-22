import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, CheckCircle, AlertTriangle, Clock, X } from 'lucide-react';

// Configuración de la API - Semestre 2026-1
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbxBti9G7nUBCYMG9mpFzQyQCo0oxzbNTSMUjPCKkgFiqe5Q18UJ0OJvmJudHOUV3qo3YQ/exec';

const API_CONFIG = {
  ASISTENCIAS_PF: `${API_BASE_URL}?sheet=asistencias`,
  ASISTENCIAS_PROFES: `${API_BASE_URL}?sheet=asistencias_profes`,
  REVISIONES: API_BASE_URL,
  REVISIONES_GET: `${API_BASE_URL}?sheet=revisiones`,
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
    soloInconsistencias: false,
    todasLasFechas: false
  });
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [notas, setNotas] = useState('');

  // Cargar datos desde la API
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      console.log('Cargando datos de todas las fechas...');
      
      // Hacer peticiones en paralelo (ahora incluye revisiones)
      const [resPF, resProfes, resMaestro, resEstudiantes, resRevisiones] = await Promise.all([
        fetch(API_CONFIG.ASISTENCIAS_PF),
        fetch(API_CONFIG.ASISTENCIAS_PROFES),
        fetch(API_CONFIG.MAESTRO_GRUPOS),
        fetch(API_CONFIG.ESTUDIANTES),
        fetch(API_CONFIG.REVISIONES_GET)
      ]);

      const dataPF = await resPF.json();
      const dataProfes = await resProfes.json();
      const dataMaestro = await resMaestro.json();
      const dataEstudiantes = await resEstudiantes.json();
      const dataRevisiones = await resRevisiones.json();

      console.log('Respuestas completas de API:', {
        dataPF,
        dataProfes,
        dataMaestro,
        dataEstudiantes,
        dataRevisiones
      });

      // Validar que las respuestas tengan la estructura correcta
      if (!dataPF?.data || !dataProfes?.data || !dataMaestro?.data) {
        console.error('Estructura de datos incorrecta:', {
          dataPF: dataPF?.data ? 'OK' : 'ERROR',
          dataProfes: dataProfes?.data ? 'OK' : 'ERROR',
          dataMaestro: dataMaestro?.data ? 'OK' : 'ERROR',
          dataEstudiantes: dataEstudiantes?.data ? 'OK' : 'ERROR',
          dataRevisiones: dataRevisiones?.data ? 'OK' : 'ERROR'
        });
        throw new Error('Las respuestas de la API no tienen la estructura esperada. Verifica que el Apps Script esté desplegado correctamente.');
      }

      console.log('Datos recibidos:', {
        asistenciasPF: dataPF.count,
        asistenciasProfes: dataProfes.count,
        maestroGrupos: dataMaestro.count,
        estudiantes: dataEstudiantes?.count || 0,
        revisiones: dataRevisiones?.count || 0
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

      // Guardar todas las asistencias sin filtrar (el filtro se aplica después según todasLasFechas)
      console.log('Datos cargados (todas las fechas):', {
        asistenciasPF: dataPF.data.length,
        asistenciasProfes: dataProfes.data.length
      });

      setAsistenciasPF(dataPF.data);
      setAsistenciasProfes(dataProfes.data);
      setMaestroGrupos(dataMaestro.data);
      
      // Cargar todas las revisiones (no solo de la fecha seleccionada)
      setRevisiones(dataRevisiones?.data || []);
      
    } catch (error) {
      console.error('Error cargando datos:', error);
      alert(`Error al cargar datos: ${error.message}\n\nRevisa la consola del navegador (F12) para más detalles.`);
    }
    setLoading(false);
  }, []); // Sin dependencias - solo carga una vez

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Verificar si una clase ya fue revisada
  const claseYaRevisada = (fecha, grupo) => {
    return revisiones.some(rev => 
      rev.Fecha === fecha && rev.Grupo_Codigo === grupo
    );
  };

  // Obtener día de la semana en español
  const obtenerDiaSemana = (fecha) => {
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
    const date = new Date(fecha + 'T00:00:00'); // Agregar hora para evitar problemas de zona horaria
    return diasSemana[date.getDay()];
  };

  // Verificar si un grupo tiene clase en un día específico
  const grupoTieneClaseEnDia = (infoGrupo, diaBuscado) => {
    if (!infoGrupo) return false;
    
    // Opción 1: Usar las columnas booleanas individuales (Lunes, Martes, etc.)
    const valorDia = infoGrupo[diaBuscado];
    if (valorDia === true || valorDia === 'TRUE' || valorDia === 'true' || valorDia === 1) {
      return true;
    }
    
    // Opción 2: Buscar en la columna "Días" (si existe)
    if (infoGrupo.Días || infoGrupo.Dias) {
      const diasTexto = (infoGrupo.Días || infoGrupo.Dias).toString().toLowerCase();
      const diaBuscadoLower = diaBuscado.toLowerCase();
      return diasTexto.includes(diaBuscadoLower);
    }
    
    return false;
  };

  // ============ OPTIMIZACIÓN: Crear mapa de maestroGrupos para búsquedas O(1) ============
  const maestroGruposMap = useMemo(() => {
    const map = {};
    maestroGrupos.forEach(g => {
      if (g.Código) {
        map[g.Código] = g;
      }
    });
    return map;
  }, [maestroGrupos]);

  // ============ OPTIMIZACIÓN: useMemo para comparar asistencias ============
  const clases = useMemo(() => {
    const clasesTemp = {};

    // Filtrar asistencias por fecha si NO está activo "todasLasFechas"
    const asistenciasPFFiltered = filters.todasLasFechas
      ? asistenciasPF
      : asistenciasPF.filter(a => a.Fecha === selectedDate);

    const asistenciasProfesFiltered = filters.todasLasFechas
      ? asistenciasProfes
      : asistenciasProfes.filter(a => a.Fecha === selectedDate);

    // Agrupar por Fecha + Grupo_Codigo
    [...asistenciasPFFiltered, ...asistenciasProfesFiltered].forEach(asistencia => {
      const key = `${asistencia.Fecha}_${asistencia.Grupo_Codigo}`;
      if (!clasesTemp[key]) {
        clasesTemp[key] = {
          fecha: asistencia.Fecha,
          grupo: asistencia.Grupo_Codigo,
          estudiantes: {}
        };
      }

      const estudianteKey = asistencia.Estudiante_ID;
      if (!clasesTemp[key].estudiantes[estudianteKey]) {
        clasesTemp[key].estudiantes[estudianteKey] = {
          id: estudianteKey,
          nombre: estudiantes[estudianteKey] || estudianteKey,
          pf: null,
          profe: null
        };
      }

      // Determinar si viene del PF o del Profe
      if (asistencia.Enviado_Por === 'usuario' || asistenciasPF.includes(asistencia)) {
        clasesTemp[key].estudiantes[estudianteKey].pf = asistencia;
      } else {
        clasesTemp[key].estudiantes[estudianteKey].profe = asistencia;
      }
    });

    // Agregar información del maestro de grupos y filtrar por día de la semana
    const clasesDelDia = {};

    Object.keys(clasesTemp).forEach(key => {
      const clase = clasesTemp[key];
      const infoGrupo = maestroGruposMap[clase.grupo]; // ⚡ Búsqueda O(1) en lugar de .find()

      // Obtener el día de la semana para la fecha de esta clase
      const diaClase = obtenerDiaSemana(clase.fecha);

      if (infoGrupo) {
        clase.horario = infoGrupo.Hora;
        clase.profesor = infoGrupo.Profe;
        clase.cancha = infoGrupo.Cancha;
        clase.tieneClaseHoy = grupoTieneClaseEnDia(infoGrupo, diaClase);
      } else {
        clase.tieneClaseHoy = true; // Por defecto incluir si no se encuentra info
      }

      // Solo incluir si el grupo tiene clase ese día de la semana
      if (clase.tieneClaseHoy) {
        clasesDelDia[key] = clase;
      }
    });

    return clasesDelDia;
  }, [asistenciasPF, asistenciasProfes, maestroGruposMap, estudiantes, selectedDate, filters.todasLasFechas]);

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
      
      // NUEVO: Filtrar clases ya revisadas en la vista de pendientes
      if (currentPage === 'pendientes' && claseYaRevisada(clase.fecha, clase.grupo)) {
        return false;
      }
      
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
      profesor: modalData.profesor || 'Sin asignar',
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
      
      // Actualizar estado local inmediatamente
      setRevisiones([...revisiones, revision]);
      setShowModal(false);
      alert('Clase aprobada exitosamente ✅\nLa clase ya no aparecerá en Pendientes.');
    } catch (error) {
      console.error('Error aprobando clase:', error);
      alert('Error al guardar la revisión. Revisa la consola.');
    }
  };

  // Cancelar por lluvia
  const cancelarPorLluvia = async () => {
    if (!modalData) return;

    const revision = {
      ID_Revision: `REV_${Date.now()}`,
      Fecha: modalData.fecha,
      Grupo_Codigo: modalData.grupo,
      profesor: modalData.profesor || 'Sin asignar',
      Estado_Revision: 'Cancelada por Lluvia',
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

      console.log('Clase cancelada por lluvia:', revision);

      // Actualizar estado local inmediatamente
      setRevisiones([...revisiones, revision]);
      setShowModal(false);
      alert('Clase cancelada por lluvia 🌧️\nLa clase ya no aparecerá en Pendientes y se guardó en el Historial.');
    } catch (error) {
      console.error('Error cancelando clase:', error);
      alert('Error al guardar la revisión. Revisa la consola.');
    }
  };

  // Verificar si una clase tiene plena coincidencia
  const tieneCoincidenciaPlena = (clase) => {
    const estudiantesArray = Object.values(clase.estudiantes);

    // Verificar que todos los estudiantes tengan coincidencia (presente o ausente)
    return estudiantesArray.every(estudiante => {
      const inc = detectarInconsistencia(estudiante);
      return inc.tipo === 'coincide' || inc.tipo === 'coincide_ausente';
    });
  };

  // Aprobar masivamente clases con plena coincidencia
  const aprobarClasesMasivo = async () => {
    // Obtener las clases filtradas pendientes
    const clasesPendientes = clasesKeys.map(key => ({
      key,
      ...clases[key]
    }));

    // Filtrar solo las que tienen plena coincidencia
    const clasesCoincidentes = clasesPendientes.filter(clase =>
      tieneCoincidenciaPlena(clase)
    );

    if (clasesCoincidentes.length === 0) {
      alert('No hay clases con plena coincidencia para aprobar.');
      return;
    }

    const confirmacion = window.confirm(
      `¿Deseas aprobar ${clasesCoincidentes.length} clase(s) con plena coincidencia?\n\n` +
      clasesCoincidentes.map(c => `- ${c.grupo} (${c.horario})`).join('\n')
    );

    if (!confirmacion) return;

    setLoading(true);
    const nuevasRevisiones = [];

    try {
      // Crear revisiones para cada clase
      for (const clase of clasesCoincidentes) {
        const revision = {
          ID_Revision: `REV_${Date.now()}_${clase.grupo}`,
          Fecha: clase.fecha,
          Grupo_Codigo: clase.grupo,
          profesor: clase.profesor || 'Sin asignar',
          Estado_Revision: 'Aprobado',
          Notas: 'Aprobado automáticamente - Plena coincidencia',
          Revisado_Por: 'Coordinador (Masivo)',
          Timestamp: new Date().toISOString()
        };

        await fetch(API_CONFIG.REVISIONES, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(revision)
        });

        nuevasRevisiones.push(revision);
        console.log('Clase aprobada masivamente:', revision);

        // Pequeña pausa para evitar saturar la API
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Actualizar estado local
      setRevisiones([...revisiones, ...nuevasRevisiones]);
      setLoading(false);
      alert(
        `✅ ${clasesCoincidentes.length} clase(s) aprobada(s) exitosamente!\n\n` +
        'Las clases ya no aparecerán en Pendientes.'
      );
    } catch (error) {
      setLoading(false);
      console.error('Error en aprobación masiva:', error);
      alert('Error al aprobar algunas clases. Revisa la consola.');
    }
  };

  const clasesKeys = filtrarClases(clases);
  const clasesPorHorario = agruparPorHorario(clases, clasesKeys);

  // Obtener listas únicas para filtros
  const profesores = [...new Set(maestroGrupos.map(g => g.Profe).filter(Boolean))];
  const grupos = [...new Set(maestroGrupos.map(g => g.Código).filter(Boolean))];
  const canchas = [...new Set(maestroGrupos.map(g => g.Cancha).filter(Boolean))];

  // Filtrar revisiones por fecha seleccionada para el historial
  const revisionesFiltradas = revisiones.filter(rev => rev.Fecha === selectedDate);

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

          {currentPage === 'pendientes' && (
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.soloInconsistencias}
                  onChange={(e) => setFilters({ ...filters, soloInconsistencias: e.target.checked })}
                  className="w-4 h-4"
                />
                <span>Solo inconsistencias</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.todasLasFechas}
                  onChange={(e) => setFilters({ ...filters, todasLasFechas: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="font-medium text-blue-600">📅 Todas las fechas</span>
              </label>
            </>
          )}

          <button
            onClick={() => setFilters({ profesor: '', grupo: '', cancha: '', soloInconsistencias: false, todasLasFechas: false })}
            className="ml-auto px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Limpiar filtros
          </button>

          {currentPage === 'pendientes' && (
            <button
              onClick={aprobarClasesMasivo}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              ✅ Aprobar clases con coincidencia total
            </button>
          )}
        </div>
      </div>

      {/* Leyenda */}
      {currentPage === 'pendientes' && (
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
      )}

      {/* Contenido principal */}
      <div className="max-w-7xl mx-auto p-4">
        {loading ? (
          <div className="text-center py-12">
            <Clock className="animate-spin mx-auto mb-4" size={48} />
            <p>Cargando datos...</p>
          </div>
        ) : currentPage === 'pendientes' ? (
          <>
            <div className="mb-4">
              <h2 className="text-2xl font-bold">
                {filters.todasLasFechas
                  ? 'Clases pendientes - Todas las fechas'
                  : `Clases pendientes del ${selectedDate}`}
              </h2>
              <p className="text-gray-600 mt-1">
                {filters.todasLasFechas
                  ? 'Mostrando clases de todas las fechas pendientes de revisión'
                  : `${obtenerDiaSemana(selectedDate)} - Mostrando solo grupos de este día`}
              </p>
            </div>
            
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
                          <div className="w-full">
                            <h4 className="font-bold text-lg mb-1">{clase.grupo}</h4>
                            {filters.todasLasFechas && (
                              <p className="text-sm text-blue-600 font-semibold">
                                📅 {clase.fecha} ({obtenerDiaSemana(clase.fecha)})
                              </p>
                            )}
                            <p className="text-sm text-gray-700 font-medium">
                              👤 {clase.profesor || 'Profesor no asignado'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">📍 Cancha {clase.cancha || 'N/A'}</p>
                          </div>
                          {tieneInconsistencia && (
                            <AlertTriangle className="text-red-500 flex-shrink-0" size={24} />
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
                <CheckCircle className="mx-auto mb-4 text-green-500" size={64} />
                <p className="text-xl font-semibold text-gray-700 mb-2">¡Todo al día!</p>
                <p className="text-gray-500">
                  {filters.todasLasFechas
                    ? 'No hay clases pendientes de revisión en ninguna fecha'
                    : `No hay clases pendientes de revisión para ${obtenerDiaSemana(selectedDate)}, ${selectedDate}`}
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  {filters.profesor || filters.grupo || filters.cancha || filters.soloInconsistencias || filters.todasLasFechas
                    ? 'Intenta limpiar los filtros para ver más resultados'
                    : 'Las clases se filtran automáticamente por día de la semana'}
                </p>
              </div>
            )}
          </>
        ) : (
          <div>
            <h2 className="text-2xl font-bold mb-4">Historial de Revisiones - {selectedDate}</h2>
            <div className="bg-white rounded-lg shadow-md p-6">
              {revisionesFiltradas.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="mx-auto mb-4 text-gray-400" size={48} />
                  <p className="text-gray-500">No hay revisiones para esta fecha</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {revisionesFiltradas.map(rev => (
                    <div key={rev.ID_Revision} className="border-b pb-3 last:border-b-0">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <p className="font-bold text-lg">{rev.Grupo_Codigo}</p>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              rev.Estado_Revision === 'Aprobado' 
                                ? 'bg-green-100 text-green-700' 
                                : rev.Estado_Revision === 'Cancelada por Lluvia'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {rev.Estado_Revision === 'Aprobado' 
                                ? '✅ Aprobado' 
                                : rev.Estado_Revision === 'Cancelada por Lluvia'
                                ? '🌧️ Cancelada por Lluvia'
                                : '⏸️ Pendiente'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-1">Profesor: {rev.profesor}</p>
                          <p className="text-xs text-gray-500 mb-2">
                            Revisado por: {rev.Revisado_Por} - {new Date(rev.Timestamp).toLocaleString()}
                          </p>
                          {rev.Notas && (
                            <div className="bg-gray-50 p-3 rounded mt-2">
                              <p className="text-sm font-medium text-gray-700 mb-1">Notas:</p>
                              <p className="text-sm text-gray-600 italic">"{rev.Notas}"</p>
                            </div>
                          )}
                        </div>
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
                  onClick={cancelarPorLluvia}
                  className="flex-1 py-3 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition"
                >
                  🌧️ Cancelada por lluvia
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
