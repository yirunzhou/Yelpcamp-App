var express = require("express"),
    router = express.Router(),
    passport = require("passport"),
    User = require("../models/user"),
    Campground = require("../models/campground"),
    middleware = require("../middleware"),
    nodemailer = require("nodemailer"),
    async = require("async"),
    crypto = require("crypto");


router.get("/", function(req,res){
   res.render("landing", {page: "landing"}); 
});


router.get("/register", function(req, res){
   res.render("register", {page: "register"});
});

router.post("/register", function(req, res){
   User.register(new User({username: req.body.username, email: req.body.email}), req.body.password, function(err, user){
      if (err){
         console.log(err);
         return res.render("register", {error: err.message, page: "register"});
      }
      passport.authenticate("local")(req, res, function(){
         req.flash("success", "Welcome to YelpCamp " + req.user.username + " !");
         res.redirect("/campgrounds");
      });
   });
});


router.get("/login", function(req, res){
   res.render("login", {page: "login"});
});

router.post("/login", passport.authenticate("local",
   {
      successRedirect: "/campgrounds",
      faliureRedirect: "/login"
   }), function(req, res){});

router.get("/logout", function(req, res){
   req.logout();
   req.flash("success", "Successfully logged out");
   res.redirect("/campgrounds");
});

router.get("/users/:id", middleware.isLoggedIn, function(req, res){
   User.findById(req.params.id, function(err, user){
      if(err || !user){
         console.log(err);
         req.flash("error", "User not found");
         res.redirect("/campgrounds");
      } else{
         Campground.find().where("author.id").equals(user._id).exec(function(err, campgrounds){
            if(err){
               console.log(err);
               req.flash("error", "User not found");
               res.redirect("/campgrounds");
            } else{
               res.render("users/show", {user:user, campgrounds:campgrounds});
            }
         });
      }
   });
});

//forgot password

router.get("/forgot", function(req, res){
   res.render("forgot");
});

router.post('/forgot', function(req, res, next) {
   async.waterfall([
      function(done) {
         crypto.randomBytes(20, function(err, buf) {
         var token = buf.toString('hex');
         done(err, token);
         });
      },
      function(token, done) {
         User.findOne({ email: req.body.email }, function(err, user) {
            if (err || !user) {
               req.flash('error', 'No account with that email address exists.');
               return res.redirect('/forgot');
            }
            
            user.resetPasswordToken = token;
            user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
            
            user.save(function(err) {
               done(err, token, user);
            });
         });
      },
      function(token, user, done) {
         var smtpTransport = nodemailer.createTransport({
            service: 'Gmail', 
            auth: {
            user: 'yelpcampapp.yrzhou@gmail.com',
            pass: process.env.GMAILPW
            }
         });
         var mailOptions = {
            to: user.email,
            from: 'yelpcampapp.yrzhou@gmail.com',
            subject: 'YelpCamp Password Reset',
            text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
            'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
            'http://' + req.headers.host + '/reset/' + token + '\n\n' +
            'If you did not request this, please ignore this email and your password will remain unchanged.\n'
         };
         smtpTransport.sendMail(mailOptions, function(err) {
            console.log('mail sent');
            req.flash('success', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
            done(err, 'done');
         });
      }
      ], function(err) {
         if (err) return next(err);
         res.redirect('/forgot');
      });
});

router.get('/reset/:token', function(req, res) {
   User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
      if (err || !user) {
         req.flash('error', 'Password reset token is invalid or has expired.');
         return res.redirect('/forgot');
   }
      res.render('reset', {token: req.params.token});
   });
});

router.post("/reset/:token", function(req, res){
   async.waterfall([
      function(done) {
         User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
            if (err || !user) {
               req.flash('error', 'Password reset token is invalid or has expired.');
               return res.redirect('back');
            }
            if(req.body.new_password === req.body.confirm_password) {
               user.setPassword(req.body.new_password, function(err) {
                  user.resetPasswordToken = undefined;
                  user.resetPasswordExpires = undefined;
                  
                  user.save(function(err) {
                     req.logIn(user, function(err) {
                        done(err, user);
                     });
                  });
               });
            } else {
               req.flash("error", "Passwords do not match.");
               return res.redirect('back');
            }
         });
      },
      function(user, done) {
         var smtpTransport = nodemailer.createTransport({
            service: 'Gmail', 
            auth: {
             user: 'yelpcampapp.yrzhou@gmail.com',
             pass: process.env.GMAILPW
            }
         });
         var mailOptions = {
         to: user.email,
         from: 'yelpcampapp.yrzhou@gmail.com',
         subject: 'Your password has been changed',
         text: 'Hello,\n\n' +
          'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
         };
         smtpTransport.sendMail(mailOptions, function(err) {
            req.flash('success', 'Success! Your password has been changed.');
            done(err);
         });
         }
      ], function(err) {
         res.redirect('/campgrounds');
      });
});


// follow user
router.get('/follow/:id', middleware.isLoggedIn, async function(req, res) {
  try {
    let user = await User.findById(req.params.id);
    user.followers.push(req.user._id);
    user.save();
    req.flash('success', 'Successfully followed ' + user.username + '!');
    res.redirect('/users/' + req.params.id);
  } catch(err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
});





module.exports = router;