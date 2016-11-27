var express = require('express');
var exphbs  = require('express-handlebars'),
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
	connection.connect();

	connection.query('SELECT * FROM Empleados', function(err, rows, fields) {
	  if (err) throw err;
	});

	connection.end();

    res.render('alsea');
});

app.listen(3000);