# Entrega académica – Autos Colombia (Iteraciones 1 y 2)

## Contenido entregado
- Aplicativo web y API REST (Node.js + Express).
- Persistencia PostgreSQL y script de creación con datos demostrativos.
- Gestión de operaciones, mensualidades/pagos, novedades, usuarios, vehículos y celdas.
- Documentación académica en PDF y Word editable.
- Requerimientos, historias de usuario, mockups, diagramas UML y plan de pruebas dentro de `docs/`.
- Guion para grabar el video demostrativo: `docs/GUION_VIDEO.md`.
- Configuración Docker para levantar aplicación y base de datos en conjunto.

## Opción A – Ejecutar con Docker (recomendada)
Requiere Docker Desktop con Docker Compose.
1. Descomprime el proyecto.
2. Abre una terminal dentro de esta carpeta.
3. Ejecuta: `docker compose up --build`
4. Abre: http://localhost:3000
5. Comprueba la API: http://localhost:3000/api/health

Para detener: `docker compose down`.
Para borrar también la base de datos local de demostración: `docker compose down -v`
(esto elimina los datos guardados en el volumen).

La primera inicialización ejecuta `database/script_pg.sql` y carga datos de ejemplo.
Si el volumen ya existe, PostgreSQL no vuelve a ejecutar el script automáticamente.

## Opción B – Ejecutar sin Docker
Requisitos: Node.js 18+ y PostgreSQL 12+.
1. Crea la base `autoscolombiadb` en PostgreSQL.
2. Ejecuta `database/script_pg.sql` conectado a esa base. **El script recrea las tablas y borra los datos previos.**
3. Copia `.env.example` a `.env` y configura `DB_PASSWORD` con tu contraseña local.
4. En esta carpeta ejecuta `npm install`.
5. Ejecuta `npm run bd:migrar` si la base ya existía y quieres conservar datos; para base nueva, el script `script_pg.sql` ya incluye autenticación.
6. Habilita el administrador con `npm run admin:crear -- 9999999999 admin "Una-Clave-Privada-2026!"`.
7. Ejecuta `npm start`.
8. Abre http://localhost:3000 y valida `/api/health`.

## Pruebas
Ejecuta `npm test` con PostgreSQL encendido y la base configurada. Las pruebas de integración
utilizan la base indicada en `.env` y limpian algunos registros de prueba; no ejecutes contra
una base con información real. Se agregó una suite unitaria de seguridad (`tests/auth.test.js`) para hash de contraseñas, sesiones y permisos. Las pruebas de integración requieren dependencias instaladas y PostgreSQL configurado; no se pudieron ejecutar aquí porque no había PostgreSQL disponible y el registro npm no estuvo accesible para instalar dependencias. La suite unitaria de seguridad sí se ejecutó: 3 pruebas aprobadas.

## Preparación para GitHub
El ZIP está limpio: no incluye `.git`, `.env`, contraseñas ni `node_modules`.
En la carpeta del proyecto:
```bash
git init
git add .
git commit -m "Entrega Autos Colombia - iteraciones 1 y 2"
git branch -M main
git remote add origin https://github.com/USUARIO/REPOSITORIO.git
git push -u origin main
```
Sustituye la URL por la del repositorio que te corresponda. Si ya tienes un repositorio
remoto creado, no repitas `git remote add origin`; revisa primero `git remote -v`.

## Pendiente antes de entregar
- Completar en `docs/DOCUMENTACION_EA2_editable.docx` el nombre del estudiante y los datos
  institucionales que solicite la portada, si faltan.
- Grabar y subir el video siguiendo `docs/GUION_VIDEO.md`.
- Pegar el enlace real de YouTube en la sección 2.8 del documento y comprobar que se pueda abrir.
- Ejecutar `npm test` en un equipo con PostgreSQL y adjuntar/capturar el resultado real.
- Confirmar que el repositorio GitHub contiene la misma versión final del ZIP.

## Seguridad y alcance conocido
Esta versión incorpora login, contraseñas protegidas con scrypt, cookie de sesión HttpOnly y permisos en backend para Administrador, Operario y Cliente. Las sesiones están almacenadas en memoria y se invalidan al reiniciar el servidor; para producción se recomienda un almacén persistente de sesiones, HTTPS con `COOKIE_SECURE=true`, protección adicional contra fuerza bruta y secretos robustos. Configure `PAGO_WEBHOOK_SECRET` para el sistema de pagos externo. Los datos y tarifas incluidos son demostrativos/configurables. Consulte `docs/SEGURIDAD_LOGIN_ROLES.md` y `docs/GUIA_LOGIN_ROLES.md`.
