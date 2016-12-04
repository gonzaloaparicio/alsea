var express = require('express');
var exphbs  = require('express-handlebars');
var db   = require('mysql-promise')();
//var mysql   = require('mysql');
var Q       = require('q');
var bodyParser = require('body-parser')

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
			console.log(query);
			promises.push(db.query(query)
				.spread(() => {
					return;
				})
			);
		});
	});

	return Q.all(promises)
	 	.then(() => res.end());

});

app.listen(3000);