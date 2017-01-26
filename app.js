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




app.get('/modificarCurso', function(req, res) {

	db.query("select pc.fecha, pc.id_plan_de_carrera, c.nombre nombreCurso, pc.id_curso, a.descripcion aula, pc.id_aula, e.nombre nombreEntrenador, e.apellido apellidoEntrenador, e.id_empleado idEntrenador from planes_de_carrera pc join cursos c on pc.id_curso = c.id_curso join aulas a on pc.id_aula = a.id_aula join empleados e on pc.id_entrenador = e.id_empleado group by id_plan_de_carrera")
		.spread((cursosParaModificar) => {

			var promises = [];

			cursosParaModificar.forEach(function(cpm, i) {
				promises.push(db.query("select count(id_clase) canti from planes_de_carrera where id_plan_de_carrera ="+cpm.id_plan_de_carrera+" group by id_clase").spread((cant) => {
					cursosParaModificar[i].cant = cant[0].canti;
				}));
				promises.push(db.query("select * from clases where id_curso="+cpm.id_curso).spread((clases) => {
					cursosParaModificar[i].clases = clases;
				}));
			});

			Q.all(promises)
			.then(() => {
				console.log(JSON.stringify(cursosParaModificar));
				res.render('modificarCurso', {cursos: cursosParaModificar,dni:req.query.dni});
			});
		});
});


app.get('/inicio', function (req, res) {
  if (req.query.dni || req.query.password) {
    //sacar el email del query string y hacer el select a planes de carrera
    db.query("select * from empleados where dni="+req.query.dni)
    .spread((empleado) => {
      if(empleado.length > 0) {
        if(empleado[0].tipo == 'ENTRENADOR') {
          res.render('alsea', {isTrainer: true,dni:req.query.dni});
        } else if (empleado[0].tipo == 'RRHH') {
          res.render('alsea', {isTrainer: false,dni:req.query.dni});
        } else {
          res.render('loginFail', {errorLogin: true});
        }
      } else {
        res.render('loginFail', {errorLogin: true});
      }
    });
  } else {
    res.render('loginFail', {errorLogin: false});
  }
});

app.get('/login', function (req, res) {
    res.render('login');
});

app.get('/finalizarClase', function (req, res) {
    res.render('finalizar');
});

app.get('/finalizarClaseAdmin', function (req, res) {
    res.render('loginAdmin',{dni:req.query.dni});
});

