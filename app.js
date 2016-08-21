"use strict";

var RoonApi          = require("node-roon-api"),
    RoonApiTransport = require('node-roon-api-transport'),
    RoonApiImage     = require('node-roon-api-image'),
    Vue              = require('vue');

var core;
var roon = new RoonApi();

Vue.config.devtools = true; 

var vzi = Vue.extend({
    template: '<img :src="src">',
    props: [ 'zone' ],
    data: function() { return { src: '' }; },
    created: function() {
        var self = this;
        var up = function() {
            if (self.zone &&
                self.zone.now_playing &&
                self.zone.now_playing.image_key)
            {
            core.services.RoonApiImage.get_image(self.zone.now_playing.image_key,
                                                 {
                                                     width:  100,
                                                     height: 100,
                                                     scale:  'fit',
                                                 },
                                                 function(err, contenttype, img) {
                                                     self.$set('src', window.URL.createObjectURL(new Blob([ img ], { 'type': contenttype })));
                                                 });

            } else {
                self.$set('src', '');
            }
        };
        this.$watch('zone.now_playing.image_key', up);
        up();
    }
});
Vue.component('zone-image', vzi);

var v = new Vue({
    el: "#app",
    template: require('./root.html'),
    data: function() { return {
	status: 'foo',
        zones: [],
        current_zone_id: null,
    }},
    computed: {
        zone: function () {
            return this.zones[this.current_zone_id];
        }
    },
    methods: {
        transport_playpause: function() {
            core.services.RoonApiTransport.control(this.zone, 'playpause');
        },
        transport_stop: function() {
            core.services.RoonApiTransport.control(this.zone, 'stop');
        },
        transport_previous: function() {
            core.services.RoonApiTransport.control(this.zone, 'previous');
        },
        transport_next: function() {
            core.services.RoonApiTransport.control(this.zone, 'next');
        },
    }
});

var extension = roon.extension({
    extension_id:        'com.roonlabs.web.testapp',
    display_name:        'Roon API Web Test Application',
    display_version:     "1.0.0",
    publisher:           'Roon Labs, LLC',
    email:               'contact@roonlabs.com',
    required_services:   [ RoonApiTransport, RoonApiImage ],
    optional_services:   [ ],
    provided_services:   [ ],

    core_paired: function(core_) {
        core = core_;
        core.services.RoonApiTransport.subscribe_zones((response, msg) => {
            if (response == "Subscribed") {
                let zones = msg.zones.reduce((p,e) => (p[e.zone_id] = e) && p, {});
                v.$set('zones', zones);
            } else if (response == "Changed") {
                var z;
                if (msg.zones_removed) msg.zones_removed.forEach(e => delete(v.zones[e.zone_id]));
                if (msg.zones_added)   msg.zones_added  .forEach(e => v.zones[e.zone_id] = e);
                if (msg.zones_changed) msg.zones_changed.forEach(e => v.zones[e.zone_id] = e);
                v.$set('zones', v.zones);
            }
        });
        v.status = 'connected';
    },
    core_unpaired: function(core_) {
	core = undefined;
        v.status = 'disconnected';
    }
});


var go = function() {
    v.status = 'connecting';
    extension.connect("localhost:9100", () => setTimeout(go, 3000));
};
go();
