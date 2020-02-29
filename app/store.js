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

var isDirty = function() { 
    // todo: implement this
    return true;
}

//window.onload = function() {
//    window.addEventListener("beforeunload", function (e) {
//        if (!isDirty()) {
//            return undefined;
//        }
//
//        var confirmationMessage = 'It looks like you have been editing something. '
//                                + 'If you leave before saving, your changes will be lost.';
//
//        (e || window.event).returnValue = confirmationMessage; //Gecko + IE
//        return confirmationMessage; //Gecko + Webkit, Safari, Chrome etc.
//    });
//};

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