app.get('/finalizarClase/clases', function (req, res) {
	//sacar el email del query string y hacer el select a planes de carrera
	db.query("select * from empleados where dni="+req.query.dni)
	.spread((empleado) => {
    if(empleado.length > 0 && empleado[0].tipo == "ENTRENADOR"){
  		db.query("select c.nombre nombreCurso, cl.descripcion nombreClase, cl.id_clase idClase, e.nombre nombreAlumno, e2.id_empleado idProfesor, e.apellido apellidoAlumno, e2.nombre nombreProfesor,pc.nota,pc.presente,pc.fecha, pc.id_empleado from planes_de_carrera pc  join empleados e  on e.id_empleado = pc.id_empleado join empleados e2 on e2.id_empleado = pc.id_entrenador join clases cl on cl.id_clase = pc.id_clase join cursos c on c.id_curso = pc.id_curso where id_entrenador="+empleado[0].id_empleado)
  		.spread((planes_de_carrera) => {

  			var resultado = {};
  			planes_de_carrera.forEach(function(p, index) {
  				if (resultado[p.nombreClase]) {
  					resultado[p.nombreClase]['alumnos'].push({nombre: p.nombreAlumno, apellido: p.apellidoAlumno, presente: p.presente, nota: p.nota, id: p.id_empleado, idClase: p.idClase, idProfesor: p.idProfesor})
  				} else {
  					resultado[p.nombreClase] = { alumnos: [
  						{nombre: p.nombreAlumno, apellido: p.apellidoAlumno, presente: p.presente, nota: p.nota, id: p.id_empleado, idClase: p.idClase, idProfesor: p.idProfesor}
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

  			res.render('finalizarClases', {clases: resultado2,dni:req.query.dni});
  		});
    } else {
      res.render('finalizarClaseAdminFail',{dni:req.query.dni});
    }
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
	 	.then(() => res.render('cursos', {cursos: cursos, dni:req.query.dni}));

	});

});


app.get('/reportes', function (req, res) {

	db.query("select * from planes_de_carrera pc join cursos c on pc.id_curso = c.id_curso group by pc.id_curso;")
		.spread((cursos) => {
			res.render('reportes', {cursos: cursos,dni:req.query.dni})
		});

});


// SERVICES
app.get('/services/entrenadoresyclases', function (req, res) {

	var date = req.query.fecha, // YYYY-MM-DD
		id_clase = req.query.idClase,
		cant_alumnos = req.query.cant,
		result = {},
		promises = [];


	promises.push(db.query("select * from empleados where tipo = 'ENTRENADOR' and id_empleado in (select id_empleado from certificaciones where id_clase ="+id_clase+") and id_empleado not in (select id_entrenador from planes_de_carrera where fecha ='"+date+"')")
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


app.post('/services/finalizarClase', function(req, res) {

	var body = req.body.body;
	var promises = [];

	body.forEach(function(e, i) {
		promises.push(db.query("update planes_de_carrera set nota ='"+e.nota+"', presente='"+e.presente+"' where id_empleado ="+e.id_alumno+" and id_clase ="+e.id_clase+" and id_entrenador="+e.id_profesor)
			.spread(() => {
				return;
			}));
	});

	Q.all(promises)
		.then(() => {
			res.end();
		});

});

app.post('/services/altaCurso', function (req, res) {

	var curso_id = req.body.id_curso,
		promises = [],
		planes_de_carrera_id = new Date().getTime();


	req.body.empleados.forEach(function(empleado, index_e) {
		req.body.clases.forEach(function(clase, index) {
			var query = "insert into planes_de_carrera(id_plan_de_carrera, id_curso, id_clase, id_empleado, id_entrenador, id_aula, fecha) values("+planes_de_carrera_id+", "+curso_id+", "+clase.id+", "+empleado+", "+clase.entrenador+", "+clase.aula+", '"+clase.fecha+"')";
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
							if (empleado.presente != null && empleado.presente == 'PRESENTE')
								suma_presente+=1;
							if (empleado.presente != null && empleado.presente == 'AUSENTE')
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

						reportes.push( {nombre: curso[0].nombre,
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


		var super_body = "";

		reportes.forEach(function(curso, index) {
			super_body = super_body.concat("<h3>Nombre del cuso: "+curso.nombre+"</h3>");
			super_body = super_body.concat("</br>");
			super_body = super_body.concat("<h3>Cantidad de empleados anotados al curso: "+curso.cantidad+"</h3>");
			super_body = super_body.concat("</br>");
			super_body = super_body.concat("<h3>Porcentaje de empleados presentes: "+curso.porcentaje_presentes+"</h3>");
			super_body = super_body.concat("</br>");
			super_body = super_body.concat("<h3>Porcentaje de empleados ausentes: "+curso.porcentaje_ausentes+"</h3>");
			super_body = super_body.concat("</br>");
			super_body = super_body.concat("<h3>Porcentaje de empleados aprobados: "+curso.porcentaje_aprobados+"</h3>");
			super_body = super_body.concat("</br>");
			super_body = super_body.concat("<h3>Porcentaje de empleados desaprobados: "+curso.porcentaje_desaprobados+"</h3>");
			super_body = super_body.concat("</br>");
			super_body = super_body.concat("</br>");
			super_body = super_body.concat("</br>");
		});


		console.log(super_body);

		// setup e-mail data with unicode symbols
		var mailOptions = {
		    from: '"Alsea S.A - Centro de Capacitaciones" <sip.alsea@gmail.com>', // sender address
		    to: [email], // list of receivers
		    subject: 'Reporte de Cursos', // Subject line
		    html: super_body // html body
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

app.post('/services/actualizarCurso', function (req, res) {

	var id_plan_de_carrera = req.query.idPlanDeCarrera,
		promises = [];

	req.body.clases.forEach(function(e, i) {
		promises.push(db.query("update planes_de_carrera set id_entrenador="+e.id_entrenador+", id_aula="+e.id_aula+" where id_plan_de_carrera="+id_plan_de_carrera+" and id_clase="+e.id_clase));
	});


	Q.all(promises)
	.then(() => {

		var promises = [];

		var transporter = nodemailer.createTransport('smtps://sipalsea%40gmail.com:sipalsea@smtp.gmail.com');

		req.body.clases.forEach(function(e, i) {

			//mandar mail al profesor dado de baja
			promises.push(db.query("select e.nombre nombreEntrenador, e.apellido apellidoEntrenador, e.email mailEntrenador, c.descripcion nombreClase, pc.fecha fechaClase, a.descripcion aula from empleados e join planes_de_carrera pc  on pc.id_entrenador = e.id_empleado join clases c on c.id_clase = pc.id_clase join aulas a on a.id_aula = pc.id_aula where e.id_empleado="+e.id_entrenador_viejo+" and  pc.id_plan_de_carrera="+id_plan_de_carrera+" and pc.id_clase="+e.id_clase+" group by pc.id_clase").spread((entrenador) => {
				var ent = entrenador[0];
				var body = "Hola, "+ent.nombreEntrenador+" "+ent.apellidoEntrenador+". Fue dado de baja para dictar la clase: "+ ent.nombreClase+ " el dia: "+ent.fechaClase+" en el aula: " + ent.aula;


				var mailOptions = {
				    from: '"Alsea S.A - Centro de Capacitaciones" <sip.alsea@gmail.com>', // sender address
				    to: ent.mailEntrenador, // list of receivers
				    subject: 'Baja en cursos', // Subject line
				    html: body // html body
				};

				// send mail with defined transport object
				transporter.sendMail(mailOptions, function(error, info){
				    if(error){
				        return console.log(error);
				    }
				    console.log('Message sent: ' + info.response);
				});
			}));


			//mandar mail al profesor dado de alta
			promises.push(db.query("select e.nombre nombreEntrenador, e.apellido apellidoEntrenador, e.email mailEntrenador, c.descripcion nombreClase, pc.fecha fechaClase, a.descripcion aula from empleados e join planes_de_carrera pc  on pc.id_entrenador = e.id_empleado join clases c on c.id_clase = pc.id_clase join aulas a on a.id_aula = pc.id_aula where e.id_empleado="+e.id_entrenador+" and  pc.id_plan_de_carrera="+id_plan_de_carrera+" and pc.id_clase="+e.id_clase+" group by pc.id_clase").spread((entrenador) => {
				var ent = entrenador[0];
				var body = "Hola, "+ent.nombreEntrenador+" "+ent.apellidoEntrenador+". Fue dado de alta para dictar la clase: "+ ent.nombreClase+ " el dia: "+ent.fechaClase+" en el aula: " + ent.aula;


				var mailOptions = {
				    from: '"Alsea S.A - Centro de Capacitaciones" <sip.alsea@gmail.com>', // sender address
				    to: ent.mailEntrenador, // list of receivers
				    subject: 'Fue seleccionado para dictar una clase!', // Subject line
				    html: body // html body
				};

				// send mail with defined transport object
				transporter.sendMail(mailOptions, function(error, info){
				    if(error){
				        return console.log(error);
				    }
				    console.log('Message sent: ' + info.response);
				});
			}));


			//mails a los alumnos
			promises.push(db.query("select  e.nombre nombreEntrenador, e.apellido apellidoEntrenador, e2.email mailAlumno, c.descripcion nombreClase, pc.fecha fechaClase, a.descripcion aula,e2.nombre nombreAlumno,e2.apellido apellidoAlumno from empleados e join planes_de_carrera pc   on pc.id_entrenador = e.id_empleado  join empleados e2 on pc.id_empleado = e2.id_empleado join clases c  on c.id_clase = pc.id_clase join aulas a  on a.id_aula = pc.id_aula  where   e.id_empleado="+e.id_entrenador+" and   pc.id_plan_de_carrera="+id_plan_de_carrera+" and  pc.id_clase="+e.id_clase+"").spread((empleados) => {;


				empleados.forEach(function(empleado, index) {
					var body = "Hola, "+empleado.nombreAlumno+" "+empleado.apellidoAlumno+". Se actualizo el curso: "+ empleado.nombreClase+ " el cual se dictará el dia: "+empleado.fechaClase+" en el aula: " + empleado.aula;


					var mailOptions = {
					    from: '"Alsea S.A - Centro de Capacitaciones" <sip.alsea@gmail.com>', // sender address
					    to: empleado.mailAlumno, // list of receivers
					    subject: 'Cambio en curso!', // Subject line
					    html: body // html body
					};

					// send mail with defined transport object
					transporter.sendMail(mailOptions, function(error, info){
					    if(error){
					        return console.log(error);
					    }
					    console.log('Message sent: ' + info.response);
					});
				});

			}));

		});

		Q.all(promises)
		.then(() => res.end());

	});

});

app.listen(3000);
