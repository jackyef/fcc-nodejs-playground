const express = require('express');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
const passwordHash = require('password-hash');
const session = require('express-session');
const moment = require('moment');
const passport = require('passport');
const FacebookStrategy = require('passport-facebook');
require('dotenv').config();
var mongoose = require('mongoose');
mongoose.connect(process.env.PROD_MONGODB, { useMongoClient: true });

var app = express();
var expressWs = require('express-ws')(app);
const port = process.env.PORT || "8000";
const mongoUrl = process.env.PROD_MONGODB;

var twitterApiKey = process.env.TWITTER_API_KEY || "";
var twitterApiSecret = process.env.TWITTER_API_SECRET || "";
// If you are seeing this and thought to yourself "Hey, free key!",
// well, you're out of luck. This key only limits to 3 USD/month 
// and it won't go over the limit at all 
var bingApiKey = process.env.BING_API_KEY || "";

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

app.use(passport.initialize());
app.use(passport.session());
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

// app.use(function (req, res, next) {
  // req.query.signupError = null;
  // req.query.loginError = null;
  // req.query.signupSuccess = null;
  // req.query.loginSuccess = null;
//   next();
// })


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

  // I know I didn't perform any check to check if
  // the session.username == poll.username
  // freeCodeCamp user story doesn't include this,
  // so I didn't bother to do it as this is only 
  // an exercise, not a production ready app
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
    db.createCollection("users", function(err, collection) {});
    db.collection("users").createIndex( { "username": 1 }, { unique: true } );

    res.setHeader("Content-Type", "application/json");
    // res.send(JSON.stringify(polls, null, 2));
    res.send("DB initialized!");
  });

});

// End of voting app

// Start of nightlife coordination app
var yelpApiId = process.env.YELP_API_ID ;
var yelpApiSecret = process.env.YELP_API_SECRET ;
var cachedToken;



app.get('/nightlife-app', function (req, res){
  var data = {};
  data.title = 'fcc-nightlife-app';
  data.req = req;
  
  res.render("nightlife/index", data);
});

app.get('/nightlife-app/api/search', function(req, res){
  var result;
  var authEndPoint = "https://api.yelp.com/oauth2/token";
  var location = req.query.location;
  var term = req.query.term;

  var options = {
    method: "POST",
    url: authEndPoint,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    // json: true,
    form: {
      grant_type: "client_credentials",
      client_id: yelpApiId,
      client_secret: yelpApiSecret
    }
  };
  // console.log(cachedToken);
  if(!cachedToken){
    request.post(options, function(error, response, body){
      cachedToken = JSON.parse(body).access_token;
      yelpSearch(location, term);
    });
  } else {
      yelpSearch(location, term);
  }
  
  function yelpSearch(location, term){
    var endpoint = "https://api.yelp.com/v3/businesses/search";
    var url = endpoint + "?location="+ encodeURI(location)+ "&term=" + encodeURI(term) + "&limit=" + 10;
    var opt = {
        url: url,
        headers: {
          'Accept': 'application/json',
        },
        auth: {
          'bearer': cachedToken
        }
      };
    request(opt, function (error, response, body) {
      var received = {error: "API didn't respond" };
      if(body){
        received = JSON.parse(body);
      }
      
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(received, null, 2));
    });
  }
});

app.get("/nightlife-app/api/registerFacebookUser", function(req, res){
  MongoClient.connect(mongoUrl, function(err, db) {
    if(err) {
      console.log(err);
      return;
    }
    var user = {fb_id: req.query.id, fb_name: req.query.name};
    var users = db.collection("nightlife_users");
    users.createIndex( { "fb_id": 1 }, { unique: true } );
    users.insertOne(user).then(function(){
      // res.setHeader("Content-Type", "application/json");
      res.send("User added to DB!");
    });
  });
});

app.get("/nightlife-app/api/addDestination", function(req, res){
  MongoClient.connect(mongoUrl, function(err, db) {
    if(err) {
      console.log(err);
      return;
    }
    var fbId = req.query.id;
    var locationId = req.query.locationId;
    var update = {};
    update["visitors."+fbId] = true; // true means this user is going
    db.collection("nightlife_locations").update({"id": locationId}, {
        $set: update
      },
      {upsert: true} 
    ).then(function(){
      res.send("Data added to DB!");
      return;
    });
    // res.send(JSON.stringify(polls, null, 2));
  });
});

