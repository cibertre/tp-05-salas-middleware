const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const morgan = require('morgan');
const path = require('path');

const PORT = 3000;

const salasPermitidas = ["Sala Norte", "Sala Sur", "Sala Multimedia"];
const turnosPermitidos = ["Mañana", "Tarde", "Noche"];

const reservas = [

    {
        id: 1,
        estudiante: "Miguel Merentiel",
        email: "miguel.merentiel@gmail.com",
        sala: "Sala Norte",
        fecha: "2026-09-23",
        turno: "Mañana",
        personas: 3
    },
    {
        id: 2,
        estudiante: "Lautaro Blanco",
        email: "lautaro_blanco@yahoo.com.ar",
        sala: "Sala Sur",
        fecha: "2026-09-24",
        turno: "Tarde",
        personas: 5,
    },
    {
        id: 3,
        estudiante: "Santiago Ascacibar",
        email: "santiago.ascacibar@hotmail.com",
        sala: "Sala Multimedia",
        fecha: "2026-09-24",
        turno: "Noche",
        personas: 6,
    },
    {
        id: 4,
        estudiante: "Leandro Paredes",
        email: "leandro.paredes@outlook.com",
        sala: "Sala Multimedia",
        fecha: "2026-09-25",
        turno: "Mañana",
        personas: 3,
    }

];
/* ------------------------------------------------------------------ */
/* Middleware personalizado de alcance GLOBAL                        */
/* ------------------------------------------------------------------ */

// Genera un identificador consecutivo (SOL-0001, SOL-0002, ...) para
// cada solicitud, lo deja en res.locals (visible en las vistas) y lo
// usa también /estado.

let numeroDeSolicitud = 0;
function identificarSolicitud(req, res, next) {
    numeroDeSolicitud += 1;
    res.locals.solicitudId = `SOL-${String(numeroDeSolicitud).padStart(4, "0")}`;
    next();
}
// Mide cuánto tarda la respuesta. Se apoya en el evento "finish" de la
// respuesta: sólo ahí se conoce la duración real y el status final,
// por eso NO se calcula nada antes de llamar a next().

function medirDuracion(req, res, next) {
    const inicio = process.hrtime.bigint();
    res.on("finish", () => {
        const fin = process.hrtime.bigint();
        const milisegundos = Number(fin - inicio) / 1_000_000;
        console.log(
            `[${res.locals.solicitudId}] ${req.method} ${req.originalUrl} ` +
            `${res.statusCode} ${milisegundos.toFixed(2)} ms`,
        );
    });
    next();
}
/* ------------------------------------------------------------------ */
/* Middleware personalizado de alcance de ROUTER (sólo /reservas/*)   */
/* ------------------------------------------------------------------ */

function prepararAreaReservas(req, res, next) {
    res.locals.seccion = "Reservas de salas";
    next();
}
/* ------------------------------------------------------------------ */
/* Middleware personalizado de alcance de RUTA (sólo POST /reservas)  */
/* ------------------------------------------------------------------ */
function validarReserva(req, res, next) {
    const estudiante = String(req.body.estudiante ?? "").trim();
    const email = String(req.body.email ?? "").trim();
    const sala = String(req.body.sala ?? "").trim();
    const fecha = String(req.body.fecha ?? "").trim();
    const turno = String(req.body.turno ?? "").trim();
    const personas = Number(req.body.personas);

    const errores = [];
    if (!estudiante) errores.push("El nombre del estudiante es obligatorio.");
    if (!email || !email.includes("@")) errores.push("El email debe contener @.");
    if (!salasPermitidas.includes(sala)) errores.push("Seleccioná una sala válida.");
    if (!fecha) errores.push("La fecha es obligatoria.");
    if (!turnosPermitidos.includes(turno)) errores.push("Seleccioná un turno válido.");
    if (!Number.isInteger(personas) || personas < 1 || personas > 6) {
        errores.push("La cantidad de personas debe ser un número entero entre 1 y 6.");
    }

    if (errores.length > 0) {
        return res.status(400).render("reservas/nueva", {
            titulo: "Nueva reserva",
            errores,
            valores: req.body,
            salas: salasPermitidas,
            turnos: turnosPermitidos,
        });
    }

    // Camino válido: se deja la reserva lista para el handler final y
    // se pasa el control con next(), sin repetir la validación.
    req.reservaValidada = { estudiante, email, sala, fecha, turno, personas };
    next();
}

function crearReserva(req, res) {
    const ultimoId = reservas.reduce(
        (mayorId, reserva) => Math.max(mayorId, reserva.id),
        0,
    );
    reservas.push({ id: ultimoId + 1, ...req.reservaValidada });
    res.redirect("/reservas");
}
/* ------------------------------------------------------------------ */
/* Aplicación                                                          */
/* ------------------------------------------------------------------ */
const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));
app.set("layout", "layouts/main");

// 1) Morgan: middleware de terceros, registra en consola cada
//    solicitud junto con el código de estado final (200/302/400/404).
app.use(morgan("dev"));

// 2) y 3) Middleware personalizado de alcance global.
app.use(identificarSolicitud);
app.use(medirDuracion);

// 4) express-ejs-layouts: middleware de terceros que habilita el
//    layout principal para todas las vistas.
app.use(expressLayouts);

// 5) Recursos estáticos (CSS). Se sirven antes de los parsers porque
//    no necesitan leer body alguno.
app.use(express.static(path.join(__dirname, "..", "public")));

// 6) y 7) Parsers incorporados: deben ir antes que cualquier ruta que
//    lea req.body (en particular, antes de validarReserva).
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

/* ---------------------- Rutas de aplicación ------------------------ */
app.get("/", (req, res) => {
    res.render("inicio", { titulo: "Salas de estudio" });
});

app.get("/estado", (req, res) => {
    res.json({
        servicio: "activo",
        cantidadReservas: reservas.length,
        solicitudId: res.locals.solicitudId,
    });
});

/* ---------------------- Router de reservas -------------------------- */
const reservasRouter = express.Router();

reservasRouter.use(prepararAreaReservas);
reservasRouter.get("/", (req, res) => {
    res.render("reservas/lista", {
        titulo: "Reservas de salas",
        reservas,
    });
});

// IMPORTANTE: /nueva se declara antes que /:id para que "nueva" no sea
// interpretado como un identificador de reserva.
reservasRouter.get("/nueva", (req, res) => {
    res.render("reservas/nueva", {
        titulo: "Nueva reserva",
        errores: [],
        valores: {},
        salas: salasPermitidas,
        turnos: turnosPermitidos,
    });
});

reservasRouter.get("/:id", (req, res) => {
    const id = Number(req.params.id);
    const reserva = reservas.find((elemento) => elemento.id === id);
    if (!reserva) {
        return res.status(404).render("no-encontrado", {
            titulo: "Reserva no encontrada",
            mensaje: "No existe una reserva con ese identificador.",
        });
    }
    res.render("reservas/detalle", {
        titulo: `Reserva de ${reserva.estudiante}`,
        reserva,
    });
});

reservasRouter.post("/", validarReserva, crearReserva);

app.use("/reservas", reservasRouter);

/* ---------------------- Página 404 final ---------------------------- */
app.use((req, res) => {
    res.status(404).render("no-encontrado", {
        titulo: "Página no encontrada",
        mensaje: "La dirección solicitada no existe.",
    });
});

app.listen(PORT, () => {
    console.log(`Aplicación disponible en http://localhost:${PORT}`);
});
