const express = require('express');
const app = express();
const moment = require('moment');
const port = process.env.PORT || "8000";
app.listen(port, function () {
  console.log(`fcc-nodejs-playground-jackyef is listening on port ${port}!`)
});

app.use(express.static('public'));

app.get('/api/timestamp/:date', function (req, res) {
  let result = {unix: null, natural: null};
  var date = (req.params.date);
  var dateFormat = "MMMM D, YYYY";
  var valid = false;

  if(isNaN(date)){
      result.natural = moment.utc(date).format("MMMM D, YYYY");
      result.unix = moment.utc(result.natural).unix();
  } else {
      // is a number, which means it is an unix timestamp
     result.natural = moment.unix(date).format("MMMM D, YYYY");
     result.unix = moment.utc(result.natural).unix();
  }
  if(!result.unix) result.natural = null;
  
  res.json(result);
});

app.get('/api/whoami', function (req, res) {
  let result = {ipaddress: null, language: null, software: null};
  
  var ip = req.ip.split(':');
  ip = ip[ip.length-1];
  result.ipaddress = ip;

  result.language = req.headers["accept-language"].split(",")[0];

  result.software = req.headers["user-agent"];
  var openParen = result.software.indexOf("(");
  var closeParen = result.software.indexOf(")");
  result.software = result.software.substring(openParen+1, closeParen);
  
  res.json(result);
});


const validUrl = require('valid-url');
const randomstring = require("randomstring");
let urlDB = {};
app.get('/api/shorten-url/:url(*)', function (req, res){
  var url = req.params.url;
  if(!validUrl.isWebUri(url)) res.send("Please provide a valid URL!");

  var hash = randomstring.generate(7);
  while(urlDB.hasOwnProperty(hash)){
    hash = randomString.generate(7);
  }
  urlDB[hash] = url;

  let result = {original_url: url, short_url: req.hostname+"/api/shortened-url/"+hash};
  console.log(urlDB);

  res.json(result);
});

app.get('/api/shortened-url/:hash', function (req, res){
  var hash = req.params.hash
  if(urlDB.hasOwnProperty(hash)){
    res.redirect(urlDB[req.params.hash]);
  }
  res.send("URL is not in database");
});