app.get("/nightlife-app/api/removeDestination", function(req, res){
  MongoClient.connect(mongoUrl, function(err, db) {
    if(err) {
      console.log(err);
      return;
    }
    var fbId = req.query.id;
    var locationId = req.query.locationId;
    var update = {};
    update["visitors."+fbId] = "";
    db.collection("nightlife_locations").update({"id": locationId}, {
        $unset: update
      },
      {upsert: true} 
    ).then(function(){
      res.send("Data removed from DB!");
      return;
    });
    // res.send(JSON.stringify(polls, null, 2));
  });
});

app.get("/nightlife-app/api/getName", function(req, res){
  MongoClient.connect(mongoUrl, function(err, db) {
    if(err) {
      console.log(err);
      return;
    }
    var fbId = req.query.id;

    res.setHeader("Content-Type", "application/json");
    db.collection("nightlife_users").findOne({"fb_id": fbId}).then(function(user){
      if(!user) {
        var result = {error: "Error getting user data"};
        res.send(JSON.stringify(result, null, 2));
        return;
      }
      var result = user;
      res.send(JSON.stringify(result, null, 2));
    });

  });
});


app.get("/nightlife-app/api/getVisitors", function(req, res){
  MongoClient.connect(mongoUrl, function(err, db) {
    if(err) {
      console.log(err);
      return;
    }
    var businessId = req.query.businessId;

    res.setHeader("Content-Type", "application/json");
    db.collection("nightlife_locations").findOne({"id": businessId}).then(function(location){
      if(!location) {
        var result = {error: "Error getting location data"};
        res.send(JSON.stringify(result, null, 2));
        return;
      }
      var result = location;
      res.send(JSON.stringify(result, null, 2));
    });

  });
});

// end of nightlife coordination app

// start of realtime stock app

