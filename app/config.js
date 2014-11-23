require.config({
  paths: {
    bower_components: "../bower_components",
    jquery: "../bower_components/jquery/jquery",
    knockout: "../bower_components/knockout.js/knockout",
    qunit: "../bower_components/qunit/qunit/qunit",
    requirejs: "../bower_components/requirejs/require",
    sammy: "../bower_components/sammy/lib/sammy",
    "jquery-ui": "../bower_components/jquery-ui/jquery-ui"
  },
  map: {
    "*": {
      knockout: "../bower_components/knockout.js/knockout",
      ko: "../bower_components/knockout.js/knockout"
    }
  },
  packages: [

  ]
});

// Use the debug version of knockout it development only
// When compiling with grunt require js will only look at the first 
// require.config({}) found in this file
require.config({
  map: {
    "*": {
      "knockout": "../bower_components/knockout.js/knockout-2.3.0.debug",
      "ko": "../bower_components/knockout.js/knockout-2.3.0.debug"
    }
  }
});

if (!window.requireTestMode) {
  require(['main'], function(){ });
}

