"use strict";

var RoonApi          = require("node-roon-api"),
    RoonApiTransport = require('node-roon-api-transport'),
    RoonApiImage     = require('node-roon-api-image'),
    RoonApiBrowse    = require('node-roon-api-browse'),
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
	status:          'foo',
        zones:           [],
        current_zone_id: null,
        listoffset:      0,
        list:            null,
        items:           [],
    }},
    computed: {
        zone: function () {
            return this.zones[this.current_zone_id];
        }
    },
    watch: {
        'current_zone_id': function(val, oldval) {
            roon.save_config("current_zone_id", val);
            refresh_browse();
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
        list_item: function(item) {
            refresh_browse({ item_key: item.item_key });
        },
        list_back: function() {
            refresh_browse({ pop_levels: 1 });
        },
        list_home: function() {
            refresh_browse({ pop_all: true });
        },
        list_refresh: function() {
            refresh_browse({ refresh_list: true } );
        },
        list_next_page: function() {
            load_browse(this.listoffset + 100);
        },
        list_prev_page: function() {
            load_browse(this.listoffset - 100);
        },
    }
});

function refresh_browse(opts) {
    opts = Object.assign({
        hierarchy:          "browse",
        zone_or_output_id:  v.current_zone_id,
        set_display_offset: v.listoffset,
    }, opts);

    core.services.RoonApiBrowse.browse(opts, (err, r) => {
        if (err) { console.log(err, r); return; }

        console.log(err, r);

        if (r.action == 'list') {
            v.$set("list", r.list);
            v.$set("items", []);
            var listoffset = r.list.display_offset > 0 ? r.list.display_offset : 0;
            load_browse(listoffset);

        } else if (r.action == 'message') {
            alert((r.is_error ? "ERROR: " : "") + r.message);

        } else if (r.action == 'replace_item') {
            var i = 0;
            var l = v.items;
            while (i < l.length) {
                if (l[i].item_key == opts.item_key) {
                    l.splice(i, 1, r.item);
                    break;
                }
                i++;
            }
            v.$set("items", l);

        } else if (r.action == 'remove_item') {
            var i = 0;
            var l = v.items;
            while (i < l.length) {
                if (l[i].item_key == opts.item_key) {
                    l.splice(i, 1);
                    break;
                }
                i++;
            }
            v.$set("items", l);
        }
    });
}

function load_browse(listoffset) {
    core.services.RoonApiBrowse.load({ hierarchy: "browse", offset: listoffset, set_display_offset: listoffset }, (err, r) => {
        v.$set("listoffset", listoffset);
        v.$set("items", r.items);
    });
}

var extension = roon.extension({
    extension_id:        'com.roonlabs.web.testapp',
    display_name:        'Roon API Web Test Application',
    display_version:     "1.0.0",
    publisher:           'Roon Labs, LLC',
    email:               'contact@roonlabs.com',
    required_services:   [ RoonApiBrowse, RoonApiTransport, RoonApiImage ],
    optional_services:   [ ],
    provided_services:   [ ],

    core_paired: function(core_) {
        v.current_zone_id = roon.load_config("current_zone_id");
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

        v.listoffset = 0;
        refresh_browse();
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