var alphaVantageApiKey = "EXRTXZ5R1SG6BO4H"; //this key is totally free, I didn't bother putting it into .env
var alphaVantageEndpoint = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&apikey=${alphaVantageApiKey}`;

var names = ['MSFT', 'AAPL', 'GOOG', 'FB'];

app.get('/stock-app', function (req, res){
  var data = {};
  data.title = 'fcc-stock-app';
  data.req = req;
  data.names = names;
  res.render("stock/index", data);
});

app.ws('/stock-app/ws', function(ws, req) {
  ws.on('message', function(msg) {
    console.log("broadcasting message to all clients:", msg);
    expressWs.getWss().clients.forEach(function(client,i){
      if(client !== ws) client.send(msg);
    });
    var data = msg.split(':');
    var action = data[0];
    var symbol = data[1];
    
    if(action == "ADD"){
      names.push(symbol);
    } else if(action == "REMOVE") {
      names.splice(names.indexOf(symbol), 1);
    }
  });
});

// end of realtime stock app

// start of book trading app

app.get('/book-app', function (req, res){
  var data = {};
  data.title = 'fcc-book-app';

  // Connect to the db
  MongoClient.connect(mongoUrl, function(err, db) {
    if(err) {
      console.log(err);
      return;
    }
    var books = db.collection("books");
    if(!req.session.loggedIn) req.session.username = "Guest";
    data.req = req;
    data.session = req.session;
    // var pollsCursor = pollsCollection.find();
    books.find( { username: { $not: new RegExp(req.session.username) } }).sort({_id: -1}).toArray().then(function(books){
      data.books = books;
      res.render("book/index", data);
    });
  });
});

app.get('/book-app/my-books', function (req, res){
  var data = {};
  data.title = 'fcc-book-app';

  // Connect to the db
  MongoClient.connect(mongoUrl, function(err, db) {
    if(err) {
      console.log(err);
      return;
    }
    var books = db.collection("books");
    if(!req.session.loggedIn) req.session.username = "Guest";
    data.req = req;
    data.session = req.session;
    // var pollsCursor = pollsCollection.find();
    books.find( { username: req.session.username }).sort({_id: -1}).toArray().then(function(books){
      data.books = books;
      res.render("book/index", data);
    });
  });
});


app.post('/book-app/signup', function (req, res){
  // res.sendFile("book-app/index.html");
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
      res.redirect(req.baseUrl+"/book-app?signupSuccess=1");
    }).catch(function(err){
      res.redirect(req.baseUrl+"/book-app?signupError=1");
    });
  });

});

app.post('/book-app/login', function (req, res){
  // res.sendFile("book-app/index.html");
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
          req.session.username = data.username;
          req.session.city = data.city;
          req.session.state = data.state;
          req.session.fullname = data.fullname;
          req.session.loggedIn = true;
          var backURL=req.header('Referer') || '/';
          res.redirect(backURL);
          return;
        }
      }
      res.redirect(req.baseUrl+"/book-app?loginError=1");
    });
  });
});

app.get('/book-app/logout', function (req, res){
  req.session.destroy(function(err){
    res.redirect("/book-app");
  });
});

app.get('/book-app/edit-info', function (req, res){
  var data = {};
  data.title = 'Edit my information';

  if(!req.session.loggedIn) {
    req.session.username = "Guest";
    res.redirect("/book-app"); // need to be logged in to get here
  } 

  data.req = req;
  data.session = req.session;
  res.render("book/edit-info", data);
});

app.post('/book-app/edit-info', function (req, res){
  var data = {};

  if(!req.session.loggedIn) {
    req.session.username = "Guest";
    res.redirect("/book-app"); // need to be logged in to get here
  }

  var toSet = {};
  toSet.city = req.body.city;
  toSet.state = req.body.state;
  toSet.fullname = req.body.fullname;

  MongoClient.connect(mongoUrl, function(err, db){
    if(err){
      console.log(err);
      return;
    }
    var users = db.collection("users");
    users.update({"username": req.session.username}, {
      $set: toSet
    }).then(function(result){
      db.collection("users").findOne({"username": req.session.username}).then(function(user){
        if(data !== null) {
          req.session.city = user.city;
          req.session.state = user.state;
          req.session.fullname = user.fullname;
          req.session.loggedIn = true;
        }
      }).then(function(result){
        data.req = req;
        data.session = req.session;
        res.redirect("/book-app/edit-info?success=1");
      });
    });
  });
  // res.setHeader("Content-Type", "application/json");
  // res.send(JSON.stringify(req.body, null, 2));
  // res.render("voting/newPoll", data);
});

app.get('/book-app/my-books/add', function (req, res){
  var data = {};
  data.title = 'Add a new book';

  if(!req.session.loggedIn) {
    req.session.username = "Guest";
    res.redirect("/book-app"); // need to be logged in to get here
  }

  data.req = req;
  data.session = req.session;
  res.render("book/add", data);
});

app.post('/book-app/my-books/add', function (req, res){
  var data = {};

  if(!req.session.loggedIn) {
    req.session.username = "Guest";
    res.redirect("/book-app"); // need to be logged in to get here
  }

  data.req = req;
  data.session = req.session;

  var book = {};
  book.title = req.body.title;
  book.username = req.session.username;

  MongoClient.connect(mongoUrl, function(err, db){
    if(err){
      console.log(err);
      return;
    }
    var books = db.collection("books");
    books.insertOne(book).then(function(result){
      res.redirect("/book-app/my-books");
    });
  });
  // res.setHeader("Content-Type", "application/json");
  // res.send(JSON.stringify(req.body, null, 2));
  // res.render("voting/newPoll", data);
});

app.get('/book-app/book/trade/:id', function (req, res){
  var data = {};

  if(!req.session.loggedIn) {
    req.session.username = "Guest";
    res.redirect("/book-app"); // need to be logged in to get here
  }
  var bookId = new ObjectID(req.params.id);
  data.req = req;
  data.session = req.session;

  var trade = {};
  trade.book_id = bookId;
  trade.requester = req.session.username;

  MongoClient.connect(mongoUrl, function(err, db){
    if(err){
      console.log(err);
      return;
    }
    var books = db.collection("books");

    books.findOne({"_id": bookId}).then(function(data){
    // console.log(data);
      if(data !== null) {
        trade.owner = data.username;
        trade.title = data.title;
      }
    }).then(function(result){
      db.collection("trades").insertOne(trade).then(function(result){
        res.redirect("/book-app/my-trades");
      });
    });
  });
});

app.get('/book-app/my-trades', function (req, res){
  var data = {};
  data.title = 'fcc-book-app';

  // Connect to the db
  MongoClient.connect(mongoUrl, function(err, db) {
    if(err) {
      console.log(err);
      return;
    }
    var trades = db.collection("trades");
    if(!req.session.loggedIn) {
      req.session.username = "Guest";
      res.redirect("/book-app");
    }
    data.req = req;
    data.session = req.session;
    // var pollsCursor = pollsCollection.find();
    trades.find( { $or :[{owner: req.session.username}] }).sort({book_id: -1}).toArray().then(function(trades){
      data.inTrades = trades;
    }).then(function(){
      trades.find( { $or :[{requester: req.session.username}] }).sort({book_id: -1}).toArray().then(function(trades){
        data.outTrades = trades;
        res.render("book/trades", data);
      });
    });
  });
});

app.get('/book-app/book/delete/:id', function (req, res){
  var data = {};

  if(!req.session.loggedIn) {
    req.session.username = "Guest";
    res.redirect("/book-app"); // need to be logged in to get here
  }
  var bookId = new ObjectID(req.params.id);
  data.req = req;
  data.session = req.session;

  MongoClient.connect(mongoUrl, function(err, db){
    if(err){
      console.log(err);
      return;
    }
    var books = db.collection("books");

    books.remove({"_id": bookId}).then(function(data){
    // console.log(data);
      res.redirect("/book-app/my-books");
    });
  });
});

app.get('/book-app/trade/cancel/:id', function (req, res){
  var data = {};

  if(!req.session.loggedIn) {
    req.session.username = "Guest";
    res.redirect("/book-app"); // need to be logged in to get here
  }
  var tradeId = new ObjectID(req.params.id);
  data.req = req;
  data.session = req.session;

  MongoClient.connect(mongoUrl, function(err, db){
    if(err){
      console.log(err);
      return;
    }
    var trades = db.collection("trades");

    trades.remove({"_id": tradeId}).then(function(data){
    // console.log(data);
      res.redirect("/book-app/my-trades");
    });
  });
});

app.get('/book-app/trade/accept/:id', function (req, res){
  var data = {};

  if(!req.session.loggedIn) {
    req.session.username = "Guest";
    res.redirect("/book-app"); // need to be logged in to get here
  }
  var tradeId = new ObjectID(req.params.id);
  data.req = req;
  data.session = req.session;

  MongoClient.connect(mongoUrl, function(err, db){
    if(err){
      console.log(err);
      return;
    }
    var trades = db.collection("trades");
    var books = db.collection("books");
    trades.findOne({"_id": tradeId}).then(function(data){
    // console.log(data);
      var toSet = {};
      toSet["username"] = data.requester;
      var bookId = ObjectID(data.book_id);
      books.update({"_id": bookId}, {
        $set: toSet
      }).then(function(){
        trades.remove({"_id": tradeId}).then(function(data){
        // console.log(data);
          res.redirect("/book-app/my-trades");
        });
      })
    });
  });
});

// end of book trading app

// start of pinterest-like app
var Twitter = require('node-twitter-api');
var shortid = require('shortid');
var twitterApiUrl = "https://api.twitter.com/oauth";

var twitter = new Twitter({
  consumerKey: twitterApiKey,
  consumerSecret: twitterApiSecret,
  callback: "https://fcc-nodejs-playground-jackyef.herokuapp.com/pinterest-app/auth/twitter"
  // callback: "http://localhost:8000/pinterest-app/auth/twitter"
});
var _requestSecret;

app.get('/pinterest-app', function (req, res){
  var data = {};
  data.title = 'fcc-pinterest-app';

  // Connect to the db
  MongoClient.connect(mongoUrl, function(err, db) {
    if(err) {
      console.log(err);
      return;
    }
    var pins = db.collection("pins");
   
      data.req = req;
      data.session = req.session;
      // var pollsCursor = pollsCollection.find();
      pins.find().sort({_id: -1}).toArray().then(function(pins){
        data.pins = pins;
        res.render("pinterest/index", data);
      });
    
  });
});

app.get('/pinterest-app/auth/twitter', function(req, res){
  var requestToken = req.query.oauth_token || null,
      verifier = req.query.oauth_verifier || null;
  twitter.getAccessToken(requestToken, _requestSecret, verifier, function(err, accessToken, accessSecret) {
    if (err)
      res.status(500).send(err);
    else
      twitter.verifyCredentials(accessToken, accessSecret, function(err, user) {
        if (err)
          res.status(500).send(err);
        else
          req.session.twitter = {};
          req.session.twitter.user = user;
          req.session.loggedIn = true;
          res.redirect('/pinterest-app');
      });
  });
  
});
app.get('/pinterest-app/twitter-login', function (req, res){
  var data = {};
  data.title = 'fcc-pinterest-app';
  
  twitter.getRequestToken(function(err, requestToken, requestSecret){
    if(err)
      res.status(500).send(err);
    else {
      _requestSecret = requestSecret;
       res.redirect("https://api.twitter.com/oauth/authenticate?oauth_token=" + requestToken);
    }
  });
});

app.get('/pinterest-app/my-pins', function (req, res){
  var data = {};
  data.title = 'fcc-pinterest-app';

  // Connect to the db
  MongoClient.connect(mongoUrl, function(err, db) {
    if(err) {
      console.log(err);
      return;
    }
    var pins = db.collection("pins");
    if(!req.session.loggedIn) {
      res.redirect('/pinterest-app');
      return;
    }
    data.req = req;
    data.session = req.session;
    // var pollsCursor = pollsCollection.find();
    pins.find( { username: req.session.twitter.user.screen_name }).sort({_id: -1}).toArray().then(function(pins){
      data.pins = pins;
      res.render("pinterest/index", data);
    });
  });
});

app.get('/pinterest-app/logout', function (req, res){
  req.session.destroy(function(err){
    res.redirect("/pinterest-app");
  });
});

app.post('/pinterest-app/add', function (req, res){
  var data = {};

  if(!req.session.loggedIn) {
    res.redirect("/pinterest-app"); // need to be logged in to get here
    return;
  }

  data.req = req;
  data.session = req.session;

  var pin = {};
  pin.url = req.body.pinUrl;
  pin.title = req.body.pinTitle;
  pin.username = req.session.twitter.user.screen_name;

  MongoClient.connect(mongoUrl, function(err, db){
    if(err){
      console.log(err);
      return;
    }
    var pins = db.collection("pins");
    pins.insertOne(pin).then(function(result){
      res.redirect("/pinterest-app/my-pins");
    });
  });
  // res.setHeader("Content-Type", "application/json");
  // res.send(JSON.stringify(req.body, null, 2));
  // res.render("voting/newPoll", data);
});


app.get('/pinterest-app/pin/delete/:id', function (req, res){

  if(!ObjectID.isValid(req.params.id)) {
    res.redirect("/pinterest-app");
    return;
  }
  var id = new ObjectID(req.params.id);
  var data = {};
  data.title = 'pinterest-app';

  if(!req.session.loggedIn) {
    res.redirect("/pinterest-app");
    return;
  }
  data.req = req;
  data.session = req.session;

  MongoClient.connect(mongoUrl, function(err, db){
    if(err){
      console.log(err);
      res.redirect("back");
      return;
    }
    db.collection("pins").remove({"_id": id}).then(function(){
      res.redirect("/pinterest-app/my-pins");
    });
  });
});

// end of pinterest-like app

// start of chat-app


var dummyMessages1 = 
  [
    {
      id: 1,
      author: "jackyef",
      content: "hey man you up?",
      timestamp: Date.now()
    },
    {
      id: 2,
      author: "jackyef",
      content: "HELLO?",
      timestamp: Date.now()+1
    },
  ];
var dummyMessages2 = 
  [
    {
      id: 3,
      author: "jackyef2",
      content: "Hey I'm chatting you from my other account to check if you have blocked me",
      timestamp: Date.now()
    },
    {
      id: 4,
      author: "jackyef2",
      content: "Still no answer?",
      timestamp: Date.now()+2
    },
  ];

var dummyMessages3 = 
  [
    {
      id: 5,
      author: "jackyef3",
      content: "Good thing that I have 3 accounts!",
      timestamp: Date.now()
    },
    {
      id: 6,
      author: "jackyef3",
      content: "What... instant read?",
      timestamp: Date.now()+3
    },
    {
      id: 7,
      author: "jackyef3",
      content: "So you did block me! FRIENDSHIP OVER!",
      timestamp: Date.now()+5
    },
  ];

var allMessages = {
  1: dummyMessages1,
  2: dummyMessages2,
  3: dummyMessages3,
};
var entries = {
  1: {
    name: "jackyef",
    id: 1,
  },
  2: {
    name: "jackyef2",
    id: 2,
  },
  3: {
    name: "jackyef3",
    id: 3,
  },
  4: {
    name: "jackyef",
    id: 1,
  },
  5: {
    name: "jackyef2",
    id: 2,
  },
  6: {
    name: "jackyef3",
    id: 3,
  },
  7: {
    name: "jackyef",
    id: 1,
  },
  8: {
    name: "jackyef2",
    id: 2,
  },
  9: {
    name: "jackyef3",
    id: 3,
  },
  10: {
    name: "jackyef",
    id: 1,
  },
  11: {
    name: "jackyef2",
    id: 2,
  },
  12: {
    name: "jackyef3",
    id: 3,
  },
};

app.get('/chat-app', function(req, res){
  var data = {};
  if(!req.session.passport) {
    res.redirect('/chat-app/login');
    return;
  }
  data.passport = {};
  data.passport.user = req.session.passport.user;
  res.render('chat/index', data);
});

app.get('/chat-app/login', function(req, res){
  var data = {};
  res.render('chat/login', data);
});

var vueChatFbAppId = process.env.VUECHAT_FB_APP_ID;
var vueChatFbAppSecret = process.env.VUECHAT_FB_APP_SECRET;
 
var Schema = mongoose.Schema, 
  ObjectId = Schema.ObjectId;

var VueChatUserSchema = new Schema({
    id: { type: ObjectId },
    facebookId: { type: String },
    name: { type: String },
    photo: { type: String },
    email: { type: String, unique: true },
    username: { type: String, lowercase: true, unique: true },
    password: { type: String },
});

var User = mongoose.model('vuechat_user', VueChatUserSchema);

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});
passport.use(new FacebookStrategy({
  clientID: vueChatFbAppId,
  clientSecret: vueChatFbAppSecret,
  callbackURL: "/auth/facebook/callback",
  enableProof: true,
  profileFields : ['id', 'displayName', 'emails', 'photos'],
},
  function(accessToken, refreshToken, profile, cb){
    User.findOne({facebookId: profile.id}, function(err, user){
      if(err) throw(err);
      if(user != null) return cb(null, user);

      var user = new User({
          facebookId : profile.id,
          name: profile.displayName,
          email: profile.emails[0].value,
          photo: profile.photos[0].value,
      });

      user.save(function(err) {
          if(err) throw err;
          return cb(null, user);
      });

      // return cb(err, user);
    });
  }
))

app.get('/auth/facebook',
  passport.authenticate('facebook', { scope: ['email'] } ));

app.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/chat-app/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/chat-app');
  });

app.get('/chat-app/initialData', function(req, res){
  var data = {};
  data.allMessages = allMessages;
  data.entries = entries;
  res.status(200);
  res.json(data);
});

app.post('/chat-app/sendMessage', function(req, res){
  var entryId = req.body.entryId;
  var msg = req.body.message;
  allMessages[entryId].push(msg);
  res.status(200);
  res.send();
});

app.ws('/chat-app/ws', function(ws, req) {
  ws.on('message', function(msg) {
    console.log("broadcasting message to all clients:", msg);
    expressWs.getWss().clients.forEach(function(client,i){
      if(client !== ws) client.send(msg);
    });
    var data = msg.split(':');
    var action = data[0];
    var symbol = data[1];
    
    if(action == "ADD"){
      names.push(symbol);
    } else if(action == "REMOVE") {
      names.splice(names.indexOf(symbol), 1);
    }
  });
});
// end of chat-app