var moment = require('moment');
var tz = require('moment-timezone');
var Client = require('ibmiotf');
var fs = require('fs');
var args = process.argv.slice(2);
var appClientConfig;

if (args == "l") {
  appClientConfig = JSON.parse(fs.readFileSync('secrets/ibm.json', 'utf8'));
  } else {
  appClientConfig = JSON.parse(fs.readFileSync('/run/secrets/ibm.json', 'utf8'));
  }

moment.locale('en');

var day = new Date(); 
var     deviceInfo = {
        date : moment(day).format('DD-MM-YYYY'),
        deviceType : null,
        deviceId : null,
        eventType : null,
        payload : null,
        timeIn : null,
        timeOut : null,
        totalTime : null,
        beaconId : null
    }

var appClient = new Client.IotfApplication(appClientConfig);

appClient.log.setLevel('info');

appClient.connect();

appClient.on('connect', function () {
    appClient.
        subscribeToDeviceEvents('iBeamer');
});

setInterval(function () {
   if (appClient.isConnected) {
   } else {
     console.log('Application is NOT connected, trying to re-connect');
     appClient.connect();
   }
}, 100000);


appClient.on('deviceEvent', function (deviceType, deviceId, eventType, format, payload) {
    //console.log(new Date().toString() + "Device Event from :: "+deviceType+" : "+deviceId+" of event "+eventType+" with payload : "+payload);
    if ((eventType == "Beacon") && ((JSON.parse(payload).beaconId == 'MiniBeacon_00188') || (JSON.parse(payload).beaconId == 'MiniBeacon_00171') || (JSON.parse(payload).beaconId == 'MiniBeacon_00330'))){
      day = new Date();
      var dayWrapper = moment(day).format('DD-MM-YYYY');
      deviceInfo = {
          date : moment(day).format('DD-MM-YYYY'),
          deviceType : deviceType,
          deviceId : JSON.parse(payload).beaconId,
          eventType : eventType,
          payload : JSON.parse(payload).Beacon,
          timeIn : JSON.parse(payload).Beacon == 'entered' ? moment(day) : null ,
          timeOut : JSON.parse(payload).Beacon == 'exited' ? moment(day) : null ,
          totalTime : null
      }
    
      findAndUpdateUserStatus(deviceInfo, function(){
      });

      findOrCreateTimeReport(deviceInfo, function(err, deviceInfo, text){
         if (err) {
            console.log('error: ' + text);
            return
         } else {
               console.log('Time report updated in DB!');
         }
      });
    }
});

var express = require('express');
var router = express.Router();
var User = require('../models/user');
//var Address = require('../models/numbers');
var TimeReport = require('../models/timeReport');
var bCrypt = require('bcrypt-nodejs');
//var bootbox = require('bootbox');

// Generates hash using bCrypt
var createHash = function(password){
    return bCrypt.hashSync(password, bCrypt.genSaltSync(10), null);
}

function findAndUpdateUserStatus(req, done){
  console.log('User to change ' + req.deviceId);
  User.findOne({ 'deviceId' :  req.deviceId }, function(err, existingUser) {
    // In case of any error, return using the done method
    if (err){
       console.log('Error in finding user with deviceId: ' + req.deviceId + ', Message:  ' + err);
       return done(err);
    }
    // User not found
    if (!existingUser) {
       return done(true, req.user, 'User not found!');
    } else {
      // if there is no user with that email
      // create the user
      if (req.payload == 'entered') { 
          existingUser.atDesk = true;
      } else {
          existingUser.atDesk = false;
      }
      existingUser.save(function(err) {
        if (err){
           console.log('Error in Saving user: '+err);
           throw err;
        }
        console.log('User info updated succesful');
        return done(false);
      });

    }
  });
}


