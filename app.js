var express = require('express');
var exphbs  = require('express-handlebars');
var mysql   = require('mysql');

var app = express();

app.engine('handlebars', exphbs({defaultLayout: 'index'}));
app.set('view engine', 'handlebars');

app.use("/public", express.static(__dirname + '/public'));


var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : '',
  database : 'sip'
});

app.get('/', function (req, res) {
    res.render('bienvenida');
});


app.get('/inicio', function (req, res) {
    res.render('alsea');
});

app.get('/cursos', function (req, res) {

	var cursos = [];

	//buscar los cursos que tengan entrenadores para darlos (join con planes de carrera)
	connection.connect();
	connection.query('SELECT * FROM cursos', function(err, rows, fields) {
		if (err) throw err;

		rows.forEach(function(curso, index) {
		  	cursos.push({
		  		nombre: curso.nombre,
		  		descripcion: curso.descripcion
		  	});
		});

	});
	connection.end();

	//compilar primero el html
    res.render('cursos');
});

app.listen(3000);



	// connection.connect();

	// connection.query('SELECT * FROM Empleados', function(err, rows, fields) {
	//   if (err) throw err;
	// });

	// connection.end();