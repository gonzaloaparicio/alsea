var express = require('express');
var exphbs  = require('express-handlebars');
var db   = require('mysql-promise')();
//var mysql   = require('mysql');
var Q       = require('q');
var bodyParser = require('body-parser');
var nodemailer = require('nodemailer');
var fs = require('fs');

var app = express();

app.engine('handlebars', exphbs({defaultLayout: 'index'}));
app.set('view engine', 'handlebars');

app.use("/public", express.static(__dirname + '/public'));


app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));



db.configure({
	"host": "localhost",
	"user": "root",
	"password": "",
	"database": "sip"
});


app.get('/', function (req, res) {
    res.render('bienvenida');
});


app.get('/inicio', function (req, res) {
    res.render('alsea');
});

app.get('/finalizarClase', function (req, res) {
    res.render('finalizar');
});

app.get('/finalizarClase/clases', function (req, res) {

	//sacar el email del query string y hacer el select a planes de carrera
	db.query("select * from empleados where dni="+req.query.dni)
	.spread((empleado) => {
		db.query("select c.nombre nombreCurso, cl.descripcion nombreClase, e.nombre nombreAlumno, e.apellido apellidoAlumno, e2.nombre nombreProfesor,pc.nota,pc.presente,pc.fecha from planes_de_carrera pc  join empleados e  on e.id_empleado = pc.id_empleado join empleados e2 on e2.id_empleado = pc.id_entrenador join clases cl on cl.id_clase = pc.id_clase join cursos c on c.id_curso = pc.id_curso where id_entrenador="+empleado[0].id_empleado)
		.spread((planes_de_carrera) => {

			var resultado = {};
			planes_de_carrera.forEach(function(p, index) {
				if (resultado[p.nombreClase]) {
					resultado[p.nombreClase]['alumnos'].push({nombre: p.nombreAlumno, apellido: p.apellidoAlumno, presente: p.presente, nota: p.nota})
				} else {
					resultado[p.nombreClase] = { alumnos: [
						{nombre: p.nombreAlumno, apellido: p.apellidoAlumno, presente: p.presente, nota: p.nota}
					]};
				}
			});

			var clases = Object.keys(resultado);
			var resultado2 = [];

			clases.forEach(function(nombre, index) {
				resultado2.push({
					clase: nombre,
					alumnos: resultado[nombre].alumnos
				})
			});

			console.log(JSON.stringify(resultado2));

			res.render('finalizarClases', {clases: resultado2});
		});
	});
});


app.get('/cursos', function (req, res) {

	var cursos = [];


	db.query('SELECT * FROM cursos')
	.spread((cursos) => {

		var promises = [];


	 	cursos.forEach(function(curso, index) {
			// por cada curso evaluo aquellos que puedan hacer cada curso
			promises.push(db.query("select * from empleados where id_empleado not in (select id_empleado from planes_de_carrera where id_curso = " + curso.id_curso +") and tipo = 'EMPLEADO'")
				.spread((empleados) => {
				return curso.empleados = empleados;
			}));
			promises.push(db.query("select * from clases where id_curso=" + curso.id_curso)
				.spread((clases) => {
					return curso.clases = clases;
			}));
		});

	 	return Q.all(promises)
	 	.then(() => res.render('cursos', {cursos: cursos}));

	});

});


app.get('/reportes', function (req, res) {

	db.query("select * from planes_de_carrera pc join cursos c on pc.id_curso = c.id_curso group by pc.id_curso;")
		.spread((cursos) => {
			res.render('reportes', {cursos: cursos})
		});

});


// SERVICES
app.get('/services/entrenadoresyclases', function (req, res) {

	var date = req.query.fecha, // YYYY-MM-DD
		id_clase = req.query.idClase,
		cant_alumnos = req.query.cant,
		result = {},
		promises = [];


	promises.push(db.query("select * from empleados where tipo = 'ENTRENADOR' and id_empleado in (select id_empleado from certificaciones where id_clase ="+id_clase+") and id_empleado not in (select id_entrenador from planes_de_carrera where fecha ="+date+")")
		.spread((entrenadores) => {
			return result.entrenadores = entrenadores;
		}
	));

	promises.push(db.query("select * from aulas where capacidad >="+cant_alumnos+" and id_aula not in(select id_aula from planes_de_carrera where fecha ="+date+")")
		.spread((aulas) => {
			return result.aulas = aulas;
		}
	));

	return Q.all(promises)
	 	.then(() => res.send(result));

});