function findOrCreateUser(req, done){ 
  User.findOne({ 'username' :  req.params.username }, function(err, usernew) {
    // In case of any error, return using the done method
    if (err){
       console.log('Error in Registration: '+err);
       return done(err);
    }
    // already exists
    if (usernew) {
       return done(true, req.user, 'User already exists');
    } else {
      // if there is no user with that email
      // create the user
      var newUser = new User();
      // set the user's local credentials
      newUser.username = req.params.username;
      newUser.password = createHash(req.params.password);
      newUser.email = req.params.email;
      newUser.firstName = req.params.firstName;
      newUser.lastName = req.params.lastName;
      newUser.company = req.params.company;
      newUser.role = req.params.role;
      newUser.active = (req.params.active === 'active');

     // save the user
     newUser.save(function(err) {
       if (err){
          console.log('Error in Saving user: '+err);
          throw err;
       }
       console.log('Bank Registration succesful');
       return done(false);
     });
   }
 });
}


/*
function findAndChangeUser(req, done){
  User.findOne({ 'username' :  req.param('username') }, function(err, oldUser) {
    // In case of any error, return using the done method
    if (err){
       console.log('Error in Registration: '+err);
       return done(err);
    }
    // already exists
    if (!oldUser) {
       //console.log('User already exists with username: ' + req.param('username'));
       return done(true, req.user, 'User already exists');
    } else {
      // if there is no user with that email
      // create the user
      //var newUser = new User();
      // set the user's local credentials
      oldUser.username = req.param('username');
      var unchanged = (req.param('password') == '');
      if (!unchanged) {
        oldUser.password = createHash(req.param('password'));
      }
      oldUser.email = req.param('email');
      oldUser.firstName = req.param('firstName');
      oldUser.lastName = req.param('lastName');
      oldUser.company = req.param('company');
      oldUser.role = req.param('role');
      oldUser.active = (req.param('active') === 'active');

     // save the user
     oldUser.save(function(err) {
       if (err){
          console.log('Error in Saving user: '+err);
          throw err;
       }
       console.log('Bank Registration succesful');
       return done(false);
     });
   }
 });
}


function findAndDeleteUser(req, done){
  User.findOne({ 'username' :  req.param('username') }, function(err, user) {
    // In case of any error, return using the done method
    if (err){
       console.log('Error in Deleting user: '+err);
       return done(err);
    }
    // already exists
    if (!user) {
       //console.log('User already exists with username: ' + req.param('username'));
       return done(true, req.user, 'No such user exists');
    } else {
     // remove the user
     user.remove(function(err) {
       if (err){
          console.log('Error in Deleting user: '+err);
          throw err;
       }
       console.log('User succesfully deleted');
       return done(false);
     });
   }
 });
}

/*
function findOrCreateAddress(req, done){
  Address.findOne({ 'number' :  req.param('number') }, function(err, address) {
    // In case of any error, return using the done method
    if (err){
       console.log('Error in Registration: '+err);
       return done(err);
    }
    // already exists
    if (address) {
       //console.log('User already exists with username: ' + req.param('username'));
       return done(true, req.user, 'Number already exists');
    } else {
      // if there is no user with that email
      // create the address
      var newAddress = new Address();
      // set the user's local credentials
      newAddress.number = req.param('number');
      newAddress.company = req.param('company');
     // save the number
     newAddress.save(function(err) {
       if (err){
          console.log('Error in Saving number: '+err);
          throw err;
       }
       console.log('Adding new number succesful' + newAddress);
       return done(false);
     });
   }
 });
}
*/

