var express = require('express');
var exphbs  = require('express-handlebars');

var app = express();

app.engine('handlebars', exphbs({defaultLayout: 'index'}));
app.set('view engine', 'handlebars');

app.use("/public", express.static(__dirname + '/public'));

app.get('/', function (req, res) {
    res.render('bienvenida');
});


// app.get('/inicio', function (req, res) {
//     res.render('alsea');
// });

app.listen(3000);