app.post('/services/altaCurso', function (req, res) {

	var curso_id = req.body.id_curso,
		promises = [];

	req.body.empleados.forEach(function(empleado, index) {
		req.body.clases.forEach(function(clase, index) {
			var query = "insert into planes_de_carrera(id_curso, id_clase, id_empleado, id_entrenador, id_aula, fecha) values("+curso_id+", "+clase.id+", "+empleado+", "+clase.entrenador+", "+clase.aula+", '"+clase.fecha+"')";
			promises.push(db.query(query)
				.spread(() => {
					return;
				})
			);
		});
	});



	// ENVIO MAILS
	var transporter = nodemailer.createTransport('smtps://sipalsea%40gmail.com:sipalsea@smtp.gmail.com');


	// mails a entrenadores
	req.body.clases.forEach(function(clase, index) {
		db.query("select * from empleados where id_empleado ="+clase.entrenador)
			.spread((entrenador) => {

				var html;

				fs.readFile('./views/mails/entrenador.html', 'utf8', function(err, data) {
				    if (err) throw err;
				    html = data;

					html = html.replace("[[entrenador]]", entrenador[0].nombre);
					html = html.replace("[[fecha]]", clase.fecha);

					db.query("select * from aulas where id_aula="+clase.aula)
						.spread((aula) => {
							html = html.replace("[[aula]]", aula[0].tipo + ': ' + aula[0].direccion);

							//query al curso y a la clase y a dentro lo de abajo
							db.query("select * from cursos where id_curso ="+curso_id)
								.spread((curso) => {
									html = html.replace("[[curso]]", curso[0].nombre);


									db.query("select * from clases where id_clase="+clase.id)
										.spread((clase) => {

											html = html.replace("[[clase]]", clase[0].descripcion);

											html = html.replace("[[verbo]]", '<b>dictar</b>');

											// setup e-mail data with unicode symbols
											var mailOptions = {
											    from: '"Alsea S.A - Centro de Capacitaciones" <sip.alsea@gmail.com>', // sender address
											    to: entrenador[0].email, // list of receivers
											    subject: 'Novedades En cursos', // Subject line
											    html: html // html body
											};

											// send mail with defined transport object
											transporter.sendMail(mailOptions, function(error, info){
											    if(error){
											        return console.log(error);
											    }
											    console.log('Message sent: ' + info.response);
											});
										});
								}
							);
						});
				});

			});
	});


	// mails a entrenadores
	req.body.clases.forEach(function(clase, index) {

		clase.empleados.forEach(function(empleado, index) {
			db.query("select * from empleados where id_empleado ="+empleado)
				.spread((entrenador) => {

					var html;

					fs.readFile('./views/mails/entrenador.html', 'utf8', function(err, data) {
					    if (err) throw err;
					    html = data;

						html = html.replace("[[entrenador]]", entrenador[0].nombre);
						html = html.replace("[[fecha]]", clase.fecha);

						db.query("select * from aulas where id_aula="+clase.aula)
							.spread((aula) => {
								html = html.replace("[[aula]]", aula[0].tipo + ': ' + aula[0].direccion);

								//query al curso y a la clase y a dentro lo de abajo
								db.query("select * from cursos where id_curso ="+curso_id)
									.spread((curso) => {
										html = html.replace("[[curso]]", curso[0].nombre);


										db.query("select * from clases where id_clase="+clase.id)
											.spread((clase) => {

												html = html.replace("[[clase]]", clase[0].descripcion);

												html = html.replace("[[verbo]]", '<b>atender</b>');

												// setup e-mail data with unicode symbols
												var mailOptions = {
												    from: '"Alsea S.A - Centro de Capacitaciones" <sip.alsea@gmail.com>', // sender address
												    to: entrenador[0].email, // list of receivers
												    subject: 'Novedades En cursos', // Subject line
												    html: html // html body
												};

												// send mail with defined transport object
												transporter.sendMail(mailOptions, function(error, info){
												    if(error){
												        return console.log(error);
												    }
												    console.log('Message sent: ' + info.response);
												});
											});
									}
								);
							});
					});

				});
		});

	});


	return Q.all(promises)
	 	.then(() => res.end());

});


app.get('/services/reportes', function (req, res) {

	var email = req.query.email;
	var ids = req.query.ids.split(',');

	var reportes = [];
	var promises = [];

	ids.forEach(function(id, index) {

		promises.push(db.query("select * from cursos where id_curso="+id)
			.spread((curso) => {
				return db.query("select pc.id_empleado, e.nombre nombreEmpleado, e.apellido apellidoEmpleado, pc.presente, pc.nota from planes_de_carrera pc join empleados e on pc.id_empleado = e.id_empleado where pc.id_curso ="+id+" group by pc.id_empleado")
					.spread((empleados) => {

						var suma_presente = 0;
						var suma_ausente = 0;
						var suma_aprobado = 0;
						var suma_desaprobado = 0;
						empleados.forEach(function(empleado, index) {
							if (empleado.presente != null && empleado.presente == 'SI')
								suma_presente+=1;
							if (empleado.presente != null && empleado.presente == 'NO')
								suma_ausente+=1;

							if (empleado.nota != null && empleado.nota == 'APROBADO')
								suma_aprobado+=1;
							if (empleado.nota != null && empleado.nota == 'DESAPROBADO')
								suma_desaprobado+=1;
						});

						var porcentaje_presentes = suma_presente > 0 ? (suma_presente/empleados.length)*100 : 0;
						var porcentaje_ausentes = suma_ausente > 0 ? (suma_ausente/empleados.length)*100 : 0;
						var porcentaje_aprobados = suma_aprobado > 0 ? (suma_aprobado/empleados.length)*100 : 0;
						var porcentaje_desaprobados = suma_desaprobado > 0 ? (suma_desaprobado/empleados.length)*100 : 0;

						reportes.push( {nombre: curso.nombre,
										empleados: empleados,
										cantidad: empleados.length,
										porcentaje_presentes: porcentaje_presentes,
										porcentaje_ausentes: porcentaje_ausentes,
										porcentaje_aprobados: porcentaje_aprobados,
										porcentaje_desaprobados: porcentaje_desaprobados
										});
					});
			}));

	});

	Q.all(promises).then(() => {

		var transporter = nodemailer.createTransport('smtps://sipalsea%40gmail.com:sipalsea@smtp.gmail.com');

		// setup e-mail data with unicode symbols
		var mailOptions = {
		    from: '"Alsea S.A - Centro de Capacitaciones" <sip.alsea@gmail.com>', // sender address
		    to: [email], // list of receivers
		    subject: 'Reporte de Cursos', // Subject line
		    html: JSON.stringify(reportes) // html body
		};

		// send mail with defined transport object
		transporter.sendMail(mailOptions, function(error, info){
		    if(error){
		        return console.log(error);
		    }
		    console.log('Message sent: ' + info.response);
		});

		return res.end();
	});

});

app.listen(3000);
