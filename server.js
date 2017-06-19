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
  var hash = req.params.hash;
  if(urlDB.hasOwnProperty(hash)){
    res.redirect(urlDB[req.params.hash]);
  }
  res.send("URL is not in database");
});

// If you are seeing this and thought to yourself "Hey, free key!",
// well, you're out of luck. This key only limits to 3 USD/month 
// and it won't go over the limit at all 

var bingApiKey = "93f9b3ff8af84047998e53be764e5904";
const request = require('request');
const fs = require('fs');
var imgSearchDB = [];
fs.readFile("./imgSearchDB.json", function(error, data){
  if(!error) imgSearchDB = JSON.parse(data);
});

app.get('/api/image-search/:query(*)', function(req, res){
  var result;
  var endpoint = "https://api.cognitive.microsoft.com/bing/v5.0/images/search?count=10";
  var query = req.params.query;
  var offset = req.query.offset || "0";
  var url = endpoint + "&q="+ encodeURI(query);
  url += "&offset="+ encodeURI(offset);

  var options = {
    url: url,
    headers: {
      'Ocp-Apim-Subscription-Key': bingApiKey,
      'Accept': 'application/json',
    }
  };

  request(options, function (error, response, body) {
    // console.log('error:', error); // Print the error if one occurred
    // console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
    // console.log('body:', body); // Print the HTML for the Google homepage.
    var received = JSON.parse(body).value;
    result = [];
    received.forEach((v) => {
      var current = {
        url: v.contentUrl,
        snippet: v.name,
        thumbnail: v.thumbnailUrl,
        context: v.hostPageUrl,
      };
      result.push(current);
    });
  
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(result, null, 2));
  });

  var record = {term: query, when: new Date().toISOString() };
  imgSearchDB.unshift(record);
  // save to file (as database);
  fs.writeFile("./imgSearchDB.json", JSON.stringify(imgSearchDB));
});

app.get('/api/latest/image-search', function(req, res){
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(imgSearchDB, null, 2));
});

// LAST EXERCISE, YAY!
// this one is to receive a file upload then respond with a JSON containing the size of the file
const multer = require('multer');

app.get('/api/upload-file', function (req, res){
  var html = "<h4>Submit a file to view get its size in a JSON response</h4>";
  html += `<form action="/api/upload-file" method="POST" enctype="multipart/form-data">`; 
  html += `<input type="file" name="file"/>`; 
  html += `<button type="submit">Submit the file!</button>`
  html += `</form>`;

  res.send(html);
});

var upload = multer();
app.post('/api/upload-file', upload.single("file"), function (req, res){

  var result = {filename: req.file.originalname, size: req.file.size};
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(result, null, 2));
});
