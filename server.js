const express = require('express');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
const passwordHash = require('password-hash');
const session = require('express-session');
const app = express();
const moment = require('moment');
const port = process.env.PORT || "8000";
const mongoUrl = process.env.PROD_MONGODB;
// Retrieve
var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;

// Connect to the db
MongoClient.connect(mongoUrl, function(err, db) {
  if(!err) {
    console.log("Connected to mongoDB");
  }
});

app.listen(port, function () {
  console.log(`fcc-nodejs-playground-jackyef is listening on port ${port}!`)
});

app.use(express.static('public'));
app.disable('x-powered-by'); // for security
app.use(cookieParser());
app.use(session(
  { secret: "someS3crEeT-StR1n60F-Ch4rAct3Rs_th4Ti5n08suPposEdT0b3KnoWnbyP30pl3",
    resave: false,
    saveUninitialized: false,
}));
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.use(function (req, res, next) {
  req.query.signupError = null;
  req.query.loginError = null;
  req.query.signupSuccess = null;
  req.query.loginSuccess = null;
  next();
})


app.get('/', function(req, res){
  res.render('index');
});

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


// first project: Voting App

app.set('view engine', 'ejs');
app.get('/voting-app', function (req, res){
  // res.sendFile("voting-app/index.html");
  var data = {};
  data.title = 'Voting-app';

  // Connect to the db
  MongoClient.connect(mongoUrl, function(err, db) {
    if(err) {
      console.log(err);
      return;
    }
    var pollsCollection = db.collection("polls");
    if(!req.session.loggedIn) req.session.username = "Guest";
    data.req = req;
    data.session = req.session;
    // var pollsCursor = pollsCollection.find();
    pollsCollection.find().sort({_id: -1}).toArray().then(function(polls){
      data.polls = polls;
      res.render("voting/index", data);
    });
  });
});

app.get('/voting-app/mine', function (req, res){
  // res.sendFile("voting-app/index.html");
  var data = {};
  data.title = 'My polls';
  // Connect to the db
  MongoClient.connect(mongoUrl, function(err, db) {
    if(err) {
      console.log(err);
      return;
    }
    var pollsCollection = db.collection("polls");
    if(!req.session.loggedIn) req.session.username = "Guest";
    data.req = req;
    data.session = req.session;
    // var pollsCursor = pollsCollection.find();
    pollsCollection.find({username: req.session.username}).sort({_id: -1}).toArray().then(function(polls){
      data.polls = polls;
      res.render("voting/index", data);
    });
  });
});

app.get('/voting-app/poll/:id', function (req, res){
  // res.sendFile("voting-app/index.html");
  if(!ObjectID.isValid(req.params.id)) {
    res.redirect("/voting-app");
    return;
  }
  var id = new ObjectID(req.params.id);
  var data = {};
  data.title = 'Voting-app';

  if(!req.session.loggedIn) req.session.username = "Guest";
  data.req = req;
  data.session = req.session;

  MongoClient.connect(mongoUrl, function(err, db){
    if(err){
      console.log(err);
      res.redirect("back");
      return;
    }
    db.collection("polls").findOne({"_id": id}).then(function(poll){
      data.poll = poll;
      if(!poll) {
        res.redirect("/voting-app");
        return;
      }
      if(poll.votedBy.hasOwnProperty(req.session.username) && req.session.loggedIn){
        data.session.votedAlready = true;
        data.session.votedOption = poll.votedBy[req.session.username];
        data.optionsSize = Object.keys(poll.options).length;
      } else {
        data.session.votedAlready = false;
        data.optionsSize = Object.keys(poll.options).length;
      }
      res.render("voting/pollDetail", data);
    });
  });
});

app.post('/voting-app/poll/:id', function (req, res){
  // res.sendFile("voting-app/index.html");
  if(!ObjectID.isValid(req.params.id)) {
    res.redirect("/voting-app");
    return;
  }
  var id = new ObjectID(req.params.id);
  var votedOption = Number(req.body.vote);
  var data = {};
  data.title = 'Voting-app';

  if(!req.session.loggedIn) req.session.username = "Guest";
  data.req = req;
  data.session = req.session;
  var username = req.session.username;
  var fieldName = "options."+votedOption+".votes";
  
  var updatedOptionVote = {};
  updatedOptionVote[fieldName] = 1;
  updatedOptionVote["votes"] = 1;
  
  var userVote = {};
  userVote["votedBy."+req.session.username] = votedOption;
  if(req.body.optionsSize == req.body.vote){
    userVote["options."+votedOption+".content"] = req.body.customOption;
  }

  // console.log(updatedOptionVote);
  MongoClient.connect(mongoUrl, function(err, db){
    var votedBy = {};
    db.collection("polls").update({"_id": id}, {
        $set: userVote,
        $inc: updatedOptionVote
      }
    ).then(function(){
      res.redirect("/voting-app/poll/"+req.params.id);
      return;
    });
  });
});


