# Trabajo práctico 05 - Salas - Middleware

## Descripción

Aplicación web para consultar salas de estudio y reservar un turno, éste ultimo de manera termporal. Basada en tecnologias tales como: Node.js + Express, vistas con EJS.
Incluye un layout principal y registro de solicitudes con Morgan. 

Las reservas se guardan solo en memoria, en un array dentro de src/index.js. No hay persistencia en disco: al reiniciar el servidor vuelven a quedar únicamente las tres reservas iniciales.

## Instalación

Para instalar y ejecutar el proyecto localmente, se deben seguir los siguientes pasos.

1. Clonacion del repositorio
El proyecto se encuentra alojado en la nube de GitHub. Para obtener una copia local, abrir una terminal y ejecutar:

Consola bash se tipea lo siguiente:

git clone url del repositorio

Luego ingresar a la carpeta del proyecto:

Consola bash cd tp-05-salas-middleware

2. Instalacion de las dependencias
Una vez dentro de la carpeta del proyecto, abrir una terminal e instalar las dependencias, para ello:

Consola bash, se tipea y ejecuta el siguiente comando

npm install

Este comando instala los paquetes necesarios definidos para que la aplicación pueda ejecutarse correctamente, entre ellos Express, EJS, express-ejs-layouts y morgan.


## Ejecución

Consola bash, se tipea y ejecuta el siguiente comando
npm start


La aplicación queda disponible en http://localhost:3000

Para verificar que el archivo principal no tiene errores de sintaxis, sin llegar a ejecutarlo:

Consola bash, se tipea y ejecuta el siguiente comando
npm run check


## Rutas

| Método | Ruta              | Descripción                                               |
|--------|-------------------|-----------------------------------------------------------|
| GET    | "/"               | Página de inicio, con enlaces al listado y al formulario. |
| GET    | "/estado"         | JSON con "servicio", "cantidadReservas" y "solicitudId".  |
| GET    | "/reservas"       | Listado de reservas (o estado vacío).                     |
| GET    | "/reservas/nueva" | Formulario de alta.                                       |
| GET    | "/reservas/:id"   | Detalle de una reserva, o 404 HTML si no existe.          |
| POST   | "/reservas"       | Valida y crea una reserva; redirige a "/reservas".        |

"GET /reservas/nueva" está declarada antes que "GET /reservas/:id" dentro del router. Express evalúa las rutas en el orden en que se registran, así que si ":id" fuera primero, la palabra "nueva" sería interpretada como un identificador y nunca se llegaría al formulario.

## Pipeline de middleware

El orden en "src/index.js" es el siguiente:


morgan("dev")
identificarSolicitud
medirDuracion
expressLayouts
express.static("public")
express.urlencoded()
express.json()
rutas de aplicación ( / , /estado )
reservasRouter
prepararAreaReservas
(rutas internas: / , /nueva , /:id , POST /)


Justificación del orden:

- "Morgan primero": para que quede registrada absolutamente toda solicitud que entra a la aplicación, incluidas las que después terminan en error.
- "identificarSolicitud" y "medirDuracion" antes que cualquier  ruta: necesitan ejecutarse para *toda* solicitud (incluidas las que van a 404), no sólo para las de negocio.
- "expressLayouts" antes de las rutas**: las rutas usan "res.render", que ya necesita tener el layout configurado.
- "express.static" antes de los parsers**: los archivos estáticos no leen "req.body", así que no dependen de ellos; se sirven apenas llegan.
- "express.urlencoded" y "express.json" antes de las rutas de aplicación: el formulario de reservas envía datos codificados como "urlencoded", y "validarReserva" necesita "req.body" ya parseado antes de poder revisarlo. Si los parsers fueran después, "req.body" llegaría "undefined" al POST.
- "El router de reservas después de las rutas sueltas** ("/" y "/estado"): no es estrictamente obligatorio, pero mantiene juntas primero las rutas de nivel raíz y después el área de reservas.
- "El middleware 404 al final de todo": Express recorre el pipeline en orden; si ninguna ruta anterior respondió, se llega a este middleware, que no depende de ningún parámetro de ruta y por eso puede capturar cualquier URL no reconocida.

## Alcance de cada función

