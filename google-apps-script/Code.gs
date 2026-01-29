/**
 * Google Apps Script - Validador de Asistencias
 * Semestre 2026-1
 *
 * INSTRUCCIONES DE DESPLIEGUE:
 * 1. Ve a https://script.google.com y crea un nuevo proyecto
 * 2. Copia todo este código en el editor
 * 3. Haz clic en "Implementar" > "Nueva implementación"
 * 4. Selecciona tipo: "Aplicación web"
 * 5. Configura:
 *    - Ejecutar como: "Yo" (tu cuenta)
 *    - Quién tiene acceso: "Cualquier persona"
 * 6. Copia la URL generada y actualízala en App.js
 */

// =====================================================
// VALIDADOR_CONFIGURACIÓN DE HOJAS DE CÁLCULO - SEMESTRE 2026-1
// =====================================================

const VALIDADOR_CONFIG = {
  // Hoja principal del sistema (Matrícula, Grupos, Reposiciones, Reporte_Consolidado)
  SISTEMA: '1qEM6-CFjC6I1eVdy6yVCN_mBYX06SDojXkMJ7R20LWU',

  // Hojas de informes por profesor
  PROFESORES: {
    'Juan Andrés': '1JYRLl0gdwFgQ9bPXjDB4wT1scN3WCTuyUfCAI9hudLo',
    'Ricardo': '1KZ9fL5NCPT0s-s6cpeN072Kz6x6G7iaGR50VnxfVGV4',
    'Stivens': '1Lc-THweqGI78PFfoCvxPCXmZTRz_iW77nalraU8myO0',
    'Wilman': '1nqfrzh8_FDPPQvMRZ4em-hAVLNTh3RoOEvWoWul8I44',
    'Yeison': '1y81LHGPb8uULyCgOddCj8gKwPIQr8DmvDxrlEofWoGY'
  },

  // Nombres de las pestañas en la hoja del sistema
  SHEETS: {
    MATRICULA: 'Matrícula',
    GRUPOS: 'Grupos',
    REPOSICIONES: 'Reposiciones',
    REPORTE_CONSOLIDADO: 'Reporte_Consolidado',
    ASISTENCIA_PROFES: 'AsistenciaProfes',
    REVISIONES: 'Revisiones'  // Pestaña para guardar revisiones
  }
};

// =====================================================
// FUNCIONES PRINCIPALES
// =====================================================

/**
 * Maneja las peticiones GET
 */