app.get('/voting-app/poll/delete/:id', function (req, res){
  // res.sendFile("voting-app/index.html");
  if(!ObjectID.isValid(req.params.id)) {
    res.redirect("/voting-app");
    return;
  }
  var id = new ObjectID(req.params.id);
  var data = {};
  data.title = 'Voting-app';

  if(!req.session.loggedIn) req.session.username = "Guest";
  data.req = req;
  data.session = req.session;

  MongoClient.connect(mongoUrl, function(err, db){
    if(err){
      console.log(err);
      res.redirect("back");
      return;
    }
    db.collection("polls").remove({"_id": id}).then(function(){
      res.redirect("/voting-app/mine");
    });
  });
});

app.post('/voting-app/signup', function (req, res){
  // res.sendFile("voting-app/index.html");
  // Connect to the db
  MongoClient.connect(mongoUrl, function(err, db) {
    if(err) {
      console.log(err);
      return;
    }
    var users = db.collection("users");

    var user = {
      username: req.body.username,
      email: req.body.email,
      password: passwordHash.generate(req.body.password)
    };

    users.insert(user).then(function(){
      res.redirect(req.baseUrl+"/voting-app?signupSuccess=1");
    }).catch(function(err){
      res.redirect(req.baseUrl+"/voting-app?signupError=1");
    });
  });

});

app.post('/voting-app/login', function (req, res){
  // res.sendFile("voting-app/index.html");
  // Connect to the db
  MongoClient.connect(mongoUrl, function(err, db) {
    if(err) {
      console.log(err);
      return;
    }
    var users = db.collection("users");
    var user = {
      username: req.body.username
    };

    users.findOne(user).then(function(data){
      // console.log(data);
      if(data !== null) {
        if(passwordHash.verify(req.body.password, data.password)){
          req.session.username = user.username;
          req.session.loggedIn = true;
          var backURL=req.header('Referer') || '/';
          res.redirect(backURL);
          return;
        }
      }
      res.redirect(req.baseUrl+"/voting-app?loginError=1");
    });
  });
});
app.get('/voting-app/logout', function (req, res){
  req.session.destroy(function(err){
    res.redirect("/voting-app");
  });
});

app.get('/voting-app/new', function (req, res){
  var data = {};
  data.title = 'Create new poll';

  if(!req.session.loggedIn) {
    req.session.username = "Guest";
    res.redirect("/voting-app"); // need to be logged in to get here
  }

  data.req = req;
  data.session = req.session;
  res.render("voting/newPoll", data);
});

app.post('/voting-app/new', function (req, res){
  var data = {};

  if(!req.session.loggedIn) {
    req.session.username = "Guest";
    res.redirect("/voting-app"); // need to be logged in to get here
  }

  data.req = req;
  data.session = req.session;

  var poll = {};
  poll.title = req.body.pollTitle;
  poll.votes = 0;
  poll.options = {};
  poll.username = req.session.username;

  req.body.pollOptions.forEach((v,i)=>{
    var option = {};
    option.content = v;
    option.votes = 0;
    option.id = i;
    poll.options[i] = option;
  });
  poll.votedBy = {};

  MongoClient.connect(mongoUrl, function(err, db){
    if(err){
      console.log(err);
      return;
    }
    var polls = db.collection("polls");
    polls.insertOne(poll).then(function(result){
      res.redirect("/voting-app/mine");
    });
  });
  // res.setHeader("Content-Type", "application/json");
  // res.send(JSON.stringify(req.body, null, 2));
  // res.render("voting/newPoll", data);
});

app.get('/voting-app/initDB', function (req, res){
  // res.sendFile("voting-app/index.html");
  // Connect to the db
  MongoClient.connect(mongoUrl, function(err, db) {
    if(err) {
      console.log(err);
      return;
    }
    var pollsCollection = db.collection("polls");
    // var pollsCursor = pollsCollection.find();
    // var poll = {
    //   id: 1,
    //   title: "Who do you pick, X or Y?",
    //   votes: 5,
    //   options: [
    //     {
    //       content: "X",
    //       votes: 3,
    //     },
    //     {
    //       content: "Y",
    //       votes: 2,
    //     }
    //   ],
    //   votedBy: {
    //     1: 1,
    //     2: 1,
    //     3: 1,
    //     4: 2,
    //     5: 2
    //   }
    // };

    // pollsCollection.insert(poll);
    // var polls = pollsCollection.find().toArray();
    db.createCollection("users", function(err, collection) {});
    db.collection("users").createIndex( { "username": 1 }, { unique: true } );

    res.setHeader("Content-Type", "application/json");
    // res.send(JSON.stringify(polls, null, 2));
    res.send("DB initialized!");
  });

});

// End of voting app