function findAndChangeTimeReport(req, editedReport, done){
  //console.log('Date to search ' + editedReport.date);
  //console.log('Device ID to search: ' + req.user.deviceId);
  TimeReport.findOne( { $and: [{ 'date' :  req.params.date }, { 'deviceId' : req.user.deviceId} ]}, function(err, oldReport) {
    // In case of any error, return using the done method
    if (err){
       console.log('Error in Changing Report: '+err);
       return done(err);
    }
    // if report not already already exists
    if (!oldReport) {
       var newTimeReport = new TimeReport();
       // set the user's local credentials
       newTimeReport.date = editedReport.date;
       newTimeReport.deviceId = req.user.deviceId;
       newTimeReport.payload = editedReport.payload;
       newTimeReport.timeIn =  moment(editedReport.timeIn, 'ddd, DD MMM YYYY HH:mm:ss ZZ').tz('Europe/Helsinki');
       newTimeReport.timeOut = moment(editedReport.timeOut, 'ddd, DD MMM YYYY HH:mm:ss ZZ').tz('Europe/Helsinki');
       newTimeReport.totalTime =  ( (newTimeReport.timeIn == null) || (newTimeReport.timeOut == null) ) ? '0' : moment.utc(moment(newTimeReport.timeOut).diff(newTimeReport.timeIn)).format('HH:mm:ss');
       // save the new report
       newTimeReport.save(function(err) {
         if (err){
            console.log('Error in Saving timeReport: '+err);
            throw err;
         }  
         console.log('Adding new timereport successful');
         return done(false);
      });
    } else {
      oldReport.date = editedReport.date;
      oldReport.payload = editedReport.payload;
      oldReport.deviceId = req.user.deviceId;
      oldReport.timeIn = moment(editedReport.timeIn).tz('Europe/Helsinki');
      oldReport.timeOut = moment(editedReport.timeOut).tz('Europe/Helsinki');
      oldReport.totalTime = editedReport.totalTime;
      console.log('Updated report details are: ' + oldReport);

      // save the Report
      oldReport.save(function(err) {
        if (err){
           console.log('Error in saving Report: '+err);
           throw err;
        }
        console.log('Saving new Report details successful');
        return done(false);
      });
    }
 });
}

function findAndDeleteDate(req, done){
  TimeReport.findOne({ $and: [{ 'date' :  req.params.value }, { 'deviceId' : req.user.deviceId}] }, function(err, user) {
    //console.log('Timereport to delete ' + user);
    // In case of any error, return using the done method
    if (err){
       console.log('Error in Deleting Time Report: '+err);
       return done(err);
    }
    // already exists
    if (!user) {
       return done(true, req.user, 'No such date exists');
    } else {
     // remove the user
     user.remove(function(err) {
       if (err){
          console.log('Error in Deleting date: '+err);
          throw err;
       }
       return done(false);
     });
   }
 });
}


function findOrCreateTimeReport(req, done){
  var day = moment().tz('Europe/Helsinki');
  TimeReport.findOne({ $and: [{ 'date' :  req.date }, { 'deviceId' : req.deviceId} ]}, function(err, timeReport) {
    // In case of any error, return using the done method
    if (err){
       console.log('Error in finding timeReport: '+err);
       return done(err);
    }
    // already exists
    if (timeReport) {
       console.log('Timereport already exists'+ timeReport);
       timeReport.date = req.date;
       timeReport.deviceId = req.deviceId;
       timeReport.payload = req.payload;
       if (!timeReport.timeIn) {
           timeReport.timeIn =  req.payload == 'entered' ? day : null
       }
       if (req.payload == 'exited'){
           timeReport.timeOut = day;
       }
       var firstIn = moment(timeReport.timeIn, "ddd MMM DD YYYY HH:mm:ss.SSS ZZ").toISOString();
       var lastOut = moment(timeReport.timeOut, "ddd MMM DD YYYY HH:mm:ss.SSS ZZ").toISOString();
       //console.log('first in: ' + firstIn + '   lastout: ' + lastOut);
       timeReport.totalTime =  ( (timeReport.timeIn == null) || (timeReport.timeOut == null) ) ? '0' : moment.utc(moment(lastOut).diff(firstIn)).format('HH:mm:ss');
       //console.log('timeReport: ' + timeReport);
       timeReport.save(function(err) {
         if (err){
           console.log('Error in Saving timeReport: '+err);
           throw err;
         }
         console.log('Updating old timereport successful: ');
         return done(false);
       });  
       return done(false);
    } else {
      // if there is no timereport fro the existing date
      // create a new timereport
      var newTimeReport = new TimeReport();
      // set the user's local credentials
      newTimeReport.date = req.date;
      newTimeReport.payload = req.payload;
      newTimeReport.deviceId = req.deviceId;
      newTimeReport.timeIn =  req.payload == 'entered' ? moment(day).tz('Europe/Helsinki') : null ,
      newTimeReport.timeOut = req.payload == 'exited' ? moment(day).tz('Europe/Helsinki') : null ,
      newTimeReport.totalTime =  ( (newTimeReport.timeIn == null) || (newTimeReport.timeOut == null) ) ? '0' : moment.utc(moment(newTimeReport.timeOut).diff(newTimeReport.timeIn)).format('HH:mm:ss');
     // save the number
     newTimeReport.save(function(err) {
       if (err){
          console.log('Error in Saving timeReport: '+err);
          throw err;
       }
       console.log('Adding new timereport successful');
       return done(false);
     });
   }
 });
}

