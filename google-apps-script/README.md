# Google Apps Script - Validador de Asistencias

## Semestre 2026-1

### Hojas de Cálculo Configuradas

| Tipo | ID | URL |
|------|----|----|
| **Sistema** | `1qEM6-CFjC6I1eVdy6yVCN_mBYX06SDojXkMJ7R20LWU` | [Abrir](https://docs.google.com/spreadsheets/d/1qEM6-CFjC6I1eVdy6yVCN_mBYX06SDojXkMJ7R20LWU/edit) |
| Juan Andrés | `1JYRLl0gdwFgQ9bPXjDB4wT1scN3WCTuyUfCAI9hudLo` | [Abrir](https://docs.google.com/spreadsheets/d/1JYRLl0gdwFgQ9bPXjDB4wT1scN3WCTuyUfCAI9hudLo/edit) |
| Ricardo | `1KZ9fL5NCPT0s-s6cpeN072Kz6x6G7iaGR50VnxfVGV4` | [Abrir](https://docs.google.com/spreadsheets/d/1KZ9fL5NCPT0s-s6cpeN072Kz6x6G7iaGR50VnxfVGV4/edit) |
| Stivens | `1Lc-THweqGI78PFfoCvxPCXmZTRz_iW77nalraU8myO0` | [Abrir](https://docs.google.com/spreadsheets/d/1Lc-THweqGI78PFfoCvxPCXmZTRz_iW77nalraU8myO0/edit) |
| Wilman | `1nqfrzh8_FDPPQvMRZ4em-hAVLNTh3RoOEvWoWul8I44` | [Abrir](https://docs.google.com/spreadsheets/d/1nqfrzh8_FDPPQvMRZ4em-hAVLNTh3RoOEvWoWul8I44/edit) |
| Yeison | `1y81LHGPb8uULyCgOddCj8gKwPIQr8DmvDxrlEofWoGY` | [Abrir](https://docs.google.com/spreadsheets/d/1y81LHGPb8uULyCgOddCj8gKwPIQr8DmvDxrlEofWoGY/edit) |

### Instrucciones de Despliegue

1. **Crear el proyecto en Google Apps Script**
   - Ve a [https://script.google.com](https://script.google.com)
   - Clic en "Nuevo proyecto"
   - Nombra el proyecto: "ValidadorAsistencias-2026-1"

2. **Copiar el código**
   - Elimina el contenido del archivo `Code.gs` existente
   - Copia todo el contenido de `Code.gs` de esta carpeta
   - Pégalo en el editor

3. **Configurar permisos**
   - Ejecuta la función `testConnection()` desde el editor (menú Ejecutar)
   - Autoriza los permisos cuando se solicite
   - Verifica en los logs que todas las hojas se conectan correctamente

4. **Desplegar como aplicación web**
   - Clic en "Implementar" > "Nueva implementación"
   - Selecciona el tipo: "Aplicación web"
   - Configura:
     - **Descripción**: "Validador Asistencias 2026-1"
     - **Ejecutar como**: "Yo" (tu cuenta de Google)
     - **Quién tiene acceso**: "Cualquier persona"
   - Clic en "Implementar"

5. **Copiar la URL**
   - Copia la URL de la aplicación web generada
   - Tiene formato: `https://script.google.com/macros/s/XXXXX/exec`

6. **Actualizar App.js**
   - Abre `/src/App.js`
   - Reemplaza la línea `API_BASE_URL` con la nueva URL

### Endpoints Disponibles

| Endpoint | Descripción |
|----------|-------------|
| `?sheet=asistencias` | Asistencias del Reporte Consolidado |
| `?sheet=asistencias_profes` | Asistencias de todos los profesores |
| `?sheet=maestro_grupos` | Maestro de grupos |
| `?sheet=estudiantes` | Lista de estudiantes (matrícula) |
| `?sheet=revisiones` | Historial de revisiones |
| `?sheet=reposiciones` | Reposiciones pendientes |

### Pestañas Requeridas en Hoja del Sistema

La hoja de sistema debe tener estas pestañas:
- `Matrícula` - Datos de estudiantes matriculados
- `Grupos` - Configuración de grupos
- `Reposiciones` - Registro de reposiciones
- `Reporte_Consolidado` - Asistencias consolidadas
- `Revisiones` - Se crea automáticamente para guardar revisiones

### Solución de Problemas

**Error: "No se encontró la hoja X"**
- Verifica que el nombre de la pestaña coincida exactamente (mayúsculas/acentos)

**Error: "No tienes permiso"**
- Asegúrate de que tu cuenta tenga acceso a todas las hojas de cálculo
- Vuelve a ejecutar `testConnection()` y autoriza los permisos

**Los datos no se actualizan**
- Después de cambiar el código, debes crear una nueva implementación
- La URL cambia con cada nueva implementación
