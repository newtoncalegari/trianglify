// Trianglify. Made by (and copyright) @qrohlf, licensed under the GPLv3.
// Needs d3.js
//
// JSHint stuff:
/* global module, require, jsdom:true, d3:true, document:true, XMLSerializer:true, btoa:true*/
function Trianglify(options) {
    if (typeof options === 'undefined') {
        options = {};
    }
    function defaults(opt, def) {
        return (typeof opt !== 'undefined') ?  opt : def;
    }
    // defaults
    this.options = {
        cellsize: defaults(options.cellsize, 150), // zero not valid here
        bleed: defaults(options.cellsize, 150),
        cellpadding: defaults(options.cellpadding, 0.1*options.cellsize || 15),
        noiseIntensity: defaults(options.noiseIntensity, 0),
        x_gradient: defaults(options.x_gradient, Trianglify.randomColor()),
        format: defaults(options.format, "svg"),
        fillOpacity: defaults(options.fillOpacity, 1),
        strokeOpacity: defaults(options.strokeOpacity, 1)
    };

    this.options.y_gradient = options.y_gradient || this.options.x_gradient.map(function(c){return d3.rgb(c).brighter(0.5);});
}

//nodejs stuff
if (typeof module !== 'undefined' && module.exports) {
    d3 = require("d3");
    jsdom = require("jsdom");
    document = new (jsdom.level(1, "core").Document)();
    XMLSerializer = require("xmldom").XMLSerializer;
    btoa = require('btoa');
    module.exports = Trianglify;
}

Trianglify.randomColor = function() {
    var keys = Object.keys(Trianglify.colorbrewer);
    var palette = Trianglify.colorbrewer[keys[Math.floor(Math.random()*keys.length)]];
    keys = Object.keys(palette);
    var colors = palette[keys[Math.floor(Math.random()*keys.length)]];
    return colors;
};

Trianglify.prototype.generate = function(width, height) {
    return new Trianglify.Pattern(this.options, width, height);
};

Trianglify.Pattern = function(options, width, height) {
    this.options = options;
    this.width = width;
    this.height = height;
    this.polys = this.generatePolygons();
    this.svg = this.generateSVG();
    var s = new XMLSerializer();
    this.svgString = s.serializeToString(this.svg);
    this.base64 = btoa(this.svgString);
    this.dataUri = 'data:image/svg+xml;base64,' + this.base64;
    this.dataUrl = 'url('+this.dataUri+')';
};

Trianglify.Pattern.prototype.append = function() {
    document.body.appendChild(this.svg);
};

Trianglify.Pattern.gradient_2d = function (x_gradient, y_gradient, width, height) {

    return function(x, y) {
        var color_x = d3.scale.linear()
            .range(x_gradient)
            .domain(d3.range(0, width, width/x_gradient.length)); //[-bleed, width+bleed]
        var color_y = d3.scale.linear()
            .range(y_gradient)
            .domain(d3.range(0, height, height/y_gradient.length)); //[-bleed, width+bleed]
        return d3.interpolateRgb(color_x(x), color_y(y))(0.5);
    };
};

Trianglify.Pattern.prototype.generatePolygons = function () {
    var options = this.options;
    var cellsX = Math.ceil((this.width+options.bleed*2)/options.cellsize);
    var cellsY = Math.ceil((this.height+options.bleed*2)/options.cellsize);

    var vertices = d3.range(cellsX*cellsY).map(function(d) {
        // figure out which cell we are in
        var col = d % cellsX;
        var row = Math.floor(d / cellsX);
        var x = Math.round(-options.bleed + col*options.cellsize + Math.random() * (options.cellsize - options.cellpadding*2) + options.cellpadding);
        var y = Math.round(-options.bleed + row*options.cellsize + Math.random() * (options.cellsize - options.cellpadding*2) + options.cellpadding);
        // return [x*cellsize, y*cellsize];
        return [x, y]; // Populate the actual background with points
    });

    return d3.geom.voronoi().triangles(vertices);
};


Trianglify.Pattern.prototype.generateSVG = function () {
    var options = this.options;
    var color = Trianglify.Pattern.gradient_2d(options.x_gradient, options.y_gradient, this.width, this.height);

    var elem = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    var svg = d3.select(elem);

    svg.attr("width", this.width);
    svg.attr("height", this.height);
    svg.attr('xmlns', 'http://www.w3.org/2000/svg');
    var group = svg.append("g");

    if (options.noiseIntensity > 0.01) {
        var filter = svg.append("filter").attr("id", "noise");

        filter.append('feTurbulence')
            .attr('type', 'fractalNoise')
            .attr('in', 'fillPaint')
            .attr('fill', '#F00')
            .attr('baseFrequency', 0.7)
            .attr('numOctaves', '3') // See PR #23 for details about performance implications here
            .attr('stitchTiles', 'stitch');

        var transfer = filter.append('feComponentTransfer');
        transfer.append('feFuncR')
            .attr('type', 'linear')
            .attr('slope', '2')
            .attr('intercept', '-.5');
        transfer.append('feFuncG')
            .attr('type', 'linear')
            .attr('slope', '2')
            .attr('intercept', '-.5');
        transfer.append('feFuncB')
            .attr('type', 'linear')
            .attr('slope', '2')
            .attr('intercept', '-.5');

        filter.append('feColorMatrix')
            .attr('type', 'matrix')
            .attr('values', "0.3333 0.3333 0.3333 0 0 \n 0.3333 0.3333 0.3333 0 0 \n 0.3333 0.3333 0.3333 0 0 \n 0 0 0 1 0");

        svg.append("rect")
            .attr("opacity", options.noiseIntensity)
            .attr('width', '100%')
            .attr('height', '100%')
            .attr("filter", "url(#noise)");
    }

    this.polys.forEach(function(d) {
        var x = (d[0][0] + d[1][0] + d[2][0])/3;
        var y = (d[0][1] + d[1][1] + d[2][1])/3;
        var c = color(x, y);
        var g = group.append("path").attr("d", "M" + d.join("L") + "Z").attr({ fill: c, stroke: c });
        if (options.fillOpacity != 1)
            g.attr('fill-opacity', options.fillOpacity);
        if (options.strokeOpacity != 1)
            g.attr('stroke-opacity', options.strokeOpacity);
    });
    return svg.node();
};

Trianglify.Pattern.prototype.append = function() {
    document.body.appendChild(this.svg);
};

//colorbrewer palettes from http://bl.ocks.org/mbostock/5577023
Trianglify.colorbrewer = {YlGn: {
4: ["#2648B4", "#4395CE", "#2952A5", "#2139A8", "#161A94"],
}};
// I've left out the non-continuous colorbrewer scales here because they don't really look that nice as mesh
// palettes, but if you want to try them out you can grab them from http://bl.ocks.org/mbostock/5577023