var isAuthenticated = function (req, res, next) {
	// if user is authenticated in the session, call the next() to call the next request handler 
	// Passport adds this method to request object. A middleware is allowed to add properties to
	// request and response objects
	if (req.isAuthenticated())
		return next();
	// if the user is not authenticated then redirect him to the login page
	res.redirect('/');
}

module.exports = function(passport){

	/* GET login page. */
	router.get('/', function(req, res) {
    	// Display the Login page with any flash message, if any
		res.render('index', { message: req.flash('message') });
	});

	/* Handle Login POST */
	router.post('/login', passport.authenticate('login', {
		successRedirect: '/home',
		failureRedirect: '/',
		failureFlash : true  
	}));

	/* GET Registration Page */
	router.get('/signup', function(req, res){
                console.log('new user: ' + req.user);
		res.render('register',{message: ''});
	});

	/* Handle Registration POST */
	router.post('/signup', passport.authenticate('signup', {
		successRedirect: '/home',
		failureRedirect: '/signup',
		failureFlash : true  
	}));


        /* GET Edit date report Page */
        router.get('/editdate/:date', isAuthenticated, function(req, res){
                console.log('edit date started ' + req.params.date + ' and ' + req.user.deviceId);
                          TimeReport.find({ $and: [{ 'date' :  req.params.date }, { 'deviceId' : req.user.deviceId} ]}, function(err, reports) {
                            if (err) return console.error(err);
                            reports.forEach(function(report) {
                              report.timeIn = moment(report.timeIn,'ddd MMM DD YYYY HH:mm:ss ZZ').format('HH:mm:ss');
                              report.timeOut = moment(report.timeOut,'ddd MMM DD YYYY HH:mm:ss ZZ').tz('Europe/Helsinki').format('HH:mm:ss');
                            });
                            res.render('editdate', { dates: reports});
                          });
        });


	/* GET Home Page */
	router.get('/home', isAuthenticated, function(req, res){
                  TimeReport.find({ 'deviceId' : req.user.deviceId }, function(err, reports) {
                    if (err) return console.error(err);
                    reports.forEach(function(report) {
                        report.timeOut = moment(report.timeOut,'ddd MMM DD YYYY HH:mm:ss ZZ').tz('Europe/Helsinki').format('HH:mm:ss');
                        report.timeIn = moment(report.timeIn,'ddd MMM DD YYYY HH:mm:ss ZZ').tz('Europe/Helsinki').format('HH:mm:ss');
                    });
                    res.render('timereport', { timereport: reports, user: req.user});
                  });
	});


       /* Manage timeReports */
       router.get('/timereport', isAuthenticated, function(req, res){
                if (req.user.role == 'admin') {
                  TimeReport.find({ 'deviceId' : req.user.deviceId }, function(err, reports) {
                    if (err) return console.error(err);
                      reports.forEach(function(report) {
                        report.timeIn = moment(report.timeIn,'ddd MMM DD YYYY HH:mm:ss ZZ').tz('Europe/Helsinki').format('HH:mm:ss');
                        report.timeOut = moment(report.timeOut,'ddd MMM DD YYYY HH:mm:ss ZZ').tz('Europe/Helsinki').format('HH:mm:ss');
                      });
                      res.render('timereport', { timereport: reports, user: req.user});
                 })
               } else {
                  
                  TimeReport.find({ 'deviceId' : req.user.deviceId }, function(err, timereport) {
                    if (err) return console.error(err);
                    var reports = timereport;
                    timereport.forEach(function(report) {
                    });
                    res.render('timereport', { timereport: timereport, user: req.user});
                    
                 })
               }
             });

        /* Handle Address add POST */
        router.post('/editdate', isAuthenticated, function(req, res) {
                console.log('timereport add POST received ');
                var newTimeReport = new TimeReport();
                // set the user's local credentials
                newTimeReport.date = moment(req.params.date, 'DD-MM-YYYY').format('DD-MM-YYYY');
                newTimeReport.payload = req.params.payload;
                var dateformat = moment(req.params.date, 'DD-MM-YYYY').format('DD-MM-YYYY'); 
                newTimeReport.timeIn = moment(dateformat  + ' ' + req.params.timeIn, 'DD-MM-YYYY HH:mm:ss').tz('Europe/Helsinki').format('ddd MMM DD YYYY HH:mm:ss ZZ' );
                newTimeReport.timeOut = moment(dateformat + ' ' + req.params.timeOut, 'DD-MM-YYYY HH:mm:ss').tz('Europe/Helsinki').format('ddd MMM DD YYYY HH:mm:ss ZZ' );
                newTimeReport.totalTime = moment.utc(moment(newTimeReport.timeOut).diff(newTimeReport.timeIn)).format('HH:mm:ss');
                findAndChangeTimeReport(req, newTimeReport, function(err, newTimeReport, text){
                        if (err) {
                          console.log('error: ' + text);
                          res.render('timereport', {message: text});
                          return
                        } else {
                          TimeReport.find({ 'deviceId' : req.user.deviceId },function(err, timeReportList) {
                            //console.log('timereport is: ' + timeReportList);
                            if (err) return console.error(err);
                            timeReportList.forEach(function(report) {
                                report.timeIn = moment(report.timeIn).tz('Europe/Helsinki').format('HH:mm:ss');
                                report.timeOut = moment(report.timeOut).tz('Europe/Helsinki').format('HH:mm:ss');
                            });
                            res.render('timereport', { timereport: timeReportList, user: req.user});
                          });

                        }
                });
        });

        /* Handle Delete Time Report POST */
        router.post('/deletedate', isAuthenticated, function(req, res) {
                console.log('Delete Time Report POST received with value ');
                findAndDeleteDate(req, function(err){
                        if (err) {
                          console.log('error: ' + text);
                          res.render('timereport', {message: text});
                        } else {
                          TimeReport.find({ 'deviceId' : req.deviceId }, function(err, timeReportList) {
                            //console.log('timereport is: ' + timeReportList);
                            if (err) return console.error(err);
                            timeReportList.forEach(function(report) {
                                report.timeIn = moment(report.timeIn).format('HH:mm:ss');
                                report.timeOut = moment(report.timeOut).format('HH:mm:ss');
                            });
                            res.render('timereport', { timereport: timeReportList, user: req.user});
                          });

                        }
                });
        });

        /* test */
       router.get('#home', isAuthenticated, function(req, res){
                res.render('home', { user: req.user });
        });


	/* Handle Logout */
	router.get('/signout', function(req, res) {
		req.logout();
		res.redirect('/');
	});

	return router;

}