| Función                  | Alcance  | Dónde se registra        | Qué hace |
|--------------------------|----------|--------------------------|----------|
| `identificarSolicitud`   | Global   | `app.use(...)`           | Genera `SOL-0001`, `SOL-0002` 
| `medirDuracion`          | Global   | `app.use(...)`           | Guarda el tiempo de inicio, escucha `finish` en `res` y recién ahí calcula y loguea la duración. |
| `prepararAreaReservas`   | Router   | `reservasRouter.use(...)`| Define `res.locals.seccion = "Reservas de salas"`, usado por las vistas del área. No corre para `/` ni `/estado`. |
| `validarReserva`         | Ruta     | `reservasRouter.post("/", validarReserva, crearReserva)` | Sólo corre para `POST /reservas`. Normaliza y valida `req.body`. |
| `crearReserva`           | Ruta     | ídem                      | Handler final: agrega la reserva en memoria y renderiza y redirige  |

- **Global**: se registra con `app.use(fn)` sin ruta, corre para toda solicitud que entra a la aplicación.
- **De router**: se registra con `router.use(fn)` dentro de un `express.Router()`; sólo corre para las solicitudes que matchean el prefijo con el que se montó ese router (`/reservas`).
- **De ruta**: se pasa como argumento intermedio de un verbo HTTP puntual (`router.post("/", fn, handler)`); sólo corre para esa combinación exacta de método y path.

### Middleware incorporado, de terceros y personalizado

- **Incorporado** (viene con Express): "express.static", "express.urlencoded", "express.json".
- **De terceros** (paquetes externos instalados vía npm): "morgan" y "express-ejs-layouts".
- **Personalizado** (escrito para este TP): "identificarSolicitud", "medirDuracion", "prepararAreaReservas", "validarReserva".

### next()

Cada middleware recibe `(req, res, next)`. Si no responde la solicitud él mismo, **debe** llamar a `next()` para que Express siga con el siguiente middleware o ruta en el pipeline; si nunca lo llama ni responde, la solicitud queda colgada. Un middleware que sí responde (por ejemplo `validarReserva` en el camino inválido, o el middleware 404) **no** debe llamar a `next()` después de renderizar o enviar la respuesta.

### Parsers antes de validar

`express.urlencoded` y `express.json` tienen que registrarse **antes** de cualquier ruta que lea `req.body`. Son los que efectivamente completan `req.body` a partir del cuerpo crudo de la solicitud; si `validarReserva` corriera antes de ellos, `req.body` estaría vacío o `undefined` y la validación fallaría siempre.

### Evento `finish`

`finish` se dispara sobre el objeto `res` cuando la respuesta terminó de enviarse al cliente (headers y body ya salieron). Es el único momento en el que `res.statusCode` es definitivo y en el que tiene sentido calcular cuánto tardó la solicitud de punta a punta. Por eso `medirDuracion` guarda el tiempo de inicio, registra un listener de `finish` y llama a `next()` de inmediato: la medición se resuelve más tarde, de forma asincrónica, sin bloquear el resto del pipeline.

### Montaje del router


const reservasRouter = express.Router();
// ...rutas internas relativas: "/", "/nueva", "/:id"...
app.use("/reservas", reservasRouter);


Las rutas dentro de `reservasRouter` se escriben **relativas** al prefijo de montaje: adentro del router es `"/"`, `"/nueva"`, `"/:id"`; Express les antepone `/reservas` automáticamente. Por eso nunca se escribe `/reservas/nueva` dentro del router: sería duplicar el prefijo.

### POST 302 frente al GET posterior

Cuando `POST /reservas` es válido, `crearReserva` responde con `res.redirect("/reservas")`, que es un **302** (redirección
temporal). El navegador, al recibir ese 302, dispara automáticamente un **segundo request, `GET /reservas`**, que es el que finalmente devuelve el HTML con el listado actualizado. Son dos solicitudes distintas (y por lo tanto dos líneas distintas en el log de Morgan y dos mediciones de `medirDuracion`), no una sola.

### Memoria temporal

El array `reservas` vive en una variable de módulo dentro de `src/index.js`. Los `push` que hace `crearReserva` modifican ese array mientras el proceso de Node sigue corriendo, pero no se escribe nada en disco. Al detener y volver a iniciar el servidor (`npm start`), el array se reconstruye desde cero con las cuatro reservas iniciales definidas en el código.

## Validación

`validarReserva` se ejecuta únicamente para `POST /reservas`, como middleware intermedio antes del handler `crearReserva`:

