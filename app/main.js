// to depend on a bower installed component:
// define(['component/componentName/file'])

define(["jquery", "knockout", "sammy", "jquery-ui"], function($, ko, Sammy) {
/* Author: marmida
Depends on: knockout, sammy, jquery ui, base64, modernizr
*/

/* a port of Java's hashCode function; used as a simple hashing algorithm
   taken from: http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
   */
String.prototype.hashCode = function(){
    var hash = 0;
    if (this.length == 0) return hash;
    for (i = 0; i < this.length; i++) {
        char = this.charCodeAt(i);
        hash = ((hash<<5)-hash)+char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

/* don't flatten nested elements like $.map; recursively apply fn to sub-lists */
document.nestedMap = function(ar, fn) {
    var ret = []
    for(var i=0; i<ar.length; i++) {
        var elem = ar[i]
        if(Array.isArray(elem)) {
            ret.push(document.nestedMap(elem, fn))
        } else {
            ret.push(fn(elem))
        }
    }
    return ret
}

/* un-nest lists while preserving depth-first order */
Array.prototype.flatten = function() {
    var reducer = function(last, cur) {
        if(Array.isArray(cur)) {
            cur = cur.reduce(reducer, [])
        }
        return last.concat(cur) 
    }
    return this.reduce(reducer, [])
}

/*  annotateParents: add 'parent' to each Tile object, indicating 
    which Tile object is above it in the train, heading upwards,
    towards the first spinner tile played.

    About the format:
    The first item in each list is parent to all subsequent items.
    Any non-initial item must be a list if it has sub-items itself.
    If it does not have any subtrees, a non-initial item can be given
    by itself, for brevity.
*/
Array.prototype.annotateParents = function(parent) {
    for (var i=0; i<this.length; i++) {
        var elem = this[i]
        if(i == 1) {
            // the first elem is parent to all following
            // we omit nested lists in the case of leaves
            parent = this[0]
        }

        if(Array.isArray(elem)) {
            elem.annotateParents(parent)
        } else {
            elem.parent = parent
        }
    }
}

/* slider */

ko.bindingHandlers.percentageSlider = {
init: function (element, valueAccessor, allBindingsAccessor) {
    var options = allBindingsAccessor().percentageSliderOptions || {};
    $(element).slider(options);
    ko.utils.registerEventHandler(element, "slidechange", function (event, ui) {
        // this is also handled by 'slide' below; maybe unneccessary
        var observable = valueAccessor();
        console.log('slidechange: ' + ui.value) // todo: remove
        observable(ui.value);
    });
    ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
        $(element).slider("destroy");
    });
    ko.utils.registerEventHandler(element, "slide", function (event, ui) {
        var observable = valueAccessor();
        console.log('slide: ' + ui.value) // todo: remove
        observable(ui.value);
    });
},
update: function (element, valueAccessor) {
    var value = ko.utils.unwrapObservable(valueAccessor());
    $(element).slider("value", value);

}
};

ko.bindingHandlers.dynamicText = {
'update': function (element, valueAccessor) {
    var value = ko.utils.unwrapObservable(valueAccessor());
    if (typeof value === 'function') {
        value = value(element);
    }
    if ((value === null) || (value === undefined)) {
        value = "";
    }
    if (typeof element.innerText == "string") { element.innerText = value; }
    else { element.textContent = value; }
}
};

ko.bindingHandlers.tableauLayout = {
    'update': function (element, valueAccessor, allBindingsAccessor) {
        var tiles = allBindingsAccessor().tableauLayout() // why not valueAccessor()
        console.log('tableauLayout invoked; tableau: ' + document.viewmodel.tableau().length + '; tiles: ' + tiles.length)

        // appropriate for our scenario: wipe out all contained elements
        $(element).children().not('#doorstop').remove()

        // scroll the tableau
        $(element).scrollTop(tableauHeight/2 - $(element).height()/2)
        $(element).scrollLeft(tableauWidth/2 - $(element).width()/2)

        var root_arm_ctr = 0
        for (var ctr=0; ctr<tiles.length; ctr++) {
            var tile = tiles[ctr]
            $(element).append(tile.domino())
            // re-fetch the element just added
            tile.elem = $(element).children(":last")

            // only display the tile when we're past the turn in which it was added
            tile.elem.attr('data-bind', 'visible: turn() >= ' + tile.turn)
            // must re-bind the new element
            ko.applyBindings(document.viewmodel, tile.elem[0])

            /* add two attribs to each tile: 
               * placement: angle between the center of the parent and child, in degrees; NB: 0 is right
               * rotation: angle of the child tile, in degrees, so that the A end points toward the parent; NB: 0 is up 
               * because of they have different origins, placement = rotation + 90 
               */
            if(tile.parent == undefined) {
                // this is the root; center it
                tile.elem.css({
                    'position': 'absolute',
                    'left': (tableauWidth/2 - tileWidth/2) + 'px',
                    'top': (tableauHeight/2 - tileHeight/2) + 'px',
                })
                tile.placement = 0
                tile.rotation = 0
                continue
            } else if (tile.parent.parent == undefined) {
                // this tile is directly under the root; it gets a pre-determined position
                tile.placement = root_arm_ctr++ * 90
                tile.rotation = tile.placement - 90
            } else if (tile.isSpinner()) {
                // this tile is a spinner, and should appear perpendicular
                tile.placement = tile.parent.placement
                tile.rotation = (tile.parent.rotation + 90) % 360
            } else if (tile.parent.isSpinner()) {
                // this tile is below a spinner, and needs to fan out from it in 45 degree rays
                if(tile.parent.childPlacementCtr == undefined) {
                    // kind of cheesy, but we'll use the parent to host a counter
                    tile.parent.childPlacementCtr = 0
                }
                tile.placement = tile.parent.placement - 45 + (45 * tile.parent.childPlacementCtr++)
                /* the child's placement + the parent's placement = the rotation angle so the B
                 * side points upwards.
                 * Add 180 to flip the A side back around, and then subtract 90 to deal with the
                 * fanning. */
                tile.rotation = (tile.parent.placement + tile.placement + 90) % 360
            } else {
                // regular train placement
                tile.placement = tile.parent.placement
                tile.rotation = tile.parent.rotation
            }

            // pips matching: if the tile was attached "inverted," then add to its angle
            if (tile.inverted) {
                tile.rotation = (tile.rotation + 180) % 360
            }
            
            // use the placement angles to determine this tile's position
            var offset_x = Math.round(spacing * Math.cos(Math.PI * (tile.placement / 180)))
            var offset_y = Math.round(spacing * Math.sin(Math.PI * (tile.placement / 180)))
            // we can't use $.position, so we'll do our own
            // fetch original values, dropping 'px'
            var parent_top = parseInt(tile.parent.elem.css('top').slice(0, -2))
            var parent_left = parseInt(tile.parent.elem.css('left').slice(0, -2))

            // combine with offset
            var n_top = parent_top + offset_y
            var n_left = parent_left + offset_x

            // debug
            console.log('tile ' + tile.a + '/' + tile.b + ' offset: ' + offset_x + " " + offset_y +
                ' placement: ' + tile.placement + ' rotation: ' + tile.rotation + ' parent: ' + parent_left + ' ' + parent_top + 
                ' parent rotation: ' + tile.parent.rotation + ' new pos: ' + n_left + ' ' + n_top)

            // apply styles
            tile.elem.css({
                'position': 'absolute',
                'top': n_top + 'px',
                'left': n_left + 'px',
            })
            
            // apply rotation second; $.position isn't aware of rotation
            if(tile.rotation != 0) {
                // don't bother adding css if the rotation is 0
                for(var propCtr=0; propCtr<transformProperties.length; propCtr++) {
                    tile.elem.css(transformProperties[propCtr], 'rotate(' + tile.rotation + 'deg)')
                }
            }
        }
    },
}


// UGLY GLOBALS
// todo: namespace
var tileWidth = 52
var tileHeight = 104
var spacing = tileHeight * (5/4)
var transformProperties = ['-moz-transform', '-webkit-transform', '-o-transform', '-ms-transform', 'transform']
var tableauWidth = 2000
var tableauHeight = 1600
var apiHost = 'http://localhost:11081'

// MODELS
var Tile = function(a, b, turn, inverted, turnHandAdded, turnHandRemoved) {
    var self = this
    // since the whole tile changes, we don't need to make these observable
    self.a = a
    self.b = b
    self.turn = turn
    self.inverted = inverted
    self.turnHandAdded = turnHandAdded
    self.turnHandRemoved = turnHandRemoved
    

    self.domino = function() {
       return '<div class="domino"><div class="pips' + self.a + '">' + self.a + 
            '</div><hr/><div class="pips' + self.b + '">' + self.b +'</div></div>'
    }

    self.isSpinner = function() {
        return self.a == self.b
    }

    self.isInHand = function() {
        // is there a better way to get the current turn?
        curTurn = document.viewmodel.turn()
        return self.turnHandAdded < self.turnHandRemoved && curTurn >= self.turnHandAdded && 
            curTurn < self.turnHandRemoved
    }
}


var ChickenFootViewModel = function() {
    var self = this
    // Data
    // turn: the current turn being displayed
    self.turn = ko.observable(1)
    // maxTurn: the highest numbered turn in the current round
    self.maxTurn = ko.observable(1)
    // hands: arrays of Tiles in each player's hand.  Changes every round.
    self.p1Hand = ko.observableArray()
    self.p2Hand = ko.observableArray()
    // tableau: a flat array of tiles after they've been annotated.  Changes every round.
    self.tableau = ko.observableArray()

    // Behaviors

    /* renderGame: refreshes all the observables and sets up everything
       each time a new game is loaded. */
    self.renderGame = function(gameData) {
        /* we don't want to re-bind the slider, else we'd have to figure out partial 
         * binding updates as per http://stackoverflow.com/questions/8281875/knockout-js-update-bindings
         * Instead, we just update its values
         */
        tileFn = function(elem) {
            return new Tile(elem.a, elem.b, elem.turn, elem.inverted, elem.turnHandAdded, elem.turnHandRemoved)
        }

        // populate observables that will trigger the board to fill in
        var newTree = document.nestedMap(gameData.tableau, tileFn)
        newTree.annotateParents()
        self.tableau(newTree.flatten())
        self.maxTurn(gameData.maxTurn)
        self.turn(gameData.maxTurn)
        self.p1Hand(gameData.p1Hand.map(tileFn))
        self.p2Hand(gameData.p2Hand.map(tileFn))
        $('#turn-slider').slider({min: 1, max: gameData.maxTurn, value: gameData.maxTurn})
    }

    self.nextTurn = function() {
        var val = self.turn()
        if(val < self.maxTurn()) {
            self.turn(val+1)
        }
    }

    self.prevTurn = function() {
        var val = self.turn()
        if(val > 1) {
            self.turn(val-1)
        }
    }

    self.apiURL = function(uri) {
        return apiHost + uri
    }

    // TODO: originally, this would talk to a backend server after generating a
    // random game ID, or would retrieve a specific game ID. Instead, fetch an
    // index document and display the contents therein, or show summary stats.

    // Routes
    Sammy(function() {
        this.get('#/', function() {
            // no game id provided; add a hash of the time
            var gameId = base64.encode(new Date().toUTCString().hashCode())
            // this.app.runRoute('get', '#' + gameId) // this causes some nasty recursion
            console.log('[routing] No game id detected')
            location.hash = '/' + gameId + '/'
        })
        this.get('#/:gameId/', function() {
            console.log('[routing] displaying game: ' + this.params.gameId)
            $.getJSON(self.apiURL("/game/" + this.params.gameId), function(gameData) {
                // process gameData here
                self.renderGame(gameData)
            });
        });
    }).run();
}

$(document).ready(function() {
    $.ajaxSetup({
        origin: location.protocol + '//' + location.host,
    })
    document.viewmodel = new ChickenFootViewModel()
    ko.applyBindings(document.viewmodel);
})
});