function doGet(e) {
  const sheet = e.parameter.sheet;

  let result;

  switch(sheet) {
    case 'asistencias':
      result = getAsistenciasPF();
      break;
    case 'asistencias_profes':
      result = getAsistenciasProfesores();
      break;
    case 'maestro_grupos':
      result = getMaestroGrupos();
      break;
    case 'estudiantes':
      result = getEstudiantes();
      break;
    case 'revisiones':
      result = getRevisiones();
      break;
    case 'reposiciones':
      result = getReposiciones();
      break;
    default:
      result = { error: 'Parámetro sheet no válido' };
  }

  // Si hay error, retornarlo directamente
  if (result && result.error) {
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Envolver el resultado en la estructura esperada por el frontend
  const response = {
    data: result,
    count: Array.isArray(result) ? result.length : 0
  };

  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Maneja las peticiones POST (guardar revisiones)
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const result = guardarRevision(data);

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// =====================================================
// FUNCIONES DE LECTURA DE DATOS
// =====================================================

/**
 * Obtiene las asistencias del Reporte Consolidado (PF)
 * Mapea los nombres de columnas al formato esperado por el frontend
 */
function getAsistenciasPF() {
  const ss = SpreadsheetApp.openById(VALIDADOR_CONFIG.SISTEMA);
  const sheet = ss.getSheetByName(VALIDADOR_CONFIG.SHEETS.REPORTE_CONSOLIDADO);

  if (!sheet) {
    return { error: 'No se encontró la hoja ' + VALIDADOR_CONFIG.SHEETS.REPORTE_CONSOLIDADO };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // Mapeo de columnas: nombre en hoja -> nombre esperado por frontend
  const columnMapping = {
    'FECHA': 'Fecha',
    'COD_GRUPO': 'Grupo_Codigo',
    'COD_ESTUDIANTE': 'Estudiante_ID',
    'NOMBRE': 'Nombre',
    'ESTADO_ASISTENCIA': 'Estado',
    'TIPO': 'Tipo_Clase'
  };

  const result = [];
  for (let i = 1; i < data.length; i++) {
    const row = {
      Enviado_Por: 'usuario'  // Marcar como datos del PF
    };

    for (let j = 0; j < headers.length; j++) {
      let value = data[i][j];
      const headerName = headers[j];

      // Formatear fechas al formato yyyy-MM-dd para consistencia
      if (value instanceof Date) {
        value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }

      // Usar nombre mapeado si existe, sino usar nombre original
      const mappedName = columnMapping[headerName] || headerName;
      row[mappedName] = value;
    }

    // Convertir estado P/A al formato completo
    if (row['Estado'] === 'P') row['Estado'] = 'Presente';
    if (row['Estado'] === 'A') row['Estado'] = 'Ausente';
    if (row['Estado'] === 'J') row['Estado'] = 'Justificado';

    // Solo agregar filas con datos válidos
    if (row['Fecha'] && row['Grupo_Codigo']) {
      result.push(row);
    }
  }

  return result;
}

/**
 * Obtiene las asistencias de todos los profesores desde la hoja consolidada AsistenciaProfes
 */
function getAsistenciasProfesores() {
  const ss = SpreadsheetApp.openById(VALIDADOR_CONFIG.SISTEMA);
  const sheet = ss.getSheetByName(VALIDADOR_CONFIG.SHEETS.ASISTENCIA_PROFES);

  if (!sheet) {
    return { error: 'No se encontró la hoja ' + VALIDADOR_CONFIG.SHEETS.ASISTENCIA_PROFES };
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return []; // Solo encabezados o vacía

  const headers = data[0];

  const result = [];
  for (let i = 1; i < data.length; i++) {
    const row = {};

    for (let j = 0; j < headers.length; j++) {
      let value = data[i][j];
      const headerName = headers[j];

      // Formatear fechas al formato yyyy-MM-dd para consistencia
      if (value instanceof Date) {
        value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }

      row[headerName] = value;
    }

    // Marcar como datos del profesor
    row['Enviado_Por'] = row['Enviado_Por'] || 'profesor';

    // Solo agregar filas con datos válidos (no duplicados y con fecha)
    if (row['Fecha'] && row['Grupo_Codigo'] && row['Es_Duplicado'] !== true && row['Es_Duplicado'] !== 'TRUE') {
      result.push(row);
    }
  }

  return result;
}

/**
 * Obtiene el maestro de grupos
 */
function getMaestroGrupos() {
  const ss = SpreadsheetApp.openById(VALIDADOR_CONFIG.SISTEMA);
  const sheet = ss.getSheetByName(VALIDADOR_CONFIG.SHEETS.GRUPOS);

  if (!sheet) {
    return { error: 'No se encontró la hoja ' + VALIDADOR_CONFIG.SHEETS.GRUPOS };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const result = [];
  for (let i = 1; i < data.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    // Solo agregar filas con código de grupo
    if (row['Código'] || row['Codigo']) {
      result.push(row);
    }
  }

  return result;
}

/**
 * Obtiene la lista de estudiantes (matrícula)
 * Mapea los nombres de columnas al formato esperado por el frontend
 */
function getEstudiantes() {
  const ss = SpreadsheetApp.openById(VALIDADOR_CONFIG.SISTEMA);
  const sheet = ss.getSheetByName(VALIDADOR_CONFIG.SHEETS.MATRICULA);

  if (!sheet) {
    return { error: 'No se encontró la hoja ' + VALIDADOR_CONFIG.SHEETS.MATRICULA };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const result = [];
  for (let i = 1; i < data.length; i++) {
    const codEstudiante = data[i][0]; // Primera columna: COD ESTUDIANTE
    const nombreEstudiante = data[i][1]; // Segunda columna: ESTUDIANTE

    // Solo agregar filas con código de estudiante válido
    if (codEstudiante && codEstudiante !== '' && codEstudiante !== '#N/A') {
      result.push({
        ID: codEstudiante,
        Nombre: nombreEstudiante
      });
    }
  }

  return result;
}

/**
 * Obtiene las reposiciones
 */
function getReposiciones() {
  const ss = SpreadsheetApp.openById(VALIDADOR_CONFIG.SISTEMA);
  const sheet = ss.getSheetByName(VALIDADOR_CONFIG.SHEETS.REPOSICIONES);

  if (!sheet) {
    return { error: 'No se encontró la hoja ' + VALIDADOR_CONFIG.SHEETS.REPOSICIONES };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const result = [];
  for (let i = 1; i < data.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      let value = data[i][j];
      if (value instanceof Date) {
        value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy');
      }
      row[headers[j]] = value;
    }
    // Solo agregar filas con datos válidos (no #N/A)
    if (row['Fecha'] && row['Estudiante'] && row['Código'] !== '#N/A') {
      result.push(row);
    }
  }

  return result;
}

/**
 * Obtiene las revisiones guardadas
 */
function getRevisiones() {
  const ss = SpreadsheetApp.openById(VALIDADOR_CONFIG.SISTEMA);
  let sheet = ss.getSheetByName(VALIDADOR_CONFIG.SHEETS.REVISIONES);

  // Si no existe la hoja de revisiones, crearla
  if (!sheet) {
    sheet = ss.insertSheet(VALIDADOR_CONFIG.SHEETS.REVISIONES);
    sheet.appendRow(['FECHA', 'GRUPO', 'ESTADO', 'NOTAS', 'TIMESTAMP', 'USUARIO']);
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return []; // Solo encabezados

  const headers = data[0];

  const result = [];
  for (let i = 1; i < data.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      let value = data[i][j];
      if (value instanceof Date) {
        value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
      }
      row[headers[j]] = value;
    }
    if (row['FECHA'] && row['GRUPO']) {
      result.push(row);
    }
  }

  return result;
}

// =====================================================
// FUNCIONES DE ESCRITURA DE DATOS
// =====================================================

/**
 * Guarda una revisión de clase
 */
function guardarRevision(data) {
  const ss = SpreadsheetApp.openById(VALIDADOR_CONFIG.SISTEMA);
  let sheet = ss.getSheetByName(VALIDADOR_CONFIG.SHEETS.REVISIONES);

  // Si no existe la hoja de revisiones, crearla
  if (!sheet) {
    sheet = ss.insertSheet(VALIDADOR_CONFIG.SHEETS.REVISIONES);
    sheet.appendRow(['FECHA', 'GRUPO', 'ESTADO', 'NOTAS', 'TIMESTAMP', 'USUARIO']);
  }

  const timestamp = new Date();
  const usuario = Session.getActiveUser().getEmail() || 'Sistema';

  // Verificar si ya existe una revisión para esta fecha y grupo
  const existingData = sheet.getDataRange().getValues();
  let rowToUpdate = -1;

  for (let i = 1; i < existingData.length; i++) {
    const fecha = existingData[i][0];
    const grupo = existingData[i][1];

    let fechaStr = fecha;
    if (fecha instanceof Date) {
      fechaStr = Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'dd/MM/yyyy');
    }

    if (fechaStr === data.fecha && grupo === data.grupo) {
      rowToUpdate = i + 1; // +1 porque getRange usa índice 1-based
      break;
    }
  }

  if (rowToUpdate > 0) {
    // Actualizar fila existente
    sheet.getRange(rowToUpdate, 1, 1, 6).setValues([[
      data.fecha,
      data.grupo,
      data.estado,
      data.notas || '',
      timestamp,
      usuario
    ]]);
    return { success: true, message: 'Revisión actualizada', action: 'updated' };
  } else {
    // Agregar nueva fila
    sheet.appendRow([
      data.fecha,
      data.grupo,
      data.estado,
      data.notas || '',
      timestamp,
      usuario
    ]);
    return { success: true, message: 'Revisión guardada', action: 'created' };
  }
}

/**
 * Guarda múltiples revisiones (aprobación masiva)
 */
function guardarRevisionesMasivas(revisiones) {
  const results = [];
  for (const revision of revisiones) {
    const result = guardarRevision(revision);
    results.push({ ...revision, result });
  }
  return { success: true, results };
}

// =====================================================
// FUNCIONES DE UTILIDAD
// =====================================================

/**
 * Función de prueba para verificar la conexión
 */
function testConnection() {
  const tests = {
    sistema: false,
    profesores: {}
  };

  // Probar hoja del sistema
  try {
    const ss = SpreadsheetApp.openById(VALIDADOR_CONFIG.SISTEMA);
    tests.sistema = true;
    tests.sistemaSheets = ss.getSheets().map(s => s.getName());
  } catch (e) {
    tests.sistemaError = e.message;
  }

  // Probar hojas de profesores
  for (const [profesor, sheetId] of Object.entries(VALIDADOR_CONFIG.PROFESORES)) {
    try {
      const ss = SpreadsheetApp.openById(sheetId);
      tests.profesores[profesor] = {
        ok: true,
        sheets: ss.getSheets().map(s => s.getName())
      };
    } catch (e) {
      tests.profesores[profesor] = {
        ok: false,
        error: e.message
      };
    }
  }

  return tests;
}

/**
 * Función para obtener información del semestre
 */
function getInfo() {
  return {
    semestre: '2026-1',
    version: '1.0.0',
    lastUpdate: new Date().toISOString(),
    sheets: {
      sistema: VALIDADOR_CONFIG.SISTEMA,
      profesores: VALIDADOR_CONFIG.PROFESORES
    }
  };
}
