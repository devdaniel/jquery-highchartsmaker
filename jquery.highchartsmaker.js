/*
 * HighchartsMaker Plugin
 * Render highcharts charts by reading table data
 * Usage:
 * $(target selector).highchartsMaker($(data table selector), {options});
 */

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function isValidDate(date){
    if(new Date(date) == 'Invalid Date') {
        var matches = /^(\d{4})[-\/](\d{2})[-\/](\d{2})$/.exec(date);
        if (matches == null) return false;
        var y = matches[1];
        var m = matches[2] - 1;
        var d = matches[3];
        var composedDate = new Date(y, m, d);
        return composedDate.getDate() == d &&
                composedDate.getMonth() == m &&
                composedDate.getFullYear() == y;
    }
    return true;
};
function getValidDate(date) {
    if(isValidDate(date)) {
        var composedDate = new Date(date);
        if(composedDate == 'Invalid Date') {
            var matches = /^(\d{4})[-\/](\d{2})[-\/](\d{2})$/.exec(date);
            if (matches == null) return false;
            var y = matches[1];
            var m = matches[2] - 1;
            var d = matches[3];
            var composedDate = new Date(y, m, d);
        }
        return composedDate;
    }
    return false;
}

(function($){
    $.highchartsMaker = function(el, datatable, options){
        // To avoid scope issues, use 'base' instead of 'this'
        // to reference this class from internal events and functions.
        var base = this;

        // Access to jQuery and DOM versions of element
        base.$el = $(el);
        base.el = el;

        // Add a reverse reference to the DOM object
        base.$el.data("highchartsMaker", base);

        base.init = function(){
            if( typeof( datatable ) === "undefined" || datatable === null ) {
                console.error('source table undefined');
                return false;
            }
            base.datatable = datatable;
            base.options = $.extend({},$.highchartsMaker.defaultOptions, options);
            // initialization code
        };

        // Run initializer
        base.init();
    };

    $.fn.highchartsMaker = function(datatable, options){
        var defaultOptions = {
            title: "Untitled",
            subtitle: "",
            yAxis: {
                min: 0
            },
            date_only: false
        };
        var options = $.extend({}, defaultOptions, options);

        return this.each(function(){
            (new $.highchartsMaker(this, datatable, options));

            var iterator = 'none';
            var columns = [];
            var data = [];
            var series = [];
            var start_date = 0;
            var date_interval = 0;

            // Set up the series names
            datatable.children('thead').children('tr').children('th').each(function(index) {
                columns.push($(this).html());
                data.push(new Array());
            });

            // Set up the series data
            var last_date;
            datatable.children('tbody').children('tr').each(function(row) {
                $(this).children('td').each(function(col) {
                    if(row == 0 && col == 0) {
                        // Check the first column for date type?
                        if(isValidDate($(this).html())) {
                            iterator = 'date';
                            start_date = getValidDate($(this).html()).valueOf();
                        }
                    }
                    if(row == 1 && col == 0) {
                        // If table is date-based, figure out interval between first and second row.
                        // We will assume this is the regular interval per table row.
                        if(iterator == 'date') {
                            var point_next = getValidDate($(this).html());
                            date_interval = Math.abs(point_next - start_date);
                        }
                    }
                    if(row > 1 && col == 0) {
                        /* Starting on row 3 for date-iterated tables,
                         * Fill in gaps in dates with nulls, so chart will insert blank spaces
                         */
                        if(iterator == 'date') {
                            var colcount = columns.length-1; // Don't count date as column
                            var point_next = getValidDate($(this).html());
                            var gap = Math.floor(point_next - last_date)-1;
                            if(gap > date_interval) {
                                // Missing rows, find out how many
                                var missing_rows = Math.floor(gap/date_interval);
                                // Fill in each column with null * missing row count
                                for(var c = 1; c <= colcount; c++) { // Col count starts @ 1
                                    for(var r = 0; r < missing_rows; r++) {
                                        data[c].push(null);
                                    }
                                }
                            }
                        }
                    }
                    if(iterator == 'date' && col == 0) {
                        // Keep track of last date processed so we know how big gaps are
                        last_date = getValidDate($(this).html());
                    }
                    // For missing fields, use null to skip the point in chart rendering
                    var value = parseFloat($(this).html().replace(/\$|,/g,''));
                    if(isNaN(value)) {
                        data[col].push(null);
                    } else {
                        data[col].push(value);
                    }
                });
            });

            // Set up the series array
            columns.forEach(function(el, index) {
                var series_object = new Object();
                if(index == 0 && (iterator == 'date' || iterator == 'numeric')) {
                    // nothing special, just skip first
                } else {
                    series_object.name = columns[index];
                    series_object.data = data[index];
                    if(iterator == 'date') {
                        series_object.pointStart = start_date;
                        series_object.pointInterval = date_interval;
                    }
                    series.push(series_object);
                }
            });

            // Build skeleton of highcharts data object
            var now = new Date();
            var chart_options = new Object();
            chart_options.chart = new Object();
            chart_options.credits = new Object();
            chart_options.title = new Object();
            chart_options.subtitle = new Object();
            chart_options.xAxis = new Object();
            chart_options.yAxis = new Object();
            chart_options.yAxis.title = new Object();
            chart_options.plotOptions = new Object();
            chart_options.tooltip = new Object();
            // Set up the basic chart options
            chart_options.chart.renderTo = $(this).attr('id');
            chart_options.chart.type = 'line';
            chart_options.chart.zoomType = 'x';
            chart_options.credits.href='http://www.chitika.com/';
            chart_options.credits.text='Data Generated: ' + now.toString("dddd, mmmm dS, yyyy, h:MM:ss TT");
            chart_options.title.text = options.title;
            chart_options.subtitle.text = options.subtitle;
            chart_options.yAxis.min = options.yAxis.min;
            chart_options.yAxis.title.text = 'Amount';

            // Do not render labels for times when we are only dealing with dates or higher
            if(options.date_only == true) {
                chart_options.xAxis.dateTimeLabelFormats = {
                    millisecond: ' ',
                    second: ' ',
                    minute: ' ',
                    hour: ' ',
                    day: '%e. %b',
                    week: '%e. %b',
                    month: '%b \'%y',
                    year: '%Y'
                }
            } else {
                chart_options.xAxis.dateTimeLabelFormats = { day: '%b %d<!-- %H:%M:%S-->' };
            }

            // Set up date formatting options
            if(iterator == 'date') {
                chart_options.xAxis.type = 'datetime';
            }
            chart_options.tooltip = {
                formatter: function () {
                    return '<b>'+Highcharts.dateFormat('%B %d %Y', this.x)+'</b><br /><b style="color:'+this.series.color+';">'+this.series.name+'</b>: '+numberWithCommas(this.y);
                }
            };

            // Chart Type Options
            chart_options.plotOptions.line = new Object();
            chart_options.plotOptions.line.shadow = false;

            // Magic
            chart_options.series = series;

            // ERROR HANDLING
            if(chart_options.series[0].data.length == 0) {
                console.error('highchartsMaker: zero-length data, cannot render chart. Using fallback.');
                chart_options.chart.backgroundColor = '#FCC';
                chart_options.title.text = 'CHART ERROR :-(';
                chart_options.subtitle.text = 'No data to display!<br /><img src="http://images.chitika.net/logos/banner-logo.png" />';
                chart_options.credits.enabled = false;
                chart_options.series = new Array();
            }

            // DEBUGZ0R
            /*
            console.log(JSON.stringify(chart_options));
            console.log(datatable);
            console.log(columns);
            console.log(data);
            console.log('DATA LENGTH:' + data.length);
            console.log(iterator);
            console.log(JSON.stringify(series));
            console.log(start_date);
            console.log(date_interval);
            */

            var chart_created = new Highcharts.Chart(chart_options);

            // END DOING STUFF
        });
    };
})(jQuery);
