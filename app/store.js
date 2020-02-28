function setBrush() {
    
}

var store = {

}

var Listener = ES3Class({
  constructor: function() {
    this.listeners = {};
  },
  invoke: function(a, b, c, d, e) {
    Object.keys(this.listeners).forEach(function(f) {f(a, b, c, d, e)});
  },
  addListener: function(f) {
    this.listeners[f] = null;
  },
  removeListener: function(f) {
    delete this.listeners[f];
  },
});


// ===============================================
// HELPERS

function ES3Class(obj) {
  var
    // if there isn't a constructor, create one
    constructor = obj.hasOwnProperty('constructor') ?
    obj.constructor : function() {},
    key;
  for (key in obj) {
    // per each own property in the received object
    if (obj.hasOwnProperty(key) && key !== 'constructor') {
      // copy such property to the constructor prototype
      constructor.prototype[key] = obj[key];
    }
  }
  // return what will be used to create new Instances
  return constructor;
}