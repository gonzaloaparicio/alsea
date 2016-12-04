var express = require('express');
var exphbs  = require('express-handlebars');
var db   = require('mysql-promise')();
//var mysql   = require('mysql');
var Q       = require('q');

var app = express();

app.engine('handlebars', exphbs({defaultLayout: 'index'}));
app.set('view engine', 'handlebars');

app.use("/public", express.static(__dirname + '/public'));



db.configure({
	"host": "localhost",
	"user": "root",
	"password": "",
	"database": "sip"
});


// var connection = mysql.createConnection({
//   host     : 'localhost',
//   user     : 'root',
//   password : '',
//   database : 'sip'
// });

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

app.listen(3000);