1. Normaliza los campos de texto con `.trim()` y convierte `personas`
   con `Number(...)`.
2. Verifica que `estudiante`, `email` y `fecha` no estén vacíos.
3. Verifica que `sala` sea una de `"Sala Norte"`, `"Sala Sur"` o
   `"Sala Multimedia"`.
4. Verifica que `turno` sea uno de `"Mañana"`, `"Tarde"` o `"Noche"`.
5. Verifica que `personas` sea un entero entre 1 y 6.
6. Verifica que `email` contenga `@`.

**Camino inválido**: responde `res.status(400).render("reservas/nueva", ...)` conservando los valores enviados (`valores: req.body`), mostrando los mensajes de error dentro de un contenedor con `role="alert"`, y **no llama a `next()`**.

**Camino válido**: arma `req.reservaValidada` con los datos ya normalizados y llama a `next()`, para que `crearReserva` agregue el registro sin tener que repetir ninguna validación.


## Pruebas manuales


| # | Caso                                                           | Resultado esperado |
|---|----------------------------------------------------------------|---------------------|
| 1 | `GET /`                                                        | 200, enlaces a listado y formulario |
| 2 | `GET /estado`                                                  | 200, JSON con `servicio: "activo"`, `cantidadReservas`, `solicitudId` |
| 3 | `GET /reservas` (con las 4 iniciales)                          | 200, cuatro tarjetas |
| 4 | `GET /reservas` con el array vacío (editando el código a mano) | 200, mensaje de estado vacío |
| 5 | `GET /reservas/nueva`                                          | 200, formulario con los 6 campos |
| 6 | `GET /reservas/1`                                              | 200, detalle completo |
| 7 | `GET /reservas/999`                                            | 404, página HTML de "no encontrado" |
| 8 | `POST /reservas` con campos vacíos                             | 400, no se crea nada, mensaje con `role="alert"` |
| 9 | `POST /reservas` con `sala` no permitida                       | 400, no se crea nada |
| 10 | `POST /reservas` con `turno` no permitido                     | 400, no se crea nada |
| 11 | `POST /reservas` con `email` sin `@`                          | 400, no se crea nada |
| 12 | `POST /reservas` con `personas=0` o `personas=7`              | 400, no se crea nada |
| 13 | `POST /reservas` con todos los datos válidos                  | 302 a `/reservas`, luego `GET /reservas` en 200 muestra la nueva tarjeta |
| 14 | `GET /ruta-inexistente`                                       | 404 por el middleware final |
| 15 | Reiniciar el servidor tras crear una reserva nueva            | `/reservas` vuelve a mostrar sólo las 4 iniciales |

Para cada uno de estos casos conviene mirar también la consola: debe aparecer la línea de Morgan (método, ruta, status) y, debajo o mezclada según el orden real de ejecución, la línea propia de `medirDuracion` con el `solicitudId`, el status y los milisegundos.

## Persistencia temporal

No hay base de datos ni archivo de datos en esta entrega: el array `reservas` se define directamente en `src/index.js` y vive únicamente en la memoria del proceso de Node mientras el servidor está corriendo. Reiniciar el proceso equivale a "resetear" los datos a su estado inicial.

## Diagramas

### POST válido


POST /reservas
morgan("dev")
identificarSolicitud
medirDuracion
expressLayouts
express.urlencoded
reservasRouter
prepararAreaReservas
validarReserva (todo OK, no responde, llama next())
crearReserva
res.redirect → 302 /reservas
finish → medirDuracion loguea (ID, 302, duración)


Después de ese 302, el navegador dispara un `GET /reservas` aparte, que atraviesa el pipeline completo de nuevo y responde 200 con el listado ya actualizado.

### POST inválido


POST /reservas
morgan("dev")
identificarSolicitud
medirDuracion
expressLayouts
express.urlencoded
reservasRouter
prepararAreaReservas
validarReserva (detecta errores)
res.status(400).render("reservas/nueva", ...)
(NO llama a next(), termina acá)
finish → medirDuracion loguea (ID, 400, duración)


Con el POST inválido, la solicitud termina dentro de **`validarReserva`**: `crearReserva` nunca se ejecuta, no se modifica
el array `reservas`, y la respuesta 400 se renderiza con los valores enviados y los mensajes de error.
